import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { runRound } from "../../src/main.ts";
import { dbConfig } from "../../src/notes/index.ts";

const schema = ["notes", "capture", "publish"]
  .map((module) => readFileSync(fileURLToPath(new URL(`../../src/${module}/schema.sql`, import.meta.url)), "utf8"))
  .join("");
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

// 測試自己開的連線，給直接呼叫 notes 函式的測試用
export async function withClient<T>(work: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client(testDb);
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

export type Job = {
  id: string;
  status: string;
  attempts: number;
  last_error: string | null;
  note_slugs: string[];
};

export async function jobs(): Promise<Job[]> {
  return query<Job>("SELECT id, status, attempts, last_error, note_slugs FROM capture.jobs ORDER BY id");
}

export type Deploy = {
  commit_sha: string;
  notes_updated_at: string;
  status: string;
  attempts: number;
  last_error: string | null;
};

export async function deploys(): Promise<Deploy[]> {
  return query<Deploy>(
    `SELECT commit_sha, notes_updated_at::text AS notes_updated_at, status, attempts, last_error
       FROM publish.deploys ORDER BY created_at`,
  );
}

export type Article = { slug: string; title: string; tags: string[]; body: string };

export async function articles(): Promise<Article[]> {
  return query<Article>("SELECT slug, title, tags, body FROM notes.articles ORDER BY slug");
}

// 直接在資料庫放一篇合規格的文章（模擬之前收錄過的），同一個 slug 再放一次就是改內文
export async function putNote(slug: string, body = `# ${slug}\n`): Promise<void> {
  await query(
    `INSERT INTO notes.articles (slug, title, date, tags, source_type, captured_at, body)
     VALUES ($1, $1, '2026-09-27', '{dev}', 'manual', '2026-09-27T10:00:00+0800', $2)
     ON CONFLICT (slug) DO UPDATE SET body = EXCLUDED.body, updated_at = now()`,
    [slug, body],
  );
}

// 文章最後一次變動的時間，跟 publish.deploys 記的格式相同；沒有文章是 -infinity
export async function notesVersion(): Promise<string> {
  const [row] = await query<{ at: string }>(
    "SELECT COALESCE(max(updated_at), '-infinity'::timestamptz)::text AS at FROM notes.articles",
  );
  return row.at;
}

// 假 claude：每次呼叫記一行「情境 inbox-id 當下 content/notes 的檔名⋯⋯」，照 TEST_SCENARIO 改 content/notes
const fakeClaude = `#!/bin/zsh
print -r -- "$TEST_SCENARIO \${2#/capture inbox/} $(ls content/notes 2>/dev/null | tr '\\n' ' ')" >> "$CLAUDE_LOG"

note() { # 寫一篇合規格的筆記，$1 = slug
  cat > "content/notes/$1.md" <<EOF
---
title: "$1"
date: 2026-09-27
tags: [dev]
source_type: manual
captured_at: 2026-09-27T10:00:00+0800
---

# $1
EOF
}

case "$TEST_SCENARIO" in
  new)
    note new-note
    ;;
  update)
    print -r -- 'updated' >> content/notes/existing-note.md
    ;;
  both)
    note new-note
    print -r -- 'updated' >> content/notes/existing-note.md
    ;;
  timeout)
    note slow-note
    ;;
  no-change)
    ;;
  delete)
    rm content/notes/existing-note.md
    ;;
  bad)
    note good-note
    print -r -- 'no frontmatter' > content/notes/bad-note.md
    ;;
  unwritable)
    cat > content/notes/comma-tag.md <<'EOF'
---
title: "comma-tag"
date: 2026-09-27
tags:
  - "a, b"
source_type: manual
captured_at: 2026-09-27T10:00:00+0800
---

# comma-tag
EOF
    ;;
  block-tags)
    cat > content/notes/block-tags.md <<'EOF'
---
title: "block-tags"
date: 2026-09-27
tags:
  - dev
  - git
source_type: manual
captured_at: 2026-09-27T10:00:00+0800
---

# block-tags
EOF
    ;;
  first-bad)
    if [[ $(wc -l < "$CLAUDE_LOG") -eq 1 ]]; then
      print -r -- 'no frontmatter' > content/notes/bad-note.md
    else
      note new-note
    fi
    ;;
  fail)
    note half-note
    print -r -- "\${(l:4100::x:)}TAIL_ERROR" >&2
    exit 1
    ;;
  retry-once)
    if [[ $(wc -l < "$CLAUDE_LOG") -eq 1 ]]; then
      print -r -- 'first attempt failed' >&2
      exit 1
    fi
    note retried-note
    ;;
esac
`;

// 假的 npx、wrangler、index-notes.mjs 共用：一次呼叫記一行 JSON（指令、參數、stdin、當下的 HEAD 與 origin/v5、
// 當下 content/notes 的檔名），FAIL_STEP 指定哪一步失敗（build／deploy／index），失敗時 stderr 印 4100 個 x 加 TAIL_ERROR
const recordCall = `
const { appendFileSync, existsSync, readFileSync, readdirSync } = process.getBuiltinModule("node:fs");
const { execFileSync } = process.getBuiltinModule("node:child_process");
const { basename } = process.getBuiltinModule("node:path");
const cmd = basename(process.argv[1]);
const args = process.argv.slice(2);
const rev = (ref) => execFileSync("git", ["rev-parse", ref], { encoding: "utf8" }).trim();
const notes = existsSync("content/notes") ? readdirSync("content/notes").sort() : null;
const call = { cmd, args, head: rev("HEAD"), originHead: rev("origin/v5"), notes };
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

export type Call = { cmd: string; args: string[]; stdin?: string; head: string; originHead: string; notes: string[] | null };
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
    mkdirSync(join(this.repo, "workers/kb-search"), { recursive: true });
    mkdirSync(this.bin, { recursive: true });
    writeFileSync(this.claudeLog, "");
    writeFileSync(this.callsLog, "");
    writeFileSync(join(this.repo, "inbox/.gitkeep"), "");
    // 跟正式 repo 一樣：content/notes 是匯出的結果，不進 git
    writeFileSync(join(this.repo, ".gitignore"), "content/notes/\n");
    writeFileSync(join(this.repo, "workers/kb-search/index-notes.mjs"), recordCall);
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
    this.git("add", ".gitignore", "inbox/.gitkeep", "workers/kb-search/index-notes.mjs");
    this.git("commit", "-qm", "test fixture");
    this.git("push", "-qu", "origin", "v5");
  }

  git(...args: string[]): string {
    return execFileSync("git", ["-C", this.repo, ...args], { encoding: "utf8" }).trim();
  }

  // 「GitHub」上 v5 指到的 commit
  remoteHead(): string {
    return execFileSync("git", ["--git-dir", this.remote, "rev-parse", "v5"], { encoding: "utf8" }).trim();
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

  seedInbox(id = "item"): void {
    writeFileSync(join(this.repo, `inbox/${id}.json`), "{}\n");
  }

  claudeCalls(): number {
    return this.claudeLines().length;
  }

  // 每次呼叫假 claude 時 content/notes 裡的檔名，依呼叫順序
  claudeSaw(): string[][] {
    return this.claudeLines().map((line) => line.split(" ").slice(2).filter(Boolean));
  }

  private claudeLines(): string[] {
    return readFileSync(this.claudeLog, "utf8").split("\n").filter(Boolean);
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
