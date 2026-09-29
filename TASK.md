# TASK：收錄每輪不再 git pull，程式碼更新改由 GitHub Actions 在 push 時拉到 mini

## 要解決什麼問題

mini 每 60 秒一輪的第一步是 `git pull`（`kg/src/main.ts` 呼叫 publish 的 `pull`），pull 失敗就整輪丟錯，
外殼 `scripts/process-inbox.sh` 發一則「❌ 收錄程式異常結束」LINE。9/27 以來 33 次失敗全卡在 pull：
網路斷線（查不到 ssh.github.com）、Xcode 授權、GitHub 間歇性回 `Permission denied (publickey)`。
收錄本身全部成功，使用者卻一直收到 ❌，以為收錄壞了。

文章 5b-3 之後正本在 mini 的資料庫，收錄完全不需要 GitHub。pull 只剩「把筆電 push 的程式碼改動帶到 mini」這個用途，
這是部署的事，不該綁在每分鐘的收錄上。改成：push 到 `v5` 時，由 mini 上的 GitHub Actions self-hosted runner
（裝在 mini、主動連 GitHub 領工作的程式，stock_commentary 已經在用同一招）把程式碼拉進 `~/knowledge-garden`；
下一輪看到 HEAD（目前 commit）是沒佈署過的網站版本，照既有邏輯建站、佈署。

## 做完怎麼確認（驗收條件）

先寫測試、跑到紅、貼出紅的輸出，才准寫實作。

- [ ] `kg/spec/db/publish.spec.ts`：把 origin 刪掉（連不到 GitHub），inbox 有一則 → 這一輪照樣收錄、建站、佈署，發「已上花園」，不丟錯。
      取代現有的「pull 失敗：丟錯，不收錄、不建站」。
- [ ] `kg/spec/db/publish.spec.ts`：原本的測試 6 改成「GitHub 上有新 commit、clone 還沒拉 → 這一輪不動 HEAD，佈署的是 clone 目前的版本」；
      另一條「clone 已經在新 commit（部署工作拉好了）、inbox 是空的 → 這一輪佈署新 commit」。
- [ ] `kg/spec/update-code.spec.ts`（新，臨時 repo，不碰真的 `/tmp/kb-inbox.lock`，鎖的路徑用環境變數換掉）測 `scripts/update-code.sh`：
      - 鎖沒被佔：拿鎖 → `git pull --ff-only` → 放鎖，clone 變成 origin 的最新 commit。
      - 鎖被佔（收錄正在跑）：等到鎖放掉才 pull；等超過上限（測試用環境變數設幾秒）就非 0 結束、不 pull、不動別人的鎖。
      - pull 失敗（origin 不見、或不是 fast-forward）：非 0 結束，鎖一定放掉。
- [ ] `cd kg && npm test`、`cd kg && npm run test:db`、根目錄 `npm test` 全綠；歸屬檢查認得新檔。
- [ ] 上線後（Claude 經 ssh 與 gh 驗）：mini 的 kb-inbox.log 之後不再出現 `git pull`；push 一個只改文件的 commit，
      GitHub Actions 的部署工作綠燈、mini 的 HEAD 等於 origin/v5、下一輪 log 出現那個 commit 的 `publish … done`。
- [ ] 使用者驗證：LINE 丟一則，收到「🌱 已上花園」；打開 GitHub repo 的 Actions 頁，看到上線那次 push 的「部署到 mini」是綠勾。

## 動到的模組

- publish：拿掉 `pull`（`kg/src/publish/git.ts`、`index.ts`）。
- 外殼：`kg/src/main.ts` 不再呼叫 pull；新增 `scripts/update-code.sh`、`.github/workflows/deploy.yml`。

## 範圍內

