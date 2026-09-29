import { existsSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import type pg from "pg";
import { announceNotes, notifyLine, runCapture, statusOf } from "./capture/index.ts";
import { dbConfig } from "./notes/index.ts";
import { runPublish } from "./publish/index.ts";

export type RoundOptions = {
  kbDir: string;
  db: pg.ClientConfig;
  notify: (message: string) => Promise<void>;
  statusOf: (url: string) => Promise<number | null>;
  sleep: (seconds: number) => Promise<void>;
};

// 一輪：收錄（文章寫進資料庫）→ 佈署目前的網站版本 → 收錄有筆記才發 LINE。
// 只負責串 capture 與 publish 的入口；丟錯就以非 0 結束，由外殼發當掉告警
export async function runRound(options: RoundOptions): Promise<void> {
  const notes = await runCapture(options);
  const siteUpdated = await runPublish(options);
  await announceNotes(notes, siteUpdated, options);
}

// 外殼 scripts/process-inbox.sh 執行這支檔案；測試只 import runRound
if (import.meta.main) {
  const kbDir = fileURLToPath(new URL("../../", import.meta.url));
  const envFile = `${kbDir}.env`;
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  await runRound({
    kbDir,
    db: dbConfig(process.env),
    notify: notifyLine,
    statusOf,
    sleep: (seconds) => setTimeout(seconds * 1000),
  });
}
