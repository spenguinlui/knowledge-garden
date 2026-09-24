# TASK：收錄狀態改存 Postgres，inbox 與失敗計數退出 git（資料庫化第一層）

## 背景與整體方向

知識花園要逐步改成「資料庫是正本」，未來接向量檢索與 RAG 問答。整體分四層，每層做完都要能獨立運作：

1. **（本次）** mini 起 Postgres，收錄狀態改存 DB，`inbox/` 與失敗計數退出 git
2. 文章搬進 DB 當正本，mini 從 DB 匯出 Markdown 自己建站並直接佈署，每日備份
3. 存原文，筆記與原文切段存進 pgvector，搜尋 API 經 Tunnel 改打 mini，停用 Vectorize
4. `/ask` 問答，以及透過 LINE 修改文章

本次只做第 1 層。

## 目前的問題

`v5` 分支 2171 個 commit 裡，收錄成功的 `capture:` 只有 98 個，`capture failed (n/3)` 卻有 121 個。
原因是收錄管線把排程狀態也放進 git：每失敗一次就寫 `inbox/<id>.failcount`、commit、push，
每次 push 又觸發 Cloudflare Pages 佈署和向量索引。git 裡混了大量不是知識的東西，
要看「某則收錄為什麼失敗」也只能翻 git log。

## 名詞

- **收錄管線**：mini 上 launchd `com.liu.kb-inbox` 每 5 分鐘跑的 `scripts/process-inbox.sh`。
- **inbox 項目**：小柳三世（LINE bot）寫進 mini `~/knowledge-garden/inbox/` 的 `<id>.json`，
  截圖另有 `<id>.jpg`。id 形如 `oc-1790041483`。這些檔案本來就沒被 git 追蹤。
- **收錄任務**：本次新增的資料表裡的一列，代表一個 inbox 項目與它的處理狀態。
- **failcount**：現在用來記重試次數的 `inbox/<id>.failcount` 檔，本次要廢除。

## 要做出什麼行為

1. **Postgres 用 compose 起在 mini 上**
   repo 根目錄新增 `compose.yaml`：映像檔用 `pgvector/pgvector:pg17`（第 3 層會用到 pgvector，
   現在先用同一個映像檔，之後就不必換）；container 名稱 `knowledge-garden-db`；
   port 只綁 `127.0.0.1:41161`；資料放 named volume。密碼放 gitignored 的 `.env`，
   repo 裡附 `.env.example`。

2. **資料表**
   schema 放 `db/schema.sql`，要能重複執行（`CREATE TABLE IF NOT EXISTS`）。只建一張收錄任務表，
   至少記錄：id（inbox 的 id）、狀態（`pending` / `done` / `failed`）、已嘗試次數、
   最後一次錯誤輸出（claude 失敗時 stderr／stdout 的尾段）、產出的筆記路徑、
   收錄成功的 commit sha、建立時間與更新時間。

3. **收錄管線改讀寫 DB**
   - 每輪開始時，把 `inbox/*.json` 裡還沒登記過的 id 寫進任務表，狀態 `pending`。重複跑不能重複登記。
   - 只處理 `pending` 且嘗試次數小於 3 的任務。
   - 成功：刪掉 inbox 檔案，**commit 只包含 `content/`**，任務改成 `done`，記下 commit sha 與筆記路徑。
     claude 沒改到任何東西也算 `done`（沿用現在的判定），筆記路徑留空。
   - 失敗：嘗試次數加 1、記下錯誤輸出，**不產生任何 git commit**。第 3 次失敗改成 `failed`，
     並照舊發 LINE 告警（文案不變）。失敗項目的 inbox 檔案保留在原地。
   - DB 連不上時：寫 log、發一則 LINE 告警、結束這一輪，不動任何 inbox 檔案。
   - 腳本透過 `docker exec knowledge-garden-db psql ...` 存取 DB（mini 上沒有裝 psql）。
     launchd 的 PATH 可能找不到 `docker`，由腳本自己確保找得到，不要改 plist。

