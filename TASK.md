# TASK：第②層 5b-2，建站、佈署、更新搜尋索引搬到 mac mini（文章仍在 git）

## 要解決什麼問題

下一步（5b-3）文章會搬進 mini 的 Postgres，`content/notes` 退出 git，GitHub 上就沒有文章可以建站了。
所以建站、佈署到 Cloudflare Pages、更新 Vectorize 搜尋索引，要先搬到 mini 上跑穩；這次文章還在 git，
網站內容不會變，只換「誰來建站」。搬完後刪掉 GitHub 上的兩個自動化（`deploy.yml`、`vectorize.yml`），
佈署只剩 mini 一個地方。

名詞：

- **建站**：`npx quartz build` 把 `content/` 轉成 `public/` 靜態網頁。
- **佈署**：`wrangler pages deploy` 把 `public/` 上傳到 Cloudflare Pages（專案 `knowledge-garden`，分支 `v5`）。
- **更新索引**：`scripts/index-notes.mjs` 把有變動的筆記轉成向量寫進 Vectorize（`kb-index`），`/search` 靠它。
- **一輪**：mini 的 launchd `com.liu.kb-inbox` 每次執行 `scripts/process-inbox.sh` 叫一輪。

## 做完怎麼確認（驗收條件）

先寫測試、跑到紅、貼出紅的輸出，才准寫實作。新測試放 `kg/spec/db/publish.spec.ts`，跑在 `cd kg && npm run test:db`。
建站、佈署用 `PATH` 前置的假 `npx`、假 `wrangler` 攔截（記下參數、可指定失敗）；測試用的暫存 repo 裡放假的
`scripts/index-notes.mjs`（記下參數與 stdin）。情境：

- [ ] 1 有新 commit 還沒佈署過：依序建站、佈署（參數含 `pages deploy public --project-name=knowledge-garden --branch=v5`）、
      更新索引（stdin 是「上次成功佈署的 commit」到 HEAD 之間 `content/**/*.md` 的 `git diff --name-status`）；
      `publish.deploys` 記下這個 commit 為 done。
- [ ] 2 HEAD 已經佈署過：不建站、不佈署、不更新索引。
- [ ] 3 從來沒有成功佈署紀錄（或上次的 commit 已不在歷史裡）：索引用 `--all` 全量重建。
- [ ] 4 建站失敗：不佈署、不更新索引，記 failed、嘗試 1 次、存錯誤尾段；佈署失敗、索引失敗同樣記 failed。
- [ ] 5 同一個 commit 連續失敗：每輪重試，第 3 次失敗發一則 LINE「❌ knowledge-garden 網站更新失敗（已重試 3 次），
      詳見 mini 的 ~/Library/Logs/kb-inbox.log」，第 4 輪不再重試這個 commit；出現新 commit 就照常重試。
- [ ] 6 inbox 是空的、GitHub 上有筆電 push 的新 commit：這一輪 pull 下來並佈署。
- [ ] 7 同一輪有收錄：筆記 commit、push → 佈署 → 網址變 200 → 才發「🌱 已上花園」（沿用現有訊息與輪詢）；
      佈署失敗則發「🌱 已收錄，網站更新失敗，下一輪會自動重試：」加網址，不發「已上花園」。
- [ ] 8 既有收錄測試照新流程調整後全綠（pull 移出收錄，其餘情境語意不變）；`shell.spec.ts` 補：根目錄
      `node_modules` 缺或 `package-lock.json` 比較新時先 `npm ci`。
- [ ] `cd kg && npm test` 與 `npm run test:db` 全綠；根目錄 `npm test` 維持原樣全綠。
- [ ] 上線後（Claude 經 ssh 做）：mini 手動觸發一輪，log 看得到建站、佈署、更新索引成功；`wrangler pages deployment list`
      最新一筆來自這次；`https://knowledge.wayne-liu.com/notes/<任一篇>` 回 200；`/search` 搜一個詞有結果；
      `launchctl print` 看得到每 60 秒一輪。使用者從 LINE 丟一則，收到「已上花園」且網址打得開。

## 動到的模組

- 新增 publish 模組（`kg/src/publish/`，擁有 `publish.deploys` 表）：建站、佈署、更新索引、記錄每個 commit 的佈署狀態。
- capture：拿掉 pull，改成回傳這輪的新增／更新筆記；「等網址上線、發 LINE」改成獨立函式由程式入口在佈署後呼叫。
- 外殼：`process-inbox.sh`、`com.liu.kb-inbox.plist`（60 秒）、刪 `.github/workflows/`。
- search-api（過渡）：`index-notes.mjs` 改由 publish 呼叫，本身不改。

## 範圍內

- `kg/src/publish/`、`kg/src/main.ts`（新程式入口）、`kg/src/capture/`、`db/schema.sql`（加 `publish` schema 與表）、
  `kg/package.json`（加 `wrangler`）、`scripts/process-inbox.sh`、`scripts/com.liu.kb-inbox.plist`、刪 `.github/workflows/deploy.yml` 與 `vectorize.yml`。
- `kg/spec/db/publish.spec.ts`，以及因流程改變要調整的 `kg/spec/db/capture.spec.ts`、`harness.ts`、`shell.spec.ts`。
- `kg/.dependency-cruiser.cjs` 加規則擋 capture 與 publish 互相 import，並照既有做法在 `kg/spec/fixtures/` 加範例目錄、`kg/spec/boundaries.spec.ts` 加一條測試（驗收中追加）。
- `ARCHITECTURE.md`（模組表加 publish、外殼列）、`README.md`（流程圖、維運備忘、`local-env.sh` 要放的變數）、`CLAUDE.md`、`AGENTS.md` 裡講到 GitHub 佈署的句子。

