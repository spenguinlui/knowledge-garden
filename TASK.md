# TASK：模組化整理 2，收錄管線從 zsh 改寫成 TypeScript

## 要解決什麼問題

mac mini 每 5 分鐘跑一次的收錄管線 `scripts/process-inbox.sh`（182 行 zsh），把業務邏輯全寫在 shell 裡：
重試狀態（pending／done／failed、最多 3 次）、字串拼 SQL 經 `docker exec psql`、從 git diff 分新增和更新、
輪詢站台網址、組 LINE 訊息。測試 `scripts/test-process-inbox.sh` 也是 zsh，沒接進任何測試指令。
第②③④層（文章改存 DB、原文與向量、問答）都要改這條管線，繼續疊在 zsh 上只會更難改、更難測。

這次只換寫法，使用者看到的行為不變（LINE 文案、重試規則、網址等部署完成才通知），唯一新增的是「程式當掉發一次 LINE」。

名詞：

- **收錄任務表**：mini Postgres（容器 `knowledge-garden-db`，只綁 `127.0.0.1:41161`）裡記每個 inbox 項目處理狀態的表，
  現在叫 `public.capture_jobs`，這次改名 `capture.jobs`（`capture` 是只屬於收錄功能的 schema，也就是資料庫裡的分區）。
- **外殼**：改寫後的 `scripts/process-inbox.sh`，只負責上鎖、確保套件裝好、啟動 node、當掉時告警。
- **inbox 項目**：小柳三世（LINE bot）寫進 mini `~/knowledge-garden/inbox/` 的 `<id>.json`（可能附 `<id>.jpg`）。

## 做完怎麼確認（驗收條件）

先把現有 11 個情境改寫成 `node:test`，跑到紅、貼出紅的輸出，才准寫實作。

- [ ] `cd kg && npm test` 全綠：dependency-cruiser、`tsc --noEmit`、純函式單元測試（不需要 DB）。
- [ ] `cd kg && npm run test:db` 全綠（用筆電 compose 起的 Postgres，測試自己建、自己刪一個獨立 database，
      每個情境用臨時 git repo 加 bare 遠端，`PATH` 前置假的 `claude`）。情境：
  1. 新增一篇：LINE 訊息有「新增：」組和正確網址，沒有「更新：」組
  2. 更新既有一篇：只有「更新：」組
  3. 同一輪有新增也有更新：兩組分開、順序是新增在前；任務的筆記路徑記下兩篇
  4. 網址一直不是 200：發「🌱 已收錄，站台還在建，請稍後再開：」加網址；確實有輪詢、有等待
  5. git push 失敗：發「❌ knowledge-garden push 失敗，筆記卡在 mini 本機」，不發成功或還在建的訊息
  6. claude 沒改任何東西：不發 LINE、不輪詢；任務 `done`，筆記路徑空、commit sha 空
  7. 收錄成功：任務 `done`，commit sha 等於 HEAD、筆記路徑正確；該 commit 只動 `content/`；inbox 檔案已刪
  8. claude 失敗一次：任務 `pending`、嘗試 1 次、錯誤輸出存尾段 4000 字；commit 數不變；inbox 檔案還在
  9. 連續失敗四輪：第 3 輪後 `failed`、發「❌ 收錄失敗（已重試 3 次，不再重試）：<id>」；第 4 輪不呼叫 claude
  10. 同一個 inbox 檔跑兩輪才成功：任務表只有一列，`done`、嘗試 1 次
  11. DB 連不上：發「❌ knowledge-garden 收錄資料庫連線失敗，本輪未處理 inbox」，inbox 不動、沒有 commit、不呼叫 claude；
      inbox 是空的時候不發任何訊息
  12. 外殼：node 異常結束（非 0）時發一次「❌ knowledge-garden 收錄程式異常結束（exit <碼>），詳見 mini 的
      ~/Library/Logs/kb-inbox.log；恢復前不再重複通知」；連續第二次異常不再發；中間成功一次後再異常，會再發一次
- [ ] `scripts/test-process-inbox.sh` 已刪除；`process-inbox.sh` 裡沒有 SQL、jq、git 指令。
- [ ] 上線（Claude 經 ssh 代跑，見下方）之後，mini 手動觸發一輪，log 沒有錯誤，`capture.jobs` 查得到原本那 3 筆 `done`。
- [ ] 使用者驗證：丟一則連結給小柳三世，幾分鐘後收到帶網址的 LINE；用 README 的指令查 `capture.jobs`，這筆是 `done`、筆記路徑正確。

## 動到的模組

- capture：從 `scripts/process-inbox.sh` 搬到 `kg/src/capture/`，擁有的表改成 `capture.jobs`。更新 `ARCHITECTURE.md`。

## 範圍內

- `kg/src/capture/`、`kg/spec/`、`kg/package.json`（加 `pg`、`@types/pg`，加 `test:db` 指令）、`kg/package-lock.json`；
  改寫 `scripts/process-inbox.sh` 成外殼；刪 `scripts/test-process-inbox.sh`；`db/schema.sql` 改成 `capture.jobs`。
