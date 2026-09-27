# TASK：資料夾對齊模組表，加歸屬檢查（整理，不改行為）

## 要解決什麼問題

works 架構規約 2026-09-27 新增三條（`works/ARCHITECTURE-GUIDE.md` 第 1 節最後三條）：程式資料夾的第一層就是模組表、
根目錄只放入口／設定／文件／外殼、每個程式檔都要有歸屬而且有測試檢查。knowledge-garden 還有三處對不上：

- `db/schema.sql` 一個檔案同時裝 capture 的 `capture.jobs` 和 publish 的 `publish.deploys`，表的擁有權看不出來。
- `scripts/` 混著外殼（`process-inbox.sh`、`backup-db.sh`、兩個 plist）和 search-api 的 `index-notes.mjs`。
- 沒有測試確認「每個程式檔都落在模組表某一列」，文件跟資料夾對不上時沒人發現。

第②層下一步（5b-3，文章進資料庫）會新增表和程式，要在那之前把規矩立好。網站、收錄、佈署的行為一律不變。

名詞：

- **歸屬檢查**：一支測試用 `git ls-files` 列出所有程式檔，逐一確認它落在 `ARCHITECTURE.md` 模組表某一列的路徑底下，
  沒有就失敗；表上寫的路徑不存在也失敗。它直接讀 `ARCHITECTURE.md`，所以模組表永遠是現況。

## 做完怎麼確認（驗收條件）

先寫測試、跑到紅、貼出紅的輸出，才准搬檔案。

- [ ] 新增 `kg/spec/ownership.spec.ts`，接在 `cd kg && npm test` 裡（`spec/*.spec.ts` 本來就會跑到），情境：
  - 1 先把 `ARCHITECTURE.md` 改成目標模組表，在搬檔案之前跑到紅，錯誤訊息點名 `db/schema.sql`、`scripts/index-notes.mjs`
    這類沒落在任何一列的檔案，以及表上寫了但還不存在的路徑。
  - 2 搬完全綠。
  - 3 反例寫成固定的測試（用範例資料餵檢查函式，不動真的 repo）：多一個不屬於任何模組的檔案（例如 `kg/src/utils.ts`）要紅；
    表上寫一個不存在的路徑要紅；落在不檢查路徑底下的檔案不算。
- [ ] `kg/src/capture/schema.sql` 只建 `capture` schema 與 `capture.jobs`，`kg/src/publish/schema.sql` 只建 `publish` schema 與 `publish.deploys`，
      內容跟現在 `db/schema.sql` 對應段落一字不差；`db/` 刪除。
- [ ] `index-notes.mjs` 搬到 `workers/kb-search/index-notes.mjs`，程式內容不改；publish 呼叫的路徑跟著改。
- [ ] `cd kg && npm test`、`npm run test:db`、根目錄 `npm test` 全綠；`git grep -n "db/schema.sql\|scripts/index-notes"` 只剩 `TASK.md`。
- [ ] 上線後（Claude 經 ssh 做）：mini 這次的佈署記 done，log 看得到 `index` 那一步成功；`/search` 搜一個詞有結果。

## 動到的模組

- capture、publish：各自擁有自己的 `schema.sql`。
- search-api（過渡）：路徑收成 `workers/kb-search/` 一個資料夾。
- 外殼：`scripts/` 只剩外殼；程式入口 `kg/src/main.ts` 列進外殼那一列。
- 不新增模組、不改依賴規則。

## 範圍內

- 新增 `kg/spec/ownership.spec.ts`；`ARCHITECTURE.md` 加「歸屬檢查」那一行、改寫模組表的路徑欄（見已裁決的分歧點）。
- `db/schema.sql` 拆成 `kg/src/capture/schema.sql`、`kg/src/publish/schema.sql`；`scripts/index-notes.mjs` 搬到 `workers/kb-search/index-notes.mjs`。
- 跟著改路徑：`kg/src/publish/steps.ts`、`kg/spec/db/harness.ts`、`kg/spec/db/backup.spec.ts`、`kg/spec/db/publish.spec.ts`、
  `kg/spec/duplicated-constants.spec.ts`、`README.md`、`index-notes.mjs` 開頭註解裡的用法路徑。

