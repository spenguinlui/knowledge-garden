import type pg from "pg";
import { MAX_FAILS, errorTail } from "./rules.ts";

// 收錄任務表 capture.jobs 的讀寫
export async function registerJob(client: pg.Client, id: string): Promise<void> {
  await client.query("INSERT INTO capture.jobs (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [id]);
}

export async function pendingJobs(client: pg.Client): Promise<{ id: string; attempts: number }[]> {
  const result = await client.query<{ id: string; attempts: number }>(
    "SELECT id, attempts FROM capture.jobs WHERE status = 'pending' AND attempts < $1 ORDER BY created_at, id",
    [MAX_FAILS],
  );
  return result.rows;
}

export async function markDone(client: pg.Client, id: string, noteSlugs: string[]): Promise<void> {
  await client.query(
    `UPDATE capture.jobs
        SET status = 'done', note_slugs = $2, last_error = NULL, updated_at = now()
      WHERE id = $1`,
    [id, noteSlugs],
  );
}

export async function markFailed(
  client: pg.Client,
  id: string,
  next: { attempts: number; status: "pending" | "failed" },
  output: string,
): Promise<void> {
  await client.query(
    `UPDATE capture.jobs
        SET attempts = $2, status = $3, last_error = $4, updated_at = now()
      WHERE id = $1`,
    [id, next.attempts, next.status, errorTail(output)],
  );
}
