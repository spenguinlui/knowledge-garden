import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { dbConfig, runCapture } from "../../src/capture/index.ts";

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

export async function query<T extends pg.QueryResultRow>(sql: string): Promise<T[]> {
  const client = new pg.Client(testDb);
  await client.connect();
  try {
    return (await client.query<T>(sql)).rows;
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

export class Case {
  readonly repo: string;
  readonly remote: string;
  readonly bin: string;
  readonly claudeLog: string;
  readonly messages: string[] = [];
  readonly polled: string[] = [];
  readonly sleeps: number[] = [];

  constructor(name: string) {
    const root = join(testRoot, name);
    this.repo = join(root, "repo");
    this.remote = join(root, "remote.git");
    this.bin = join(root, "bin");
    this.claudeLog = join(root, "claude.log");
    mkdirSync(join(this.repo, "inbox"), { recursive: true });
    mkdirSync(join(this.repo, "content/notes"), { recursive: true });
    mkdirSync(this.bin, { recursive: true });
    writeFileSync(this.claudeLog, "");
    writeFileSync(join(this.repo, "inbox/.gitkeep"), "");
    writeFileSync(join(this.bin, "claude"), fakeClaude);
    chmodSync(join(this.bin, "claude"), 0o755);

    execFileSync("git", ["init", "--bare", "-q", this.remote]);
    this.git("init", "-q", "-b", "v5");
    this.git("config", "user.name", "Capture Test");
    this.git("config", "user.email", "capture-test@example.com");
    this.git("remote", "add", "origin", this.remote);
    this.git("add", "inbox/.gitkeep");
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

  commitCount(): number {
    return Number(this.git("rev-list", "--count", "HEAD"));
  }

  // 跑一輪收錄：LINE、網址狀態碼、等待都換成假的並記錄下來
  async run(scenario: string, db: pg.ClientConfig = testDb): Promise<void> {
    process.env.PATH = `${this.bin}:${originalPath}`;
    process.env.TEST_SCENARIO = scenario;
    process.env.CLAUDE_LOG = this.claudeLog;
    try {
      await runCapture({
        kbDir: this.repo,
        db,
        notify: async (message) => {
          this.messages.push(message);
        },
        statusOf: async (url) => {
          this.polled.push(url);
          return scenario === "timeout" ? 404 : 200;
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
