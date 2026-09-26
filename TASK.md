# TASK：第②層 5b-1，mac mini 每日備份資料庫（本機保留 7 天）

## 要解決什麼問題

第②層接下來要把文章搬進 mini 的 Postgres 當唯一正本（`content/notes` 會退出 git）。切換之後，
資料庫壞掉或誤刪就等於文章沒了，所以備份要在切換之前先上線、先跑穩。現在資料庫裡只有收錄紀錄表 `capture.jobs`
（約 7.5 MB），剛好拿來驗證備份與還原都可行。

名詞：

- **dump 檔**：`pg_dump --format=custom` 匯出的整個資料庫，用 `pg_restore` 可以還原成一模一樣的資料庫。
- **mini**：生產機 mac mini，Postgres 跑在容器 `knowledge-garden-db`（只綁 `127.0.0.1:41161`）。

## 做完怎麼確認（驗收條件）

先寫測試、跑到紅、貼出紅的輸出，才准寫腳本。測試放 `kg/spec/db/backup.spec.ts`，跑在 `cd kg && npm run test:db`
（筆電的 `knowledge-garden-db` 容器，測試自己建、自己刪獨立 database 與暫存資料夾），情境：

- [ ] 1 備份成功：備份資料夾出現 `knowledge_garden-<今天日期>.dump`，沒有殘留 `.partial`；用 `pg_restore` 還原到另一個
      臨時 database，`capture.jobs` 的筆數與內容跟來源一樣。
- [ ] 2 保留 7 天：事先放一份 7 天前與一份 6 天前的 dump（用 `touch` 改修改時間），跑完 7 天前那份被刪、6 天前那份還在；
      資料夾裡不是 `knowledge_garden-*.dump` 的檔案不受影響。
- [ ] 3 備份失敗（容器名稱錯）：腳本以非 0 結束、沒有留下 `.partial` 或空的 dump、舊備份一份都沒被刪，
      並發一則 LINE「❌ knowledge-garden 每日備份失敗，詳見 mini 的 ~/Library/Logs/kb-backup.log」（`PATH` 前置假 `curl` 攔截）。
- [ ] `cd kg && npm test` 與 `npm run test:db` 全綠。
- [ ] 上線後（Claude 經 ssh 做）：mini 手動觸發一次，`~/backups/knowledge_garden/` 出現今天的 dump；在 mini 上還原到臨時
      database 比對 `capture.jobs` 筆數一致後刪掉臨時 database；`launchctl print` 看得到排程每天 04:30。

## 動到的模組

- 外殼（`ARCHITECTURE.md` 的「外殼」列加上備份腳本與排程）。不新增功能模組。

## 範圍內

- 新增 `scripts/backup-db.sh`（備份外殼）與 `scripts/com.liu.kb-backup.plist`（launchd 排程，路徑用 mini 的）。
- 新增 `kg/spec/db/backup.spec.ts`。
- `ARCHITECTURE.md` 外殼列；`README.md`「維運備忘」補備份位置、保留天數、還原指令（一行可複製）。

## 範圍外（這次不准碰）

- `kg/src/`、`scripts/process-inbox.sh`、`scripts/com.liu.kb-inbox.plist`、`db/`、`compose.yaml`
- `content/`、`quartz/`、`quartz.config.yaml`、`workers/`、`.github/`、`.claude/`
- 雲端備份（使用者 2026-09-26 決定不上雲）
- mini：實作階段不准連；不准 git commit、不准 push

## 上線步驟（使用者收下後由 Claude 經 ssh 做）

1. push；mini 上先 `mkdir /tmp/kb-inbox.lock` 暫停收錄，`git pull`，再 `rmdir` 解鎖。
2. 複製 plist 到 `~/Library/LaunchAgents/`，`launchctl bootstrap gui/501` 載入，`launchctl kickstart` 手動跑一次。
3. 照驗收條件最後一條檢查。

## 已裁決的分歧點

- 備份存 mini 本機，每天一次，保留 7 天，不上 R2 或其他雲端（使用者決定，取代原本的 R2 方案）。
- 做法照 mini 上 rent_house 的 `deploy/backup.sh`：用容器裡的 `pg_dump`（版本一定跟資料庫一致）、`--format=custom`、
  先寫 `.partial` 成功才改名、`find -mtime +6 -delete` 保留今天加前 6 天（Claude 決定：同一台機器維護方式一致）。
- 位置 `~/backups/knowledge_garden/knowledge_garden-YYYY-MM-DD.dump`，log `~/Library/Logs/kb-backup.log`，
  每天 04:30（Claude 決定：避開 rent_house 04:00 與 stock_commentary 23:30）。
- 備份失敗發一則 LINE（Claude 決定，沿用收錄程式「當掉要通知」的原則；token 讀 `scripts/local-env.sh`，沒設就只寫 log）。
  失敗時不刪任何舊備份。
- 腳本只做串接（匯出、改名、刪舊檔、告警），不含業務邏輯，所以用 zsh；主體包在 `{ ... }` 裡，理由同 `process-inbox.sh`
  （Claude 決定）。腳本吃 `KB_DIR`、`BACKUP_DIR`、`DB_CONTAINER`、`DB_NAME` 環境變數覆寫，測試才能指到臨時資料夾、錯的容器名稱、
  自己建的臨時 database；`DB_NAME` 沒設就用容器的 `POSTGRES_DB`（實作中裁決，Claude 決定）。
- 整個資料庫一起備份（現在只有 `capture.jobs`，切換後會多文章的表）。第③層的向量資料到時再決定要不要排除。
- log 由 plist 的 `StandardOutPath`／`StandardErrorPath` 寫到 `~/Library/Logs/kb-backup.log`，腳本本身只輸出到畫面，
  跟 `com.liu.kb-inbox.plist` 一致，測試也不會寫到真正的 log（實作中裁決，Claude 決定）。
