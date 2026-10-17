# TASK：網站改由 mini 提供，文章頁直接改標籤

> 工作資料夾 `~/sideproject/worktrees/knowledge-garden-tag-editor`（分支 `tag-editor`）。
> 分支上已有兩個 commit（`21198b9`、`f5eb49e`）是前兩版，這次在它們上面改，沒變的部分不要重寫。
> 2026-10-17：實作驗收完後，`v5` 先上了「改由 mini-deploy 部署」（`17c0f72`，刪掉 `scripts/update-code.sh`、`.github/workflows/deploy.yml`，
> 改成 GitHub 雲端跑測試、通過後 mini-deploy 更新 mini 的程式碼再呼叫 `deploy/update.sh`）。這個分支已接到它後面，
> 原本寫在 `update-code.sh` 的「重啟網站服務」改放 `deploy/update.sh`，測試在 `kg/spec/deploy-update.spec.ts`（Claude 決定）。

## 要解決什麼問題

使用者要在文章頁上自己改標籤。前兩版把它做成「網站放 Cloudflare Pages、編輯服務放 mini 的另一個網址」，
頁面和資料分在兩地，於是長出一堆補接縫的零件：跨網址設定、補登入跳轉、服務自己再驗一次登入、
收錄完回頭打正式網址確認上線、為了那個確認要建的通行憑證。使用者判定這是過度設計（2026-10-09）。

改成一般網站的樣子，跟 `jobs.wayne-liu.com` 同一種接法：

```
瀏覽器 → Cloudflare Access 登入（現成的規則「wayne only」）→ Cloudflare 通道 → mini 上一支服務 → 資料庫
```

同一支服務負責把頁面傳給瀏覽器，也負責收改標籤的請求。寫進資料庫成功就是完成，不再有事後確認。

## 做完怎麼確認（驗收條件）

先改測試、跑到紅、貼出紅的輸出，才准動實作。測試比照 request spec：送請求，看資料庫那一列和回應。

- [ ] `kg/spec/db/web.spec.ts`（由 `edit.spec.ts` 改名改寫；起真的服務，port 用 0，資料庫用測試庫，`public` 用暫存資料夾）：
      1. `PUT /api/notes/<slug>/tags` 送合格的標籤 → 200，資料庫那篇的 `tags` 變成送來的順序，其他欄位不變。
      2. 送不合格的標籤（沿用既有那一組案例）→ 400 加原因，資料庫沒變。slug 不存在 → 404。
      3. `GET /api/notes/<slug>` → 200，有這篇的 `tags`、全站標籤篇數、主分類清單；slug 不存在 → 404。
      4. 請求不用帶任何登入憑證就會成功（登入由 Cloudflare 擋在前面，服務不管）。
      5. 頁面：`GET /notes/a` 拿到 `public/notes/a.html` 的內容；`GET /` 拿到 `index.html`；
         不存在的路徑 → 404，內容是 `public/404.html`；`/../.env` 這類想跳出資料夾的路徑拿不到檔案。
         回應帶 `Cache-Control: no-cache`。
      6. `public` 資料夾整個被換掉之後，下一個請求拿到的是新內容（服務不能把檔案清單記在記憶體裡）。
- [ ] `kg/spec/tag-editor.spec.ts`：既有的畫面、儲存、400、站內換頁、晚到的舊回應這幾條照留；
      請求改打同網址的相對路徑 `/api/notes/<slug>`；讀取失敗（不是 200，或 `fetch` 丟錯）一律顯示「讀不到這篇的標籤」；
      登入跳轉、`opaqueredirect`、`sessionStorage`、「重新登入」連結相關的測試與程式全部刪掉。
      儲存成功的訊息改成「已儲存，網站約 1 分鐘後更新」。
- [ ] `kg/spec/db/publish.spec.ts`：一次網站更新跑的指令是「裝外掛 → `npx quartz build -o public.next`」，
      成功後 `public/` 是新產生的內容、`public.next` 不存在；建站失敗時原本的 `public/` 原封不動；不再呼叫 `wrangler`。
      重試次數、失敗通知、搜尋索引那幾條照舊要綠。
- [ ] `kg/spec/db/capture.spec.ts` 與整輪測試：這輪有收錄而且網站更新成功 → 直接發「🌱 已上花園」，沒有等待、沒有查網址；
      網站更新失敗 → 既有的失敗訊息。「站台還在建」相關的測試、訊息、`kg/spec/site-status.spec.ts` 刪掉。
