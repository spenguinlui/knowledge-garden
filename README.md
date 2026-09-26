# 🌱 knowledge-garden

個人知識花園：markdown 知識庫 + 公開網站 + LINE 收錄 + 語意搜尋。

```
LINE 小柳三世（OpenClaw）→ 轉交寫入 inbox/（git 當 queue）
Mac mini launchd 每 60 秒一輪 → git pull（筆電 push 的改動也從這裡進來）
  inbox 有項目 → claude -p /capture → content/notes/ → commit、push
  HEAD 還沒佈署過 → quartz build → wrangler → Cloudflare Pages（Quartz 網站）
                  → embed (bge-m3) → Vectorize（語意搜尋索引）
  這輪有收錄 → 網址上線後 LINE 回傳筆記網址
網站 /search 頁 → CF Worker (kb-search) → Vectorize query
```

## 目錄

| 路徑 | 用途 |
|---|---|
| `content/notes/` | 筆記本體（flat，第一個 tag = 主分類），規格見 `.claude/skills/capture/SKILL.md` |
| `inbox/` | 收錄佇列：小柳三世轉交的 `oc-*.json`（+ `.jpg`），mini 消化後刪除 |
| `.claude/skills/capture/` | `/capture` skill——收錄流程與筆記規格的單一事實來源 |
| `workers/kb-search/` | 語意搜尋 API（bge-m3 embed → Vectorize query） |
| `kg/quartz-plugins/semantic-search/` | `/search` 頁的語意搜尋框（本機 Quartz 元件外掛，Worker 網址在 `quartz.config.yaml` 的 options 設定） |
| `scripts/process-inbox.sh` | mini 每 60 秒一輪的外殼（launchd `com.liu.kb-inbox`，log 在 `~/Library/Logs/kb-inbox.log`）：上鎖、裝套件後執行 `kg/src/main.ts`（pull → 收錄 → 建站佈署 → 發 LINE），當掉發一次 LINE |
| `scripts/index-notes.mjs` | 筆記 → 向量索引（增量 / `--all` 全量） |
| `quartz/`、`quartz.config.yaml` | Quartz v5 本體與設定；升級走 `git pull upstream v5` |
| `kg/` | 自己寫的 TypeScript（獨立 package.json），邊界檢查 `cd kg && npm test` |
| `ARCHITECTURE.md` | 模組清單、依賴規則、既有違規 |

## 收錄方式

- **LINE**：丟給**小柳三世** URL / 文字 / 截圖，≤5 分鐘上站
  收錄完成後，小柳三世會再傳一則可直接開啟的筆記網址
- **桌面**：repo 內 `claude` → `/capture <url|文字|圖片路徑>`
- 手寫：直接在 `content/notes/` 加檔，照 skill 裡的 frontmatter 規格
- 最近的收錄任務與失敗原因：`docker exec knowledge-garden-db psql -U knowledge_garden -d knowledge_garden -c "SELECT id, status, attempts, last_error, note_paths, commit_sha, updated_at FROM capture.jobs ORDER BY updated_at DESC LIMIT 20;"`
- 重試失敗任務（把 `<id>` 換成 inbox id）：`docker exec knowledge-garden-db psql -U knowledge_garden -d knowledge_garden -c "UPDATE capture.jobs SET status = 'pending', attempts = 0, last_error = NULL, updated_at = now() WHERE id = '<id>' AND status = 'failed';"`

## 維運備忘

- 網站佈署與搜尋索引：全在 mini 上跑，GitHub 上沒有自動化。每一輪 pull 之後，HEAD 還沒成功佈署過就建站
  （`npx quartz build`）、上傳 Cloudflare Pages（`wrangler pages deploy`，專案 `knowledge-garden`、分支 `v5`）、
  更新 Vectorize 索引（`scripts/index-notes.mjs`，從上次成功佈署的 commit 算增量，沒有紀錄就 `--all` 全量重建）。
  三步任一步失敗，整件下一輪從建站重來；同一個 commit 失敗 3 次發一則 LINE 後不再重試，有新 commit 才會再試。
  筆電改了站台或文章，push 上 GitHub 等下一輪就會上線。
- 最近的佈署紀錄與失敗原因：`docker exec knowledge-garden-db psql -U knowledge_garden -d knowledge_garden -c "SELECT commit_sha, status, attempts, last_error, updated_at FROM publish.deploys ORDER BY updated_at DESC LIMIT 10;"`
- 放棄的 commit 要再試一次（把 `<sha>` 換成完整 commit）：`docker exec knowledge-garden-db psql -U knowledge_garden -d knowledge_garden -c "UPDATE publish.deploys SET attempts = 0, updated_at = now() WHERE commit_sha = '<sha>';"`
- 手動全量重建索引（mini 上）：`cd ~/knowledge-garden && source scripts/local-env.sh && node scripts/index-notes.mjs --all`
- mini 的 `scripts/local-env.sh`（gitignored）每行一個 `export`：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`
  （佈署與更新索引）、`LINE_CHANNEL_ACCESS_TOKEN`、`LINE_USER_ID`（LINE 通知）。Worker secrets 見各 `wrangler.toml` 註解
- 資料庫備份：mini 上 launchd `com.liu.kb-backup` 每天 04:30 跑 `scripts/backup-db.sh`，存在
  `~/backups/knowledge_garden/knowledge_garden-YYYY-MM-DD.dump`，保留今天加前 6 天（共 7 份），log 在
  `~/Library/Logs/kb-backup.log`，失敗發一則 LINE。還原前先 `mkdir /tmp/kb-inbox.lock` 暫停收錄，把日期換掉後執行（會蓋掉現有資料），完成後 `rmdir /tmp/kb-inbox.lock`：
  `docker exec -i knowledge-garden-db pg_restore -U knowledge_garden -d knowledge_garden --clean --if-exists --single-transaction < ~/backups/knowledge_garden/knowledge_garden-YYYY-MM-DD.dump`
- mini 停擺：inbox 累積不丟失，恢復後自動補跑；筆電也能手動跑 `scripts/process-inbox.sh`
- ⚠️ **mini 上別用 ssh 手動觸發 claude**：claude 憑證存 macOS Keychain，ssh session 拿不到會報
  `Not logged in`（launchd 跑在 GUI session 正常）。要手動補跑就等下一輪（每 60 秒），或
  `launchctl kickstart gui/501/com.liu.kb-inbox`
