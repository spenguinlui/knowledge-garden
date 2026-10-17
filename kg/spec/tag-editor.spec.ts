import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { browserScript } from "../quartz-plugins/tag-editor/script.ts";

const SITE = "https://knowledge.wayne-liu.com";
const PAGE = '<main><h1 class="article-title">文章</h1><article>內容</article></main>';
const DATA = {
  tags: ["dev", "typescript", "from/web"],
  tagCounts: { dev: 4, life: 2, typescript: 3, existing: 1, "from/web": 8 },
  mainCategories: ["dev", "life"],
};

type Call = { url: string; init?: RequestInit };

async function setup(path: string, options: {
  response?: Response;
  reject?: boolean;
  fetchResponse?: (url: string, init?: RequestInit) => Promise<Response>;
} = {}) {
  const dom = new JSDOM(`<!doctype html><body>${PAGE}</body>`, {
    url: `${SITE}${path}`,
    runScripts: "outside-only",
  });
  const { window } = dom;
  const calls: Call[] = [];
  window.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    if (options.reject) throw new Error("network failed");
    if (options.fetchResponse) return options.fetchResponse(String(input), init);
    return options.response ?? new Response(JSON.stringify(DATA), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  window.eval(browserScript());
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { dom, window, calls };
}

test("文章頁不看編輯記號，向同網址的相對 API 要資料", async () => {
  const s = await setup("/notes/a");
  assert.equal(s.calls.length, 1);
  assert.equal(s.calls[0].url, "/api/notes/a");
  assert.ok(s.window.document.querySelector("#kg-tag-editor"));
});

test("不再處理 #kg-edit，也不讀寫 localStorage 的 kg-edit", async () => {
  const s = await setup("/notes/a#kg-edit");
  assert.equal(s.window.location.hash, "#kg-edit");
  assert.equal(s.window.localStorage.getItem("kg-edit"), null);
  assert.equal(s.calls.length, 1);
});

test("文章頁載入編輯區：主分類、可移除細分標籤、可新增既有或新標籤、唯讀來源與儲存按鈕", async () => {
  const s = await setup("/notes/a");
  assert.equal(s.calls.length, 1);
  assert.equal(s.calls[0].url, "/api/notes/a");
  const doc = s.window.document;
  assert.deepEqual([...doc.querySelectorAll<HTMLSelectElement>("#kg-main-category option")].map((x) => x.value), ["dev", "life"]);
  assert.deepEqual([...doc.querySelectorAll<HTMLElement>(".kg-tag-remove")].map((x) => x.dataset.tag), ["typescript"]);
  assert.deepEqual([...doc.querySelectorAll<HTMLOptionElement>("#kg-tag-options option")].map((x) => x.value), ["existing", "typescript"]);
  assert.equal(doc.querySelector(".kg-source-tag")?.textContent, "from/web");
  assert.ok(doc.querySelector("#kg-tag-input"));
  assert.ok(doc.querySelector("#kg-tag-save"));
});

test("換主分類、加一個、移除一個後儲存：依主分類、細分標籤、來源標籤送 PUT", async () => {
  const s = await setup("/notes/a");
  const doc = s.window.document;
  (doc.querySelector("#kg-main-category") as HTMLSelectElement).value = "life";
  (doc.querySelector(".kg-tag-remove") as HTMLButtonElement).click();
  const input = doc.querySelector("#kg-tag-input") as HTMLInputElement;
  input.value = "new-tag";
  (doc.querySelector("#kg-tag-add") as HTMLButtonElement).click();
  (doc.querySelector("#kg-tag-save") as HTMLButtonElement).click();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(s.calls.length, 2);
  assert.equal(s.calls[1].url, "/api/notes/a/tags");
  assert.equal(s.calls[1].init?.method, "PUT");
  assert.deepEqual(JSON.parse(String(s.calls[1].init?.body)), { tags: ["life", "new-tag", "from/web"] });
  assert.equal(doc.querySelector(".kg-tag-status")?.textContent, "已儲存，網站約 1 分鐘後更新");
});

test("輸入框有字時直接儲存：自動把那個字加進送出的標籤", async () => {
  const s = await setup("/notes/a");
  const doc = s.window.document;
  (doc.querySelector("#kg-tag-input") as HTMLInputElement).value = "typed-only";
  (doc.querySelector("#kg-tag-save") as HTMLButtonElement).click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(JSON.parse(String(s.calls[1].init?.body)), {
    tags: ["dev", "typescript", "typed-only", "from/web"],
  });
});

test("輸入框按 Enter 等同按加入", async () => {
  const s = await setup("/notes/a");
  const doc = s.window.document;
  const input = doc.querySelector("#kg-tag-input") as HTMLInputElement;
  input.value = "by-enter";
  input.dispatchEvent(new s.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  assert.equal(input.value, "");
  assert.ok([...doc.querySelectorAll(".kg-tag-remove")].some((x) => x.textContent?.includes("by-enter")));
});

test("PUT 400 顯示伺服器原因，編輯內容保留", async () => {
  const s = await setup("/notes/a");
  const doc = s.window.document;
  const input = doc.querySelector("#kg-tag-input") as HTMLInputElement;
  input.value = "keep-me";
  (doc.querySelector("#kg-tag-add") as HTMLButtonElement).click();
  s.window.fetch = (async () => new Response(JSON.stringify({ error: "標籤重複" }), { status: 400 })) as typeof fetch;
  (doc.querySelector("#kg-tag-save") as HTMLButtonElement).click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(doc.querySelector(".kg-tag-status")?.textContent, "標籤重複");
  assert.ok([...doc.querySelectorAll(".kg-tag-remove")].some((x) => x.textContent?.includes("keep-me")));
});

test("404 或 5xx 顯示讀不到標籤", async () => {
  for (const status of [404, 500, 503]) {
    const s = await setup("/notes/a", { response: new Response("", { status }) });
    assert.equal(s.window.document.querySelector("#kg-tag-editor")?.textContent, "讀不到這篇的標籤");
  }
});

test("fetch 丟錯顯示讀不到標籤", async () => {
  const s = await setup("/notes/a", { reject: true });
  assert.equal(s.window.document.querySelector("#kg-tag-editor")?.textContent, "讀不到這篇的標籤");
});

test("非文章頁不發請求、不畫東西", async () => {
  for (const path of ["/", "/tags/dev", "/search"] ) {
    const s = await setup(path);
    assert.deepEqual(s.calls, []);
    assert.equal(s.window.document.querySelector("#kg-tag-editor"), null);
  }
});

test("Quartz nav 到另一篇：編輯區換成新文章且只有一個", async () => {
  const s = await setup("/notes/a");
  s.window.history.pushState({}, "", "/notes/b");
  s.window.document.dispatchEvent(new s.window.CustomEvent("nav"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(s.calls.map((x) => x.url), ["/api/notes/a", "/api/notes/b"]);
  assert.equal(s.window.document.querySelectorAll("#kg-tag-editor").length, 1);
});

test("換頁時舊請求晚到：仍只顯示最後一次載入的文章", async () => {
  let resolveFirst!: (response: Response) => void;
  let resolveSecond!: (response: Response) => void;
  let staleJsonCalls = 0;
  const first = new Promise<Response>((resolve) => { resolveFirst = resolve; });
  const second = new Promise<Response>((resolve) => { resolveSecond = resolve; });
  const s = await setup("/notes/a", {
    fetchResponse: (url) => url.endsWith("/a") ? first : second,
  });
  s.window.history.pushState({}, "", "/notes/b");
  s.window.document.dispatchEvent(new s.window.CustomEvent("nav"));
  resolveSecond(new Response(JSON.stringify({
    tags: ["life", "second-note"],
    tagCounts: { life: 1, "second-note": 1 },
    mainCategories: ["dev", "life"],
  }), { status: 200, headers: { "Content-Type": "application/json" } }));
  await new Promise((resolve) => setTimeout(resolve, 0));

  resolveFirst({
    ok: true,
    json: async () => {
      staleJsonCalls += 1;
      return DATA;
    },
  } as Response);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const doc = s.window.document;
  assert.equal((doc.querySelector("#kg-main-category") as HTMLSelectElement).value, "life");
  assert.deepEqual([...doc.querySelectorAll<HTMLElement>(".kg-tag-remove")].map((x) => x.dataset.tag), ["second-note"]);
  assert.equal(doc.querySelectorAll("#kg-tag-editor").length, 1);
  assert.equal(staleJsonCalls, 0, "過期回應應直接丟掉，不再解析或畫面");
});
