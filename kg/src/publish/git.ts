import { execFileSync } from "node:child_process";

function git(kbDir: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: kbDir, encoding: "utf8" }).trim();
}

// 每輪開頭拉 GitHub 上的新 commit；失敗就丟錯，由外殼當成程式異常結束處理
export function pull(kbDir: string): void {
  git(kbDir, "pull", "--rebase", "--quiet");
}

export function head(kbDir: string): string {
  return git(kbDir, "rev-parse", "HEAD");
}
