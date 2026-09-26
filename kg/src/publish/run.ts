import pg from "pg";
import { findDeploy, lastDone, markDone, markFailed, markPending } from "./deploys.ts";
import { commitExists, contentChanges, head } from "./git.ts";
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

// 佈署 HEAD：還沒成功佈署過、也還沒失敗滿 3 次，就建站、佈署、更新索引，任一步失敗整件記 failed，下一輪從建站重來。
// 回傳 HEAD 現在是不是已經在網站上。連不上資料庫就丟錯，由外殼當成程式異常結束處理
export async function runPublish({ kbDir, db, notify }: PublishOptions): Promise<boolean> {
  const client = new pg.Client({ ...db, connectionTimeoutMillis: 10_000 });
  await client.connect();
  try {
    const sha = head(kbDir);
    const deploy = await findDeploy(client, sha);
    if (deploy?.status === "done") return true;
    if (deploy && deploy.attempts >= MAX_ATTEMPTS) return false;

    await markPending(client, sha);
    const since = await lastDone(client);
    const changes = since !== null && commitExists(kbDir, since) ? contentChanges(kbDir, since, sha) : null;
    const failure = deployCommit(kbDir, sha, changes);
    if (failure === null) {
      await markDone(client, sha);
      return true;
    }
    const attempts = await markFailed(client, sha, failure);
    if (attempts >= MAX_ATTEMPTS) await notify(GAVE_UP_MESSAGE);
    return false;
  } finally {
    await client.end();
  }
}

// 依序跑每一步，回傳失敗那一步的輸出；全部成功回傳 null
function deployCommit(kbDir: string, sha: string, changes: string | null): string | null {
  const name = `publish ${sha.slice(0, 7)}`;
  for (const step of deploySteps(changes)) {
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
