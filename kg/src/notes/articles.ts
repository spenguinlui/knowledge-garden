import type pg from "pg";
import type { Note } from "./markdown/note.ts";

// 文章表 notes.articles 的讀寫
type Row = {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  source_url: string | null;
  source_type: string;
  captured_at: string;
  body: string;
};

export async function allNotes(client: pg.Client): Promise<Note[]> {
  const result = await client.query<Row>(
    "SELECT slug, title, date, tags, source_url, source_type, captured_at, body FROM notes.articles ORDER BY slug",
  );
  return result.rows.map((row) => {
    const note: Note = {
      slug: row.slug,
      title: row.title,
      date: row.date,
      tags: row.tags,
      sourceType: row.source_type,
      capturedAt: row.captured_at,
      body: row.body,
    };
    if (row.source_url !== null) note.sourceUrl = row.source_url;
    return note;
  });
}

// 新增或改寫；內容跟資料庫一樣的不動，updated_at（網站版本的一部分）只在真的變了才更新。
// 不自己開交易：要跟別的寫入綁在一起的呼叫端自己 BEGIN／COMMIT
export async function saveNotes(client: pg.Client, notes: Note[]): Promise<void> {
  for (const note of notes) {
    await client.query(
      `INSERT INTO notes.articles AS a (slug, title, date, tags, source_url, source_type, captured_at, body)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title, date = EXCLUDED.date, tags = EXCLUDED.tags, source_url = EXCLUDED.source_url,
         source_type = EXCLUDED.source_type, captured_at = EXCLUDED.captured_at, body = EXCLUDED.body,
         updated_at = now()
       WHERE (a.title, a.date, a.tags, a.source_url, a.source_type, a.captured_at, a.body)
         IS DISTINCT FROM
         (EXCLUDED.title, EXCLUDED.date, EXCLUDED.tags, EXCLUDED.source_url, EXCLUDED.source_type, EXCLUDED.captured_at, EXCLUDED.body)`,
      [note.slug, note.title, note.date, note.tags, note.sourceUrl ?? null, note.sourceType, note.capturedAt, note.body],
    );
  }
}

// 文章最後一次變動的時間，網站版本的一部分；沒有文章是 -infinity。
// 回傳資料庫的文字格式而非 Date：Date 只到毫秒，拿去比對或查詢會跟微秒的 updated_at 對不上
export async function lastChangedAt(client: pg.Client): Promise<string> {
  const result = await client.query<{ at: string }>(
    "SELECT COALESCE(max(updated_at), '-infinity'::timestamptz)::text AS at FROM notes.articles",
  );
  return result.rows[0].at;
}

// since 之後變動過的文章 slug
export async function changedSince(client: pg.Client, since: string): Promise<string[]> {
  const result = await client.query<{ slug: string }>(
    "SELECT slug FROM notes.articles WHERE updated_at > $1::timestamptz ORDER BY slug",
    [since],
  );
  return result.rows.map((row) => row.slug);
}

export async function noteTags(client: pg.Client, slug: string): Promise<string[] | null> {
  const result = await client.query<{ tags: string[] }>("SELECT tags FROM notes.articles WHERE slug = $1", [slug]);
  return result.rows[0]?.tags ?? null;
}

export async function updateTags(client: pg.Client, slug: string, tags: string[]): Promise<boolean> {
  const result = await client.query(
    `UPDATE notes.articles
     SET tags = $2, updated_at = CASE WHEN tags IS DISTINCT FROM $2 THEN now() ELSE updated_at END
     WHERE slug = $1`,
    [slug, tags],
  );
  return result.rowCount === 1;
}

export async function tagCounts(client: pg.Client): Promise<Record<string, number>> {
  const result = await client.query<{ tag: string; count: string }>(
    `SELECT tag, count(*)::text AS count
     FROM notes.articles CROSS JOIN LATERAL unnest(tags) AS tag
     GROUP BY tag ORDER BY tag`,
  );
  return Object.fromEntries(result.rows.map((row) => [row.tag, Number(row.count)]));
}

export async function mainCategories(client: pg.Client): Promise<string[]> {
  const result = await client.query<{ tag: string }>(
    "SELECT DISTINCT tags[1] AS tag FROM notes.articles WHERE cardinality(tags) > 0 ORDER BY tag",
  );
  return result.rows.map((row) => row.tag);
}