## 範圍外（這次不准碰）

- `content/`、`quartz/`、根目錄 `package.json` 與 `package-lock.json`、`quartz.config.yaml`、`quartz.ts`
- `workers/`、`scripts/index-notes.mjs`、`kg/src/notes/`、`kg/quartz-plugins/`、`.claude/`
- `scripts/backup-db.sh`、`scripts/com.liu.kb-backup.plist`、`compose.yaml`
- 文章進資料庫、筆電 `/capture` 改送 mini inbox（都是 5b-3）
- mini：實作階段不准連；不准 git commit、不准 push；不准碰真的 Cloudflare（測試一律用假指令）

## 上線步驟（使用者收下後）

1. 使用者在 Cloudflare 後台建一把 API 權杖，自己放進 mini 的 `scripts/local-env.sh`（`CLOUDFLARE_API_TOKEN`）；
   Claude 補上不是機密的 `CLOUDFLARE_ACCOUNT_ID`。權限清單由 Claude 查證後給使用者。
2. Claude push；mini 上 `mkdir /tmp/kb-inbox.lock` 暫停，`git pull`，套 `db/schema.sql`，重新載入 plist，`rmdir` 解鎖，手動觸發一輪。
3. 照驗收條件最後一條檢查。之後建議使用者刪掉 GitHub repo 的 `CLOUDFLARE_*` secrets，並在 Cloudflare 撤銷舊權杖。

## 已裁決的分歧點

- 每 60 秒一輪（使用者決定）：每輪都 pull，inbox 有項目才收錄，HEAD 還沒成功佈署過才建站佈署。
- 建站、佈署、更新索引搬到 mini 並刪掉兩個 GitHub workflow，文章仍留在 git（使用者 2026-09-26 已決定 mini 負責佈署與更新索引，撐到第③層）。
- 任何新 commit 都佈署，不再像 `deploy.yml` 排除特定路徑（Claude 決定：mini 上建站約 1 分鐘，判斷路徑省下的時間不值得多一套規則）。
- 一輪的順序：pull → 收錄（commit、push）→ 佈署 → 收錄有筆記才等網址 200 發 LINE。程式入口是 `kg/src/main.ts`，
  只負責串 capture 與 publish 兩個模組的入口；capture 與 publish 互不 import（Claude 決定）。
- pull 失敗、publish 連不上資料庫：丟錯讓程式非 0 結束，沿用外殼「異常結束發一次 LINE」（Claude 決定）。
- 佈署狀態存 `publish.deploys`（commit_sha 主鍵、status pending/done/failed、attempts、last_error、時間），
  失敗重試 3 次的規則與 `capture.jobs` 一致；增量索引的起點取最後一筆 done 的 commit（Claude 決定：跟收錄一樣查得到歷史與失敗原因）。
- 「一個 commit 的佈署」是一整件事：建站、佈署、更新索引任一步失敗整件記 failed，下一輪從建站重來（佈署與索引重跑都無害）。
- 外部指令一律用名稱經 `PATH` 呼叫（`npx quartz plugin install`、`npx quartz build`、`wrangler`、`node scripts/index-notes.mjs`），
  測試才攔得到；外殼把 `kg/node_modules/.bin` 加進 `PATH`（Claude 決定）。
- `wrangler` 裝在 `kg/package.json` 的 dependencies（根目錄 package.json 是 upstream 不改）；外殼比照 `kg/` 的做法，
  根目錄 `node_modules` 缺或過期時先 `npm ci`（Claude 決定）。
- Cloudflare 權杖與帳號 ID 放 mini 的 `scripts/local-env.sh`（gitignored），外殼 source 後 export 給子程序（Claude 決定，同 LINE token）。
- `git pull` 由 publish 入口匯出（`pull()`），main.ts 依序呼叫 publish 的 pull → 收錄 → publish 佈署 → 收錄的發 LINE
  （實作中裁決，Claude 決定：拉新 commit 是為了佈署，5b-3 後 capture 完全不碰 git）。
- push 失敗那一輪照樣佈署本機的 commit，LINE 只發「push 失敗」（實作中裁決，Claude 決定）。
- 「上次成功佈署的 commit 已不在」用 `git cat-file -e` 判斷查不查得到，查得到就照常做增量（實作中裁決，Claude 決定）。
- `kg/package-lock.json` 隨加 `wrangler` 更新，算在範圍內（實作中裁決）。
- 收錄連不上資料庫、登記任務寫入失敗：改成丟錯讓程式非 0 結束，由外殼只發一次「異常結束」告警，
  拿掉 `DB_UNAVAILABLE_MESSAGE`、`DB_WRITE_FAILED_MESSAGE` 兩則每輪都發的 LINE（驗收中追加，Claude 決定：
  改成每 60 秒一輪後，資料庫掛掉會變成每分鐘一則 LINE；publish 本來就會因同一原因丟錯）。
- 「capture 與 publish 互不 import」要有機器檢查：`kg/.dependency-cruiser.cjs` 加一條規則（驗收中追加，Claude 決定）。
- 外殼檔名 `process-inbox.sh` 與 launchd 名稱 `com.liu.kb-inbox` 不改名，只改註解（Claude 決定：改名要多動 mini 的 launchd，沒有好處）。
