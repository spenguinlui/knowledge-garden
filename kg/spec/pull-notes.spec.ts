import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

const script = fileURLToPath(new URL("../../scripts/pull-notes.sh", import.meta.url));
const repo = realpathSync(fileURLToPath(new URL("../../", import.meta.url)));
const root = realpathSync(mkdtempSync(join(tmpdir(), "pull-notes-test-")));
const log = join(root, "rsync.log");
after(() => rmSync(root, { recursive: true, force: true }));

// 假 rsync：記下參數與 cwd，照 RSYNC_EXIT 結束，不碰任何檔案
writeFileSync(
  join(root, "rsync"),
  `#!/usr/bin/env node
const { appendFileSync } = process.getBuiltinModule("node:fs");
appendFileSync(process.env.RSYNC_LOG, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }) + "\\n");
process.exit(Number(process.env.RSYNC_EXIT ?? 0));
`,
);
chmodSync(join(root, "rsync"), 0o755);

function pull(exitCode: number) {
  writeFileSync(log, "");
  // 故意在別的資料夾執行，腳本要自己切到 repo 根目錄
  return spawnSync("zsh", [script], {
    cwd: root,
    env: { ...process.env, PATH: `${root}:${process.env.PATH}`, RSYNC_LOG: log, RSYNC_EXIT: String(exitCode) },
    encoding: "utf8",
  });
}

test("筆電預覽：在 repo 根目錄把 mini 最近一次匯出的 content/notes 整個同步下來（mini 沒有的刪掉）", () => {
  const result = pull(0);
  assert.equal(result.status, 0, result.stderr);
  const calls = readFileSync(log, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
  assert.deepEqual(calls, [
    { args: ["-a", "--delete", "liumac-mini:knowledge-garden/content/notes/", "content/notes/"], cwd: repo },
  ]);
});

test("rsync 失敗：以非 0 結束", () => {
  assert.notEqual(pull(23).status, 0);
});
