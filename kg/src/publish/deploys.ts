import type pg from "pg";

const ERROR_TAIL_LENGTH = 4000;

// 一個網站版本：程式碼的 commit 加上文章最後一次變動的時間（資料庫的文字格式，原樣存回去才比對得上）
export type Version = { sha: string; notesAt: string };

// 佈署紀錄表 publish.deploys 的讀寫，一個網站版本一列
export async function findDeploy(client: pg.Client, { sha, notesAt }: Version): Promise<{ status: string; attempts: number } | undefined> {
  const result = await client.query<{ status: string; attempts: number }>(
    "SELECT status, attempts FROM publish.deploys WHERE commit_sha = $1 AND notes_updated_at = $2",
    [sha, notesAt],
  );
  return result.rows[0];
}

// 最後一個成功佈署的版本的文章時間；增量更新索引從這之後變動的文章算起
export async function lastDoneNotesAt(client: pg.Client): Promise<string | null> {
  const result = await client.query<{ notes_updated_at: string }>(
    "SELECT notes_updated_at::text AS notes_updated_at FROM publish.deploys WHERE status = 'done' ORDER BY updated_at DESC LIMIT 1",
  );
  return result.rows[0]?.notes_updated_at ?? null;
}

export async function markPending(client: pg.Client, { sha, notesAt }: Version): Promise<void> {
  await client.query(
    `INSERT INTO publish.deploys (commit_sha, notes_updated_at) VALUES ($1, $2)
     ON CONFLICT (commit_sha, notes_updated_at) DO UPDATE SET status = 'pending', updated_at = now()`,
    [sha, notesAt],
  );
}

export async function markDone(client: pg.Client, { sha, notesAt }: Version): Promise<void> {
  await client.query(
    `UPDATE publish.deploys SET status = 'done', last_error = NULL, updated_at = now()
      WHERE commit_sha = $1 AND notes_updated_at = $2`,
    [sha, notesAt],
  );
}

// 記一次失敗，回傳累計的嘗試次數
export async function markFailed(client: pg.Client, { sha, notesAt }: Version, output: string): Promise<number> {
  const result = await client.query<{ attempts: number }>(
    `UPDATE publish.deploys
        SET status = 'failed', attempts = attempts + 1, last_error = $3, updated_at = now()
      WHERE commit_sha = $1 AND notes_updated_at = $2
      RETURNING attempts`,
    [sha, notesAt, output.slice(-ERROR_TAIL_LENGTH)],
  );
  return result.rows[0].attempts;
}
