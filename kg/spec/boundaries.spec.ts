import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const depcruise = fileURLToPath(new URL("../node_modules/.bin/depcruise", import.meta.url));
const config = fileURLToPath(new URL("../.dependency-cruiser.cjs", import.meta.url));

// 在範例目錄裡跑跟 `npm test` 同一套設定，回傳違反到的規則名稱
function violatedRules(fixture: string, dirs = ["src"]): string[] {
  const cwd = fileURLToPath(new URL(`fixtures/${fixture}/`, import.meta.url));
  const result = spawnSync(depcruise, [...dirs, "--config", config, "--output-type", "json"], {
    cwd,
    encoding: "utf8",
  });
  assert.ok(result.stdout, `depcruise 沒有輸出：${result.stderr}`);
  const report = JSON.parse(result.stdout) as {
    summary: { violations: { rule: { name: string } }[] };
  };
  return report.summary.violations.map((violation) => violation.rule.name);
}

test("乾淨的範例沒有違規", () => {
  assert.deepEqual(violatedRules("clean"), []);
});

test("no-circular：模組內循環依賴", () => {
  assert.ok(violatedRules("no-circular").includes("no-circular"));
});

test("feature-entrance-only：import 別的模組的內部檔案", () => {
  assert.ok(violatedRules("feature-entrance-only").includes("feature-entrance-only"));
});

test("shared-no-feature：shared import 功能模組", () => {
  assert.ok(violatedRules("shared-no-feature").includes("shared-no-feature"));
});

test("capture-publish-apart：capture import publish、publish import capture 兩個方向都被擋", () => {
  assert.deepEqual(violatedRules("capture-publish-apart"), ["capture-publish-apart", "capture-publish-apart"]);
});

test("no-upstream：src import 上一層的 quartz/", () => {
  assert.ok(violatedRules("no-upstream/kg").includes("no-upstream"));
});

test("no-upstream：quartz-plugins import 上一層的 quartz/", () => {
  assert.ok(violatedRules("no-upstream/kg", ["quartz-plugins"]).includes("no-upstream"));
});

test("notes-pure：notes import pg、node:fs、node:child_process 三個都被擋", () => {
  assert.deepEqual(violatedRules("notes-pure"), ["notes-pure", "notes-pure", "notes-pure"]);
});
