import { execFileSync, spawnSync } from "node:child_process";

function git(kbDir: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: kbDir, encoding: "utf8" }).trim();
}

// 失敗就丟錯，由外殼當成程式異常結束處理
export function pull(kbDir: string): void {
  git(kbDir, "pull", "--rebase", "--quiet");
}

// 只提交 content/；claude 沒改東西就不產生 commit，回傳 null
export function commitContent(kbDir: string, id: string): string | null {
  git(kbDir, "add", "-A", "--", "content/");
  const before = git(kbDir, "rev-parse", "HEAD");
  spawnSync("git", ["commit", "-qm", `capture: ${id}`, "--", "content/"], { cwd: kbDir, stdio: "inherit" });
  const after = git(kbDir, "rev-parse", "HEAD");
  return after === before ? null : after;
}

export function noteChanges(kbDir: string, sha: string): string {
  return git(kbDir, "show", "--name-status", "--format=", sha, "--", "content/notes/");
}

export function push(kbDir: string): boolean {
  return spawnSync("git", ["push", "--quiet"], { cwd: kbDir, stdio: "inherit" }).status === 0;
}
