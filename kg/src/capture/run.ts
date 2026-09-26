import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { runClaude } from "./claude.ts";
import { commitContent, noteChanges, push } from "./git.ts";
import { markDone, markFailed, pendingJobs, registerJob } from "./jobs.ts";
import { PUSH_FAILED_MESSAGE, gaveUpMessage } from "./messages.ts";
import { afterFailure, splitNoteChanges } from "./rules.ts";

export type CaptureOptions = {
  kbDir: string;
  db: pg.ClientConfig;
  notify: (message: string) => Promise<void>;
};

// 這輪收錄後 push 上去的筆記路徑
export type CapturedNotes = { added: string[]; updated: string[] };

const NOTHING: CapturedNotes = { added: [], updated: [] };

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

// 跑一輪收錄：消化 inbox → claude /capture 寫筆記 → commit + push，回傳 push 上去的新增／更新筆記。
// 連不上資料庫或寫入失敗就丟錯，由外殼當成程式異常結束處理
export async function runCapture(options: CaptureOptions): Promise<CapturedNotes> {
  const { kbDir, db, notify } = options;
  const ids = inboxIds(kbDir);
  if (ids.length === 0) return NOTHING;

  const client = new pg.Client({ ...db, connectionTimeoutMillis: 10_000 });
  await client.connect();

  let notes: CapturedNotes;
  try {
    for (const id of ids) await registerJob(client, id);
    notes = await captureAll(client, options);
  } finally {
    await client.end();
  }

  if (!push(kbDir)) {
    await notify(PUSH_FAILED_MESSAGE);
    return NOTHING;
  }
  return notes;
}

async function captureAll(client: pg.Client, { kbDir, notify }: CaptureOptions): Promise<CapturedNotes> {
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
