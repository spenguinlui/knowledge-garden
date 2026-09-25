import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

// 前面只能是 ../ 或非路徑字元，才不會誤判 base64 圖片（quartz/util/emojimap.json）裡剛好出現的 kg/
const reference = /(^|[^A-Za-z0-9+/_.-]|\.\.\/)(kg|workers)\//;

// 回傳引用了 kg/ 或 workers/ 的「檔案:行號」
function referencesIn(dir: string): string[] {
  const hits: string[] = [];
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const file = join(entry.parentPath, entry.name);
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (reference.test(line)) hits.push(`${file}:${index + 1}`);
      });
  }
  return hits;
}

test("掃描能抓到 kg/ 與 workers/ 的引用", () => {
  const dir = fileURLToPath(new URL("fixtures/upstream-scan/quartz/", import.meta.url));
  assert.equal(referencesIn(dir).length, 2);
});

test("quartz/ 沒有引用 kg/ 或 workers/", () => {
  const dir = fileURLToPath(new URL("../../quartz/", import.meta.url));
  assert.deepEqual(referencesIn(dir), []);
});
