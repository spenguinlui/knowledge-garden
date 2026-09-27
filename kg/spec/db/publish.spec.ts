import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import {
  Case,
  type Call,
  createDatabase,
  deploys,
  dropDatabase,
  notesVersion,
  putNote,
  query,
  unreachableDb,
  url,
} from "./harness.ts";

before(createDatabase);
after(dropDatabase);
beforeEach(async () => {
  await query("TRUNCATE notes.articles, capture.jobs, publish.deploys");
});

const PLUGIN_INSTALL = { cmd: "npx", args: ["quartz", "plugin", "install"] };
const BUILD = { cmd: "npx", args: ["quartz", "build"] };
const DEPLOY = { cmd: "wrangler", args: ["pages", "deploy", "public", "--project-name=knowledge-garden", "--branch=v5"] };
const INDEX = { cmd: "index-notes.mjs", args: [] };
const INDEX_ALL = { cmd: "index-notes.mjs", args: ["--all"] };
const GAVE_UP = "❌ knowledge-garden 網站更新失敗（已重試 3 次），詳見 mini 的 ~/Library/Logs/kb-inbox.log";

const commandsOf = (calls: Call[]) => calls.map(({ cmd, args }) => ({ cmd, args }));
const commands = (c: Case) => commandsOf(c.calls());
const builds = (c: Case) => c.calls().filter((call) => call.cmd === "npx" && call.args[1] === "build").length;
const done = (commit_sha: string, notes_updated_at: string) => ({
  commit_sha,
  notes_updated_at,
  status: "done",
  attempts: 0,
  last_error: null,
});

test("佈署 1：只有文章變了（commit 沒變）：匯出、建站、佈署，索引 stdin 只列這次變動的文章，記 done", async () => {
  const c = new Case("publish-notes-changed");
  await putNote("a");
  await putNote("b");
  await c.run("no-change");
  const sha = c.git("rev-parse", "HEAD");
  assert.deepEqual(await deploys(), [done(sha, await notesVersion())]);

  await putNote("b", "# b\nupdated\n");
  await putNote("c");
  writeFileSync(join(c.repo, "content/notes/stale.md"), "# stale\n");
  const before = c.calls().length;
  await c.run("no-change");

  const round = c.calls().slice(before);
  assert.deepEqual(commandsOf(round), [PLUGIN_INSTALL, BUILD, DEPLOY, INDEX]);
  assert.ok(round.every((call) => call.head === sha), "commit 沒變");
  assert.deepEqual(round[1].notes, ["a.md", "b.md", "c.md"], "建站前已匯出：資料庫的文章都在、多的檔案刪掉");
  assert.ok(readFileSync(join(c.repo, "content/notes/b.md"), "utf8").endsWith("\n# b\nupdated\n"));
  assert.equal(round[3].stdin, "M\tcontent/notes/b.md\nM\tcontent/notes/c.md\n");
  const rows = await deploys();
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[1], done(sha, await notesVersion()));
});

test("佈署 2：只有 commit 變了：照樣佈署，索引 stdin 沒有文章", async () => {
  const c = new Case("publish-commit-changed");
  await putNote("a");
  await c.run("no-change");
  const version = await notesVersion();

  const second = c.laptopCommit({ "scripts/tool.sh": "echo site change\n" });
  const before = c.calls().length;
  await c.run("no-change");

  const round = c.calls().slice(before);
  assert.deepEqual(commandsOf(round), [PLUGIN_INSTALL, BUILD, DEPLOY, INDEX]);
  assert.ok(round.every((call) => call.head === second), "建站、佈署、索引都在新 commit 上跑");
  assert.deepEqual(round[1].notes, ["a.md"]);
  assert.equal(round[3].stdin, "");
  const rows = await deploys();
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[1], done(second, version));
});

test("佈署 2：文章與 commit 都沒變：不匯出、不建站、不佈署、不更新索引", async () => {
  const c = new Case("publish-already-done");
  await putNote("a");
  await c.run("no-change");
  assert.equal(c.calls().length, 4);

  rmSync(join(c.repo, "content/notes/a.md"));
  await c.run("no-change");
  assert.equal(c.calls().length, 4);
  assert.equal(existsSync(join(c.repo, "content/notes/a.md")), false, "沒有匯出");
  assert.deepEqual(await deploys(), [done(c.git("rev-parse", "HEAD"), await notesVersion())]);
});

test("佈署 2：沒有任何成功紀錄：索引用 --all 全量重建", async () => {
  const c = new Case("publish-first");
  await putNote("a");
  await c.run("no-change");
  assert.deepEqual(commands(c), [PLUGIN_INSTALL, BUILD, DEPLOY, INDEX_ALL]);
  assert.deepEqual(c.calls()[1].notes, ["a.md"]);
});

test("佈署 3：建站失敗：不佈署、不更新索引，記 failed、嘗試 1 次、存錯誤尾段", async () => {
  const c = new Case("publish-build-fail");
  c.failStep = "build";
  await c.run("no-change");
  assert.deepEqual(commands(c), [PLUGIN_INSTALL, BUILD]);
  const [row] = await deploys();
  assert.equal(row.commit_sha, c.git("rev-parse", "HEAD"));
  assert.equal(row.notes_updated_at, await notesVersion());
  assert.equal(row.status, "failed");
  assert.equal(row.attempts, 1);
  assert.equal(row.last_error?.length, 4000);
  assert.ok(row.last_error?.endsWith("TAIL_ERROR"));
  assert.deepEqual(c.messages, [], "第一次失敗不發 LINE");
});

