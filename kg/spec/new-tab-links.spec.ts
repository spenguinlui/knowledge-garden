import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { parse } from "yaml";
import { browserScript } from "../quartz-plugins/new-tab-links/script.ts";

const ORIGIN = "https://knowledge.wayne-liu.com";

// 下面的 HTML 片段抄自建站結果 public/ 的真實結構（筆記頁、標籤頁、關鍵字搜尋的 result-card、
// 語意搜尋 script.ts 的 render、explorer 的 template-file）；explorer 在建站時只輸出
// href="#" 的樣板，連結是瀏覽器端程式填的，這裡把 href 填成實際會填的筆記網址
const NOTE_PAGE = `
<div class="left sidebar">
  <h2 class="page-title"><a id="site-title" href="..">知識花園</a></h2>
  <div class="explorer"><ul class="explorer-ul">
    <li><a id="explorer-file" href="../notes/quartz-static-site-generator" class="nav-file-title tree-item-self">Quartz</a></li>
    <li><a id="explorer-folder" href="../notes/" class="folder-title">notes</a></li>
  </ul></div>
</div>
<div class="center">
  <nav class="breadcrumb-container" aria-label="breadcrumbs">
    <div class="breadcrumb-element"><a id="crumb-home" href="../">Home</a><p> ❯ </p></div>
    <div class="breadcrumb-element"><a id="crumb-notes" href="../notes/">notes</a><p> ❯ </p></div>
  </nav>
  <ul class="tags"><li><a id="header-tag" href="../tags/rag" class="internal internal-link tag-link">rag</a></li></ul>
  <article class="popover-hint"><div class="markdown-preview-view markdown-rendered">
    <blockquote><p>原文：<a id="external" href="https://developers.cloudflare.com/workers-ai/models/bge-m3/" class="external external-link">developers.cloudflare.com</a></p></blockquote>
    <h2 id="摘要">摘要<a id="heading-anchor" role="anchor" aria-hidden="true" tabindex="-1" data-no-popover="true" href="#摘要" class="internal internal-link"><svg id="anchor-svg" width="18" height="18"></svg></a></h2>
    <p>見 <a id="note-link" href="../notes/quartz-static-site-generator" class="internal internal-link alias" data-slug="notes/quartz-static-site-generator">Quartz</a>
       與 <a id="note-link-code" href="../notes/quartz-static-site-generator" class="internal internal-link"><code id="note-link-code-inner">npx quartz</code></a>
       與 <a id="body-tag" href="../tags/rag" class="internal internal-link tag-link">#rag</a></p>
  </div></article>
</div>
<div class="right sidebar">
  <div class="toc"><a id="toc-link" href="#摘要" data-for="摘要">摘要</a></div>
  <div class="backlinks"><h3>反向連結</h3><ul><li><a id="backlink" href="../notes/mit-python-intro-course" class="internal">MIT Python 入門課</a></li></ul></div>
</div>`;

const TAG_PAGE = `
<div class="center">
  <article class><div class="markdown-preview-view markdown-rendered"></div></article>
  <div class="page-listing"><p>此標籤下有 3 條筆記。</p><div><ul class="section-ul">
    <li class="section-li"><div class="section"><p class="meta"><time datetime="2026-09-21T16:00:00.000Z">2026年9月22日</time></p>
      <div class="desc"><h3><a id="list-title" href="../notes/claude-design-skills-anti-cliche-checklist" class="internal">讓 Claude 做出專業級網站</a></h3></div>
      <ul class="tags"><li><a id="list-tag" class="internal tag-link" href="../tags/ai-skill">ai-skill</a></li></ul></div></li>
  </ul></div></div>
</div>`;

