import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

// 桌面送件：筆電的 /capture 收到網址、文字或截圖時，包成 inbox 項目送進 mini 的 inbox，
// 由 mini 下一輪收錄、發 LINE。用法：node kg/src/capture/send.ts [--image <圖片路徑>] [文字]
// 先傳點開頭的暫存檔、全部傳完才改名：收錄程式會略過點開頭的檔案，不會讀到傳一半的項目

const MINI = "liumac-mini";
const INBOX = "knowledge-garden/inbox";
const SSH_OPTIONS = ["-o", "ConnectTimeout=10"];

// ssh、scp 用名稱經 PATH 呼叫（測試才攔得到），失敗就丟錯並帶上它印的原因
function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: ["ignore", "inherit", "pipe"], encoding: "utf8" });
  if (result.status !== 0) {
    const reason = (result.stderr || String(result.error ?? "")).trim();
    throw new Error(`送不到 mini（${command} 結束代碼 ${result.status}）：${reason}`);
  }
}

// inbox 的圖一律是 jpg；其他格式（例如 macOS 截圖的 png）用 macOS 內建的 sips 轉
function toJpeg(image: string, workDir: string): string {
  if (!existsSync(image)) throw new Error(`找不到圖片：${image}`);
  if (/\.jpe?g$/i.test(image)) return image;
  const out = join(workDir, "image.jpg");
  const result = spawnSync("sips", ["-s", "format", "jpeg", image, "--out", out], { encoding: "utf8" });
  if (result.status !== 0 || !existsSync(out)) {
    throw new Error(`圖片轉成 jpg 失敗：${`${result.stdout}${result.stderr}`.trim()}`);
  }
  return out;
}

function send(text: string, image: string | undefined): string {
  const timestamp = Date.now();
  const id = `desk-${timestamp}`;
  const workDir = mkdtempSync(join(tmpdir(), "kb-send-"));
  try {
    // 格式照 LINE 那邊寫進 inbox 的 JSON；沒有文字的截圖 text 是 null
    const item = { type: image === undefined ? "text" : "image", text: text || null, timestamp, messageId: id };
    const json = join(workDir, `${id}.json`);
    writeFileSync(json, `${JSON.stringify(item)}\n`);
    // 圖在前：改名時圖先出現，收錄程式看到 json 時圖一定已經在
    const uploads: [string, string][] = [];
    if (image !== undefined) uploads.push([toJpeg(image, workDir), `${id}.jpg`]);
    uploads.push([json, `${id}.json`]);

    for (const [local, name] of uploads) run("scp", [...SSH_OPTIONS, "-q", local, `${MINI}:${INBOX}/.${name}`]);
    const renames = uploads.map(([, name]) => `mv .${name} ${name}`).join(" && ");
    run("ssh", [...SSH_OPTIONS, MINI, `cd ${INBOX} && ${renames}`]);
    return id;
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

const { values, positionals } = parseArgs({ options: { image: { type: "string" } }, allowPositionals: true });
const text = positionals.join(" ").trim();
if (text === "" && values.image === undefined) {
  console.error("用法：node kg/src/capture/send.ts [--image <圖片路徑>] [文字]（文字與圖至少一個）");
  process.exit(2);
}
try {
  const id = send(text, values.image);
  console.log(`已送出 ${id}，mini 收錄完會發 LINE「已上花園」`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
