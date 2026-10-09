import { join } from "node:path";
import pg from "pg";
import { changedSince, exportNotes, lastChangedAt } from "../notes/index.ts";
import {
  findDeploy,
  lastDoneNotesAt,
  markDone,
  markFailed,
  markIndexDone,
  markIndexFailed,
  markPending,
  type Version,
} from "./deploys.ts";
import { head } from "./git.ts";
import { deploySteps, indexStep, runStep, type Step } from "./steps.ts";

const MAX_ATTEMPTS = 3;
const GAVE_UP_MESSAGE = `❌ knowledge-garden 網站更新失敗（已重試 ${MAX_ATTEMPTS} 次），詳見 mini 的 ~/Library/Logs/kb-inbox.log`;
const INDEX_GAVE_UP_MESSAGE = `⚠️ knowledge-garden 搜尋索引更新失敗（已重試 ${MAX_ATTEMPTS} 次）。網站已更新，但這次變動的文章暫時搜不到；詳見 mini 的 ~/Library/Logs/kb-inbox.log`;

export type PublishOptions = {
  kbDir: string;
  db: pg.ClientConfig;
  notify: (message: string) => Promise<void>;
};

function log(message: string): void {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  console.log(`${stamp} ${message}`);
}

// 佈署目前的網站版本（HEAD 加上文章最後一次變動的時間）：網站與搜尋索引分開記錄、分開重試。
// 回傳目前的版本是不是已經在網站上，不受索引結果影響。
// 連不上資料庫就丟錯，由外殼當成程式異常結束處理
export async function runPublish({ kbDir, db, notify }: PublishOptions): Promise<boolean> {
  const client = new pg.Client({ ...db, connectionTimeoutMillis: 10_000 });
  await client.connect();
  try {
    const version: Version = { sha: head(kbDir), notesAt: await lastChangedAt(client) };
    let deploy = await findDeploy(client, version);
    if (deploy?.status !== "done") {
      if (deploy && deploy.attempts >= MAX_ATTEMPTS) return false;

      await markPending(client, version);
      await exportNotes(client, join(kbDir, "content/notes"));
      const failure = runSteps(kbDir, version, deploySteps());
      if (failure !== null) {
        const attempts = await markFailed(client, version, failure);
        if (attempts >= MAX_ATTEMPTS) await notify(GAVE_UP_MESSAGE);
        return false;
      }
      await markDone(client, version);
      deploy = await findDeploy(client, version);
    }

    if (deploy?.indexStatus === "done" || (deploy?.indexAttempts ?? 0) >= MAX_ATTEMPTS) return true;
    const since = await lastDoneNotesAt(client);
    const changed = since === null ? null : await changedSince(client, since);
    const failure = runSteps(kbDir, version, [indexStep(changed)]);
    if (failure === null) await markIndexDone(client, version);
    else {
      const attempts = await markIndexFailed(client, version, failure);
      if (attempts >= MAX_ATTEMPTS) await notify(INDEX_GAVE_UP_MESSAGE);
    }
    return true;
  } finally {
    await client.end();
  }
}

// 依序跑每一步，回傳失敗那一步的輸出；全部成功回傳 null
function runSteps(kbDir: string, { sha, notesAt }: Version, steps: Step[]): string | null {
  const name = `publish ${sha.slice(0, 7)} + notes ${notesAt}`;
  for (const step of steps) {
    log(`${name}: ${step.label}`);
    const { ok, output } = runStep(kbDir, step);
    if (output) console.log(output);
    if (!ok) {
      log(`${name}: ${step.label} failed`);
      return output;
    }
  }
  log(`${name}: done`);
  return null;
}
