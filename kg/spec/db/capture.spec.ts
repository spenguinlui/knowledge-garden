import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import {
  Case,
  articles,
  createDatabase,
  dropDatabase,
  jobs,
  putNote,
  query,
  testDb,
  unreachableDb,
  url,
} from "./harness.ts";

before(createDatabase);
after(dropDatabase);
beforeEach(async () => {
  await query("TRUNCATE notes.articles, capture.jobs, publish.deploys");
});

const GAVE_UP = "❌ 收錄失敗（已重試 3 次，不再重試）：item";

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
  await putNote("existing-note");
  c.seedInbox();
  await c.run("update");
  assert.equal(c.messages.length, 1);
  assert.match(c.messages[0], /更新：/);
  assert.ok(c.messages[0].includes(url("existing-note")));
  assert.doesNotMatch(c.messages[0], /新增：/);
});

test("收錄 1：先匯出再跑 claude，新增與修改的兩篇寫進資料庫、任務 done 記下兩篇；沒有 commit、沒有 push；LINE 分新增／更新兩組", async () => {
  const c = new Case("both");
  await putNote("existing-note");
  c.seedInbox();
  const commits = c.commitCount();
  const remote = c.remoteHead();
  await c.run("both");

  assert.deepEqual(c.claudeSaw(), [["existing-note.md"]], "跑 claude 之前資料庫的文章已經匯出");
  const rows = await articles();
  assert.deepEqual(
    rows.map(({ slug, body }) => ({ slug, body })),
    [
      { slug: "existing-note", body: "# existing-note\nupdated\n" },
      { slug: "new-note", body: "# new-note\n" },
    ],
  );
  const [job] = await jobs();
  assert.equal(job.status, "done");
  assert.deepEqual([...job.note_slugs].sort(), ["existing-note", "new-note"]);
  assert.equal(c.commitCount(), commits, "沒有 commit");
  assert.equal(c.remoteHead(), remote, "沒有 push");
  assert.deepEqual(c.messages, [`🌱 已上花園\n\n新增：\n${url("new-note")}\n\n更新：\n${url("existing-note")}`]);
});

test("收錄 2：claude 寫出格式不合的筆記：資料庫不變（同一次寫的合格筆記也不收），任務記一次失敗、錯誤點名 slug 與原因，inbox 保留", async () => {
  const c = new Case("bad-note");
  c.seedInbox();
  await c.run("bad");
  assert.deepEqual(await articles(), []);
  const [job] = await jobs();
  assert.equal(job.status, "pending");
  assert.equal(job.attempts, 1);
  assert.match(job.last_error ?? "", /bad-note：開頭不是 frontmatter/);
  assert.deepEqual(job.note_slugs, []);
  assert.equal(existsSync(join(c.repo, "inbox/item.json")), true);
  assert.deepEqual(c.messages, []);
});

test("收錄 2：格式不合連續四輪：第 3 輪後 failed 並告警，第 4 輪不呼叫 claude", async () => {
  const c = new Case("bad-note-gave-up");
  c.seedInbox();
  for (let round = 0; round < 4; round++) await c.run("bad");
  const [job] = await jobs();
  assert.equal(job.status, "failed");
  assert.equal(job.attempts, 3);
  assert.deepEqual(c.messages, [GAVE_UP]);
  assert.equal(c.claudeCalls(), 3);
  assert.deepEqual(await articles(), []);
});

test("收錄 2：讀得進來但匯出時寫不回去的值（多行寫法的標籤含逗號）也算格式不合", async () => {
  const c = new Case("unwritable");
  c.seedInbox();
  await c.run("unwritable");
  assert.deepEqual(await articles(), []);
  const [job] = await jobs();
  assert.equal(job.attempts, 1);
  assert.match(job.last_error ?? "", /comma-tag：欄位 tags/);
});

test("格式小差異照收：tags 用換行寫法照樣寫進資料庫，匯出時統一成標準格式", async () => {
  const c = new Case("block-tags");
  c.seedInbox();
  await c.run("block-tags");
  const [row] = await articles();
  assert.deepEqual([row.slug, row.tags], ["block-tags", ["dev", "git"]]);
  const exported = readFileSync(join(c.repo, "content/notes/block-tags.md"), "utf8");
  assert.match(exported, /^tags: \[dev, git\]$/m);
});

