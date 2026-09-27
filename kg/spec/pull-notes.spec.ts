import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

const source = fileURLToPath(new URL("../../scripts/pull-notes.sh", import.meta.url));
// realpath：macOS 的 tmpdir 是 symlink，假 rsync 記下的 cwd 是解開後的路徑
const root = realpathSync(mkdtempSync(join(tmpdir(), "pull-notes-test-")));
const bin = join(root, "bin");
const log = join(root, "rsync.log");
after(() => rmSync(root, { recursive: true, force: true }));

// 假 rsync：記下參數、cwd、當下 .git/info/exclude 有幾行 content/notes/，照 RSYNC_EXIT 結束，不碰任何檔案
mkdirSync(bin);
writeFileSync(
  join(bin, "rsync"),
  `#!/usr/bin/env node
const { appendFileSync, existsSync, readFileSync } = process.getBuiltinModule("node:fs");
const exclude = ".git/info/exclude";
const excluded = existsSync(exclude) ? readFileSync(exclude, "utf8").split("\\n").filter((line) => line === "content/notes/").length : 0;
appendFileSync(process.env.RSYNC_LOG, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd(), excluded }) + "\\n");
process.exit(Number(process.env.RSYNC_EXIT ?? 0));
`,
);
chmodSync(join(bin, "rsync"), 0o755);

// 臨時 repo：scripts/ 放一份 pull-notes.sh，.git/info/exclude 換成指定內容。真正 repo 的 .git/info/exclude 不碰
let repos = 0;
function tempRepo(exclude: string): string {
  const repo = join(root, `repo-${repos++}`);
  mkdirSync(join(repo, "scripts"), { recursive: true });
  execFileSync("git", ["init", "-q", repo]);
  copyFileSync(source, join(repo, "scripts/pull-notes.sh"));
  writeFileSync(join(repo, ".git/info/exclude"), exclude);
  return repo;
}

function pull(repo: string, exitCode = 0) {
  writeFileSync(log, "");
  // 故意在別的資料夾執行，腳本要自己切到 repo 根目錄
  return spawnSync("zsh", [join(repo, "scripts/pull-notes.sh")], {
    cwd: root,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, RSYNC_LOG: log, RSYNC_EXIT: String(exitCode) },
    encoding: "utf8",
  });
}

function rsyncCalls(): { args: string[]; cwd: string; excluded: number }[] {
  return readFileSync(log, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const excludeLines = (repo: string) => readFileSync(join(repo, ".git/info/exclude"), "utf8").split("\n");

test("筆電預覽：在 repo 根目錄把 mini 最近一次匯出的 content/notes 整個同步下來（mini 沒有的刪掉）", () => {
  const repo = tempRepo("content/notes/\n");
  const result = pull(repo);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    rsyncCalls().map(({ args, cwd }) => ({ args, cwd })),
    [{ args: ["-a", "--delete", "liumac-mini:knowledge-garden/content/notes/", "content/notes/"], cwd: repo }],
  );
});

test(".git/info/exclude 沒有 content/notes/：拉檔之前補上，原本的內容保留，git 從此不追蹤文章", () => {
  const repo = tempRepo("# 樣板註解\n*.tmp\n");
  const result = pull(repo);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    rsyncCalls().map((call) => call.excluded),
    [1],
    "rsync 跑的時候已經補上",
  );
  const lines = excludeLines(repo);
  assert.deepEqual(lines.slice(0, 2), ["# 樣板註解", "*.tmp"]);
  assert.equal(lines.filter((line) => line === "content/notes/").length, 1);
  const ignored = spawnSync("git", ["-c", "core.excludesFile=/dev/null", "check-ignore", "content/notes/x.md"], { cwd: repo });
  assert.equal(ignored.status, 0, "git 忽略 content/notes 底下的檔案");
});

test(".git/info/exclude 已經有 content/notes/：不重複加，檔案一個字都不動", () => {
  const exclude = "# 樣板註解\ncontent/notes/\n";
  const repo = tempRepo(exclude);
  assert.equal(pull(repo).status, 0);
  assert.equal(pull(repo).status, 0);
  assert.equal(readFileSync(join(repo, ".git/info/exclude"), "utf8"), exclude);
});

test(".git/info/exclude 最後一行沒換行：補的那行自成一行，不會黏到原本的最後一行", () => {
  const repo = tempRepo("*.tmp");
  assert.equal(pull(repo).status, 0);
  const lines = excludeLines(repo);
  assert.ok(lines.includes("*.tmp"), lines.join("|"));
  assert.ok(lines.includes("content/notes/"), lines.join("|"));
});

test("rsync 失敗：以非 0 結束", () => {
  assert.notEqual(pull(tempRepo("content/notes/\n"), 23).status, 0);
});
