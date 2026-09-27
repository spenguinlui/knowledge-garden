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
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

const shell = fileURLToPath(new URL("../../../scripts/process-inbox.sh", import.meta.url));
const crashedFlag = "/tmp/kb-inbox.crashed";
// realpath：macOS 的 tmpdir 是 symlink，假 npm 記下的 cwd 是解開後的路徑
const root = realpathSync(mkdtempSync(join(tmpdir(), "capture-shell-test-")));
const kb = join(root, "kb");
const bin = join(root, "bin");
const lineLog = join(root, "line.log");
const callsLog = join(root, "calls.log");

// 根目錄與 kg/ 的 node_modules 都比 lock 新（不觸發 npm ci）
function freshModules(): void {
  const earlier = new Date(Date.now() - 60_000);
  const now = new Date();
  for (const dir of [kb, join(kb, "kg")]) {
    mkdirSync(join(dir, "node_modules"), { recursive: true });
    writeFileSync(join(dir, "package-lock.json"), "{}\n");
    writeFileSync(join(dir, "node_modules/.package-lock.json"), "{}\n");
    utimesSync(join(dir, "package-lock.json"), earlier, earlier);
    utimesSync(join(dir, "node_modules/.package-lock.json"), now, now);
  }
}

// 假的 KB_DIR（臨時 git repo）：外殼照抄；kg/src/main.ts 換成記下 PATH、當下 .git/info/exclude 有幾行 content/notes/、
// 照 FAKE_EXIT 結束的假程式；假 npm 記下參數與 cwd
before(() => {
  rmSync(crashedFlag, { force: true });
  mkdirSync(join(kb, "scripts"), { recursive: true });
  mkdirSync(join(kb, "kg/src"), { recursive: true });
  mkdirSync(bin, { recursive: true });
  execFileSync("git", ["init", "-q", kb]);
  writeFileSync(join(kb, ".git/info/exclude"), "# 樣板註解\n");
  copyFileSync(shell, join(kb, "scripts/process-inbox.sh"));
  writeFileSync(
    join(kb, "kg/src/main.ts"),
    `const { appendFileSync, readFileSync } = process.getBuiltinModule("node:fs");
const excluded = readFileSync(".git/info/exclude", "utf8").split("\\n").filter((line) => line === "content/notes/").length;
appendFileSync(process.env.CALLS_LOG, JSON.stringify({ cmd: "main", path: process.env.PATH, excluded }) + "\\n");
process.exit(Number(process.env.FAKE_EXIT));
`,
  );
  writeFileSync(
    join(bin, "npm"),
    `#!/usr/bin/env node
const { appendFileSync } = process.getBuiltinModule("node:fs");
appendFileSync(process.env.CALLS_LOG, JSON.stringify({ cmd: "npm", args: process.argv.slice(2), cwd: process.cwd() }) + "\\n");
`,
  );
  chmodSync(join(bin, "npm"), 0o755);
  freshModules();
  writeFileSync(lineLog, "");
  // 假的 curl：把 -d 的 JSON 一行一筆記下來
  writeFileSync(
    join(bin, "curl"),
    `#!/bin/zsh
while (( $# > 0 )); do
  if [[ "$1" == -d ]]; then
    shift
    print -r -- "$1" >> "$LINE_LOG"
  fi
  shift
done
`,
  );
  chmodSync(join(bin, "curl"), 0o755);
});

after(() => {
  rmSync(crashedFlag, { force: true });
  rmSync(root, { recursive: true, force: true });
});

function runShell(exitCode: number): void {
  writeFileSync(callsLog, "");
  spawnSync("zsh", [join(kb, "scripts/process-inbox.sh")], {
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      KB_DIR: kb,
      FAKE_EXIT: String(exitCode),
      LINE_LOG: lineLog,
      CALLS_LOG: callsLog,
      LINE_CHANNEL_ACCESS_TOKEN: "test-token",
      LINE_USER_ID: "test-user",
    },
    encoding: "utf8",
  });
}

function sentTexts(): string[] {
  return readFileSync(lineLog, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const body = JSON.parse(line) as { to: string; messages: { type: string; text: string }[] };
      assert.equal(body.to, "test-user");
      return body.messages[0].text;
    });
}