test("收錄 3：claude 刪掉一個檔案：資料庫不刪那篇，下次匯出就回來", async () => {
  const c = new Case("delete");
  await putNote("existing-note");
  c.seedInbox();
  await c.run("delete");
  assert.deepEqual(
    (await articles()).map((row) => row.slug),
    ["existing-note"],
  );
  const [job] = await jobs();
  assert.equal(job.status, "done");
  assert.deepEqual(job.note_slugs, []);
  assert.deepEqual(c.messages, []);
  const build = c.calls().find((call) => call.cmd === "npx" && call.args[1] === "build");
  assert.deepEqual(build?.notes, ["existing-note.md"], "建站前的匯出把它寫回來");
});

test("同一輪兩個 inbox 項目：第一個寫出格式不合的筆記，第二個跑之前重新匯出、看不到第一個留下的檔案，照常收錄", async () => {
  const c = new Case("two-items");
  c.seedInbox("item-a");
  c.seedInbox("item-b");
  await c.run("first-bad");
  assert.deepEqual(c.claudeSaw(), [[], []]);
  const [first, second] = await jobs();
  assert.deepEqual([first.id, first.status, first.attempts], ["item-a", "pending", 1]);
  assert.deepEqual([second.id, second.status, second.note_slugs], ["item-b", "done", ["new-note"]]);
  assert.deepEqual(
    (await articles()).map((row) => row.slug),
    ["new-note"],
  );
  assert.deepEqual(c.messages, [`🌱 已上花園\n\n新增：\n${url("new-note")}`]);
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

test("6 claude 沒改任何東西：不發 LINE、不輪詢，任務 done 且沒有筆記", async () => {
  const c = new Case("no-change");
  c.seedInbox();
  await c.run("no-change");
  assert.deepEqual(c.messages, []);
  assert.deepEqual(c.polled, []);
  const [job] = await jobs();
  assert.equal(job.status, "done");
  assert.deepEqual(job.note_slugs, []);
});

test("7 收錄成功：任務 done、文章寫進資料庫、inbox 檔案已刪", async () => {
  const c = new Case("success");
  c.seedInbox();
  await c.run("new");
  const [job] = await jobs();
  assert.equal(job.status, "done");
  assert.equal(job.attempts, 0);
  assert.deepEqual(job.note_slugs, ["new-note"]);
  assert.deepEqual(
    (await articles()).map((row) => row.slug),
    ["new-note"],
  );
  assert.equal(existsSync(join(c.repo, "inbox/item.json")), false);
});

test("8 claude 失敗一次：pending、嘗試 1 次、存錯誤尾段，它寫了一半的筆記不進資料庫、inbox 保留", async () => {
  const c = new Case("one-failure");
  c.seedInbox();
  await c.run("fail");
  const [job] = await jobs();
  assert.equal(job.status, "pending");
  assert.equal(job.attempts, 1);
  assert.equal(job.last_error?.length, 4000);
  assert.ok(job.last_error?.endsWith("TAIL_ERROR"));
  assert.deepEqual(await articles(), []);
  assert.equal(existsSync(join(c.repo, "inbox/item.json")), true);
});

test("9 連續失敗四輪：第 3 輪後 failed 並告警，第 4 輪不呼叫 claude", async () => {
  const c = new Case("three-failures");
  c.seedInbox();
  for (let round = 0; round < 4; round++) await c.run("fail");
  const [job] = await jobs();
  assert.equal(job.status, "failed");
  assert.equal(job.attempts, 3);
  assert.deepEqual(c.messages, [GAVE_UP]);
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
  assert.deepEqual(all[0].note_slugs, ["retried-note"]);
});

test("11 DB 連不上：整輪丟錯、不發 LINE（交給外殼發一次異常結束），inbox 不動、不呼叫 claude", async () => {
  const c = new Case("db-unavailable");
  c.seedInbox();
  await assert.rejects(c.run("new", unreachableDb), /ECONNREFUSED/);
  assert.deepEqual(c.messages, []);
  assert.equal(existsSync(join(c.repo, "inbox/item.json")), true);
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
