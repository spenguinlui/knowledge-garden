import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { parseNote, renderNote, type Note } from "../src/notes/index.ts";

// 全量來回：現有每一篇筆記轉成資料再轉回來，要跟原檔一個位元組都不差。
// mini 收進格式不合的新筆記時這裡會紅，那是切換到資料庫之前該修的真問題，不要放寬。

const NOTES_DIR = new URL("../../content/notes/", import.meta.url);
const files = readdirSync(NOTES_DIR).filter((name) => name.endsWith(".md")).sort();

test("content/notes 讀得到筆記（免得空對空也算過）", () => {
  assert.ok(files.length > 0);
});

for (const file of files) {
  test(`全量來回：${file}`, () => {
    const slug = file.slice(0, -".md".length);
    const bytes = readFileSync(new URL(file, NOTES_DIR));
    const text = bytes.toString("utf8");
    const note = parseNote(slug, text);
    const rendered = renderNote(note);
    assert.equal(rendered, text, `${file}：轉回 Markdown 跟原文不同`);
    assert.ok(Buffer.from(rendered).equals(bytes), `${file}：轉回 Markdown 跟原檔位元組不同`);
    assert.deepEqual(parseNote(slug, rendered), note, `${file}：轉出去再解析回來跟資料不同`);
  });
}

const BODY = ["> 原文：[example.com](https://example.com/a)", "", "## 摘要", "", "內文。", ""].join("\n");

function markdown(frontmatter: string[]): string {
  return ["---", ...frontmatter, "---", "", BODY].join("\n");
}

const FULL = [
  'title: "範例：標題"',
  "date: 2026-09-26",
  "tags: [dev, git, from/web]",
  'source_url: "https://example.com/a"',
  "source_type: article",
  "captured_at: 2026-09-26T10:00:00+0800",
];

function without(key: string): string[] {
  return FULL.filter((line) => !line.startsWith(`${key}:`));
}

test("解析出筆記資料的每個欄位", () => {
  assert.deepEqual(parseNote("sample", markdown(FULL)), {
    slug: "sample",
    title: "範例：標題",
    date: "2026-09-26",
    tags: ["dev", "git", "from/web"],
    sourceUrl: "https://example.com/a",
    sourceType: "article",
    capturedAt: "2026-09-26T10:00:00+0800",
    body: BODY,
  });
});

test("沒有 source_url 的筆記：資料裡沒有 sourceUrl，轉回去也不寫那一行", () => {
  const text = markdown(without("source_url"));
  const note = parseNote("manual", text);
  assert.equal("sourceUrl" in note, false);
  assert.equal(renderNote(note), text);
});

test("captured_at 的 +08:00 與 +0800 兩種寫法都原樣保留", () => {
  for (const capturedAt of ["2026-09-26T10:00:00+08:00", "2026-09-26T10:00:00+0800"]) {
    const text = markdown(FULL.map((line) => (line.startsWith("captured_at:") ? `captured_at: ${capturedAt}` : line)));
    const note = parseNote("sample", text);
    assert.equal(note.capturedAt, capturedAt);
    assert.equal(renderNote(note), text);
  }
});

test("標題含雙引號與反斜線：轉出去再轉回來還是同一個標題", () => {
  const note: Note = {
    slug: "quote",
    title: '他說 "C:\\temp" 不能用',
    date: "2026-09-26",
    tags: ["dev"],
    sourceType: "manual",
    capturedAt: "2026-09-26T10:00:00+0800",
    body: BODY,
  };
  const text = renderNote(note);
  assert.ok(text.includes('title: "他說 \\"C:\\\\temp\\" 不能用"\n'), text);
  assert.deepEqual(parseNote("quote", text), note);
});

// 切換後匯出的資料來自資料庫，可能有樣板寫不出來的值，renderNote 要當場擋下
const UNREADABLE: [string, Partial<Note>[], string][] = [
  ["標籤含逗號", [{ tags: ["a, b"] }], "tags"],
  ["標籤含方括號", [{ tags: ["a]"] }, { tags: ["[a"] }], "tags"],
  ["標題含換行", [{ title: "第一行\n第二行" }], "title"],
  ["來源網址含換行", [{ sourceUrl: "https://example.com/\na" }], "sourceUrl"],
];

for (const [name, patches, field] of UNREADABLE) {
  test(`樣板寫不出來的值（${name}）：renderNote 丟錯並點名 slug 與欄位`, () => {
    for (const patch of patches) {
      const note: Note = {
        slug: "bad-value",
        title: "範例",
        date: "2026-09-26",
        tags: ["dev"],
        sourceType: "manual",
        capturedAt: "2026-09-26T10:00:00+0800",
        body: BODY,
        ...patch,
      };
      assert.throws(() => renderNote(note), new RegExp(`^Error: bad-value：欄位 ${field} `), JSON.stringify(patch));
    }
  });
}

for (const key of ["title", "date", "tags", "source_type", "captured_at"]) {
  test(`少了必填欄位 ${key}：丟錯並點名欄位`, () => {
    assert.throws(() => parseNote("sample", markdown(without(key))), new RegExp(`缺少必填欄位.*${key}`));
  });
}

test("出現規格外的欄位：丟錯並點名欄位", () => {
  assert.throws(() => parseNote("sample", markdown([...FULL, "draft: true"])), /規格外的欄位.*draft/);
});
