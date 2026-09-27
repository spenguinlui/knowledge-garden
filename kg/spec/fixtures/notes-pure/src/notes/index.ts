import pg from "pg";
import { readFileSync } from "node:fs";
import { markdown } from "./markdown/index.ts";

// markdown/ 以外的 notes 檔案可以碰資料庫與檔案
export const notes = [pg, readFileSync, markdown];
