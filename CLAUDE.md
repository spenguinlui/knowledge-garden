# knowledge-garden

個人知識花園：Quartz v5 fork（`v5` 分支，upstream `jackyzha0/quartz`），LINE 收錄 →
`inbox/` → `/capture` 寫成 `content/notes/*.md` → push → Cloudflare Pages 佈署。
另有 `workers/kb-search`（Vectorize 語意搜尋）供站上 `/search` 用。

- Port 段: 41160-41169（本機 `npx quartz build --serve --port 41160`，別用預設 8080）
- 分工: Claude 思考/驗收，實作委派 codex（規約見上層 works/CLAUDE.md）
- 自己寫的新程式放 `kg/`，模組規則看 `ARCHITECTURE.md`，改完跑 `cd kg && npm test`。

## 這台筆電只負責編輯

收錄管線的**生產環境在 mac mini** 的 `~/knowledge-garden`：launchd
`com.liu.kb-inbox` 每 5 分鐘跑 `scripts/process-inbox.sh`（pull → 消化 inbox →
commit → push）。筆電這份沒載入任何 LaunchAgent，只做編輯與站台改動，
動完 push 上 GitHub，mini 下一輪自己 pull。
mini 上要先執行 `docker compose up -d`，收錄管線才跑得起來。

`scripts/com.liu.kb-inbox.plist` 裡的 `~/knowledge-garden` 是 **mini 上的正確路徑**，
搬家後**刻意不改**。script 本身吃 `KB_DIR` 覆寫，筆電要跑就帶 `KB_DIR=$PWD`。

## 網址結構

筆記一律在 `/notes/<slug>`（例：
`https://knowledge.wayne-liu.com/notes/remote-mac-mini-before-travel-checklist`）。
`/tags/<tag>` 是標籤頁，**沒有** `/tags/notes/...` 這種路徑——看到那種網址是別處組錯，
修源頭，不要加 redirect 把錯網址養成長期路徑。
