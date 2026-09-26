import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { after, before, beforeEach, test } from "node:test";
import { Case, createDatabase, deploys, dropDatabase, query, unreachableDb, url } from "./harness.ts";

before(createDatabase);
after(dropDatabase);
beforeEach(async () => {
  await query("TRUNCATE capture.jobs, publish.deploys");
});

const PLUGIN_INSTALL = { cmd: "npx", args: ["quartz", "plugin", "install"] };
const BUILD = { cmd: "npx", args: ["quartz", "build"] };
const DEPLOY = { cmd: "wrangler", args: ["pages", "deploy", "public", "--project-name=knowledge-garden", "--branch=v5"] };
const GAVE_UP = "❌ knowledge-garden 網站更新失敗（已重試 3 次），詳見 mini 的 ~/Library/Logs/kb-inbox.log";

const commands = (c: Case) => c.calls().map(({ cmd, args }) => ({ cmd, args }));
const builds = (c: Case) => c.calls().filter((call) => call.cmd === "npx" && call.args[1] === "build").length;

test("1 有新 commit 還沒佈署過：依序建站、佈署、更新索引，索引吃上次佈署到 HEAD 的筆記變動，記 done", async () => {
  const c = new Case("publish-incremental");
  const first = c.laptopCommit({
    "content/notes/existing-note.md": "# existing\n",
    "content/notes/gone-note.md": "# gone\n",
  });
  await c.run("no-change");
  assert.deepEqual(await deploys(), [{ commit_sha: first, status: "done", attempts: 0, last_error: null }]);

  const second = c.laptopCommit({
    "content/notes/a.md": "# a\n",
    "content/notes/existing-note.md": "# existing\nupdated\n",
    "content/notes/gone-note.md": null,
    "content/notes/pic.png": "not markdown\n",
    "scripts/tool.sh": "echo not content\n",
  });
  const before = c.calls().length;
  await c.run("no-change");

  const round = c.calls().slice(before);
  assert.deepEqual(
    round.map(({ cmd, args }) => ({ cmd, args })),
    [PLUGIN_INSTALL, BUILD, DEPLOY, { cmd: "index-notes.mjs", args: [] }],
  );
  assert.ok(round.every((call) => call.head === second), "建站、佈署、索引都在新 commit 上跑");
  assert.equal(
    round[3].stdin?.trimEnd(),
    ["A\tcontent/notes/a.md", "M\tcontent/notes/existing-note.md", "D\tcontent/notes/gone-note.md"].join("\n"),
  );
  const rows = await deploys();
  assert.deepEqual(rows[1], { commit_sha: second, status: "done", attempts: 0, last_error: null });
});

test("2 HEAD 已經佈署過：不建站、不佈署、不更新索引", async () => {
  const c = new Case("publish-already-done");
  await c.run("no-change");
  assert.equal(c.calls().length, 4);

  await c.run("no-change");
  assert.equal(c.calls().length, 4);
  assert.deepEqual(await deploys(), [{ commit_sha: c.git("rev-parse", "HEAD"), status: "done", attempts: 0, last_error: null }]);
});

test("3 從來沒有成功佈署紀錄：索引用 --all 全量重建", async () => {
  const c = new Case("publish-first");
  await c.run("no-change");
  assert.deepEqual(commands(c), [PLUGIN_INSTALL, BUILD, DEPLOY, { cmd: "index-notes.mjs", args: ["--all"] }]);
});

test("3 上次成功佈署的 commit 已不在歷史裡：索引用 --all 全量重建", async () => {
  const c = new Case("publish-missing-last");
  await query("INSERT INTO publish.deploys (commit_sha, status) VALUES ('0123456789abcdef0123456789abcdef01234567', 'done')");
  await c.run("no-change");
  assert.deepEqual(c.calls().at(-1)?.args, ["--all"]);
});

test("4 建站失敗：不佈署、不更新索引，記 failed、嘗試 1 次、存錯誤尾段", async () => {
  const c = new Case("publish-build-fail");
  c.failStep = "build";
  await c.run("no-change");
  assert.deepEqual(commands(c), [PLUGIN_INSTALL, BUILD]);
  const [row] = await deploys();
  assert.equal(row.commit_sha, c.git("rev-parse", "HEAD"));
  assert.equal(row.status, "failed");
  assert.equal(row.attempts, 1);
  assert.equal(row.last_error?.length, 4000);
  assert.ok(row.last_error?.endsWith("TAIL_ERROR"));
  assert.deepEqual(c.messages, [], "第一次失敗不發 LINE");
});

test("4 佈署失敗：不更新索引，記 failed、嘗試 1 次、存錯誤尾段", async () => {
  const c = new Case("publish-deploy-fail");
  c.failStep = "deploy";
  await c.run("no-change");
  assert.deepEqual(commands(c), [PLUGIN_INSTALL, BUILD, DEPLOY]);
  const [row] = await deploys();
  assert.equal(row.status, "failed");
  assert.equal(row.attempts, 1);
  assert.ok(row.last_error?.endsWith("TAIL_ERROR"));
});

test("4 索引失敗：記 failed、嘗試 1 次、存錯誤尾段", async () => {
  const c = new Case("publish-index-fail");
  c.failStep = "index";
  await c.run("no-change");
  assert.deepEqual(commands(c), [PLUGIN_INSTALL, BUILD, DEPLOY, { cmd: "index-notes.mjs", args: ["--all"] }]);
  const [row] = await deploys();
  assert.equal(row.status, "failed");
  assert.equal(row.attempts, 1);
  assert.ok(row.last_error?.endsWith("TAIL_ERROR"));
});

test("5 同一個 commit 連續失敗：每輪重試，第 3 次失敗發一則 LINE，第 4 輪不再重試；出現新 commit 照常重試", async () => {
  const c = new Case("publish-gave-up");
  c.failStep = "build";
  const stuck = c.git("rev-parse", "HEAD");

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
  assert.deepEqual([row.commit_sha, row.status, row.attempts], [stuck, "failed", 3]);

  c.failStep = "";
  const fresh = c.laptopCommit({ "content/notes/fixed.md": "# fixed\n" });
  await c.run("no-change");
  assert.equal(builds(c), 4, "新 commit 照常建站");
  const rows = await deploys();
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[1], { commit_sha: fresh, status: "done", attempts: 0, last_error: null });
  assert.deepEqual(c.messages, [GAVE_UP]);
});

test("6 inbox 是空的、GitHub 上有筆電 push 的新 commit：這一輪 pull 下來並佈署", async () => {
  const c = new Case("publish-laptop-push");
  const laptop = c.laptopCommit({ "content/notes/from-laptop.md": "# from laptop\n" });
  await c.run("no-change");
  assert.equal(c.git("rev-parse", "HEAD"), laptop);
  const deploy = c.calls().find((call) => call.cmd === "wrangler");
  assert.equal(deploy?.head, laptop);
  assert.deepEqual(await deploys(), [{ commit_sha: laptop, status: "done", attempts: 0, last_error: null }]);
  assert.equal(c.claudeCalls(), 0);
  assert.deepEqual(c.messages, []);
});

test("7 同一輪有收錄：筆記 commit、push 之後才佈署，網址 200 才發「已上花園」", async () => {
  const c = new Case("publish-with-capture");
  c.seedInbox();
  await c.run("new");
  const head = c.git("rev-parse", "HEAD");
  const deploy = c.calls().find((call) => call.cmd === "wrangler");
  assert.equal(deploy?.head, head, "佈署的是收錄產生的 commit");
  assert.equal(deploy?.originHead, head, "佈署前已經 push");
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
