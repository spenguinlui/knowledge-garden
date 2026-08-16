---
title: 🔍 語意搜尋
tags: []
---

用「意思」找筆記——不記得關鍵字也沒關係，描述你想找的概念就好。
（左上角的搜尋框是關鍵字全文搜尋，這裡是語意搜尋，兩者互補。）

<div id="kb-search-box">
  <input id="kb-q" type="search" placeholder="例如：怎麼讓 AI 自動整理筆記" style="width:100%;padding:.6rem .8rem;font-size:1rem;border:1px solid var(--lightgray);border-radius:8px;background:var(--light);color:var(--dark)" />
  <div id="kb-results" style="margin-top:1rem"></div>
</div>

<script>
(function () {
  var WORKER_URL = "https://kb-search.WORKERS_SUBDOMAIN.workers.dev";
  function setup() {
    var input = document.getElementById("kb-q");
    var out = document.getElementById("kb-results");
    if (!input || input.dataset.bound) return;
    input.dataset.bound = "1";
    var timer = null;
    function esc(s) {
      var d = document.createElement("div");
      d.textContent = String(s == null ? "" : s);
      return d.innerHTML;
    }
    function render(results) {
      if (!results.length) {
        out.innerHTML = "<p>沒找到相近的筆記 🌱</p>";
        return;
      }
      out.innerHTML = results
        .map(function (r) {
          return (
            '<div style="margin-bottom:1rem;padding:.8rem;border:1px solid var(--lightgray);border-radius:8px">' +
            '<a href="' + esc(r.url) + '" style="font-weight:600">' + esc(r.title) + "</a>" +
            '<div style="font-size:.85rem;color:var(--gray)">' +
            (r.tags || []).map(function (t) { return "#" + esc(t); }).join(" ") +
            " · 相關度 " + esc(r.score) + "</div>" +
            '<div style="font-size:.9rem;margin-top:.3rem">' + esc(r.excerpt) + "…</div></div>"
          );
        })
        .join("");
    }
    function search() {
      var q = input.value.trim();
      if (!q) { out.innerHTML = ""; return; }
      out.innerHTML = "<p>找找看…</p>";
      fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: q }),
      })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (d) { render(d.results || []); })
        .catch(function () { out.innerHTML = "<p>搜尋暫時失靈了，稍後再試 🙏</p>"; });
    }
    input.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(search, 400);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { clearTimeout(timer); search(); }
    });
  }
  document.addEventListener("nav", setup); // Quartz SPA 頁面切換
  if (document.readyState !== "loading") setup();
  else document.addEventListener("DOMContentLoaded", setup);
})();
</script>
