# 🌱 knowledge-garden

個人知識花園：markdown 知識庫 + 登入後使用的網站 + LINE 收錄 + 語意搜尋。

```
LINE 小柳三世（OpenClaw）→ 轉交寫入 inbox/（git 當 queue）
筆電 /capture → kg/src/capture/send.ts（scp）→ mini 的 inbox/
筆電 push 到 v5 → GitHub CI 測試通過 → mini-deploy 更新 mini 的程式碼
Mac mini launchd 每 60 秒一輪
  inbox 有項目 → 資料庫的文章匯出到 content/notes/ → claude -p /capture → 新增與修改的文章寫回資料庫（notes.articles）
  網站版本（HEAD 加上文章最後一次變動的時間）還沒建好
                  → 匯出文章 → quartz build 到 public.next → 換上 public（Quartz 網站）
                  → embed (bge-m3) → Vectorize（語意搜尋索引）
  這輪有收錄且網站更新成功 → LINE 回傳筆記網址
正式網站 knowledge.wayne-liu.com → Cloudflare Access 登入 → Cloudflare Tunnel → mini 的 web 服務（127.0.0.1:41162）→ public 與 notes.articles
網站 /search 頁 → CF Worker (kb-search) → Vectorize query
文章頁標籤編輯區 → 同網址的 /api/notes/<slug> → notes.articles 標籤
```

## 目錄

| 路徑 | 用途 |
|---|---|
| `content/notes/` | 從 mini 資料庫（`notes.articles`，文章正本）匯出的筆記，不進 git（規則寫在各機器的 `.git/info/exclude`，由 `scripts/process-inbox.sh`、`scripts/pull-notes.sh` 補上，不能寫進 `.gitignore`，因為 Quartz 建站會跳過 `.gitignore` 列到的檔案）；筆電用 `scripts/pull-notes.sh` 從 mini 拉來預覽，改了不會回寫。flat，第一個 tag = 主分類，規格見 `.claude/skills/capture/SKILL.md` |
| `inbox/` | 收錄佇列：小柳三世轉交的 `oc-*.json`（+ `.jpg`），mini 消化後刪除 |
| `.claude/skills/capture/` | `/capture` skill——收錄流程與筆記規格的單一事實來源 |
| `workers/kb-search/` | 語意搜尋 API（bge-m3 embed → Vectorize query） |
| `kg/quartz-plugins/semantic-search/` | `/search` 頁的語意搜尋框（本機 Quartz 元件外掛，Worker 網址在 `quartz.config.yaml` 的 options 設定） |
| `kg/quartz-plugins/tag-editor/`、`kg/src/web/` | 登入過的瀏覽器在文章頁編輯標籤；mini 的 web 服務送出網站頁面，並只經 notes 模組讀寫標籤 |
| `scripts/process-inbox.sh` | mini 每 60 秒一輪的外殼（launchd `com.liu.kb-inbox`，log 在 `~/Library/Logs/kb-inbox.log`）：上鎖、裝套件後執行 `kg/src/main.ts`（收錄 → 建站 → 發 LINE），當掉發一次 LINE |
| `.github/workflows/ci.yml`、`deploy/update.sh` | GitHub 在雲端測試程式碼；測試通過後，mini-deploy 等收錄鎖放掉、更新 mini 的程式碼並呼叫部署入口（重啟網站服務）；下一輪負責建站 |
| `scripts/com.liu.kb-web.plist`、`scripts/com.liu.kb-tunnel.plist` | mini 常駐的網站服務（41162）與對外 Cloudflare Tunnel |
| `scripts/pull-notes.sh` | 筆電預覽前把 mini 最近一次匯出的 `content/notes/` 同步下來（rsync，mini 沒有的刪掉） |
| `workers/kb-search/index-notes.mjs` | 筆記 → 向量索引（增量 / `--all` 全量） |
| `quartz/`、`quartz.config.yaml` | Quartz v5 本體與設定；升級走 `git pull upstream v5` |
| `kg/` | 自己寫的 TypeScript（獨立 package.json），邊界檢查 `cd kg && npm test` |
| `ARCHITECTURE.md` | 模組清單、依賴規則、既有違規 |

## 收錄方式

- **LINE**：丟給**小柳三世** URL / 文字 / 截圖，≤5 分鐘上站
  收錄完成後，小柳三世會再傳一則可直接開啟的筆記網址
- **桌面**：repo 內 `claude` → `/capture <url|文字|圖片路徑>`，skill 呼叫 `node kg/src/capture/send.ts`
  把它送進 mini 的 inbox，終端機只顯示已送出，收錄結果由 mini 發 LINE