- `ARCHITECTURE.md`（capture 那列的路徑與表名、刪掉「process-inbox.sh 帶業務邏輯」那條既有違規）、
  `README.md`（查詢與重試指令改成 `capture.jobs`；目錄表 `process-inbox.sh` 那列改寫）。

## 範圍外（這次不准碰）

- `content/`、`quartz/`、`quartz.ts`、`quartz.config.yaml`、`workers/`、`.github/`、根目錄 `package.json`
- `.claude/skills/capture/`（`/capture` 照舊讀 `inbox/<id>.json`）、`scripts/com.liu.kb-inbox.plist`、
  `scripts/index-notes.mjs`、`scripts/local-env.sh`、`compose.yaml`
- LINE 文案（除了新增的當掉告警）、重試規則、`claude -p` 的呼叫參數
- 站台網址收齊到共用設定（那是 TASK 3；這次網址常數先留在 capture 裡）
- mini：實作階段不准連、不准改；不准 git commit、不准 push

## 上線步驟（驗收通過、使用者收下後由 Claude 經 ssh 代跑）

1. mini 上 `mkdir /tmp/kb-inbox.lock`，讓收錄暫停（外殼看到鎖就直接結束）。
2. 筆電 push。mini `git pull`，`cd kg && npm ci --omit=dev`。
3. 搬表：`CREATE SCHEMA IF NOT EXISTS capture; ALTER TABLE public.capture_jobs SET SCHEMA capture;
   ALTER TABLE capture.capture_jobs RENAME TO jobs;`（一次性指令，不留成檔案）。
4. `rmdir /tmp/kb-inbox.lock`，`launchctl kickstart gui/501/com.liu.kb-inbox`，看 log 與 `capture.jobs`。

## 已裁決的分歧點

- 程式當掉 → 發一次 LINE，恢復正常前不重複發（使用者決定）。git pull 失敗也算當掉（以前只寫 log）。
- 上線 → Claude 經 ssh 代跑，用上鎖暫停收錄，暫停期間的項目留在 inbox 不會丟（使用者決定）。
- 收錄任務表改名 `capture.jobs`，跟這次改寫一起上線（TASK 0 已裁決）。
- 模組 → 只建 `kg/src/capture/`，LINE 推播先當 capture 裡的一個檔案；第④層真的有第二個功能要用 LINE 時才抽成 `line` 模組。
  `shared` 也不建（Claude 決定：規約要兩個以上模組在用才進 shared）。
- 入口 → `kg/src/capture/index.ts` 對外公開；外殼執行 `node kg/src/capture/main.ts`（Claude 決定）。
- 可測性 → 主流程是一個函式，把「發 LINE」「查網址狀態碼」「等待」當參數傳進去，測試傳假的、`main.ts` 傳真的；
  claude 用 `PATH` 放假指令；git 和 Postgres 用真的（Claude 決定）。純計算（失敗後的下一個狀態、分新增與更新、
  組 LINE 訊息、筆記路徑轉網址）寫成純函式，單元測試不碰 DB（Claude 決定）。
- DB 連線 → `pg` 直連 `127.0.0.1:41161`，不再 `docker exec`；密碼讀 `$KB_DIR/.env` 的 `POSTGRES_PASSWORD`
  （`process.loadEnvFile`），測試可用 `PGHOST`／`PGPORT`／`PGDATABASE`／`POSTGRES_PASSWORD` 環境變數覆寫。
  連不上的判定改成「連線失敗」，情境 11 用錯的 port 模擬（Claude 決定）。
- git 與 claude 用 `child_process` 呼叫 CLI，不引入 git 函式庫（Claude 決定）。
- 外殼（Claude 決定）：
  - 沿用 `/tmp/kb-inbox.lock` 鎖與 `KB_DIR` 覆寫，保留補 PATH（`/usr/local/bin:/opt/homebrew/bin`）與讀 `scripts/local-env.sh`。
  - `kg/node_modules` 不存在、或 `kg/package-lock.json` 比 `kg/node_modules/.package-lock.json` 新，就先 `npm ci --omit=dev`；失敗算當掉。
  - 當掉旗標檔 `/tmp/kb-inbox.crashed`：node 非 0 且旗標不存在 → 發 LINE 並建立旗標；node 回 0 → 刪旗標。
  - 整個腳本主體包在 `{ ... }` 裡：node 執行中會 `git pull` 改寫這支檔案，zsh 是邊讀邊跑的，不包起來會讀到改過的內容。
- 測試分兩個指令：`npm test` 不需要 DB（它是 ARCHITECTURE.md 的邊界檢查指令，要隨時能跑）；
  `npm run test:db` 需要本機 Postgres（Claude 決定）。舊測試的第 12 項（inbox 退出 git）是上一個 TASK 的一次性檢查，不移植。
