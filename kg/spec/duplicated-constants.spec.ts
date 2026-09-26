import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// 這幾組常數各有好幾份，放在 YAML、Worker 設定、瀏覽器端函式裡，沒辦法 import 同一個來源，
// 所以讀檔案原文比對。抓不到值就直接失敗，免得格式一改測試就默默變成空對空。

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

function pick(path: string, pattern: RegExp): string {
  const match = source(path).match(pattern);
  assert.ok(match?.[1], `${path} 找不到 ${pattern}`);
  return match[1];
}

test("站台網址：capture 的 SITE、quartz.config.yaml 的 baseUrl、Worker 的 SITE_BASE 一致", () => {
  const site = pick("kg/src/capture/rules.ts", /^const SITE = "([^"]+)"/m);
  const baseUrl = pick("quartz.config.yaml", /^\s+baseUrl:\s*"?([^"\s]+)"?\s*$/m);
  const siteBase = pick("workers/kb-search/wrangler.toml", /^SITE_BASE = "([^"]+)"/m);
  assert.equal(`https://${baseUrl}`, site);
  assert.equal(siteBase, site);
});

test("九大主分類：quartz.ts 的 MAIN 與 capture skill 的主分類表同一組、同一順序", () => {
  const main = JSON.parse(pick("quartz.ts", /const MAIN = (\[[^\]]*\])/)) as string[];
  const table = pick(".claude/skills/capture/SKILL.md", /\| 主分類 \| 涵蓋範圍 \|\n\|---\|---\|\n((?:\|.*\n)+)/);
  const skill = [...table.matchAll(/^\| `([^`]+)` \|/gm)].map((row) => row[1]);
  assert.equal(main.length, 9);
  assert.deepEqual(skill, main);
});

test("向量模型：index-notes.mjs 的 MODEL 與 Worker 呼叫的模型一致", () => {
  const indexer = pick("scripts/index-notes.mjs", /^const MODEL = "([^"]+)"/m);
  const worker = pick("workers/kb-search/src/index.ts", /env\.AI\.run\("([^"]+)"/);
  assert.equal(worker, indexer);
});

test("向量索引：index-notes.mjs 的 INDEX 與 wrangler.toml 的 index_name 一致", () => {
  const indexer = pick("scripts/index-notes.mjs", /^const INDEX = "([^"]+)"/m);
  const worker = pick("workers/kb-search/wrangler.toml", /^index_name = "([^"]+)"/m);
  assert.equal(worker, indexer);
});