## 範圍外（這次不准碰）

- `scripts/` 裡的外殼四個檔案（`process-inbox.sh`、`backup-db.sh`、兩個 plist）：不搬、不改，mini 的 launchd 路徑不動。
- `index-notes.mjs` 的程式內容（第③層整支刪除）、`workers/kb-search/src/`、`wrangler.toml`
- `content/`、`quartz/`、根目錄 `package.json`、`quartz.config.yaml`、`quartz.ts`、`.claude/`、`compose.yaml`
- `kg/src/` 的程式邏輯（除了 `steps.ts` 的路徑）、`kg/.dependency-cruiser.cjs`
- mini：實作階段不准連；不准 git commit、不准 push

## 上線步驟（使用者收下後由 Claude 做）

1. mini 上 `mkdir /tmp/kb-inbox.lock` 暫停（避免還在跑的舊程式 pull 到新 commit 後用舊路徑呼叫 `index-notes.mjs`，白記一次失敗）。
2. push；mini 上 `git pull`，`rmdir` 解鎖，`launchctl kickstart` 手動跑一輪。資料表已經存在，不用重套 schema。
3. 照驗收條件最後一條檢查。

## 已裁決的分歧點

全部是純技術決定（Claude 決定），使用者看到的網站、收錄、佈署都不變。

- 目標模組表的「路徑」欄：
  - site：`quartz.ts`、`quartz.config.yaml`、`content/search.md`、`kg/quartz-plugins/semantic-search/`。
    寫明原因：Quartz 只讀根目錄的 `quartz.ts`、`quartz.config.yaml`，頁面只能放 `content/`。
  - capture：`kg/src/capture/`、`.claude/skills/capture/`。寫明原因：Claude 的 skill 只能放 `.claude/`。
  - publish：`kg/src/publish/`。notes：`kg/src/notes/`。
  - search-api（過渡）：`workers/kb-search/`。
  - 外殼：`kg/src/main.ts`、`scripts/process-inbox.sh`、`scripts/com.liu.kb-inbox.plist`、`scripts/backup-db.sh`、`scripts/com.liu.kb-backup.plist`、`compose.yaml`
    （驗收中改，Claude 決定：逐檔列出，之後有非外殼的程式放進 `scripts/`，歸屬檢查才抓得到）。
- 表結構跟著擁有者放進模組資料夾（`kg/src/<模組>/schema.sql`），不另設 `db/`：`db/` 是按技術種類分的資料夾，新規約不准。
  套用方式維持手動，README「維運備忘」新增一行建表／補表指令（驗收中更正：README 原本沒有這行）： `cat kg/src/capture/schema.sql kg/src/publish/schema.sql | docker exec -i ...`；
  測試照同樣順序讀兩個檔案。
- `index-notes.mjs` 搬進 `workers/kb-search/`：雖然第③層會整支刪掉，但搬它只多改一行呼叫路徑，換來 `scripts/` 只剩外殼、
  search-api 只有一個路徑，第③層刪除時也只要刪一個資料夾。
- 外殼留在 `scripts/` 不搬進 `kg/`：搬 plist 或 `process-inbox.sh` 要改 mini 的 launchd 設定，沒有換到任何好處。
- 歸屬檢查怎麼算「程式檔」：副檔名 `.ts .tsx .js .mjs .cjs .sh .sql .plist .scss`。不檢查的路徑寫在 `ARCHITECTURE.md` 的歸屬檢查那一行，
  測試從那一行讀：`kg/spec/`（測試）、`quartz/`、`globals.d.ts`、`index.d.ts`（upstream）、`kg/.dependency-cruiser.cjs`（邊界檢查設定檔）。
- 歸屬檢查怎麼讀模組表：取 `## 模組` 表格每一列「路徑」欄裡用反引號包起來的路徑；以 `/` 結尾的是資料夾（底下全部算），其他是單一檔案。
  其他欄位裡的反引號不算路徑。
- `ARCHITECTURE.md` 裡「程式入口 `kg/src/main.ts` 不屬於任何模組」那句改成列在外殼那一列，跟模組表一致（驗收中追加，Claude 決定）。
