import { join } from "node:path";
import pg from "pg";
import { changedSince, exportNotes, lastChangedAt } from "../notes/index.ts";
import { findDeploy, lastDoneNotesAt, markDone, markFailed, markPending, type Version } from "./deploys.ts";
import { head } from "./git.ts";
import { deploySteps, runStep } from "./steps.ts";

const MAX_ATTEMPTS = 3;
const GAVE_UP_MESSAGE = `❌ knowledge-garden 網站更新失敗（已重試 ${MAX_ATTEMPTS} 次），詳見 mini 的 ~/Library/Logs/kb-inbox.log`;

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

// 佈署目前的網站版本（HEAD 加上文章最後一次變動的時間）：還沒成功佈署過、也還沒失敗滿 3 次，就匯出文章、建站、佈署、
// 更新索引，任一步失敗整件記 failed，下一輪從建站重來。回傳目前的版本是不是已經在網站上。
// 連不上資料庫就丟錯，由外殼當成程式異常結束處理
export async function runPublish({ kbDir, db, notify }: PublishOptions): Promise<boolean> {
  const client = new pg.Client({ ...db, connectionTimeoutMillis: 10_000 });
  await client.connect();
  try {
    const version: Version = { sha: head(kbDir), notesAt: await lastChangedAt(client) };
    const deploy = await findDeploy(client, version);
    if (deploy?.status === "done") return true;
    if (deploy && deploy.attempts >= MAX_ATTEMPTS) return false;

    await markPending(client, version);
    const since = await lastDoneNotesAt(client);
    const changed = since === null ? null : await changedSince(client, since);
    await exportNotes(client, join(kbDir, "content/notes"));
    const failure = deployVersion(kbDir, version, changed);
    if (failure === null) {
      await markDone(client, version);
      return true;
    }
    const attempts = await markFailed(client, version, failure);
    if (attempts >= MAX_ATTEMPTS) await notify(GAVE_UP_MESSAGE);
    return false;
  } finally {
    await client.end();
  }
}

// 依序跑每一步，回傳失敗那一步的輸出；全部成功回傳 null
function deployVersion(kbDir: string, { sha, notesAt }: Version, changed: string[] | null): string | null {
  const name = `publish ${sha.slice(0, 7)} + notes ${notesAt}`;
  for (const step of deploySteps(changed)) {
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
