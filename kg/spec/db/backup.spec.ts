import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";
import pg from "pg";
import { dbConfig } from "../../src/capture/index.ts";

const script = fileURLToPath(new URL("../../../scripts/backup-db.sh", import.meta.url));
const schema = readFileSync(fileURLToPath(new URL("../../../db/schema.sql", import.meta.url)), "utf8");
const container = "knowledge-garden-db";
const root = mkdtempSync(join(tmpdir(), "backup-test-"));
const kb = join(root, "kb");
const bin = join(root, "bin");
const lineLog = join(root, "line.log");

// 筆電 compose 起的 Postgres；備份來源與還原目標都是測試自己建的 database
const adminConfig = dbConfig({
  ...process.env,
  PGDATABASE: "postgres",
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD ?? "process-inbox-test-password",
});
const sourceDb = `backup_test_${process.pid}_${Date.now()}`;
const restoreDb = `${sourceDb}_restore`;

async function sql<T extends pg.QueryResultRow>(database: string, text: string, values: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ ...adminConfig, database });
  await client.connect();
  try {
    return (await client.query<T>(text, values)).rows;
  } finally {
    await client.end();
  }
}

const day = 24 * 60 * 60 * 1000;
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dumpName = (daysAgo: number) => `knowledge_garden-${ymd(new Date(Date.now() - daysAgo * day))}.dump`;
const failMessage = "❌ knowledge-garden 每日備份失敗，詳見 mini 的 ~/Library/Logs/kb-backup.log";

before(async () => {
  await sql("postgres", `CREATE DATABASE "${sourceDb}"`);
  await sql(sourceDb, schema);
  await sql(
    sourceDb,
    `INSERT INTO capture.jobs (id, status, attempts, last_error, note_paths, commit_sha) VALUES
      ('oc-1', 'pending', 0, NULL, '{}', NULL),
      ('oc-2', 'done', 1, NULL, '{content/notes/a.md,content/notes/b.md}', 'abc123'),
      ('oc-3', 'failed', 3, $1, '{}', NULL)`,
    ["第一行\n第二行 \"雙引號\" 'single'"],
  );

  // 假的 KB_DIR：只放 LINE 的 local-env.sh
  mkdirSync(join(kb, "scripts"), { recursive: true });
  writeFileSync(
    join(kb, "scripts/local-env.sh"),
    "export LINE_CHANNEL_ACCESS_TOKEN=test-token\nexport LINE_USER_ID=test-user\n",
  );
  // 假的 curl：把 -d 的 JSON 一行一筆記下來
  mkdirSync(bin, { recursive: true });
  writeFileSync(
    join(bin, "curl"),
    `#!/bin/zsh
while (( $# > 0 )); do
  if [[ "$1" == -d ]]; then
    shift
    print -r -- "$1" >> "$LINE_LOG"
  fi
  shift
done
`,
  );
  chmodSync(join(bin, "curl"), 0o755);
});

after(async () => {
  await sql("postgres", `DROP DATABASE IF EXISTS "${restoreDb}" WITH (FORCE)`);
  await sql("postgres", `DROP DATABASE IF EXISTS "${sourceDb}" WITH (FORCE)`);
  rmSync(root, { recursive: true, force: true });
});

function runBackup(backupDir: string, dbContainer = container) {
  writeFileSync(lineLog, "");
  return spawnSync("zsh", [script], {
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      KB_DIR: kb,
      BACKUP_DIR: backupDir,
      DB_CONTAINER: dbContainer,
      DB_NAME: sourceDb,
      LINE_LOG: lineLog,
    },
    encoding: "utf8",
  });
}

function sentTexts(): string[] {
  return readFileSync(lineLog, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const body = JSON.parse(line) as { to: string; messages: { type: string; text: string }[] };
      assert.equal(body.to, "test-user");
      return body.messages[0].text;
    });
}

// 放一份修改時間在 daysAgo 天前的檔案
function seed(dir: string, name: string, daysAgo: number): string {
  writeFileSync(join(dir, name), "old backup\n");
  const at = new Date(Date.now() - daysAgo * day);
  utimesSync(join(dir, name), at, at);
  return name;
}

const listing = (dir: string) => readdirSync(dir).sort();

test("1 備份成功：只有今天的 dump、沒有 .partial，還原後 capture.jobs 跟來源一樣", async () => {
  const dir = join(root, "s1/backups");
  const result = runBackup(dir);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(listing(dir), [dumpName(0)]);
  assert.deepEqual(sentTexts(), [], "成功不發 LINE");

  await sql("postgres", `CREATE DATABASE "${restoreDb}"`);
  const restore = spawnSync(
    "docker",
    ["exec", "-i", container, "pg_restore", "--exit-on-error", "-U", "knowledge_garden", "-d", restoreDb],
    { input: readFileSync(join(dir, dumpName(0))), encoding: "utf8" },
  );
  assert.equal(restore.status, 0, restore.stderr);

  const source = await sql(sourceDb, "SELECT * FROM capture.jobs ORDER BY id");
  const restored = await sql(restoreDb, "SELECT * FROM capture.jobs ORDER BY id");
  assert.equal(restored.length, 3);
  assert.deepEqual(restored, source);
});

test("2 保留 7 天：7 天前的 dump 刪掉、6 天前的留著，不是 knowledge_garden-*.dump 的檔案不動", () => {
  const dir = join(root, "s2");
  mkdirSync(dir);
  seed(dir, dumpName(7), 7);
  const kept = [
    seed(dir, dumpName(6), 6),
    seed(dir, "rent_house-2026-01-01.dump", 30),
    seed(dir, "knowledge_garden-2026-01-01.sql", 30),
    seed(dir, "notes.txt", 30),
  ];

  const result = runBackup(dir);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(listing(dir), [...kept, dumpName(0)].sort());
});

test("3 備份失敗（容器名稱錯）：非 0 結束、沒留下半成品、舊備份都在、發一則 LINE", () => {
  const dir = join(root, "s3");
  mkdirSync(dir);
  const seeded = [seed(dir, dumpName(7), 7), seed(dir, dumpName(1), 1)];

  const result = runBackup(dir, "knowledge-garden-db-missing");
  assert.notEqual(result.status, 0);
  assert.deepEqual(listing(dir), seeded.sort(), "沒有 .partial、沒有今天的 dump、舊檔一份都沒刪");
  assert.deepEqual(sentTexts(), [failMessage]);
});