- 文章只能透過上面兩種方式新增；筆電的 `content/notes/` 是複本，改了不會回寫（改文章的功能在第④層）
- 最近的收錄任務與失敗原因：`docker exec knowledge-garden-db psql -U knowledge_garden -d knowledge_garden -c "SELECT id, status, attempts, last_error, note_slugs, updated_at FROM capture.jobs ORDER BY updated_at DESC LIMIT 20;"`
- 重試失敗任務（把 `<id>` 換成 inbox id）：`docker exec knowledge-garden-db psql -U knowledge_garden -d knowledge_garden -c "UPDATE capture.jobs SET status = 'pending', attempts = 0, last_error = NULL, updated_at = now() WHERE id = '<id>' AND status = 'failed';"`

## 維運備忘

- 網站更新與搜尋索引：全在 mini 上跑；push 後 GitHub CI 在雲端測試，通過後 mini-deploy 自動更新 mini 的程式碼。網站版本 = HEAD 的 commit 加上文章最後一次變動的時間，
  兩者任一個變了就要重新產生。每一輪看到目前的網站版本還沒成功產生過，就把資料庫的文章匯出到 `content/notes/`，
  再建站到 `public.next`，成功後整個換上 `public/`，接著
  更新 Vectorize 索引（`workers/kb-search/index-notes.mjs`，只送上次成功更新網站之後變動的文章，沒有成功紀錄就 `--all` 全量重建）。
  建站失敗時原本的 `public/` 不動，下一輪重試；同一個網站版本失敗 3 次發一則 LINE 後不再重試，commit 或文章變了才會再試。
  筆電改了站台，push 上 GitHub 且 CI 通過後，mini-deploy 會更新 mini 的程式碼，下一輪就會建站。
- 最近的網站更新紀錄與失敗原因：`docker exec knowledge-garden-db psql -U knowledge_garden -d knowledge_garden -c "SELECT commit_sha, notes_updated_at, status, attempts, last_error, updated_at FROM publish.deploys ORDER BY updated_at DESC LIMIT 10;"`
- 放棄的網站版本要再試一次（把 `<sha>` 換成完整 commit）：`docker exec knowledge-garden-db psql -U knowledge_garden -d knowledge_garden -c "UPDATE publish.deploys SET attempts = 0, updated_at = now() WHERE commit_sha = '<sha>';"`
- 手動全量重建索引（mini 上）：`cd ~/knowledge-garden && source scripts/local-env.sh && node workers/kb-search/index-notes.mjs --all`
- mini 的 `scripts/local-env.sh`（gitignored）每行一個 `export`：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`
  （更新搜尋索引）、`LINE_CHANNEL_ACCESS_TOKEN`、`LINE_USER_ID`（LINE 通知）。Worker secrets 見搜尋服務設定檔註解
- 網站服務從 repo 根目錄 `.env` 讀資料庫設定，僅監聽 `127.0.0.1:41162`；流量由 Cloudflare Tunnel 轉入，登入由外層的 Cloudflare Access 處理。
- 建表／補表（在 repo 根目錄執行；只建還不存在的 schema 與表，重跑無害）：
  `cat kg/src/notes/schema.sql kg/src/capture/schema.sql kg/src/publish/schema.sql | docker exec -i knowledge-garden-db psql -U knowledge_garden -d knowledge_garden`
- 文章匯出／匯入（mini 上，在 repo 根目錄執行，讀 `.env` 的資料庫設定）：`node kg/src/notes/cli.ts export <資料夾>`
  把資料庫的全部文章寫成 `<資料夾>/<slug>.md`（資料夾裡資料庫沒有的檔案會被刪掉）；`node kg/src/notes/cli.ts import <資料夾>`
  把資料夾的 `.md` 寫進資料庫（有一篇格式不合整批不寫）
- 資料庫備份：mini 上 launchd `com.liu.kb-backup` 每天 04:30 跑 `scripts/backup-db.sh`，存在
  `~/backups/knowledge_garden/knowledge_garden-YYYY-MM-DD.dump`，保留今天加前 6 天（共 7 份），log 在
  `~/Library/Logs/kb-backup.log`，失敗發一則 LINE。還原前先 `mkdir /tmp/kb-inbox.lock` 暫停收錄，把日期換掉後執行（會蓋掉現有資料），完成後 `rmdir /tmp/kb-inbox.lock`：
  `docker exec -i knowledge-garden-db pg_restore -U knowledge_garden -d knowledge_garden --clean --if-exists --single-transaction < ~/backups/knowledge_garden/knowledge_garden-YYYY-MM-DD.dump`
- mini 停擺：inbox 累積不丟失，恢復後自動補跑
- ⚠️ **mini 上別用 ssh 手動觸發 claude**：claude 憑證存 macOS Keychain，ssh session 拿不到會報
  `Not logged in`（launchd 跑在 GUI session 正常）。要手動補跑就等下一輪（每 60 秒），或
  `launchctl kickstart gui/501/com.liu.kb-inbox`
