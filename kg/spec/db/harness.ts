import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { dbConfig } from "../../src/capture/index.ts";
import { runRound } from "../../src/main.ts";

const schema = readFileSync(fileURLToPath(new URL("../../../db/schema.sql", import.meta.url)), "utf8");
const testRoot = mkdtempSync(join(tmpdir(), "capture-test-"));
const originalPath = process.env.PATH;

// 筆電 compose 起的 Postgres；密碼預設是舊 zsh 測試用的那組，可用環境變數覆寫
const adminConfig = dbConfig({
  ...process.env,
  PGDATABASE: "postgres",
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD ?? "process-inbox-test-password",
});
const testDatabase = `capture_test_${process.pid}_${Date.now()}`;
export const testDb = { ...adminConfig, database: testDatabase };
// 沒有東西在聽的 port，用來模擬 DB 連不上
export const unreachableDb = { ...testDb, port: 41169 };

async function admin(sql: string): Promise<void> {
  const client = new pg.Client(adminConfig);
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

export async function createDatabase(): Promise<void> {
  await admin(`CREATE DATABASE "${testDatabase}"`);
  await query(schema);
}

export async function dropDatabase(): Promise<void> {
  await admin(`DROP DATABASE IF EXISTS "${testDatabase}" WITH (FORCE)`);
  if (process.env.KEEP_TEST_ROOT === "1") console.log(`保留測試資料：${testRoot}`);
  else rmSync(testRoot, { recursive: true, force: true });
}

export async function query<T extends pg.QueryResultRow>(sql: string, values: unknown[] = []): Promise<T[]> {
  const client = new pg.Client(testDb);
  await client.connect();
  try {
    return (await client.query<T>(sql, values)).rows;
  } finally {
    await client.end();
  }
}

export type Job = {
  id: string;
  status: string;
  attempts: number;
  last_error: string | null;
  note_paths: string[];
  commit_sha: string | null;
};

export async function jobs(): Promise<Job[]> {
  return query<Job>("SELECT id, status, attempts, last_error, note_paths, commit_sha FROM capture.jobs ORDER BY id");
}

export type Deploy = {
  commit_sha: string;
  status: string;
  attempts: number;
  last_error: string | null;
};

export async function deploys(): Promise<Deploy[]> {
  return query<Deploy>("SELECT commit_sha, status, attempts, last_error FROM publish.deploys ORDER BY created_at, commit_sha");
}

const fakeClaude = `#!/bin/zsh
print -r -- "$TEST_SCENARIO" >> "$CLAUDE_LOG"
case "$TEST_SCENARIO" in
  new)
    print -r -- '# new note' > content/notes/new-note.md
    ;;
  update)
    print -r -- 'updated' >> content/notes/existing-note.md
    ;;
  both)
    print -r -- '# new note' > content/notes/new-note.md
    print -r -- 'updated' >> content/notes/existing-note.md
    ;;
  timeout)
    print -r -- '# slow note' > content/notes/slow-note.md
    ;;
  push-fail)
    print -r -- '# push fail note' > content/notes/push-fail-note.md
    ;;
  no-change)
    ;;
  fail)
    print -r -- "\${(l:4100::x:)}TAIL_ERROR" >&2
    exit 1
    ;;
  retry-once)
    if [[ $(wc -l < "$CLAUDE_LOG") -eq 1 ]]; then
      print -r -- 'first attempt failed' >&2
      exit 1
    fi
    print -r -- '# retried note' > content/notes/retried-note.md
    ;;
esac
`;

// 假的 npx、wrangler、index-notes.mjs 共用：一次呼叫記一行 JSON（指令、參數、stdin、當下的 HEAD 與 origin/v5），
// FAIL_STEP 指定哪一步失敗（build／deploy／index），失敗時 stderr 印 4100 個 x 加 TAIL_ERROR
const recordCall = `
const { appendFileSync, readFileSync } = process.getBuiltinModule("node:fs");
const { execFileSync } = process.getBuiltinModule("node:child_process");
const { basename } = process.getBuiltinModule("node:path");
const cmd = basename(process.argv[1]);
const args = process.argv.slice(2);
const rev = (ref) => execFileSync("git", ["rev-parse", ref], { encoding: "utf8" }).trim();
const call = { cmd, args, head: rev("HEAD"), originHead: rev("origin/v5") };
if (cmd === "index-notes.mjs" && !args.includes("--all")) call.stdin = readFileSync(0, "utf8");
appendFileSync(process.env.CALLS_LOG, JSON.stringify(call) + "\\n");
const line = [cmd, ...args].join(" ");
const step =
  line === "npx quartz build" ? "build"
  : line.startsWith("wrangler pages deploy") ? "deploy"
  : cmd === "index-notes.mjs" ? "index"
  : "";
if (step && step === process.env.FAIL_STEP) {
  process.stderr.write("x".repeat(4100) + "TAIL_ERROR");
  process.exit(1);
}
`;

export type Call = { cmd: string; args: string[]; stdin?: string; head: string; originHead: string };
export type FailStep = "" | "build" | "deploy" | "index";

export const url = (slug: string) => `https://knowledge.wayne-liu.com/notes/${slug}`;

export class Case {
  readonly root: string;
  readonly repo: string;
  readonly remote: string;
  readonly laptop: string;
  readonly bin: string;
  readonly claudeLog: string;
  readonly callsLog: string;
  readonly messages: string[] = [];
  readonly polled: string[] = [];
  readonly sleeps: number[] = [];
  failStep: FailStep = "";

  constructor(name: string) {
    this.root = join(testRoot, name);
    this.repo = join(this.root, "repo");
    this.remote = join(this.root, "remote.git");
    this.laptop = join(this.root, "laptop");
    this.bin = join(this.root, "bin");
    this.claudeLog = join(this.root, "claude.log");
    this.callsLog = join(this.root, "calls.log");
    mkdirSync(join(this.repo, "inbox"), { recursive: true });
    mkdirSync(join(this.repo, "content/notes"), { recursive: true });
    mkdirSync(join(this.repo, "scripts"), { recursive: true });
    mkdirSync(this.bin, { recursive: true });
    writeFileSync(this.claudeLog, "");
    writeFileSync(this.callsLog, "");
    writeFileSync(join(this.repo, "inbox/.gitkeep"), "");
    writeFileSync(join(this.repo, "scripts/index-notes.mjs"), recordCall);
    for (const [name, source] of [
      ["claude", fakeClaude],
      ["npx", `#!/usr/bin/env node\n${recordCall}`],
      ["wrangler", `#!/usr/bin/env node\n${recordCall}`],
    ]) {
      writeFileSync(join(this.bin, name), source);
      chmodSync(join(this.bin, name), 0o755);
    }

    execFileSync("git", ["init", "--bare", "-q", this.remote]);
    this.git("init", "-q", "-b", "v5");
    this.git("config", "user.name", "Capture Test");
    this.git("config", "user.email", "capture-test@example.com");
    this.git("remote", "add", "origin", this.remote);
    this.git("add", "inbox/.gitkeep", "scripts/index-notes.mjs");
    this.git("commit", "-qm", "test fixture");
    this.git("push", "-qu", "origin", "v5");
  }

  git(...args: string[]): string {
    return execFileSync("git", ["-C", this.repo, ...args], { encoding: "utf8" }).trim();
  }

  seedExistingNote(): void {
    writeFileSync(join(this.repo, "content/notes/existing-note.md"), "# existing note\n");
    this.git("add", "content/notes/existing-note.md");
    this.git("commit", "-qm", "seed existing note");
    this.git("push", "-q");
  }

  // 模擬筆電：另一份 clone 改檔（null 代表刪檔）、commit、push 上「GitHub」，回傳新 commit
  laptopCommit(files: Record<string, string | null>): string {
    const git = (...args: string[]) => execFileSync("git", ["-C", this.laptop, ...args], { encoding: "utf8" }).trim();
    if (!existsSync(this.laptop)) {
      execFileSync("git", ["clone", "-q", "-b", "v5", this.remote, this.laptop]);
      git("config", "user.name", "Laptop");
      git("config", "user.email", "laptop@example.com");
    }
    git("pull", "-q", "--rebase");
    for (const [path, content] of Object.entries(files)) {
      const file = join(this.laptop, path);
      if (content === null) {
        rmSync(file);
      } else {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, content);
      }
    }
    git("add", "-A");
    git("commit", "-qm", "laptop edit");
    git("push", "-q");
    return git("rev-parse", "HEAD");
  }

  rejectPushes(): void {
    const hook = join(this.remote, "hooks/pre-receive");
    writeFileSync(hook, "#!/bin/sh\nexit 1\n");
    chmodSync(hook, 0o755);
  }

  seedInbox(): void {
    writeFileSync(join(this.repo, "inbox/item.json"), "{}\n");
  }

  claudeCalls(): number {
    return readFileSync(this.claudeLog, "utf8").split("\n").filter(Boolean).length;
  }

  // 假 npx、wrangler、index-notes.mjs 被呼叫的紀錄，依呼叫順序
  calls(): Call[] {
    return readFileSync(this.callsLog, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Call);
  }

  commitCount(): number {
    return Number(this.git("rev-list", "--count", "HEAD"));
  }

  // 跑一輪（kg/src/main.ts 的 runRound）：LINE、網址狀態碼、等待都換成假的並記錄下來。
  // 網址要等假 wrangler 被呼叫過才回 200，佈署前就去查會拿到 404。
  async run(scenario: string, db: pg.ClientConfig = testDb): Promise<void> {
    process.env.PATH = `${this.bin}:${originalPath}`;
    process.env.TEST_SCENARIO = scenario;
    process.env.CLAUDE_LOG = this.claudeLog;
    process.env.CALLS_LOG = this.callsLog;
    process.env.FAIL_STEP = this.failStep;
    try {
      await runRound({
        kbDir: this.repo,
        db,
        notify: async (message) => {
          this.messages.push(message);
        },
        statusOf: async (url) => {
          this.polled.push(url);
          const deployed = this.calls().some((call) => call.cmd === "wrangler");
          return scenario !== "timeout" && deployed ? 200 : 404;
        },
        sleep: async (seconds) => {
          this.sleeps.push(seconds);
        },
      });
    } finally {
      process.env.PATH = originalPath;
    }
  }
}
