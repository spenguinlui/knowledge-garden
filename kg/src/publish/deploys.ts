import type pg from "pg";

const ERROR_TAIL_LENGTH = 4000;

// 佈署紀錄表 publish.deploys 的讀寫，一個 commit 一列
export async function findDeploy(client: pg.Client, sha: string): Promise<{ status: string; attempts: number } | undefined> {
  const result = await client.query<{ status: string; attempts: number }>(
    "SELECT status, attempts FROM publish.deploys WHERE commit_sha = $1",
    [sha],
  );
  return result.rows[0];
}

// 最後一個成功佈署的 commit；增量更新索引從這裡算起
export async function lastDone(client: pg.Client): Promise<string | null> {
  const result = await client.query<{ commit_sha: string }>(
    "SELECT commit_sha FROM publish.deploys WHERE status = 'done' ORDER BY updated_at DESC LIMIT 1",
  );
  return result.rows[0]?.commit_sha ?? null;
}

export async function markPending(client: pg.Client, sha: string): Promise<void> {
  await client.query(
    `INSERT INTO publish.deploys (commit_sha) VALUES ($1)
     ON CONFLICT (commit_sha) DO UPDATE SET status = 'pending', updated_at = now()`,
    [sha],
  );
}

export async function markDone(client: pg.Client, sha: string): Promise<void> {
  await client.query(
    "UPDATE publish.deploys SET status = 'done', last_error = NULL, updated_at = now() WHERE commit_sha = $1",
    [sha],
  );
}

// 記一次失敗，回傳累計的嘗試次數
export async function markFailed(client: pg.Client, sha: string, output: string): Promise<number> {
  const result = await client.query<{ attempts: number }>(
    `UPDATE publish.deploys
        SET status = 'failed', attempts = attempts + 1, last_error = $2, updated_at = now()
      WHERE commit_sha = $1
      RETURNING attempts`,
    [sha, output.slice(-ERROR_TAIL_LENGTH)],
  );
  return result.rows[0].attempts;
}
