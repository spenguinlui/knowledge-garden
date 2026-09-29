import { execFileSync } from "node:child_process";

function git(kbDir: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: kbDir, encoding: "utf8" }).trim();
}

export function head(kbDir: string): string {
  return git(kbDir, "rev-parse", "HEAD");
}
