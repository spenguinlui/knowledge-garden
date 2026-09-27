import pg from "pg";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

export const markdown = [pg, readFileSync, execFileSync];
