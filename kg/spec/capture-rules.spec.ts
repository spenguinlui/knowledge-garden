import assert from "node:assert/strict";
import { test } from "node:test";
import { afterFailure, errorTail, MAX_SLUG_LENGTH, noteUrl } from "../src/capture/rules.ts";
import { gaveUpMessage, publishedMessage, siteUpdateFailedMessage, stillBuildingMessage } from "../src/capture/messages.ts";

test("筆記 slug 最長 56 個字元", () => {
  assert.equal(MAX_SLUG_LENGTH, 56);
});

test("失敗後的下一個狀態：未滿 3 次維持 pending", () => {
  assert.deepEqual(afterFailure(0), { attempts: 1, status: "pending" });
  assert.deepEqual(afterFailure(1), { attempts: 2, status: "pending" });
});

test("失敗後的下一個狀態：第 3 次變 failed", () => {
  assert.deepEqual(afterFailure(2), { attempts: 3, status: "failed" });
});

test("錯誤輸出只留尾段 4000 字", () => {
  const tail = errorTail(`${"x".repeat(4100)}TAIL_ERROR`);
  assert.equal(tail.length, 4000);
  assert.ok(tail.endsWith("TAIL_ERROR"));
  assert.equal(errorTail("short"), "short");
});

test("筆記 slug 轉網址", () => {
  assert.equal(noteUrl("new-note"), "https://knowledge.wayne-liu.com/notes/new-note");
});

test("上線訊息：新增在前、更新在後", () => {
  assert.equal(
    publishedMessage(["new-note"], ["existing-note"]),
    "🌱 已上花園\n\n新增：\nhttps://knowledge.wayne-liu.com/notes/new-note\n\n更新：\nhttps://knowledge.wayne-liu.com/notes/existing-note",
  );
});

test("上線訊息：沒有更新就沒有「更新：」組", () => {
  assert.equal(
    publishedMessage(["new-note"], []),
    "🌱 已上花園\n\n新增：\nhttps://knowledge.wayne-liu.com/notes/new-note",
  );
  assert.equal(
    publishedMessage([], ["existing-note"]),
    "🌱 已上花園\n\n更新：\nhttps://knowledge.wayne-liu.com/notes/existing-note",
  );
});

test("站台還在建的訊息附全部網址", () => {
  assert.equal(
    stillBuildingMessage(["a", "b"]),
    "🌱 已收錄，站台還在建，請稍後再開：\nhttps://knowledge.wayne-liu.com/notes/a\nhttps://knowledge.wayne-liu.com/notes/b",
  );
});

test("網站更新失敗訊息說明會重試三次", () => {
  assert.equal(
    siteUpdateFailedMessage(["a", "b"]),
    "🌱 已收錄，但網站更新失敗。會再重試，連續失敗 3 次會另外通知：\nhttps://knowledge.wayne-liu.com/notes/a\nhttps://knowledge.wayne-liu.com/notes/b",
  );
});

test("重試用完的訊息", () => {
  assert.equal(gaveUpMessage("item"), "❌ 收錄失敗（已重試 3 次，不再重試）：item");
});
