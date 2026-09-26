import { spawnSync } from "node:child_process";

// 跑 /capture 收錄一個 inbox 項目；output 是 stdout 接 stderr，失敗時存進任務表
export function runClaude(kbDir: string, id: string): { ok: boolean; output: string } {
  const result = spawnSync(
    "claude",
    [
      "-p",
      `/capture inbox/${id}`,
      "--permission-mode",
      "acceptEdits",
      "--allowedTools",
      "Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,Bash(date:*)",
    ],
    { cwd: kbDir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}${result.error ? String(result.error) : ""}`.replace(/\n+$/, "");
  return { ok: result.status === 0, output };
}
