import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

// 防呆：Quartz 建站會跳過 .gitignore 列到的檔案（quartz/util/glob.ts 的 gitignore: true），
// content/notes 寫進 .gitignore，網站的文章頁就全變 404（5b-3 上線事故）。
// 「文章不進 git」的規則要寫在各機器的 .git/info/exclude（Quartz 不讀它），由 process-inbox.sh、pull-notes.sh 補上。
const gitignore = fileURLToPath(new URL("../../.gitignore", import.meta.url));
const repo = mkdtempSync(join(tmpdir(), "gitignore-test-"));
after(() => rmSync(repo, { recursive: true, force: true }));

test("根目錄的 .gitignore 不忽略 content/notes 底下的文章（Quartz 建站才看得到）", () => {
  // --template= 不產生 .git/info/exclude、core.excludesFile 指到空檔：量到的只有 .gitignore，跟 Quartz 看到的一樣
  execFileSync("git", ["init", "-q", "--template=", repo]);
  copyFileSync(gitignore, join(repo, ".gitignore"));
  assert.equal(existsSync(join(repo, ".git/info/exclude")), false);

  const result = spawnSync("git", ["-c", "core.excludesFile=/dev/null", "check-ignore", "-v", "content/notes/x.md"], {
    cwd: repo,
    encoding: "utf8",
  });
  // check-ignore：0 = 被忽略，1 = 不忽略
  assert.equal(result.status, 1, `content/notes/x.md 被這條規則忽略了：${result.stdout}${result.stderr}`);
});
