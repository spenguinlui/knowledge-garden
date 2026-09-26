import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { Case, createDatabase, dropDatabase, jobs, query, testDb, unreachableDb, url } from "./harness.ts";

before(createDatabase);
after(dropDatabase);
beforeEach(async () => {
  await query("TRUNCATE capture.jobs, publish.deploys");
});

test("1 新增一篇：有「新增：」組和正確網址，沒有「更新：」組", async () => {
  const c = new Case("new");
  c.seedInbox();
  await c.run("new");
  assert.equal(c.messages.length, 1);
  assert.match(c.messages[0], /新增：/);
  assert.ok(c.messages[0].includes(url("new-note")));
  assert.doesNotMatch(c.messages[0], /更新：/);
});

test("2 更新既有一篇：只有「更新：」組", async () => {
  const c = new Case("update");
  c.seedExistingNote();
  c.seedInbox();
  await c.run("update");
  assert.equal(c.messages.length, 1);
  assert.match(c.messages[0], /更新：/);
  assert.ok(c.messages[0].includes(url("existing-note")));
  assert.doesNotMatch(c.messages[0], /新增：/);
});

test("3 同一輪有新增也有更新：兩組分開、新增在前，任務記下兩篇", async () => {
  const c = new Case("both");
  c.seedExistingNote();
  c.seedInbox();
  await c.run("both");
  assert.equal(c.messages.length, 1);
  assert.ok(c.messages[0].includes(`新增：\n${url("new-note")}\n\n更新：\n${url("existing-note")}`));
  const [job] = await jobs();
  assert.deepEqual([...job.note_paths].sort(), ["content/notes/existing-note.md", "content/notes/new-note.md"]);
});

test("4 網址一直不是 200：發站台還在建的訊息，有輪詢、有等待", async () => {
  const c = new Case("timeout");
  c.seedInbox();
  await c.run("timeout");
  assert.equal(c.messages.length, 1);
  assert.ok(c.messages[0].startsWith("🌱 已收錄，站台還在建，請稍後再開："));
  assert.ok(c.messages[0].includes(url("slow-note")));
  assert.ok(c.polled.includes(url("slow-note")));
  assert.ok(c.polled.length > 1);
  assert.ok(c.sleeps.length > 0);
});

test("5 git push 失敗：只發 push 失敗告警", async () => {
  const c = new Case("push-fail");
  c.rejectPushes();
  c.seedInbox();
  await c.run("push-fail");
  assert.deepEqual(c.messages, ["❌ knowledge-garden push 失敗，筆記卡在 mini 本機"]);
});

test("6 claude 沒改任何東西：不發 LINE、不輪詢，任務 done 且沒有筆記路徑與 commit", async () => {
  const c = new Case("no-change");
  c.seedInbox();
  await c.run("no-change");
  assert.deepEqual(c.messages, []);
  assert.deepEqual(c.polled, []);
  const [job] = await jobs();
  assert.equal(job.status, "done");
  assert.deepEqual(job.note_paths, []);
  assert.equal(job.commit_sha, null);
});

test("7 收錄成功：任務 done、commit 只動 content/、inbox 檔案已刪", async () => {
  const c = new Case("success");
  c.seedInbox();
  await c.run("new");
  const [job] = await jobs();
  assert.equal(job.status, "done");
  assert.equal(job.attempts, 0);
  assert.equal(job.commit_sha, c.git("rev-parse", "HEAD"));
  assert.deepEqual(job.note_paths, ["content/notes/new-note.md"]);
  assert.equal(c.git("show", "--name-only", "--format=", "HEAD"), "content/notes/new-note.md");
  assert.equal(existsSync(join(c.repo, "inbox/item.json")), false);
});

test("8 claude 失敗一次：pending、嘗試 1 次、存錯誤尾段，不 commit、inbox 保留", async () => {
  const c = new Case("one-failure");
  c.seedInbox();
  const commitsBefore = c.commitCount();
  await c.run("fail");
  const [job] = await jobs();
  assert.equal(job.status, "pending");
  assert.equal(job.attempts, 1);
  assert.equal(job.last_error?.length, 4000);
  assert.ok(job.last_error?.endsWith("TAIL_ERROR"));
  assert.equal(c.commitCount(), commitsBefore);
  assert.equal(existsSync(join(c.repo, "inbox/item.json")), true);
});

test("9 連續失敗四輪：第 3 輪後 failed 並告警，第 4 輪不呼叫 claude", async () => {
  const c = new Case("three-failures");
  c.seedInbox();
  for (let round = 0; round < 4; round++) await c.run("fail");
  const [job] = await jobs();
  assert.equal(job.status, "failed");
  assert.equal(job.attempts, 3);
  assert.deepEqual(c.messages, ["❌ 收錄失敗（已重試 3 次，不再重試）：item"]);
  assert.equal(c.claudeCalls(), 3);
});

test("10 同一個 inbox 檔跑兩輪才成功：任務表只有一列", async () => {
  const c = new Case("retry-once");
  c.seedInbox();
  await c.run("retry-once");
  await c.run("retry-once");
  const all = await jobs();
  assert.equal(all.length, 1);
  assert.equal(all[0].status, "done");
  assert.equal(all[0].attempts, 1);
  assert.deepEqual(all[0].note_paths, ["content/notes/retried-note.md"]);
});

test("11 DB 連不上：整輪丟錯、不發 LINE（交給外殼發一次異常結束），inbox 不動、沒有 commit、不呼叫 claude", async () => {
  const c = new Case("db-unavailable");
  c.seedInbox();
  const commitsBefore = c.commitCount();
  await assert.rejects(c.run("new", unreachableDb), /ECONNREFUSED/);
  assert.deepEqual(c.messages, []);
  assert.equal(existsSync(join(c.repo, "inbox/item.json")), true);
  assert.equal(c.commitCount(), commitsBefore);
  assert.equal(c.claudeCalls(), 0);
  assert.deepEqual(c.calls(), [], "丟錯後不建站");
});

test("11 登記任務寫入失敗：整輪丟錯、不發 LINE，inbox 不動、不呼叫 claude", async () => {
  const c = new Case("db-write-failed");
  c.seedInbox();
  // 連得上、但沒有 capture.jobs 表的資料庫
  await assert.rejects(c.run("new", { ...testDb, database: "postgres" }), /capture\.jobs/);
  assert.deepEqual(c.messages, []);
  assert.equal(existsSync(join(c.repo, "inbox/item.json")), true);
  assert.equal(c.claudeCalls(), 0);
  assert.deepEqual(c.calls(), [], "丟錯後不建站");
});

test("11 DB 連不上但 inbox 是空的：不發任何訊息（佈署連不上資料庫，整輪丟錯）", async () => {
  const c = new Case("db-unavailable-empty");
  await assert.rejects(c.run("new", unreachableDb));
  assert.deepEqual(c.messages, []);
});
