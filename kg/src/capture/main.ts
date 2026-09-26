import { existsSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { dbConfig } from "./jobs.ts";
import { notifyLine } from "./line.ts";
import { runCapture } from "./run.ts";
import { statusOf } from "./site.ts";

// 外殼 scripts/process-inbox.sh 執行的程式；丟錯就以非 0 結束，由外殼發當掉告警
const kbDir = fileURLToPath(new URL("../../../", import.meta.url));
const envFile = `${kbDir}.env`;
if (existsSync(envFile)) process.loadEnvFile(envFile);

await runCapture({
  kbDir,
  db: dbConfig(process.env),
  notify: notifyLine,
  statusOf,
  sleep: (seconds) => setTimeout(seconds * 1000),
});