4. **inbox 退出 git**
   `git rm --cached` 掉目前追蹤中的 `inbox/` 檔案，`.gitignore` 加上 `inbox/`。

5. **成功通知不變**
   上一輪做好的「網址能開才發 LINE、分新增與更新兩組、超時也講一聲」行為原封不動。

6. **查詢與重試的方法寫進 README**
   「收錄方式」那段補上：怎麼列出最近的收錄任務和失敗原因，怎麼把 `failed` 的任務重設成 `pending`。
   各給一行可以直接複製的指令即可，不做成新腳本。

## 範圍內（只准動這些）

- `scripts/process-inbox.sh`、`scripts/test-process-inbox.sh`
- 新增 `compose.yaml`、`.env.example`、`db/schema.sql`
- `.gitignore`（加 `inbox/`、`.env`）
- `git rm --cached` 目前追蹤的 `inbox/` 檔案
- `README.md` 的「收錄方式」那段
- `CLAUDE.md` 補一句：mini 上要先 `docker compose up -d`，收錄管線才跑得起來

## 範圍外（動到就是驗收沒過）

- `content/`、`quartz/`、`quartz.config.yaml`、`workers/`、`.github/`
- `.claude/skills/capture/`（`/capture` 仍然讀 `inbox/<id>.json`，本次不改它）
- `scripts/com.liu.kb-inbox.plist`、`scripts/index-notes.mjs`、`scripts/local-env.sh`
- 文章、原文、向量的資料表（那是第 2、3 層）
- 備份（第 2 層才有需要保護的正本）

## 驗收條件（先做到紅，才准動實作）

擴充既有的 `scripts/test-process-inbox.sh`，沿用它的做法（臨時 git repo 加 bare 遠端，
`PATH` 前置假的 `claude` 與 `curl`），DB 用筆電本機 compose 起的同一個 Postgres，
測試自己建、自己刪一個獨立 database，不碰 mini。

既有六個情境必須繼續全綠。新增以下情境：

| # | 情境 | 預期 |
|---|------|------|
| 7 | 收錄成功 | 任務為 `done`，記了 commit sha 與筆記路徑；該 commit 只動到 `content/`；inbox 檔案已刪 |
| 8 | claude 失敗一次 | 嘗試次數 1、錯誤輸出有存；**git log 的 commit 數完全沒變**；inbox 檔案還在 |
| 9 | 連續失敗三輪 | 第 3 輪後狀態 `failed`、發出既有的失敗告警；第 4 輪不再呼叫 claude |
| 10 | 同一個 inbox 檔跑兩輪才處理完 | 任務表只有一列 |
| 11 | DB 連不上（container 停掉或名稱錯） | 發告警、正常結束、inbox 檔案原封不動、沒有 commit |
| 12 | repo 狀態 | `git ls-files inbox/` 為空；`.gitignore` 含 `inbox/` |

**順序不可調換**：先寫測試、跑一次、貼出失敗（紅）的輸出，才可以動 `process-inbox.sh`。
十二項全綠才算做完。

## 上線步驟（由 Claude 經 Tailscale ssh 代跑，使用者不必動手）

push 之後、mini 下一輪 pull 之前：在 mini 的 `~/knowledge-garden` 放好 `.env`，
`docker compose up -d`，套用 `db/schema.sql`。
順序反過來的話，新腳本會連不上 DB，照第 3 點的規則只會告警，不會弄丟任何 inbox 檔案。

## 回報時要附的手動驗證步驟

丟一則連結給小柳三世 → 幾分鐘後收到帶網址的 LINE →
`git log --oneline -3` 只看得到 `capture: <id>`，沒有任何 inbox 相關的 commit →
用 README 裡的指令查任務表，這筆是 `done`，筆記路徑正確。

## 非目標（這次不做）

- 不把文章搬進 DB、不改建站方式（第 2 層）
- 不存原文、不動向量索引（第 3 層）
- 不做網頁後台或查詢腳本
- 不改小柳三世寫 inbox 的方式
