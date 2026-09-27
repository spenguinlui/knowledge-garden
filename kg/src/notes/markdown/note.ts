import { isDeepStrictEqual } from "node:util";
import { parse } from "yaml";

// 一篇筆記的資料。格式規格在 .claude/skills/capture/SKILL.md。
// date、capturedAt 存原字串：captured_at 有 +08:00 與 +0800 兩種寫法，要能原樣轉回去。
export type Note = {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  sourceUrl?: string;
  sourceType: string;
  capturedAt: string;
  body: string;
};

const OPEN = "---\n";
const CLOSE = "\n---\n";
const FIELDS = ["title", "date", "tags", "source_url", "source_type", "captured_at"];
const REQUIRED = ["title", "date", "tags", "source_type", "captured_at"];

// renderNote 讀回來要比對的欄位（slug 由呼叫端傳入，不經過 Markdown）
const NOTE_FIELDS = ["title", "date", "tags", "sourceUrl", "sourceType", "capturedAt", "body"] as const;
type NoteField = (typeof NOTE_FIELDS)[number];
// 找壞欄位用的最小合法筆記，一次只換進一個欄位
const PROBE: Note = { slug: "probe", title: "", date: "x", tags: [], sourceType: "x", capturedAt: "x", body: "" };

// 規格外的欄位、缺欄位、型別不對一律丟錯：切換時匯入要嘛全對、要嘛停下來
export function parseNote(slug: string, text: string): Note {
  if (!text.startsWith(OPEN)) throw new Error(`${slug}：開頭不是 frontmatter 的 ---`);
  const end = text.indexOf(CLOSE, OPEN.length - 1);
  if (end === -1) throw new Error(`${slug}：找不到 frontmatter 結尾的 ---`);
  const bodyStart = end + CLOSE.length;
  if (text[bodyStart] !== "\n") throw new Error(`${slug}：frontmatter 結尾的 --- 後面要空一行才接內文`);

  const fields: unknown = parse(text.slice(OPEN.length, end + 1));
  if (typeof fields !== "object" || fields === null || Array.isArray(fields)) {
    throw new Error(`${slug}：frontmatter 不是欄位清單`);
  }
  const record = fields as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!FIELDS.includes(key)) throw new Error(`${slug}：規格外的欄位 ${key}`);
  }
  for (const key of REQUIRED) {
    if (!(key in record)) throw new Error(`${slug}：缺少必填欄位 ${key}`);
  }

  const tags = record.tags;
  if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === "string")) {
    throw new Error(`${slug}：欄位 tags 必須是字串陣列`);
  }
  const note: Note = {
    slug,
    title: stringField(slug, record, "title"),
    date: stringField(slug, record, "date"),
    tags,
    sourceType: stringField(slug, record, "source_type"),
    capturedAt: stringField(slug, record, "captured_at"),
    body: text.slice(bodyStart + 1),
  };
  if ("source_url" in record) note.sourceUrl = stringField(slug, record, "source_url");
  return note;
}

// 寫完自己讀回來比對：樣板寫不出來的值（含逗號的標籤、含換行的標題⋯⋯）當場丟錯，
// 不產出讀回來會變樣的 Markdown
export function renderNote(note: Note): string {
  const text = fillTemplate(note);
  let back: Note;
  try {
    back = parseNote(note.slug, text);
  } catch (error) {
    // YAML 語法壞掉時，錯誤位置不一定在壞的那一行，所以把欄位一個一個換進最小合法筆記，找出讀不回來的那個
    const field = NOTE_FIELDS.find((key) => !readsBack({ ...PROBE, [key]: note[key] }, key));
    throw new Error(`${note.slug}：欄位 ${field ?? "（無法單獨重現）"} 寫成 Markdown 之後讀不回來`, { cause: error });
  }
  const field = NOTE_FIELDS.find((key) => !isDeepStrictEqual(back[key], note[key]));
  if (field !== undefined) throw new Error(`${note.slug}：欄位 ${field} 寫成 Markdown 之後讀回來變了樣`);
  return text;
}

function readsBack(note: Note, key: NoteField): boolean {
  try {
    return isDeepStrictEqual(parseNote(note.slug, fillTemplate(note))[key], note[key]);
  } catch {
    return false;
  }
}

// 固定樣板照規格的欄位順序與引號寫，不用 YAML 函式庫輸出（格式跟現有筆記不同，無法逐位元組一致）
function fillTemplate(note: Note): string {
  const lines = [
    "---",
    `title: ${quote(note.title)}`,
    `date: ${note.date}`,
    `tags: [${note.tags.join(", ")}]`,
    ...(note.sourceUrl === undefined ? [] : [`source_url: ${quote(note.sourceUrl)}`]),
    `source_type: ${note.sourceType}`,
    `captured_at: ${note.capturedAt}`,
    "---",
    "",
    note.body,
  ];
  return lines.join("\n");
}

function stringField(slug: string, record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") throw new Error(`${slug}：欄位 ${key} 必須是字串`);
  return value;
}

// YAML 雙引號字串的跳脫：雙引號與反斜線前面加反斜線
function quote(value: string): string {
  return `"${value.replace(/["\\]/g, "\\$&")}"`;
}
