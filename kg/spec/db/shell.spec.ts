import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

const shell = fileURLToPath(new URL("../../../scripts/process-inbox.sh", import.meta.url));
const crashedFlag = "/tmp/kb-inbox.crashed";
const root = mkdtempSync(join(tmpdir(), "capture-shell-test-"));
const kb = join(root, "kb");
const bin = join(root, "bin");
const lineLog = join(root, "line.log");

// 假的 KB_DIR：外殼照抄，main.ts 換成照 FAKE_EXIT 結束的假程式，node_modules 比 lock 新（不觸發 npm ci）
before(() => {
  rmSync(crashedFlag, { force: true });
  mkdirSync(join(kb, "scripts"), { recursive: true });
  mkdirSync(join(kb, "kg/src/capture"), { recursive: true });
  mkdirSync(join(kb, "kg/node_modules"), { recursive: true });
  mkdirSync(bin, { recursive: true });
  copyFileSync(shell, join(kb, "scripts/process-inbox.sh"));
  writeFileSync(join(kb, "kg/src/capture/main.ts"), "process.exit(Number(process.env.FAKE_EXIT));\n");
  writeFileSync(join(kb, "kg/package-lock.json"), "{}\n");
  writeFileSync(join(kb, "kg/node_modules/.package-lock.json"), "{}\n");
  const earlier = new Date(Date.now() - 60_000);
  utimesSync(join(kb, "kg/package-lock.json"), earlier, earlier);
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
  spawnSync("zsh", [join(kb, "scripts/process-inbox.sh")], {
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      KB_DIR: kb,
      FAKE_EXIT: String(exitCode),
      LINE_LOG: lineLog,
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

test("外殼裡沒有 SQL、jq、git 指令", () => {
  const code = readFileSync(shell, "utf8")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");
  assert.doesNotMatch(code, /\b(jq|git|psql)\b/);
  assert.doesNotMatch(code, /\b(SELECT|INSERT|UPDATE)\b/);
});
