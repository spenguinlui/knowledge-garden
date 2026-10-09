CREATE SCHEMA IF NOT EXISTS publish;

-- 一個網站版本一列：程式碼的 commit 加上文章最後一次變動的時間（notes.articles 最大的 updated_at，沒有文章是 -infinity）
CREATE TABLE IF NOT EXISTS publish.deploys (
  commit_sha text NOT NULL,
  notes_updated_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'done', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  index_status text NOT NULL DEFAULT 'pending'
    CHECK (index_status IN ('pending', 'done', 'failed')),
  index_attempts integer NOT NULL DEFAULT 0 CHECK (index_attempts >= 0),
  index_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (commit_sha, notes_updated_at)
);
