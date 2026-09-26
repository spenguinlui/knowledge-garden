import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { runClaude } from "./claude.ts";
import { commitContent, noteChanges, pull, push } from "./git.ts";
import { markDone, markFailed, pendingJobs, registerJob } from "./jobs.ts";
import {
  DB_UNAVAILABLE_MESSAGE,
  DB_WRITE_FAILED_MESSAGE,
  PUSH_FAILED_MESSAGE,
  gaveUpMessage,
  publishedMessage,
  stillBuildingMessage,
} from "./messages.ts";
import { afterFailure, noteUrl, splitNoteChanges } from "./rules.ts";

const DEPLOY_POLL_INTERVAL_SECONDS = 15;
const DEPLOY_WAIT_TIMEOUT_SECONDS = 300;

export type CaptureOptions = {
  kbDir: string;
  db: pg.ClientConfig;
  notify: (message: string) => Promise<void>;
  statusOf: (url: string) => Promise<number | null>;
  sleep: (seconds: number) => Promise<void>;
};

function log(message: string): void {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  console.log(`${stamp} ${message}`);
}

function inboxIds(kbDir: string): string[] {
  return readdirSync(join(kbDir, "inbox"))
    .filter((name) => name.endsWith(".json") && !name.startsWith("."))
    .sort()
    .map((name) => name.slice(0, -".json".length));
}

// 跑一輪收錄：消化 inbox → claude /capture 寫筆記 → commit + push → 等網址上線後發 LINE
export async function runCapture(options: CaptureOptions): Promise<void> {
  const { kbDir, db, notify } = options;
  const ids = inboxIds(kbDir);
  if (ids.length === 0) return;

  const client = new pg.Client({ ...db, connectionTimeoutMillis: 10_000 });
  try {
    await client.connect();
  } catch (error) {
    log(`Postgres unavailable: ${String(error)}`);
    await notify(DB_UNAVAILABLE_MESSAGE);
    return;
  }

  let added: string[];
  let updated: string[];
  try {
    pull(kbDir);
    try {
      for (const id of ids) await registerJob(client, id);
    } catch (error) {
      log(`failed to register capture job: ${String(error)}`);
      await notify(DB_WRITE_FAILED_MESSAGE);
      return;
    }
    ({ added, updated } = await captureAll(client, options));
  } finally {
    await client.end();
  }

  if (!push(kbDir)) {
    await notify(PUSH_FAILED_MESSAGE);
    return;
  }

  const notes = [...added, ...updated];
  if (notes.length === 0) return;
  const ready = await waitUntilPublished(notes, options);
  await notify(ready ? publishedMessage(added, updated) : stillBuildingMessage(notes));
}

async function captureAll(client: pg.Client, { kbDir, notify }: CaptureOptions): Promise<{ added: string[]; updated: string[] }> {
  const added: string[] = [];
  const updated: string[] = [];
  for (const job of await pendingJobs(client)) {
    if (!inboxIds(kbDir).includes(job.id)) continue;

    log(`processing ${job.id}`);
    const { ok, output } = runClaude(kbDir, job.id);
    if (output) console.log(output);
    if (!ok) {
      const next = afterFailure(job.attempts);
      await markFailed(client, job.id, next, output);
      if (next.status === "failed") await notify(gaveUpMessage(job.id));
      continue;
    }

    // rm 而非 git rm：小柳三世寫的 inbox 檔未被 git 追蹤
    rmInbox(kbDir, job.id);
    const sha = commitContent(kbDir, job.id);
    const changes = sha ? splitNoteChanges(noteChanges(kbDir, sha)) : { added: [], updated: [] };
    added.push(...changes.added);
    updated.push(...changes.updated);
    await markDone(client, job.id, sha, [...changes.added, ...changes.updated]);
  }
  return { added, updated };
}

function rmInbox(kbDir: string, id: string): void {
  for (const ext of [".json", ".jpg"]) rmSync(join(kbDir, "inbox", `${id}${ext}`), { force: true });
}

// push 後立刻查一次，之後每隔固定秒數再查，整批共用同一個上限
async function waitUntilPublished(notes: string[], { statusOf, sleep }: CaptureOptions): Promise<boolean> {
  const rounds = Math.floor(DEPLOY_WAIT_TIMEOUT_SECONDS / DEPLOY_POLL_INTERVAL_SECONDS);
  for (let round = 0; round <= rounds; round++) {
    let ready = true;
    for (const note of notes) {
      if ((await statusOf(noteUrl(note))) !== 200) ready = false;
    }
    if (ready) return true;
    if (round < rounds) await sleep(DEPLOY_POLL_INTERVAL_SECONDS);
  }
  return false;
}