const SEARCH_PAGE = `
<div class="center">
  <article class="popover-hint"><div class="markdown-preview-view markdown-rendered"><p>語意搜尋</p></div></article>
  <div id="kb-search-box"><input id="kb-q" type="search"><div id="kb-results" style="margin-top:1rem">
    <div style="margin-bottom:1rem;padding:.8rem;border:1px solid var(--lightgray);border-radius:8px">
      <a id="semantic-title" href="https://knowledge.wayne-liu.com/notes/bge-m3-embedding" style="font-weight:600">BGE-M3</a>
      <div style="font-size:.85rem;color:var(--gray)">#rag #embedding · 相關度 0.82</div>
    </div>
  </div></div>
</div>`;

// 關鍵字搜尋的結果卡片是 @quartz-community/search 在瀏覽器裡動態建的：
// <a class="result-card" id=slug href=...><h3 class="card-title">…</h3>…</a>；沒結果時的卡片沒有 href
const KEYWORD_RESULTS = `
<div class="search"><div class="search-container active"><div class="search-space"><div class="search-layout"><div class="results-container">
  <a id="result-card" class="result-card" href="../notes/bge-m3-embedding">
    <h3 class="card-title" id="result-card-title"><span class="highlight">BGE</span>-M3</h3>
    <ul class="tags"><li><p>#rag</p></li></ul>
    <p class="card-description" id="result-card-desc">多語向量模型</p>
  </a>
  <a id="result-card-empty" class="result-card no-match"><h3 id="result-card-empty-title">No results.</h3></a>
</div></div></div></div></div>`;

type Setup = {
  window: JSDOM["window"];
  opened: unknown[][];
  bubbled: () => number;
  click: (id: string, init?: MouseEventInit) => MouseEvent;
};

function setup(path: string, body: string): Setup {
  const dom = new JSDOM(`<!doctype html><body>${body}</body>`, {
    url: `${ORIGIN}${path}`,
    runScripts: "outside-only",
  });
  const { window } = dom;
  const opened: unknown[][] = [];
  window.open = ((...args: unknown[]) => {
    opened.push(args);
    return null;
  }) as typeof window.open;
  // 冒泡階段的監聽器：用來確認「事件照常往下走」或「被擋在捕獲階段」
  let bubbled = 0;
  window.document.body.addEventListener("click", () => {
    bubbled += 1;
  });
  window.eval(browserScript());
  return {
    window,
    opened,
    bubbled: () => bubbled,
    click(id, init = {}) {
      const el = window.document.getElementById(id);
      assert.ok(el, `找不到 #${id}`);
      const event = new window.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
        ...init,
      });
      el.dispatchEvent(event);
      return event;
    },
  };
}

function assertOpensNewTab(s: Setup, id: string, expectedUrl: string): void {
  const event = s.click(id);
  assert.deepEqual(s.opened, [[expectedUrl, "_blank", "noopener"]], `#${id} 該開新視窗`);
  assert.equal(event.defaultPrevented, true, `#${id} 原本的換頁要取消`);
  assert.equal(s.bubbled(), 0, `#${id} 不該再往下傳給 Quartz 的換頁腳本`);
}

function assertLeftAlone(s: Setup, id: string, init?: MouseEventInit): void {
  const event = s.click(id, init);
  assert.deepEqual(s.opened, [], `#${id} 不該開新視窗`);
  assert.equal(event.defaultPrevented, false, `#${id} 不該取消換頁`);
  assert.equal(s.bubbled(), 1, `#${id} 事件要照常往下走`);
}

const BGE = `${ORIGIN}/notes/bge-m3-embedding`;
const QUARTZ = `${ORIGIN}/notes/quartz-static-site-generator`;

test("筆記正文連到別篇筆記的連結開新視窗", () => {
  assertOpensNewTab(setup("/notes/bge-m3-embedding", NOTE_PAGE), "note-link", QUARTZ);
});

test("點到筆記連結裡面的子元素（<code>）一樣開新視窗", () => {
  assertOpensNewTab(setup("/notes/bge-m3-embedding", NOTE_PAGE), "note-link-code-inner", QUARTZ);
});

test("分類頁、標籤頁清單的標題連結開新視窗", () => {
  assertOpensNewTab(
    setup("/tags/ui-ux", TAG_PAGE),
    "list-title",
    `${ORIGIN}/notes/claude-design-skills-anti-cliche-checklist`,
  );
});

