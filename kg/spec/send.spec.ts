import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, beforeEach, test } from "node:test";

const SEND = fileURLToPath(new URL("../src/capture/send.ts", import.meta.url));
const root = mkdtempSync(join(tmpdir(), "send-test-"));
const bin = join(root, "bin");
// 假 mini 的家目錄：scp 傳到這裡，ssh 的指令在這裡執行
const home = join(root, "mini");
const inbox = join(home, "knowledge-garden/inbox");
const callsLog = join(root, "calls.log");
after(() => rmSync(root, { recursive: true, force: true }));

// 假 ssh、scp：一次呼叫記一行 JSON（指令、參數、當下 mini inbox 裡不是點開頭的檔名）。
// SSH_DOWN=1 模擬連不上：跟真的 ssh 一樣印原因、以 255 結束
const fake = `#!/usr/bin/env node
const { appendFileSync, copyFileSync, readdirSync } = process.getBuiltinModule("node:fs");
const { spawnSync } = process.getBuiltinModule("node:child_process");
const { basename, join } = process.getBuiltinModule("node:path");
const cmd = basename(process.argv[1]);
const args = process.argv.slice(2);
const visible = readdirSync(process.env.FAKE_INBOX).filter((name) => !name.startsWith(".")).sort();
appendFileSync(process.env.CALLS_LOG, JSON.stringify({ cmd, args, visible }) + "\\n");
if (process.env.SSH_DOWN === "1") {
  process.stderr.write("ssh: connect to host liumac-mini port 22: Operation timed out\\n");
  process.exit(255);
}
if (cmd === "scp") {
  const [local, remote] = args.slice(-2);
  if (!remote.startsWith("liumac-mini:")) process.exit(1);
  copyFileSync(local, join(process.env.FAKE_HOME, remote.slice("liumac-mini:".length)));
} else {
  if (args.at(-2) !== "liumac-mini") process.exit(1);
  process.exit(spawnSync("sh", ["-c", args.at(-1)], { cwd: process.env.FAKE_HOME, stdio: "inherit" }).status);
}
`;
mkdirSync(bin, { recursive: true });
for (const name of ["ssh", "scp"]) {
  writeFileSync(join(bin, name), fake);
  chmodSync(join(bin, name), 0o755);
}

// 1×1 的 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

beforeEach(() => {
  rmSync(home, { recursive: true, force: true });
  mkdirSync(inbox, { recursive: true });
  writeFileSync(callsLog, "");
});

type SshCall = { cmd: string; args: string[]; visible: string[] };

function calls(): SshCall[] {
  return readFileSync(callsLog, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SshCall);
}

function send(args: string[], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [SEND, ...args], {
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      CALLS_LOG: callsLog,
      FAKE_HOME: home,
      FAKE_INBOX: inbox,
      ...env,
    },
    encoding: "utf8",
  });
}

// scp 的目的地要是 mini inbox 裡點開頭的暫存檔，回傳 id（desk-<epoch 毫秒>）
function uploadedId(call: SshCall, ext: string): string {
  assert.equal(call.cmd, "scp");
  const match = call.args.at(-1)?.match(new RegExp(`^liumac-mini:knowledge-garden/inbox/\\.(desk-\\d+)\\.${ext}$`));
  assert.ok(match, call.args.join(" "));
  return match[1];
}

test("只有文字：先傳 .desk-<時間>.json，傳完才改名去掉開頭的點；JSON 照 inbox 格式，終端機顯示已送出", () => {
  const before = Date.now();
  const result = send(["https://example.com/a 這篇不錯"]);
  const after = Date.now();
  assert.equal(result.status, 0, result.stderr);

  const [upload, rename, ...rest] = calls();
  assert.deepEqual(rest, []);
  const id = uploadedId(upload, "json");
  const time = Number(id.slice("desk-".length));
  assert.ok(time >= before && time <= after, `${time} 不在 ${before}～${after} 之間`);
  assert.equal(rename.cmd, "ssh");
  assert.deepEqual(rename.visible, [], "改名前 mini 的收錄程式看不到這個項目");
  assert.deepEqual(readdirSync(inbox), [`${id}.json`]);
  assert.deepEqual(JSON.parse(readFileSync(join(inbox, `${id}.json`), "utf8")), {
    type: "text",
    text: "https://example.com/a 這篇不錯",
    timestamp: time,
    messageId: id,
  });
  assert.match(result.stdout, /已送出/);
});

test("附 png 圖：先轉成 jpg 傳成 .desk-<時間>.jpg、再傳 json，傳完才改名，圖先改名", () => {
  const png = join(root, "shot.png");
  writeFileSync(png, PNG);
  const result = send(["--image", png, "截圖說明"]);
  assert.equal(result.status, 0, result.stderr);

  const [image, json, rename, ...rest] = calls();
  assert.deepEqual(rest, []);
  const id = uploadedId(image, "jpg");
  assert.equal(uploadedId(json, "json"), id);
  assert.equal(rename.cmd, "ssh");
  assert.deepEqual(rename.visible, []);
  const command = rename.args.at(-1) ?? "";
  assert.ok(command.indexOf(`.${id}.jpg`) < command.indexOf(`.${id}.json`), command);

  assert.deepEqual(readdirSync(inbox).sort(), [`${id}.jpg`, `${id}.json`]);
  assert.ok(readFileSync(join(inbox, `${id}.jpg`)).subarray(0, 3).equals(JPEG_MAGIC), "傳上去的是 jpg");
  assert.deepEqual(JSON.parse(readFileSync(join(inbox, `${id}.json`), "utf8")), {
    type: "image",
    text: "截圖說明",
    timestamp: Number(id.slice("desk-".length)),
    messageId: id,
  });
});

test("附 jpg 圖、沒有文字：圖原樣傳上去，JSON 的 text 是 null", () => {
  const jpg = join(root, "photo.jpg");
  const bytes = Buffer.concat([JPEG_MAGIC, Buffer.from("fake jpeg body")]);
  writeFileSync(jpg, bytes);
  const result = send(["--image", jpg]);
  assert.equal(result.status, 0, result.stderr);

  const id = uploadedId(calls()[0], "jpg");
  assert.ok(readFileSync(join(inbox, `${id}.jpg`)).equals(bytes));
  const item = JSON.parse(readFileSync(join(inbox, `${id}.json`), "utf8")) as { type: string; text: unknown };
  assert.deepEqual([item.type, item.text], ["image", null]);
});

test("mini 連不上：以非 0 結束並印出原因，不改名", () => {
  const result = send(["https://example.com/a"], { SSH_DOWN: "1" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Operation timed out/);
  assert.match(result.stderr, /送不到 mini/);
  assert.deepEqual(
    calls().map((call) => call.cmd),
    ["scp"],
  );
  assert.deepEqual(readdirSync(inbox), []);
});

test("沒有文字也沒有圖：以非 0 結束並印出用法，不連 mini", () => {
  const result = send([]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--image/);
  assert.deepEqual(calls(), []);
});