- [ ] `kg/spec/deploy-update.spec.ts`：部署入口 `deploy/update.sh` 重啟的是 `com.liu.kb-web`；服務還沒裝時不算部署失敗。
      `kg/spec/boundaries.spec.ts`：規則改名 `web-notes-only`，一樣擋得住。`kg/spec/db/shell.spec.ts`、`duplicated-constants.spec.ts` 跟著改。
- [ ] 這條指令沒有任何輸出：
      `grep -rnI "jose\|Access-Control\|/login\|kg-edit\|statusOf\|wrangler\|garden-api\|CF_ACCESS" kg/src kg/quartz-plugins scripts kg/package.json quartz.config.yaml`
- [ ] `cd kg && nice npm test`、`cd kg && nice npm run test:db`、根目錄 `nice npm test` 全綠（邊界檢查、歸屬檢查都在裡面）。
- [ ] `git diff --stat 21198b9~1` 只有「範圍內」列的路徑。

**使用者驗證（上線後）**

1. 用無痕視窗開 https://knowledge.wayne-liu.com → 先看到 Cloudflare 登入，過了才進得去。
2. 開任一篇筆記 → 標題下方有標籤編輯區。加一個標籤（例如 `測試標籤`）按儲存 → 看到「已儲存」。
   約一分鐘後重新整理 → 標籤列出現它。再移除、儲存，一分鐘後消失。
3. 用 LINE 丟一則新的東西 → 收到「🌱 已上花園」，在已登入的瀏覽器點連結打得開。

## 動到的模組

- **web（原 `edit` 改名）**：`kg/src/web/`。mini 上常駐的網站服務：把 `public/` 裡產生好的頁面傳給瀏覽器、收改標籤的請求。只依賴 notes。
- publish：建站改成先產生到 `public.next`，成功才整個換上 `public`；拿掉上傳到 Cloudflare Pages 那一步。
- capture：網站更新成功就發 LINE，拿掉回頭查網址。
- site：`tag-editor` 外掛拿掉登入相關程式，請求改打同網址。
- 外殼：兩個常駐設定檔改名、`deploy/update.sh`、`process-inbox.sh`、`kg/src/main.ts` 跟著改。
- notes：不動（前兩版加的四個函式照用）。

## 範圍內

- `kg/src/edit/` 改名 `kg/src/web/`。留下：服務本體、`tags.ts`（標籤檢查，不動）、`serve.ts`（讀 `.env`、聽 `127.0.0.1:41162`、
  頁面資料夾是 repo 根目錄的 `public`）、`index.ts`。刪掉：`access.ts`、站台網址常數、`/login`、`OPTIONS`、CORS 標頭、`Origin` 檢查。
  頁面檔案用 `sirv` 套件提供（加進 `kg/package.json`；`dev: true` 讓它每次請求都讀磁碟），`jose` 從 `kg/package.json` 拿掉。
- `kg/src/publish/steps.ts`、`run.ts`：建站輸出到 `public.next`，成功後把 `public` 換成它（舊的刪掉）；刪掉 `wrangler pages deploy`。
  `wrangler` 從 `kg/package.json` 拿掉。`.gitignore` 加 `public.next`、`public.prev`（換資料夾時暫用的名字）。
- `kg/src/capture/`：刪 `site.ts`；`announce.ts` 只剩「網站更新成功發已上花園、失敗發失敗訊息」；`messages.ts` 刪 `stillBuildingMessage`；`index.ts` 不再公開 `statusOf`。
  `kg/src/main.ts`：拿掉 `statusOf`、`sleep`、服務憑證。
- `kg/quartz-plugins/tag-editor/`、`quartz.config.yaml`（拿掉 `apiUrl` 選項）。
- `scripts/com.liu.kb-edit.plist` → `scripts/com.liu.kb-web.plist`（跑 `node kg/src/web/serve.ts`，log 寫 `kb-web.log`）；
  `scripts/com.liu.kb-edit-tunnel.plist` → `scripts/com.liu.kb-tunnel.plist`（log 寫 `kb-tunnel.log`）；`deploy/update.sh` 重啟 `com.liu.kb-web`；
  `scripts/process-inbox.sh` 拿掉為了 `wrangler` 加的 PATH 與註解。
- `kg/.dependency-cruiser.cjs`、上面列到的測試檔、`kg/spec/db/harness.ts`。
- 文件：`ARCHITECTURE.md`（模組表與「刻意保留的複本」）、`README.md`、`CLAUDE.md`、`AGENTS.md` 改成新的樣子，舊說法直接刪。

## 範圍外（這次不准碰）

