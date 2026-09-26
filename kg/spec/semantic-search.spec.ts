import assert from "node:assert/strict";
import { test } from "node:test";
import type { QuartzComponentProps } from "@quartz-community/types";
import { render } from "preact-render-to-string";
import { SemanticSearch, init } from "../quartz-plugins/semantic-search/index.ts";

const WORKER_URL = "https://search.example.test/query";

function propsFor(slug: string): QuartzComponentProps {
  return { fileData: { slug } } as unknown as QuartzComponentProps;
}

// 這個測試要排第一個：之後的測試都會先呼叫 init
test("沒經過 init 拿到 Worker 網址就建元件，直接報錯", () => {
  assert.throws(() => SemanticSearch(), /workerUrl/);
});

test("slug 是 search 的頁面畫出搜尋框與結果區", () => {
  init({ workerUrl: WORKER_URL });
  const html = render(SemanticSearch()(propsFor("search")) as never);
  assert.match(html, /<input[^>]*id="kb-q"/);
  assert.match(html, /<div[^>]*id="kb-results"/);
});

test("其他頁面什麼都不畫", () => {
  init({ workerUrl: WORKER_URL });
  const Component = SemanticSearch();
  assert.equal(render(Component(propsFor("index")) as never), "");
  assert.equal(render(Component(propsFor("notes/some-note")) as never), "");
});

test("瀏覽器端程式呼叫的是 init 傳進來的 Worker 網址", () => {
  init({ workerUrl: WORKER_URL });
  const script = String(SemanticSearch().afterDOMLoaded);
  assert.ok(script.includes(JSON.stringify(WORKER_URL)), script);
  assert.ok(!script.includes("kb-search.kb-search.workers.dev"));
});

test("元件的 css 只在 search 頁藏掉文章後的分隔線、拉近搜尋框", () => {
  init({ workerUrl: WORKER_URL });
  const css = String(SemanticSearch().css);
  assert.match(css, /body\[data-slug="search"\] article \+ hr\s*\{\s*display:\s*none;?\s*\}/);
  assert.match(css, /body\[data-slug="search"\] \.page > #quartz-body \.page-footer\s*\{\s*margin-top:\s*0;?\s*\}/);
  // 每條規則都限定在 search 頁，其他頁面的 hr 與頁尾不受影響
  const selectors = [...css.matchAll(/([^{}]+)\{/g)].map((rule) => rule[1].trim());
  assert.ok(selectors.length > 0);
  for (const selector of selectors) {
    assert.ok(selector.startsWith('body[data-slug="search"] '), selector);
  }
});
