# TASK：文章連結與外部連結改成開新視窗

## 要解決什麼問題

現在在站上點連結，目前這一頁會被換掉：從分類頁點一篇筆記，清單就不見了；點「原文」連結，整個人被帶離花園，
要按上一頁才回得來。使用者想一次開好幾篇對照著看，原本那一頁要留在原地。

## 做完怎麼確認（驗收條件）

先寫測試、跑到紅、貼出紅的輸出，才准寫實作。

- [ ] `kg/spec/new-tab-links.spec.ts`（新，用 jsdom 這個在 Node 裡模擬瀏覽器頁面的套件，把外掛的瀏覽器端程式跑起來，
      `window.open` 換成記錄呼叫的假函式）。HTML 片段要從實際建站結果 `public/` 抄真實結構，不准自己編 class 名：
      - 一般左鍵點下列連結 → `window.open(該連結網址, "_blank", "noopener")` 被呼叫一次，原本的換頁被取消（`defaultPrevented` 為 true）：
        1. 筆記正文裡連到別篇筆記的連結（網址路徑是 `/notes/...`），包含點到連結裡面的子元素（例如連結文字包在 `<code>` 裡）。
        2. 分類頁、標籤頁文章清單的標題連結。
        3. `/search` 語意搜尋結果的標題連結（`#kb-results` 裡）。
        4. 左上角關鍵字搜尋的結果卡片。
      - 下列情況 `window.open` 不被呼叫、事件照常往下走：
        1. 按著 Ctrl、Cmd、Shift、Alt 其中一個，或不是左鍵。
        2. 同一頁的錨點連結（目錄、標題旁的 `#`）。
        3. 清單頁每篇筆記旁邊的標籤連結、正文裡連到 `/tags/...` 的連結。
        4. 左側「分類」樹、右側 Backlinks、麵包屑、頁首站名的連結。
        5. 外部連結（交給下一條的設定處理，不要重複開兩個視窗）。
- [ ] `kg/spec/new-tab-links.spec.ts`：讀 `quartz.config.yaml`，`@quartz-community/crawl-links` 的 `options.openLinksInNewTab` 是 `true`，
      而且 `./kg/quartz-plugins/new-tab-links` 這個外掛有列在裡面、`enabled: true`。
- [ ] `KB_DIR=$PWD scripts/pull-notes.sh` 拉文章後 `nice npx quartz build`（單次、不要 `--serve`、不要平行跑別的）成功；
      `public/notes/bge-m3-embedding.html` 裡「原文」那個連結帶 `target="_blank"`。
- [ ] `cd kg && npm test` 全綠（邊界檢查、歸屬檢查都認得新外掛）；根目錄 `npm test` 全綠。
- [ ] 使用者驗證（上線後，在 https://knowledge.wayne-liu.com ）：
      1. 開任一篇筆記，點開頭的「原文」→ 來源網站開在新視窗，筆記那一頁還在。
      2. 左側「分類」點一個主分類，在清單上點一篇筆記標題 → 筆記開在新視窗，清單頁還在。
      3. 到 `/search` 搜一個詞，點一筆結果 → 開在新視窗，搜尋結果還在；左上角搜尋框同樣操作，結果一樣。
      4. 在筆記正文點一個連到別篇筆記的連結 → 開在新視窗。
      5. 點左側「分類」樹裡的項目、右側 Backlinks → 跟以前一樣在同一個視窗換頁。

## 動到的模組

- site：`quartz.config.yaml`、新外掛 `kg/quartz-plugins/new-tab-links/`。

## 範圍內

- `quartz.config.yaml`：`crawl-links` 加 `openLinksInNewTab: true`；加一筆 `./kg/quartz-plugins/new-tab-links` 外掛設定。
- 新外掛 `kg/quartz-plugins/new-tab-links/`（照 `semantic-search/` 的寫法：`index.ts` 元件什麼都不畫，
  `script.ts` 回傳瀏覽器端程式字串掛在 `afterDOMLoaded`）、`kg/spec/new-tab-links.spec.ts`、`kg/package.json` 加 devDependency `jsdom`（與型別）。
- `ARCHITECTURE.md` 模組表 site 那列的路徑加上新外掛資料夾、職責補一句。

## 範圍外（這次不准碰）

- `quartz/`、根目錄 `package.json`、`node_modules/@quartz-community/*`（不准改別人的外掛，也不准 patch）
- `kg/src/`、`workers/`、`scripts/`、`content/`、`.claude/skills/capture/`（不准靠改筆記內容或收錄規則來達成）
- `kg/quartz-plugins/semantic-search/`（搜尋結果的開新視窗由新外掛處理，這個外掛的程式不動）
- `quartz.config.yaml` 其他設定、`quartz.ts`
- 不准 commit、push、ssh 連 mini（上線由 Claude 做）

## 已裁決的分歧點

- 「文章連結」的範圍是清單頁的文章標題、兩種搜尋的結果、正文裡連到別篇筆記的連結；左側分類樹、右側 Backlinks 與關聯圖維持同視窗 → 使用者決定。
- 所有外部連結都開新視窗，不只「原文」那一行 → 使用者決定。
- 外部連結用 `crawl-links` 外掛內建的 `openLinksInNewTab` 開關，不自己寫（Claude 決定）。
- 站內連結用一個新的本機外掛處理，做法是在 `document` 上掛一個捕獲階段（事件從外層往內傳、比其他監聽器早執行的那一段）的 click 監聽器：
  點到的連結符合條件就 `preventDefault()`、`stopPropagation()`，再 `window.open(網址, "_blank", "noopener")`。
  不用「幫連結加 `target="_blank"` 屬性」的做法，原因有兩個：搜尋結果是打字後才動態產生的，頁面載入時加不到；
  而且 Quartz 的站內換頁腳本（`quartz/components/scripts/spa.inline.ts` 第 29 行）只檢查被點到的那個元素本身有沒有 `target`，
  點到連結裡的子元素時照樣會搶去同視窗換頁（Claude 決定）。
- `stopPropagation()` 的連帶效果是關鍵字搜尋的浮層不會自動關掉，這正是要的結果（搜尋結果留著）（Claude 決定）。
- 新外掛獨立一個資料夾，不塞進 `semantic-search/`：它管的是全站連結，跟語意搜尋無關（Claude 決定）。
- 判斷「哪些連結要開新視窗」的選擇器寫死在瀏覽器端程式裡，不做成 `quartz.config.yaml` 的選項：目前只有一組規則（Claude 決定）。
- 測試用 jsdom：要驗的是真的選擇器比對與事件傳遞，自己寫假 DOM 驗不到（Claude 決定）。
- 筆電會過熱：建站只跑一次、加 `nice`，不要反覆建站，也不要開 `--serve`（Claude 決定）。

## 上線步驟（驗收過後由 Claude 做）

1. commit、push 到 `origin v5`；GitHub Actions 在 mini 拉下程式碼，下一輪（每 60 秒）建站佈署。
2. 確認 Actions 綠燈、線上頁面的「原文」連結帶 `target="_blank"`，再請使用者做上面五項驗證。