test("語意搜尋結果的標題連結開新視窗", () => {
  assertOpensNewTab(setup("/search", SEARCH_PAGE), "semantic-title", BGE);
});

test("語意搜尋結果是打字後才動態產生的，也要開新視窗", () => {
  const s = setup("/search", SEARCH_PAGE);
  const out = s.window.document.getElementById("kb-results");
  assert.ok(out);
  out.innerHTML = `<div><a id="late" href="${QUARTZ}">晚到的結果</a></div>`;
  assertOpensNewTab(s, "late", QUARTZ);
});

test("關鍵字搜尋的結果卡片（含卡片裡的標題、說明文字）開新視窗", () => {
  for (const id of ["result-card", "result-card-title", "result-card-desc"]) {
    assertOpensNewTab(setup("/notes/quartz-static-site-generator", KEYWORD_RESULTS), id, BGE);
  }
});

test("關鍵字搜尋「沒有結果」的卡片沒有網址，不開新視窗", () => {
  const s = setup("/", KEYWORD_RESULTS);
  assertLeftAlone(s, "result-card-empty");
});

test("按著 Ctrl、Cmd、Shift、Alt 其中一個，或不是左鍵：照原樣處理", () => {
  const cases: MouseEventInit[] = [
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 },
    { button: 2 },
  ];
  for (const init of cases) {
    assertLeftAlone(setup("/notes/bge-m3-embedding", NOTE_PAGE), "note-link", init);
    assertLeftAlone(setup("/tags/ui-ux", TAG_PAGE), "list-title", init);
    assertLeftAlone(setup("/search", SEARCH_PAGE), "semantic-title", init);
    assertLeftAlone(setup("/", KEYWORD_RESULTS), "result-card", init);
  }
});

test("同一頁的錨點連結（目錄、標題旁的 #）照原樣處理", () => {
  const page = "/notes/bge-m3-embedding";
  assertLeftAlone(setup(page, NOTE_PAGE), "heading-anchor");
  assertLeftAlone(setup(page, NOTE_PAGE), "anchor-svg");
  assertLeftAlone(setup(page, NOTE_PAGE), "toc-link");
});

test("清單頁每篇筆記旁邊的標籤連結、正文裡連到 /tags/ 的連結照原樣處理", () => {
  assertLeftAlone(setup("/tags/ui-ux", TAG_PAGE), "list-tag");
  assertLeftAlone(setup("/notes/bge-m3-embedding", NOTE_PAGE), "body-tag");
  assertLeftAlone(setup("/notes/bge-m3-embedding", NOTE_PAGE), "header-tag");
});

test("左側分類樹、右側 Backlinks、麵包屑、頁首站名的連結照原樣處理", () => {
  for (const id of [
    "explorer-file",
    "explorer-folder",
    "backlink",
    "crumb-home",
    "crumb-notes",
    "site-title",
  ]) {
    assertLeftAlone(setup("/notes/bge-m3-embedding", NOTE_PAGE), id);
  }
});

test("外部連結不由這支程式處理（交給 crawl-links 的 target=_blank）", () => {
  assertLeftAlone(setup("/notes/bge-m3-embedding", NOTE_PAGE), "external");
});

test("quartz.config.yaml：crawl-links 開了 openLinksInNewTab，new-tab-links 外掛已啟用", () => {
  const config = parse(readFileSync(new URL("../../quartz.config.yaml", import.meta.url), "utf8"));
  const plugins: { source: string; enabled?: boolean; options?: Record<string, unknown> }[] =
    config.plugins;
  const crawl = plugins.find((p) => p.source === "@quartz-community/crawl-links");
  assert.ok(crawl, "crawl-links 沒列在設定裡");
  assert.equal(crawl.options?.openLinksInNewTab, true);
  const mine = plugins.find((p) => p.source === "./kg/quartz-plugins/new-tab-links");
  assert.ok(mine, "new-tab-links 沒列在設定裡");
  assert.equal(mine.enabled, true);
});
