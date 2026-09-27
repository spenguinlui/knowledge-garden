CREATE SCHEMA IF NOT EXISTS capture;

CREATE TABLE IF NOT EXISTS capture.jobs (
  id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'done', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  note_paths text[] NOT NULL DEFAULT '{}',
  commit_sha text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
