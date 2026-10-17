import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import type http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { createWebServer } from "../../src/web/index.ts";
import { createDatabase, dropDatabase, putNote, query, testDb } from "./harness.ts";

let baseUrl = "";
let server: http.Server;
let root = "";
let publicDir = "";

function writeSite(dir: string, version: string): void {
  mkdirSync(join(dir, "notes"), { recursive: true });
  writeFileSync(join(dir, "index.html"), `home ${version}`);
  writeFileSync(join(dir, "notes/a.html"), `note ${version}`);
  writeFileSync(join(dir, "404.html"), `missing ${version}`);
}

before(async () => {
  await createDatabase();
  root = mkdtempSync(join(tmpdir(), "web-spec-"));
  publicDir = join(root, "public");
  writeSite(publicDir, "one");
  server = createWebServer({ db: testDb, publicDir });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error?: Error) => error ? reject(error) : resolve()));
  rmSync(root, { recursive: true, force: true });
  await dropDatabase();
});

beforeEach(async () => {
  await query("TRUNCATE notes.articles");
  await putNote("a", "body a\n");
  await putNote("b", "body b\n");
  await query("UPDATE notes.articles SET title = 'A title', tags = '{dev,old,from/web}', updated_at = '2026-01-01T00:00:00Z' WHERE slug = 'a'");
  await query("UPDATE notes.articles SET title = 'B title', tags = '{life,old}', updated_at = '2026-01-02T00:00:00Z' WHERE slug = 'b'");
});

const request = (path: string, options: RequestInit = {}) => fetch(`${baseUrl}${path}`, options);
const snapshot = () => query<Record<string, unknown>>("SELECT * FROM notes.articles ORDER BY slug");

test("GET 不用登入憑證，回文章標籤、全站標籤篇數、主分類；不存在回 404", async () => {
  const response = await request("/api/notes/a");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    tags: ["dev", "old", "from/web"],
    tagCounts: { dev: 1, life: 1, old: 2, "from/web": 1 },
    mainCategories: ["dev", "life"],
  });
  assert.equal((await request("/api/notes/missing")).status, 404);
});

test("PUT 不用登入憑證，依送來的順序改 tags，其他欄位不變", async () => {
  const before = await snapshot();
  const response = await request("/api/notes/a/tags", {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags: ["life", "new", "from/web"] }),
  });
  assert.equal(response.status, 200, await response.text());
  const after = await snapshot();
  assert.deepEqual(after[1], before[1]);
  assert.deepEqual(after[0], { ...before[0], tags: ["life", "new", "from/web"], updated_at: after[0].updated_at });
});

test("不合規 tags 一律 400、有原因且不寫資料庫；slug 不存在回 404", async () => {
  const invalid: unknown[] = [
    "dev", [], Array.from({ length: 11 }, (_, i) => i === 0 ? "dev" : `tag-${i}`),
    ["dev", "same", "same"], ["dev", ""], ["dev", "two words"], ["dev", "a,b"], ["dev", 'a"b'],
    ["dev", "#hash"], ["dev", "[tag]"], ["unknown-main", "tag"], ["dev", "from/web", "tag"],
    ["dev", "from/a", "from/b"], ["dev", "a/b"], ["from/web"],
    ["dev", "123"], ["dev", "true"], ["dev", "null"], ["dev", "{x}"], ["dev", "a:"],
    ["dev", "-x"], ["dev", "!x"], ["dev", "&x"], ["dev", "*x"],
  ];
  for (const tags of invalid) {
    const before = await snapshot();
    const response = await request("/api/notes/a/tags", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags }),
    });
    assert.equal(response.status, 400, JSON.stringify(tags));
    assert.match(String((await response.json() as { error?: string }).error), /.+/, JSON.stringify(tags));
    assert.deepEqual(await snapshot(), before, JSON.stringify(tags));
  }
  assert.equal((await request("/api/notes/missing/tags", {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags: ["dev"] }),
  })).status, 404);
});

test("頁面由 public 提供，不存在走 404.html，所有回應不快取，不能跳出 public", async () => {
  writeFileSync(join(root, ".env"), "secret");
  for (const [path, status, body] of [
    ["/notes/a", 200, "note one"], ["/", 200, "home one"], ["/missing", 404, "missing one"],
  ] as const) {
    const response = await request(path);
    assert.equal(response.status, status, path);
    assert.equal(await response.text(), body, path);
    assert.equal(response.headers.get("Cache-Control"), "no-cache", path);
  }
  const escaped = await request("/..%2f.env");
  assert.notEqual(await escaped.text(), "secret");
});

test("public 整個換掉後，下一個請求拿到新內容", async () => {
  assert.equal(await (await request("/notes/a")).text(), "note one");
  const next = join(root, "public.next");
  const previous = join(root, "public.previous");
  writeSite(next, "two");
  renameSync(publicDir, previous);
  renameSync(next, publicDir);
  rmSync(previous, { recursive: true });
  assert.equal(await (await request("/notes/a")).text(), "note two");
});
