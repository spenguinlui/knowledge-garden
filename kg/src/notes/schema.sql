CREATE SCHEMA IF NOT EXISTS notes;

-- 文章正本，一篇一列；欄位對應 Note。date、captured_at 存原字串，才能一字不差轉回 Markdown
CREATE TABLE IF NOT EXISTS notes.articles (
  slug text PRIMARY KEY,
  title text NOT NULL,
  date text NOT NULL,
  tags text[] NOT NULL,
  source_url text,
  source_type text NOT NULL,
  captured_at text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