test("佈署 3：佈署失敗：不更新索引，記 failed、嘗試 1 次、存錯誤尾段", async () => {
  const c = new Case("publish-deploy-fail");
  c.failStep = "deploy";
  await c.run("no-change");
  assert.deepEqual(commands(c), [PLUGIN_INSTALL, BUILD, DEPLOY]);
  const [row] = await deploys();
  assert.equal(row.status, "failed");
  assert.equal(row.attempts, 1);
  assert.ok(row.last_error?.endsWith("TAIL_ERROR"));
});

test("佈署 3：索引失敗：記 failed、嘗試 1 次、存錯誤尾段", async () => {
  const c = new Case("publish-index-fail");
  c.failStep = "index";
  await c.run("no-change");
  assert.deepEqual(commands(c), [PLUGIN_INSTALL, BUILD, DEPLOY, INDEX_ALL]);
  const [row] = await deploys();
  assert.equal(row.status, "failed");
  assert.equal(row.attempts, 1);
  assert.ok(row.last_error?.endsWith("TAIL_ERROR"));
});

test("佈署 3：同一個網站版本連續失敗：每輪重試，第 3 次失敗發一則 LINE，第 4 輪不再重試；文章變了、commit 變了都算新版本，照常重試", async () => {
  const c = new Case("publish-gave-up");
  c.failStep = "build";
  await putNote("a");
  const stuck = { sha: c.git("rev-parse", "HEAD"), notes: await notesVersion() };

  await c.run("no-change");
  await c.run("no-change");
  assert.equal(builds(c), 2);
  assert.deepEqual(c.messages, []);

  await c.run("no-change");
  assert.equal(builds(c), 3);
  assert.deepEqual(c.messages, [GAVE_UP]);

  await c.run("no-change");
  assert.equal(builds(c), 3, "第 4 輪不再建站");
  assert.deepEqual(c.messages, [GAVE_UP]);
  const [row] = await deploys();
  assert.deepEqual([row.commit_sha, row.notes_updated_at, row.status, row.attempts], [stuck.sha, stuck.notes, "failed", 3]);

  await putNote("b");
  await c.run("no-change");
  assert.equal(builds(c), 4, "文章變了：新版本照常建站");
  const notesChanged = (await deploys())[1];
  assert.deepEqual(
    [notesChanged.commit_sha, notesChanged.notes_updated_at, notesChanged.status, notesChanged.attempts],
    [stuck.sha, await notesVersion(), "failed", 1],
  );

  c.failStep = "";
  const fresh = c.laptopCommit({ "scripts/fixed.sh": "echo fixed\n" });
  await c.run("no-change");
  assert.equal(builds(c), 5, "commit 變了：新版本照常建站");
  const rows = await deploys();
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[2], done(fresh, await notesVersion()));
  assert.deepEqual(c.messages, [GAVE_UP]);
});

test("6 inbox 是空的、GitHub 上有筆電 push 的新 commit：這一輪 pull 下來並佈署", async () => {
  const c = new Case("publish-laptop-push");
  const laptop = c.laptopCommit({ "scripts/from-laptop.sh": "echo from laptop\n" });
  await c.run("no-change");
  assert.equal(c.git("rev-parse", "HEAD"), laptop);
  const deploy = c.calls().find((call) => call.cmd === "wrangler");
  assert.equal(deploy?.head, laptop);
  assert.deepEqual(await deploys(), [done(laptop, await notesVersion())]);
  assert.equal(c.claudeCalls(), 0);
  assert.deepEqual(c.messages, []);
});

test("7 同一輪有收錄：文章寫進資料庫之後才佈署，建站看得到新文章，網址 200 才發「已上花園」", async () => {
  const c = new Case("publish-with-capture");
  c.seedInbox();
  await c.run("new");
  const build = c.calls().find((call) => call.cmd === "npx" && call.args[1] === "build");
  assert.deepEqual(build?.notes, ["new-note.md"]);
  assert.deepEqual(await deploys(), [done(c.git("rev-parse", "HEAD"), await notesVersion())]);
  assert.deepEqual(c.messages, [`🌱 已上花園\n\n新增：\n${url("new-note")}`]);
  assert.ok(c.polled.includes(url("new-note")));
});

test("7 同一輪有收錄但佈署失敗：發「網站更新失敗，下一輪會自動重試」加網址，不發「已上花園」、不輪詢", async () => {
  const c = new Case("publish-with-capture-fail");
  c.failStep = "deploy";
  c.seedInbox();
  await c.run("new");
  assert.deepEqual(c.messages, [`🌱 已收錄，網站更新失敗，下一輪會自動重試：\n${url("new-note")}`]);
  assert.deepEqual(c.polled, []);
});

test("publish 連不上資料庫：丟錯，不建站", async () => {
  const c = new Case("publish-db-unavailable");
  await assert.rejects(c.run("no-change", unreachableDb));
  assert.deepEqual(c.calls(), []);
});

test("pull 失敗：丟錯，不收錄、不建站", async () => {
  const c = new Case("publish-pull-fail");
  c.seedInbox();
  rmSync(c.remote, { recursive: true, force: true });
  await assert.rejects(c.run("new"));
  assert.equal(c.claudeCalls(), 0);
  assert.deepEqual(c.calls(), []);
});
