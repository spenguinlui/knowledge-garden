# 🌱 knowledge-garden

個人知識花園：markdown 知識庫 + 公開網站 + LINE 收錄 + 語意搜尋。

```
LINE 小柳三世（OpenClaw）→ 轉交寫入 inbox/（git 當 queue）
Mac mini launchd 每 5 分 → claude -p /capture → content/notes/ → push
push → GitHub Actions → Cloudflare Pages（Quartz 網站）
                      → embed (bge-m3) → Vectorize（語意搜尋索引）
網站 /search 頁 → CF Worker (kb-search) → Vectorize query

（LINE 小柳二世 = 雜物箱，收非知識雜項進私有 repo stash，與花園無關）
```

## 目錄

| 路徑 | 用途 |
|---|---|
| `content/notes/` | 筆記本體（flat，第一個 tag = 主分類），規格見 `.claude/skills/capture/SKILL.md` |
| `inbox/` | LINE 訊息佇列：`{messageId}.json`（+ `.jpg`），mini 消化後刪除 |
| `.claude/skills/capture/` | `/capture` skill——收錄流程與筆記規格的單一事實來源 |
| `workers/line-webhook/` | 小柳二世雜物箱 webhook → 寫私有 repo stash（驗簽、抓圖、冪等） |
| `workers/kb-search/` | 語意搜尋 API（bge-m3 embed → Vectorize query） |
| `scripts/process-inbox.sh` | mini 消費端（launchd `com.liu.kb-inbox`，log 在 `~/Library/Logs/kb-inbox.log`） |
| `scripts/index-notes.mjs` | 筆記 → 向量索引（增量 / `--all` 全量） |
| `quartz/`、`quartz.config.yaml` | Quartz v5 本體與設定；升級走 `git pull upstream v5` |

## 收錄方式

- **LINE**：丟給**小柳三世** URL / 文字 / 截圖，≤5 分鐘上站（雜物丟小柳二世 → 進私有 stash）
- **桌面**：repo 內 `claude` → `/capture <url|文字|圖片路徑>`
- 手寫：直接在 `content/notes/` 加檔，照 skill 裡的 frontmatter 規格

## 維運備忘

- 網站部署：`.github/workflows/deploy.yml`（push 觸發，`inbox/` 等路徑除外）
- 向量索引：`.github/workflows/vectorize.yml`（content/ 變動觸發；手動 dispatch 勾 full 可全量重建）
- Secrets：GitHub repo 要 `CLOUDFLARE_API_TOKEN` `CLOUDFLARE_ACCOUNT_ID`；Worker secrets 見各 `wrangler.toml` 註解；mini 的 LINE 告警 token 在 `scripts/local-env.sh`（gitignored）
- mini 停擺：inbox 累積不丟失，恢復後自動補跑；筆電也能手動跑 `scripts/process-inbox.sh`
- ⚠️ **mini 上別用 ssh 手動觸發 claude**：claude 憑證存 macOS Keychain，ssh session 拿不到會報
  `Not logged in`（launchd 跑在 GUI session 正常）。要手動補跑就等下一個 5 分鐘 tick，或
  `launchctl kickstart gui/501/com.liu.kb-inbox`