- 上面三個模組的改動，與 `kg/spec/` 對應測試（`kg/spec/db/harness.ts` 跟著調）。
- `.github/workflows/deploy.yml`：push 到 `v5`（加手動觸發）→ 跑在 mini 的 runner（labels `self-hosted, macOS, knowledge-garden`）→
  不 checkout，直接執行 `~/knowledge-garden/scripts/update-code.sh`；同時間只准一個部署（concurrency）。
- 文件：`ARCHITECTURE.md`（publish 那列拿掉「每輪 pull」、main.ts 說明、外殼那列加兩個新檔）、`README.md`、`CLAUDE.md`、`AGENTS.md`
  講到「mini 每輪 pull」的句子改成「push 後由 GitHub Actions 在 mini 拉下來，下一輪建站佈署」；`process-inbox.sh` 開頭講 pull 的註解跟著改。

## 範圍外（這次不准碰）

- `kg/src/capture/`、`kg/src/notes/`、`workers/`、`quartz/`、`quartz.config.yaml`、`quartz.ts`、`content/`、根目錄 `package.json`
- `scripts/process-inbox.sh` 的行為（只准改註解）、兩個 plist、`compose.yaml`、`scripts/backup-db.sh`、`scripts/pull-notes.sh`
- 發 LINE 的文字與時機（❌ 告警邏輯不改，pull 拿掉之後它自然只剩真正的異常）
- CI（push 時先跑測試再部署）：這次不做
- mini 與 GitHub 設定：不准 ssh 連 mini、不准註冊 runner、不准 commit、push（上線由 Claude 做）

## 上線步驟（驗收過後由 Claude 做）

1. mini 裝第二個 runner（`~/actions-runner-kg`，註冊到 knowledge-garden repo，label `knowledge-garden`），用 `svc.sh` 裝成開機常駐。
2. commit、push。mini 現行程式下一輪仍會 pull 一次，拉到的就是新版，之後不再 pull；Actions 的部署工作也會跑一次，兩邊靠鎖排隊。
3. 照驗收條件的「上線後」逐項確認，請使用者做兩項驗證。

## 已裁決的分歧點

- 收錄每輪完全不 pull，程式碼更新是部署的事，走 GitHub Actions → 使用者決定。
- 部署工作只負責把程式碼拉進 mini 的 clone，建站與佈署仍由下一輪做（HEAD 沒佈署過就建站，這段既有邏輯不動），
  不在 workflow 裡再建一次站：兩條路建站會互搶、也會重複記錄佈署（Claude 決定）。
- 拉程式碼前要先拿 `/tmp/kb-inbox.lock`：收錄那一輪正在跑時換掉檔案會讀到一半新一半舊。等鎖上限 10 分鐘，超過就讓部署工作失敗，
  GitHub 會寄信、Actions 頁會紅，重跑即可（Claude 決定）。
- 用 `git pull --ff-only`：mini 的 clone 不該有自己的 commit，真的有就失敗讓人看，不自動 rebase（Claude 決定）。
- 拉程式碼的邏輯放 `scripts/update-code.sh` 而不是寫在 workflow 裡：才測得到鎖的行為。腳本主體包在 `{ }` 裡，
  因為它會 pull 改寫自己（Claude 決定）。
- runner 註冊在 repo 層級（個人帳號沒有跨 repo 共用 runner），所以 mini 要裝第二份，跟 stock_commentary 那份分開（Claude 決定）。
- 程式碼推上去之後大約 1–2 分鐘上線（Actions 領工作加下一輪建站），跟現在差不多（Claude 決定）。
- 這次不加 CI：先讓部署這條路最小可用，測試仍照 AGENTS.md 在筆電 push 前跑（Claude 決定）。

## 上線紀錄

- 2026-09-30 00:19 push `0903a85`：第一次 Actions 部署失敗（`update-code.sh: No such file or directory`），因為 runner 領到工作時
  mini 還沒有這支腳本；5 秒後 mini 舊版程式最後一次 pull 把新程式拉下來，00:20:12 佈署完成。只會在切換當下發生一次。
