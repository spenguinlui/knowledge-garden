import type pg from "pg";

// 資料庫連線設定：讀 .env 載進來的環境變數，收錄、佈署、命令列入口共用
export function dbConfig(env: NodeJS.ProcessEnv): pg.ClientConfig {
  return {
    host: env.PGHOST ?? "127.0.0.1",
    port: Number(env.PGPORT ?? 41161),
    database: env.PGDATABASE ?? "knowledge_garden",
    user: "knowledge_garden",
    password: env.POSTGRES_PASSWORD,
  };
}