- `quartz/`、根目錄 `package.json`、`workers/`（語意搜尋維持現狀）、`content/`、`.claude/skills/capture/`
- `kg/src/notes/`
- capture 的收錄流程：`run.ts`、`jobs.ts`、`claude.ts`、`rules.ts`、`send.ts`、`line.ts`、`schema.sql`
- publish 的紀錄表與索引：`schema.sql`、`deploys.ts`、`git.ts`，以及重試、通知、索引的邏輯
- `kg/quartz-plugins/semantic-search/`、`kg/quartz-plugins/new-tab-links/`、`quartz.ts`
- `scripts/backup-db.sh`、`scripts/pull-notes.sh`、`scripts/com.liu.kb-inbox.plist`、`scripts/com.liu.kb-backup.plist`、`compose.yaml`、`.github/`
- 不准在服務裡寫任何登入或驗證身分的程式。不准做「存完立刻重建」的觸發。不准留相容舊網址或舊設定的分支。
- 不准 commit、push、ssh 連 mini、動 Cloudflare 設定。`TASK.md` 不要改。建站由 Claude 驗收時跑，你不要跑。
- 筆電會過熱：測試一次跑一套、前面加 `nice`，不要平行。

## 已裁決的分歧點

- 網站從 Cloudflare Pages 搬到 mini，比照 jobs；代價是 mini 關機或斷網時網站打不開 → 使用者決定（2026-10-09）。
- 登入全交給 Cloudflare Access，服務本身不驗身分 → 使用者決定。服務只聽 `127.0.0.1`，外面只有通道連得到（Claude 決定）。
- 收錄完不再回頭查網址，網站更新成功就發 LINE → 使用者決定。
- 模組改名 `web`：它現在是整個網站的服務，不只管編輯（Claude 決定）。
- 頁面檔案用 `sirv` 提供，不自己寫路徑處理：`/notes/a` 對到 `a.html`、資料夾對到 `index.html`、擋跳出資料夾的路徑它都有（Claude 決定）。
- 建站先產生到 `public.next` 再換上：Quartz 建站一開始會清空輸出資料夾，直接產生在 `public` 的話，那幾秒網站是空的（Claude 決定）。
- 這個任務裡頁面更新仍靠既有的每分鐘那一輪。把排程抓取換成事件觸發（收錄請求與存標籤都直接觸發處理，拿掉排程、inbox 資料夾與鎖）
  是緊接著的下一個任務：它要連 LINE 機器人交付輸入的方式一起改，而且要先有這個任務做出來的常駐服務才接得到觸發。
  兩種做法不能並存（會有兩個程式同時建站），所以這次不准先做一半（Claude 建議的順序，待使用者確認）。
- 回應一律 `Cache-Control: no-cache`：改完標籤重新整理要看得到新頁面；只有一個使用者，不需要快取（Claude 決定）。
- 標籤規則、`updateTags` 只改標籤一欄、不拿收錄的鎖、主分類選單來自資料庫：沿用前兩版的裁決。
- 語意搜尋仍是 Cloudflare 上的服務，等第③層再搬（Claude 決定）。
- 鎖站之後，LINE 訊息裡的連結預覽會變成 Cloudflare 登入頁，看不到筆記標題 → 已告知使用者。

## 上線步驟（驗收過後由 Claude 做，標「使用者」的要請使用者按）

順序不能換：Access 要先掛上，才能把網址指到 mini，否則改標籤的請求會有一段時間沒人擋。
使用者先做第 1 步，其餘 Claude 接著一口氣做完，中間不留空檔（mini 換新程式之後就不再上傳到 Cloudflare Pages，
拖著不切網址的話，新收錄的筆記在舊站上看不到）。

1. **使用者**：Cloudflare Zero Trust 建一個應用程式，網址 `knowledge.wayne-liu.com`，掛「wayne only」。
   Claude 確認沒登入時 `curl` 正式網址得到 302。
2. 合進 `v5`，等 GitHub 雲端測試綠、mini-deploy 更新程式碼、mini 跑完一輪。在 mini 裝 `com.liu.kb-web` 並啟動，
   確認 `curl http://127.0.0.1:41162/notes/<某篇>` 回 200。
3. mini 的通道設定 `~/.cloudflared/knowledge-garden.yml` 改成 `knowledge.wayne-liu.com → http://127.0.0.1:41162`，
   裝 `com.liu.kb-tunnel` 並啟動，把 `knowledge.wayne-liu.com` 的 DNS 改指通道。切換時網站會中斷幾分鐘。
4. 確認沒登入仍是 302，再請使用者做三項驗證。
5. **使用者**（時機自己決定）：刪掉 `garden-api.wayne-liu.com` 的 DNS 記錄、Cloudflare Pages 的 `knowledge-garden` 專案（備用網址 `pages.dev` 跟著消失）。
