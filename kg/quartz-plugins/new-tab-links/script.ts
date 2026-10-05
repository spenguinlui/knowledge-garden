// 瀏覽器端程式：在 document 上掛一個捕獲階段的 click 監聽器，
// 符合條件的站內連結改用 window.open 開新視窗，原本那一頁留在原地。
// 不用「幫連結加 target=_blank」：語意搜尋結果是打字後才動態產生的，載入時加不到；
// 而且 Quartz 的換頁腳本只看被點到的那個元素有沒有 target，點到連結裡的子元素照樣會同視窗換頁。
// 外部連結不在這裡處理，由 crawl-links 的 openLinksInNewTab 加 target="_blank"。
export function browserScript(): string {
  return `(function () {
  if (window.__kbNewTabLinks) return;
  window.__kbNewTabLinks = true;
  // 文章正文、清單頁的文章標題、語意搜尋結果、關鍵字搜尋的結果卡片
  var SELECTOR = "article a[href], .page-listing .section-li h3 a[href], #kb-results a[href], a.result-card[href]";
  document.addEventListener(
    "click",
    function (e) {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      if (!(e.target instanceof Element)) return;
      var a = e.target.closest(SELECTOR);
      if (!a) return;
      var url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.indexOf("/notes/") !== 0) return;
      if (url.pathname === location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      window.open(url.href, "_blank", "noopener");
    },
    true
  );
})();
`;
}
