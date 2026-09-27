import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { dbConfig } from "./db.ts";
import { exportNotes, importNotes } from "./files.ts";

// 命令列入口：把一個資料夾的筆記匯入資料庫，或把資料庫的文章匯出到一個資料夾（上線搬家、手動檢查用）。
// 跟 kg/src/main.ts 一樣先載 repo 根目錄的 .env 拿資料庫設定（已經設好的環境變數不會被蓋掉）
const [command, dir] = process.argv.slice(2);
if ((command !== "import" && command !== "export") || dir === undefined) {
  console.error("用法：node kg/src/notes/cli.ts import <資料夾> | export <資料夾>");
  process.exit(2);
}

const envFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const client = new pg.Client({ ...dbConfig(process.env), connectionTimeoutMillis: 10_000 });
await client.connect();
try {
  const folder = resolve(dir);
  if (command === "import") {
    console.log(`已從 ${folder} 匯入 ${(await importNotes(client, folder)).length} 篇`);
  } else {
    console.log(`已匯出 ${(await exportNotes(client, folder)).size} 篇到 ${folder}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await client.end();
}
