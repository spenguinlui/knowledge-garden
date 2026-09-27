import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { exportNotes, readChanges, saveNotes, type Note } from "../notes/index.ts";
import { runClaude } from "./claude.ts";
import { markDone, markFailed, pendingJobs, registerJob } from "./jobs.ts";
import { gaveUpMessage } from "./messages.ts";
import { afterFailure } from "./rules.ts";

export type CaptureOptions = {
  kbDir: string;
  db: pg.ClientConfig;
  notify: (message: string) => Promise<void>;
};

// 這輪收錄寫進資料庫的文章 slug
export type CapturedNotes = { added: string[]; updated: string[] };

type Changes = { added: Note[]; updated: Note[] };

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

// 跑一輪收錄：消化 inbox → 每個項目先匯出文章、跑 claude /capture、把新增與修改的文章寫進資料庫，
// 回傳這輪新增／更新的文章。連不上資料庫或寫入失敗就丟錯，由外殼當成程式異常結束處理
export async function runCapture(options: CaptureOptions): Promise<CapturedNotes> {
  const ids = inboxIds(options.kbDir);
  if (ids.length === 0) return NOTHING;

  const client = new pg.Client({ ...options.db, connectionTimeoutMillis: 10_000 });
  await client.connect();
  try {
    for (const id of ids) await registerJob(client, id);
    return await captureAll(client, options);
  } finally {
    await client.end();
  }
}

async function captureAll(client: pg.Client, { kbDir, notify }: CaptureOptions): Promise<CapturedNotes> {
  const notesDir = join(kbDir, "content/notes");
  const added: string[] = [];
  const updated: string[] = [];
  for (const job of await pendingJobs(client)) {
    if (!inboxIds(kbDir).includes(job.id)) continue;

    log(`processing ${job.id}`);
    // 每個項目都從資料庫重新匯出：claude 看得到最新的文章，上一個項目失敗留下的檔案也清掉
    const exported = await exportNotes(client, notesDir);
    const { ok, output } = runClaude(kbDir, job.id);
    if (output) console.log(output);
    const outcome = ok ? noteChanges(notesDir, exported) : { error: output };
    if ("error" in outcome) {
      const next = afterFailure(job.attempts);
      await markFailed(client, job.id, next, outcome.error);
      if (next.status === "failed") await notify(gaveUpMessage(job.id));
      continue;
    }

    await saveCaptured(client, job.id, outcome);
    // rm 而非 git rm：小柳三世寫的 inbox 檔未被 git 追蹤
    rmInbox(kbDir, job.id);
    added.push(...outcome.added.map((note) => note.slug));
    updated.push(...outcome.updated.map((note) => note.slug));
  }
  return { added, updated };
}

// claude 改了哪些文章；有一篇格式不合，整個項目就算失敗，錯誤訊息點名 slug 與原因
function noteChanges(notesDir: string, exported: Map<string, string>): Changes | { error: string } {
  try {
    return readChanges(notesDir, exported);
  } catch (error) {
    const message = `筆記格式不合：${error instanceof Error ? error.message : String(error)}`;
    log(message);
    return { error: message };
  }
}

// 這個項目的文章變動與任務 done 寫在同一個交易，不會有文章進了資料庫、任務卻還是 pending
async function saveCaptured(client: pg.Client, id: string, changes: Changes): Promise<void> {
  const notes = [...changes.added, ...changes.updated];
  await client.query("BEGIN");
  try {
    await saveNotes(client, notes);
    await markDone(client, id, notes.map((note) => note.slug));
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

function rmInbox(kbDir: string, id: string): void {
  for (const ext of [".json", ".jpg"]) rmSync(join(kbDir, "inbox", `${id}${ext}`), { force: true });
}
