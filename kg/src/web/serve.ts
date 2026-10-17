import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dbConfig } from "../notes/index.ts";
import { createWebServer } from "./server.ts";

const WEB_PORT = 41162;

export function startWebService(env: NodeJS.ProcessEnv = process.env) {
  const publicDir = fileURLToPath(new URL("../../../public", import.meta.url));
  const server = createWebServer({ db: dbConfig(env), publicDir });
  server.listen(WEB_PORT, "127.0.0.1");
  return server;
}

const entry = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (entry) {
  const envFile = fileURLToPath(new URL("../../../.env", import.meta.url));
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  startWebService();
}
