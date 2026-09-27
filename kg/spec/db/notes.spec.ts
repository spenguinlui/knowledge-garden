import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, beforeEach, test } from "node:test";
import { exportNotes, importNotes, renderNote } from "../../src/notes/index.ts";
import { articles, createDatabase, dropDatabase, notesVersion, putNote, query, testDb, withClient } from "./harness.ts";

before(createDatabase);
after(dropDatabase);
beforeEach(async () => {
  await query("TRUNCATE notes.articles");
});

const FIXTURES = fileURLToPath(new URL("../fixtures/notes/", import.meta.url));
const CLI = fileURLToPath(new URL("../../src/notes/cli.ts", import.meta.url));
const fixtureFiles = readdirSync(FIXTURES).sort();
const scratch = mkdtempSync(join(tmpdir(), "notes-test-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

test("範例筆記讀得到（免得空對空也算過）", () => {
  assert.ok(fixtureFiles.length > 0);
});

let dirCount = 0;
function emptyDir(): string {
  const dir = join(scratch, `dir-${dirCount++}`);
  mkdirSync(dir);
  return dir;
}

// 範例筆記複製一份，再加上 extra 裡的檔案
function fixturesPlus(extra: Record<string, string>): string {
  const dir = emptyDir();
  cpSync(FIXTURES, dir, { recursive: true });
  for (const [name, text] of Object.entries(extra)) writeFileSync(join(dir, name), text);
  return dir;
}

const BLOCK_TAGS = [
  "---",
  'title: "換行寫法的標籤"',
  "date: 2026-09-27",
  "tags:",
  "  - dev",
  "  - git",
  "source_type: manual",
  "captured_at: 2026-09-27T10:00:00+0800",
  "---",
  "",
  "# 內文",
  "",
].join("\n");

test("匯出：資料夾的檔案跟資料庫一一對應，資料庫沒有的檔案（含非 .md、點開頭的檔、子資料夾）都刪掉，內容是 renderNote 的結果", async () => {
  await putNote("a");
  await putNote("b", "# b\nsecond line\n");
  const dir = emptyDir();
  writeFileSync(join(dir, "a.md"), "舊內容\n");
  writeFileSync(join(dir, "stale.md"), "# stale\n");
  writeFileSync(join(dir, ".DS_Store"), "");
  writeFileSync(join(dir, "pic.png"), "not markdown\n");
  mkdirSync(join(dir, "sub"));
  writeFileSync(join(dir, "sub/x.md"), "# x\n");

  await withClient((client) => exportNotes(client, dir));

  assert.deepEqual(readdirSync(dir).sort(), ["a.md", "b.md"]);
  const b = {
    slug: "b",
    title: "b",
    date: "2026-09-27",
    tags: ["dev"],
    sourceType: "manual",
    capturedAt: "2026-09-27T10:00:00+0800",
    body: "# b\nsecond line\n",
  };
  assert.equal(readFileSync(join(dir, "b.md"), "utf8"), renderNote(b));
});

test("匯出到還不存在的資料夾：自動建立", async () => {
  await putNote("a");
  const dir = join(emptyDir(), "content/notes");
  await withClient((client) => exportNotes(client, dir));
  assert.deepEqual(readdirSync(dir), ["a.md"]);
});

test("匯入全部範例筆記再匯出到空資料夾：檔案一樣多、每個檔案跟原檔位元組相同", async () => {
  await withClient((client) => importNotes(client, FIXTURES));
  const out = emptyDir();
  await withClient((client) => exportNotes(client, out));
  assert.deepEqual(readdirSync(out).sort(), fixtureFiles);
  for (const file of fixtureFiles) {
    assert.ok(readFileSync(join(out, file)).equals(readFileSync(join(FIXTURES, file))), `${file}：匯出後跟原檔位元組不同`);
  }
});

test("匯入時有一篇格式不合：丟錯並點名 slug，整批一筆都不寫進資料庫", async () => {
  const dir = fixturesPlus({ "zz-bad.md": "沒有 frontmatter\n" });
  await assert.rejects(
    withClient((client) => importNotes(client, dir)),
    /zz-bad：開頭不是 frontmatter/,
  );
  assert.deepEqual(await articles(), []);
});

test("匯入時有一篇匯出寫不回去（換行寫法的標籤含逗號）：當成格式不合，整批不寫", async () => {
  const dir = fixturesPlus({ "comma.md": BLOCK_TAGS.replace("  - git", '  - "a, b"') });
  await assert.rejects(
    withClient((client) => importNotes(client, dir)),
    /comma：欄位 tags/,
  );
  assert.deepEqual(await articles(), []);
});

test("匯入不要求一字不差：tags 換行寫法照樣收，匯出時統一成標準格式", async () => {
  const dir = emptyDir();
  writeFileSync(join(dir, "block.md"), BLOCK_TAGS);
  await withClient((client) => importNotes(client, dir));
  const out = emptyDir();
  await withClient((client) => exportNotes(client, out));
  assert.equal(readFileSync(join(out, "block.md"), "utf8"), BLOCK_TAGS.replace("tags:\n  - dev\n  - git", "tags: [dev, git]"));
});

test("重複匯入同樣的內容：文章最後變動時間不變（網站版本不會因此改變）；內容改了才變", async () => {
  await withClient((client) => importNotes(client, FIXTURES));
  const first = await notesVersion();
  await withClient((client) => importNotes(client, FIXTURES));
  assert.equal(await notesVersion(), first);

  const [file] = fixtureFiles;
  const dir = fixturesPlus({ [file]: `${readFileSync(join(FIXTURES, file), "utf8")}\n補一行\n` });
  await withClient((client) => importNotes(client, dir));
  assert.notEqual(await notesVersion(), first);
  const [row] = await query<{ slug: string }>(
    "SELECT slug FROM notes.articles WHERE updated_at = (SELECT max(updated_at) FROM notes.articles)",
  );
  assert.equal(`${row.slug}.md`, file);
});

// 命令列入口讀環境變數的資料庫設定（跟 kg/src/main.ts 一樣先載 .env，已經有的環境變數不會被蓋掉）
function cli(...args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], {
    env: {
      ...process.env,
      PGHOST: String(testDb.host),
      PGPORT: String(testDb.port),
      PGDATABASE: String(testDb.database),
      POSTGRES_PASSWORD: String(testDb.password),
    },
    encoding: "utf8",
  });
}

test("命令列入口：import 一個資料夾、export 到另一個資料夾，結果跟原檔位元組相同", async () => {
  const imported = cli("import", FIXTURES);
  assert.equal(imported.status, 0, imported.stderr);
  assert.match(imported.stdout, new RegExp(`${fixtureFiles.length} 篇`));
  assert.equal((await articles()).length, fixtureFiles.length);

  const out = emptyDir();
  const exported = cli("export", out);
  assert.equal(exported.status, 0, exported.stderr);
  assert.match(exported.stdout, new RegExp(`${fixtureFiles.length} 篇`));
  for (const file of fixtureFiles) {
    assert.ok(readFileSync(join(out, file)).equals(readFileSync(join(FIXTURES, file))), file);
  }
});

test("命令列入口：匯入格式不合的資料夾以非 0 結束並印出原因；參數不對印用法", () => {
  const bad = cli("import", fixturesPlus({ "zz-bad.md": "沒有 frontmatter\n" }));
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /zz-bad：開頭不是 frontmatter/);

  const usage = cli("sync");
  assert.notEqual(usage.status, 0);
  assert.match(usage.stderr, /import <資料夾>/);
});
