import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

// 歸屬檢查：每個程式檔都要落在 ARCHITECTURE.md 模組表某一列的路徑底下，表上的路徑也都要存在。
// 路徑以 / 結尾是資料夾（底下全部算），其他是單一檔案。
const PROGRAM = /\.(ts|tsx|js|mjs|cjs|sh|sql|plist|scss)$/;

const quoted = (text: string) => [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
const under = (file: string, path: string) => (path.endsWith("/") ? file.startsWith(path) : file === path);

// `## 模組` 表格每一列「路徑」欄裡用反引號包起來的路徑，其他欄位的反引號不算
function tablePaths(architecture: string): string[] {
  const table = architecture.match(/^## 模組\n+((?:\|.*(?:\n|$))+)/m)?.[1];
  assert.ok(table, "ARCHITECTURE.md 找不到「## 模組」表格");
  const [header, , ...rows] = table
    .trim()
    .split("\n")
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
  const column = header.indexOf("路徑");
  assert.ok(column >= 0, "模組表找不到「路徑」欄");
  return rows.flatMap((row) => quoted(row[column]));
}

// 「歸屬檢查：」那一行「不檢查：」之後用反引號包起來的路徑
function skippedPaths(architecture: string): string[] {
  const line = architecture.match(/^歸屬檢查：.*不檢查：(.*)$/m)?.[1];
  assert.ok(line, "ARCHITECTURE.md 找不到「歸屬檢查：⋯⋯不檢查：」那一行");
  return quoted(line);
}

// files 是 repo 裡所有檔案（相對根目錄），回傳違規說明；沒有違規回傳空陣列
function ownershipProblems(architecture: string, files: string[]): string[] {
  const owned = tablePaths(architecture);
  const skipped = skippedPaths(architecture);
  const orphans = files
    .filter((file) => PROGRAM.test(file))
    .filter((file) => !skipped.some((path) => under(file, path)))
    .filter((file) => !owned.some((path) => under(file, path)))
    .map((file) => `沒有落在模組表任何一列：${file}`);
  const missing = owned
    .filter((path) => !files.some((file) => under(file, path)))
    .map((path) => `模組表寫了但不存在：${path}`);
  return [...orphans, ...missing];
}

const sample = `# 範例

歸屬檢查：\`kg/spec/ownership.spec.ts\` 讀下面的表。不檢查：\`kg/spec/\`、\`quartz/\`、\`globals.d.ts\`

## 模組
| 模組 | 路徑 | 職責（一句話） |
|---|---|---|
| capture | \`kg/src/capture/\` | 呼叫 \`scripts/not-a-path.mjs\` |
| 外殼 | \`kg/src/main.ts\`、\`compose.yaml\` | — |
`;

const sampleFiles = ["kg/src/capture/run.ts", "kg/src/main.ts", "compose.yaml"];

test("範例資料全部落在模組表裡：沒有違規", () => {
  assert.deepEqual(ownershipProblems(sample, sampleFiles), []);
});

test("反例：多一個不屬於任何模組的程式檔要紅", () => {
  assert.deepEqual(ownershipProblems(sample, [...sampleFiles, "kg/src/utils.ts"]), [
    "沒有落在模組表任何一列：kg/src/utils.ts",
  ]);
});

test("反例：模組表寫了不存在的路徑要紅", () => {
  assert.deepEqual(ownershipProblems(sample, ["kg/src/main.ts", "compose.yaml"]), [
    "模組表寫了但不存在：kg/src/capture/",
  ]);
});

test("不檢查路徑底下的檔案、不是程式檔的檔案、其他欄位的反引號都不算", () => {
  const files = [...sampleFiles, "kg/spec/a.spec.ts", "quartz/cfg.ts", "globals.d.ts", "README.md", "content/a.md"];
  assert.deepEqual(ownershipProblems(sample, files), []);
});

test("repo 裡每個程式檔都落在 ARCHITECTURE.md 模組表某一列，表上的路徑都存在", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const architecture = readFileSync(join(root, "ARCHITECTURE.md"), "utf8");
  // 還沒 git add 的新檔也要算，刪掉但還沒 git rm 的不算
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .filter((file) => file && existsSync(join(root, file)));
  assert.deepEqual(ownershipProblems(architecture, files), []);
});
