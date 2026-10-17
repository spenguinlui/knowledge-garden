import { renderNote } from "../notes/index.ts";

export function validateTags(value: unknown, mainCategories: string[]): string | null {
  if (!Array.isArray(value) || value.length === 0) return "tags 必須是非空陣列";
  if (value.length > 10) return "標籤最多 10 個";
  if (!value.every((tag) => typeof tag === "string")) return "每個標籤都必須是文字";
  const tags = value as string[];
  if (new Set(tags).size !== tags.length) return "標籤不能重複";
  if (tags.some((tag) => tag.length === 0 || /[\s,'"#\[\]]/.test(tag))) {
    return "標籤不能是空字串，也不能含空白、逗號、引號、# 或方括號";
  }
  if (!mainCategories.includes(tags[0])) return "第一個標籤必須是既有主分類";

  const sources = tags.filter((tag) => tag.startsWith("from/"));
  if (sources.length > 1) return "來源標籤最多一個";
  if (sources.length === 1 && tags.at(-1) !== sources[0]) return "來源標籤必須放在最後";
  if (tags.some((tag) => tag.includes("/") && !/^from\/[^/]+$/.test(tag))) {
    return "斜線只能用在 from/<名字> 來源標籤";
  }
  if (tags.some((tag) => tag.startsWith("-"))) return "標籤含有筆記格式不支援的寫法";
  try {
    renderNote({
      slug: "tag-validation",
      title: "",
      date: "x",
      tags,
      sourceType: "x",
      capturedAt: "x",
      body: "",
    });
  } catch {
    return "標籤含有筆記格式不支援的寫法";
  }
  return null;
}
