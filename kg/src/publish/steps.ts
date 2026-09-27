import { spawnSync } from "node:child_process";

// 外部指令一律用名稱經 PATH 呼叫，測試才攔得到
export type Step = { label: string; command: string; args: string[]; input?: string };

// 一個網站版本的佈署：建站 → 上傳到 Cloudflare Pages → 更新 Vectorize 索引（建站前的匯出由呼叫端先做）。
// changed 是上次成功佈署之後變動過的文章 slug；null 代表沒有成功佈署過，索引全量重建
export function deploySteps(changed: string[] | null): Step[] {
  return [
    { label: "install quartz plugins", command: "npx", args: ["quartz", "plugin", "install"] },
    { label: "build", command: "npx", args: ["quartz", "build"] },
    {
      label: "deploy",
      command: "wrangler",
      args: ["pages", "deploy", "public", "--project-name=knowledge-garden", "--branch=v5"],
    },
    changed === null
      ? { label: "index (full)", command: "node", args: ["workers/kb-search/index-notes.mjs", "--all"] }
      : { label: "index", command: "node", args: ["workers/kb-search/index-notes.mjs"], input: indexInput(changed) },
  ];
}

// index-notes.mjs 的 stdin 吃 `git diff --name-status` 的格式；文章沒有刪除的路徑，新增與修改都寫成 M
function indexInput(slugs: string[]): string {
  return slugs.map((slug) => `M\tcontent/notes/${slug}.md\n`).join("");
}

// output 是 stdout 接 stderr，失敗時存進佈署紀錄
export function runStep(kbDir: string, step: Step): { ok: boolean; output: string } {
  const result = spawnSync(step.command, step.args, {
    cwd: kbDir,
    input: step.input,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}${result.error ? String(result.error) : ""}`.replace(/\n+$/, "");
  return { ok: result.status === 0, output };
}
