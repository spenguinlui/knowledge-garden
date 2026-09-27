import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type pg from "pg";
import { allNotes, saveNotes } from "./articles.ts";
import { parseNote, renderNote, type Note } from "./markdown/note.ts";

const EXT = ".md";

// 匯出：資料庫的全部文章寫成 <slug>.md，資料庫沒有的東西（其他檔案、子資料夾）刪掉，資料夾跟資料庫一模一樣。
// 先全部轉好再動資料夾，轉不出來就丟錯、資料夾不動。回傳每篇寫出去的內容（slug → Markdown）
export async function exportNotes(client: pg.Client, dir: string): Promise<Map<string, string>> {
  const texts = new Map((await allNotes(client)).map((note) => [note.slug, renderNote(note)]));
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(dir)) {
    if (!(name.endsWith(EXT) && texts.has(name.slice(0, -EXT.length)))) {
      rmSync(join(dir, name), { recursive: true, force: true });
    }
  }
  for (const [slug, text] of texts) writeFileSync(join(dir, `${slug}${EXT}`), text);
  return texts;
}

// 匯入：資料夾裡每個 .md 都讀，有一篇不合就丟錯，全部讀完才在同一個交易寫進資料庫
export async function importNotes(client: pg.Client, dir: string): Promise<Note[]> {
  const notes = markdownFiles(dir).map((slug) => checkedNote(slug, readFileSync(join(dir, `${slug}${EXT}`), "utf8")));
  await client.query("BEGIN");
  try {
    await saveNotes(client, notes);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  return notes;
}

// 收錄用：跟匯出時的內容比對，新檔是新增、內容變了是修改；刪掉的檔案不理會。
// 變動的檔案有一篇不合就丟錯（訊息開頭是 slug）
export function readChanges(dir: string, exported: Map<string, string>): { added: Note[]; updated: Note[] } {
  const added: Note[] = [];
  const updated: Note[] = [];
  for (const slug of markdownFiles(dir)) {
    const text = readFileSync(join(dir, `${slug}${EXT}`), "utf8");
    const before = exported.get(slug);
    if (text === before) continue;
    (before === undefined ? added : updated).push(checkedNote(slug, text));
  }
  return { added, updated };
}

// 資料夾裡 .md 檔的 slug，依字母排序
function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(EXT))
    .map((entry) => entry.name.slice(0, -EXT.length))
    .sort();
}

// 不要求轉回去一字不差，但要寫得回去：renderNote 丟錯的值收進資料庫，之後每次匯出都會失敗
function checkedNote(slug: string, text: string): Note {
  const note = parseNote(slug, text);
  renderNote(note);
  return note;
}
