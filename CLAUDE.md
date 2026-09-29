# knowledge-garden

個人知識花園：Quartz v5 fork（`v5` 分支，upstream `jackyzha0/quartz`），LINE 或筆電 `/capture` 收錄 →
mini 的 `inbox/` → `/capture` 寫成筆記 → 存進 mini 的資料庫（`notes.articles`，文章正本）→
mini 匯出成 `content/notes/*.md`、建站並佈署到 Cloudflare Pages。
另有 `workers/kb-search`（Vectorize 語意搜尋）供站上 `/search` 用。

- Port 段: 41160-41169（本機 `npx quartz build --serve --port 41160`，別用預設 8080）
- 分工: Claude 思考/驗收，實作委派 codex（規約見上層 works/CLAUDE.md）
- 自己寫的新程式放 `kg/`，模組規則看 `ARCHITECTURE.md`，改完跑 `cd kg && npm test`。

## 這台筆電只負責編輯

收錄管線的**生產環境在 mac mini** 的 `~/knowledge-garden`：launchd
`com.liu.kb-inbox` 每 60 秒跑 `scripts/process-inbox.sh`（消化 inbox、文章寫進資料庫 →
匯出文章、建站、佈署到 Cloudflare Pages、更新搜尋索引）。筆電這份沒載入任何 LaunchAgent，只做站台程式的改動；
push 到 `v5` 後 GitHub Actions 在 mini 執行 `scripts/update-code.sh` 拉下程式碼，mini 下一輪建站佈署。
文章不在 git：筆電的 `content/notes/` 是跑 `scripts/pull-notes.sh` 從 mini 拉來預覽的複本，改了不會回寫；
筆電的 `/capture` 會把輸入送進 mini 的 inbox，由 mini 收錄。
不進 git 的規則寫在各機器的 `.git/info/exclude`（`scripts/process-inbox.sh`、`scripts/pull-notes.sh` 會自己補上），
不能寫進 `.gitignore`，因為 Quartz 建站會跳過 `.gitignore` 列到的檔案。
mini 上要先執行 `docker compose up -d`，收錄管線才跑得起來。

`scripts/com.liu.kb-inbox.plist` 裡的 `~/knowledge-garden` 是 **mini 上的正確路徑**，
搬家後**刻意不改**。script 本身吃 `KB_DIR` 覆寫，筆電要跑就帶 `KB_DIR=$PWD`。

## 網址結構

筆記一律在 `/notes/<slug>`（例：
`https://knowledge.wayne-liu.com/notes/remote-mac-mini-before-travel-checklist`）。
`/tags/<tag>` 是標籤頁，**沒有** `/tags/notes/...` 這種路徑——看到那種網址是別處組錯，
修源頭，不要加 redirect 把錯網址養成長期路徑。

## 讀者設定（跟使用者溝通時的用詞基準）

- 業務面：一般筆記使用者（不熟向量搜尋、RAG 這類 AI 檢索名詞）
- 開發面：初級全端工程師

這個程度的人不懂的詞，第一次出現就要解釋。提問與回報的規則見上層 `works/CLAUDE.md` 的語言標準。