type ShellCall = { cmd: string; args?: string[]; cwd?: string; path?: string; excluded?: number };

function calls(): ShellCall[] {
  return readFileSync(callsLog, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ShellCall);
}

// 依序列出外殼做的事：npm 寫成「npm 參數 @ cwd」，程式寫成 main
const steps = () => calls().map(({ cmd, args, cwd }) => (cmd === "npm" ? `npm ${args?.join(" ")} @ ${cwd}` : cmd));

const crashMessage = (code: number) =>
  `❌ knowledge-garden 收錄程式異常結束（exit ${code}），詳見 mini 的 ~/Library/Logs/kb-inbox.log；恢復前不再重複通知`;

test("12 外殼：異常結束告警一次，恢復後再異常會再告警", () => {
  runShell(3);
  assert.deepEqual(sentTexts(), [crashMessage(3)]);

  runShell(3);
  assert.deepEqual(sentTexts(), [crashMessage(3)], "連續第二次異常不再發");

  runShell(0);
  assert.deepEqual(sentTexts(), [crashMessage(3)], "成功不發訊息");

  runShell(5);
  assert.deepEqual(sentTexts(), [crashMessage(3), crashMessage(5)]);
});

test("外殼：套件都是最新就不跑 npm ci，程式的 PATH 含 kg/node_modules/.bin（wrangler 從這裡找）", () => {
  freshModules();
  runShell(0);
  assert.deepEqual(steps(), ["main"]);
  const path = calls()[0].path ?? "";
  assert.ok(path.split(":").includes(join(kb, "kg/node_modules/.bin")), path);
});

test("外殼：根目錄 node_modules 缺，先在根目錄 npm ci 再跑程式", () => {
  freshModules();
  rmSync(join(kb, "node_modules"), { recursive: true, force: true });
  runShell(0);
  assert.deepEqual(steps(), [`npm ci @ ${kb}`, "main"]);
});

test("外殼：根目錄 package-lock.json 比 node_modules 新，先在根目錄 npm ci 再跑程式", () => {
  freshModules();
  const later = new Date(Date.now() + 60_000);
  utimesSync(join(kb, "package-lock.json"), later, later);
  runShell(0);
  assert.deepEqual(steps(), [`npm ci @ ${kb}`, "main"]);
});

test("外殼：.git/info/exclude 沒有 content/notes/ 就在啟動程式前補上，原本的內容保留", () => {
  writeFileSync(join(kb, ".git/info/exclude"), "# 樣板註解\n*.tmp\n");
  freshModules();
  runShell(0);
  assert.deepEqual(
    calls().map(({ cmd, excluded }) => ({ cmd, excluded })),
    [{ cmd: "main", excluded: 1 }],
  );
  const lines = readFileSync(join(kb, ".git/info/exclude"), "utf8").split("\n");
  assert.deepEqual(lines.slice(0, 2), ["# 樣板註解", "*.tmp"]);
});

test("外殼：.git/info/exclude 已經有 content/notes/ 就不重複加，每輪都跑檔案也一個字都不動", () => {
  const exclude = "# 樣板註解\ncontent/notes/\n";
  writeFileSync(join(kb, ".git/info/exclude"), exclude);
  freshModules();
  runShell(0);
  runShell(0);
  assert.equal(readFileSync(join(kb, ".git/info/exclude"), "utf8"), exclude);
});

// 外殼只准排程、上鎖、裝套件；git 操作放 kg/src。.git/info/exclude 這種路徑裡的 git 不是指令，不算
const COMMANDS = /(?<!\.)\b(jq|git|psql)\b/;

test("外殼裡沒有 SQL、jq、git 指令", () => {
  assert.match("git pull --rebase", COMMANDS);
  assert.doesNotMatch("print >> .git/info/exclude", COMMANDS);
  const code = readFileSync(shell, "utf8")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");
  assert.doesNotMatch(code, COMMANDS);
  assert.doesNotMatch(code, /\b(SELECT|INSERT|UPDATE)\b/);
});
