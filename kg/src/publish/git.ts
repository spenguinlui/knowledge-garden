import { execFileSync, spawnSync } from "node:child_process";

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

// repo 裡還查不查得到這個 commit（例如 force push 後被清掉就查不到）
export function commitExists(kbDir: string, sha: string): boolean {
  return spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd: kbDir }).status === 0;
}

// 兩個 commit 之間筆記的變動，`git diff --name-status` 格式，給 index-notes.mjs 當 stdin
export function contentChanges(kbDir: string, from: string, to: string): string {
  return execFileSync("git", ["diff", "--name-status", from, to, "--", "content/**/*.md"], { cwd: kbDir, encoding: "utf8" });
}
