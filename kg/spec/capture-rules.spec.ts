import assert from "node:assert/strict";
import { test } from "node:test";
import { afterFailure, errorTail, noteUrl, splitNoteChanges } from "../src/capture/rules.ts";
import { gaveUpMessage, publishedMessage, stillBuildingMessage } from "../src/capture/messages.ts";

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

test("分新增與更新：只認 A 與 M", () => {
  const nameStatus = [
    "A\tcontent/notes/new-note.md",
    "M\tcontent/notes/existing-note.md",
    "D\tcontent/notes/gone.md",
    "R100\tcontent/notes/old.md\tcontent/notes/renamed.md",
    "",
  ].join("\n");
  assert.deepEqual(splitNoteChanges(nameStatus), {
    added: ["content/notes/new-note.md"],
    updated: ["content/notes/existing-note.md"],
  });
  assert.deepEqual(splitNoteChanges(""), { added: [], updated: [] });
});

test("筆記路徑轉網址", () => {
  assert.equal(noteUrl("content/notes/new-note.md"), "https://knowledge.wayne-liu.com/notes/new-note");
});

test("上線訊息：新增在前、更新在後", () => {
  assert.equal(
    publishedMessage(["content/notes/new-note.md"], ["content/notes/existing-note.md"]),
    "🌱 已上花園\n\n新增：\nhttps://knowledge.wayne-liu.com/notes/new-note\n\n更新：\nhttps://knowledge.wayne-liu.com/notes/existing-note",
  );
});

test("上線訊息：沒有更新就沒有「更新：」組", () => {
  assert.equal(
    publishedMessage(["content/notes/new-note.md"], []),
    "🌱 已上花園\n\n新增：\nhttps://knowledge.wayne-liu.com/notes/new-note",
  );
  assert.equal(
    publishedMessage([], ["content/notes/existing-note.md"]),
    "🌱 已上花園\n\n更新：\nhttps://knowledge.wayne-liu.com/notes/existing-note",
  );
});

test("站台還在建的訊息附全部網址", () => {
  assert.equal(
    stillBuildingMessage(["content/notes/a.md", "content/notes/b.md"]),
    "🌱 已收錄，站台還在建，請稍後再開：\nhttps://knowledge.wayne-liu.com/notes/a\nhttps://knowledge.wayne-liu.com/notes/b",
  );
});

test("重試用完的訊息", () => {
  assert.equal(gaveUpMessage("item"), "❌ 收錄失敗（已重試 3 次，不再重試）：item");
});
