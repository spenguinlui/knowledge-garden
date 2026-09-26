import { spawnSync } from "node:child_process";

// 外部指令一律用名稱經 PATH 呼叫，測試才攔得到
export type Step = { label: string; command: string; args: string[]; input?: string };

// 一個 commit 的佈署：建站 → 上傳到 Cloudflare Pages → 更新 Vectorize 索引。
// changes 是上次成功佈署到這次的筆記變動；null 代表沒有可比的起點，索引全量重建
export function deploySteps(changes: string | null): Step[] {
  return [
    { label: "install quartz plugins", command: "npx", args: ["quartz", "plugin", "install"] },
    { label: "build", command: "npx", args: ["quartz", "build"] },
    {
      label: "deploy",
      command: "wrangler",
      args: ["pages", "deploy", "public", "--project-name=knowledge-garden", "--branch=v5"],
    },
    changes === null
      ? { label: "index (full)", command: "node", args: ["scripts/index-notes.mjs", "--all"] }
      : { label: "index", command: "node", args: ["scripts/index-notes.mjs"], input: changes },
  ];
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
