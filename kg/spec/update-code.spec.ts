import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

const script = fileURLToPath(new URL("../../scripts/update-code.sh", import.meta.url));
const root = mkdtempSync(join(tmpdir(), "update-code-test-"));
after(() => rmSync(root, { recursive: true, force: true }));

type Repo = {
  home: string;
  clone: string;
  laptop: string;
  remote: string;
  lock: string;
};

let cases = 0;
function git(dir: string, ...args: string[]): string {
  return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" }).trim();
}

function tempRepo(): Repo {
  const dir = join(root, `case-${cases++}`);
  const home = join(dir, "home");
  const clone = join(home, "knowledge-garden");
  const laptop = join(dir, "laptop");
  const remote = join(dir, "origin.git");
  const seed = join(dir, "seed");
  const lock = join(dir, "kb-inbox.lock");

  mkdirSync(seed, { recursive: true });
  execFileSync("git", ["init", "--bare", "-q", remote]);
  execFileSync("git", ["init", "-q", "-b", "v5", seed]);
  git(seed, "config", "user.name", "Seed");
  git(seed, "config", "user.email", "seed@example.com");
  writeFileSync(join(seed, "README.md"), "initial\n");
  git(seed, "add", "README.md");
  git(seed, "commit", "-qm", "initial");
  git(seed, "remote", "add", "origin", remote);
  git(seed, "push", "-qu", "origin", "v5");

  mkdirSync(home, { recursive: true });
  execFileSync("git", ["clone", "-q", "-b", "v5", remote, clone]);
  execFileSync("git", ["clone", "-q", "-b", "v5", remote, laptop]);
  for (const repo of [clone, laptop]) {
    git(repo, "config", "user.name", "Test");
    git(repo, "config", "user.email", "test@example.com");
  }
  return { home, clone, laptop, remote, lock };
}

function push(repo: Repo, file: string, content: string): string {
  writeFileSync(join(repo.laptop, file), content);
  git(repo.laptop, "add", file);
  git(repo.laptop, "commit", "-qm", `update ${file}`);
  git(repo.laptop, "push", "-q");
  return git(repo.laptop, "rev-parse", "HEAD");
}

function environment(repo: Repo, extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: repo.home,
    KB_INBOX_LOCK: repo.lock,
    UPDATE_CODE_TIMEOUT_SECONDS: "3",
    ...extra,
  };
}

function update(repo: Repo, extra: Record<string, string> = {}) {
  return spawnSync("zsh", [script], { env: environment(repo, extra), encoding: "utf8" });
}

function assertScriptRan(result: { status: number | null; stderr: string }): void {
  assert.notEqual(result.status, 127, result.stderr);
}

function updateAsync(repo: Repo, extra: Record<string, string> = {}): Promise<{ status: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("zsh", [script], { env: environment(repo, extra) });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stderr }));
  });
}

test("鎖沒被佔：用預設的 $HOME/knowledge-garden 拿鎖、git pull --ff-only、放鎖，clone 變成 origin 最新 commit", () => {
  const repo = tempRepo();
  const latest = push(repo, "from-laptop.txt", "new\n");

  const result = update(repo);

  assertScriptRan(result);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(git(repo.clone, "rev-parse", "HEAD"), latest);
  assert.equal(existsSync(repo.lock), false, "成功後放掉鎖");
});

test("KB_DIR 指定 clone；鎖被佔時等到鎖放掉才 pull", async () => {
  const repo = tempRepo();
  const latest = push(repo, "after-lock.txt", "new\n");
  mkdirSync(repo.lock);

  const running = updateAsync(repo, { KB_DIR: repo.clone });
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.notEqual(git(repo.clone, "rev-parse", "HEAD"), latest, "鎖還在時不能 pull");
  rmSync(repo.lock, { recursive: true });
  const result = await running;

  assertScriptRan(result);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(git(repo.clone, "rev-parse", "HEAD"), latest);
  assert.equal(existsSync(repo.lock), false);
});

test("鎖等超過上限：非 0 結束、不 pull、不動別人的鎖", () => {
  const repo = tempRepo();
  const before = git(repo.clone, "rev-parse", "HEAD");
  push(repo, "blocked.txt", "new\n");
  mkdirSync(repo.lock);
  writeFileSync(join(repo.lock, "owner"), "capture\n");

  const result = update(repo, { KB_DIR: repo.clone, UPDATE_CODE_TIMEOUT_SECONDS: "1" });

  assertScriptRan(result);
  assert.notEqual(result.status, 0);
  assert.equal(git(repo.clone, "rev-parse", "HEAD"), before);
  assert.equal(existsSync(join(repo.lock, "owner")), true, "別人的鎖與內容都保留");
});

test("pull 失敗（origin 不見）：非 0 結束，自己拿的鎖一定放掉", () => {
  const repo = tempRepo();
  rmSync(repo.remote, { recursive: true, force: true });

  const result = update(repo, { KB_DIR: repo.clone });

  assertScriptRan(result);
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(repo.lock), false);
});

test("pull 失敗（不是 fast-forward）：非 0 結束、不改 HEAD，自己拿的鎖一定放掉", () => {
  const repo = tempRepo();
  push(repo, "remote.txt", "remote\n");
  writeFileSync(join(repo.clone, "local.txt"), "local\n");
  git(repo.clone, "add", "local.txt");
  git(repo.clone, "commit", "-qm", "local commit");
  const localHead = git(repo.clone, "rev-parse", "HEAD");

  const result = update(repo, { KB_DIR: repo.clone });

  assertScriptRan(result);
  assert.notEqual(result.status, 0);
  assert.equal(git(repo.clone, "rev-parse", "HEAD"), localHead);
  assert.equal(existsSync(repo.lock), false);
});
