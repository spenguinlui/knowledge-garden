# TASK：改由 mini-deploy 部署，拿掉 mini 上的 GitHub runner

> 工作資料夾 `~/sideproject/worktrees/knowledge-garden-mini-deploy`（分支 `mini-deploy`，從 `v5` 的 `d33a858` 開出）。

## 要解決什麼問題

knowledge-garden 是 public repo（任何人都看得到、都能開 PR），程式碼更新卻靠 mini 上的 GitHub self-hosted runner：
GitHub 把工作派給 mini 上的這支程式執行。public repo 接 runner，別人開的 PR 有機會讓 mini 執行他寫的指令；
現在設成外部 PR 要使用者核准才會跑，只是把風險壓低。另外，push 上去的程式碼沒有任何測試把關，壞掉的版本照樣上到 mini。

改成跟 rent_house 一樣：測試在 GitHub 提供的雲端機器上跑（public repo 免費），綠了之後，
mini 上的 mini-deploy（每分鐘檢查一次的自動部署程式，`~/sideproject/works/mini-deploy`）自己把程式碼拉下來。
mini 不再接受 GitHub 派來的任何工作。

## 做完怎麼確認（驗收條件）

**實作完成（codex）**

- [ ] `.github/workflows/ci.yml` 在 GitHub 的 ubuntu 機器上跑，這個 PR 的 CI 綠，log 看得到四項都真的跑完：
      根目錄 `npm test`、`cd kg && npm test`、`cd kg && npm run test:db`（測試數大於 0）、`npx quartz build`。
- [ ] 筆電 `cd kg && nice npm test`、`cd kg && nice npm run test:db` 全綠（歸屬檢查在前者裡面）。
- [ ] `deploy/update.sh` 有執行權限，筆電直接跑它，結束碼 0。
- [ ] 這條指令沒有輸出：
      `grep -rn "update-code\|deploy\.yml\|self-hosted" CLAUDE.md AGENTS.md README.md ARCHITECTURE.md scripts kg/src kg/spec .github deploy`
- [ ] `git diff --stat d33a858` 只有「範圍內」列的路徑。

**上線後（Claude 做）**

- [ ] mini 的 `~/Library/Logs/mini-deploy.log` 出現 `[knowledge-garden] 部署成功 <這次的 commit 前 7 碼>`，mini 的 clone 停在那個 commit。
- [ ] 下一輪 `~/Library/Logs/kb-inbox.log` 出現 `publish <這次的 commit 前 7 碼> + notes ...: done`。
- [ ] `gh api repos/spenguinlui/knowledge-garden/actions/runners` 的清單是空的；mini 上 `~/actions-runner-kg` 不在，
      `launchctl list` 找不到 `actions.runner.spenguinlui-knowledge-garden`。

**使用者驗證**

1. 開 https://knowledge.wayne-liu.com 任一篇筆記，打得開。
2. 用 LINE 丟一則東西，照常收到「🌱 已上花園」。

## 動到的模組

- 外殼：部署腳本、GitHub 設定、排程腳本的註解。site、capture、publish、notes、search-api 都不動。

## 範圍內

- 新增 `.github/workflows/ci.yml`、`deploy/update.sh`；刪掉 `.github/workflows/deploy.yml`、`scripts/update-code.sh`、`kg/spec/update-code.spec.ts`。
- `ARCHITECTURE.md` 的外殼那一列；`CLAUDE.md`、`AGENTS.md`、`README.md` 講程式碼怎麼上 mini 的段落，舊說法直接刪。
- `scripts/process-inbox.sh`、`scripts/backup-db.sh` 開頭講「程式碼怎麼更新」的註解（只改註解）。

## 範圍外（這次不准碰）

- `kg/src/`、`kg/quartz-plugins/`、`quartz/`、`workers/`、`content/`、`.claude/`、`compose.yaml`
- 根目錄與 `kg/` 的 `package.json`、`package-lock.json`
- `scripts/` 除了上面兩段註解以外的內容（鎖、排程、備份的邏輯都不動）
- 不准 merge PR、不准 push 到 `v5`、不准 ssh 連 mini、不准動 GitHub 的設定與 runner（runner 由 Claude 上線時拆）。
  可以 push 這條分支、開 PR 看 CI。
- 筆電會過熱：測試一次跑一套、前面加 `nice`，不要平行；根目錄 `npm test` 與 `npx quartz build` 交給 CI，筆電不跑。

## 已裁決的分歧點

- 先做這個，再上 tag-editor（網站搬到 mini、文章頁改標籤，分支 `tag-editor`）→ 使用者決定（2026-10-16）。
  tag-editor 上線時，要把它在 `scripts/update-code.sh` 加的「重啟 `com.liu.kb-web`」搬進 `deploy/update.sh`。
- 部署失敗、mini 的 clone 有未提交的改動、等收錄鎖超過 10 分鐘，都改成發 LINE（mini-deploy 內建的通知）；
  以前部署失敗只在 GitHub Actions 頁看得到 → 沿用 rent_house 接 mini-deploy 時使用者選的 LINE。
- 只部署 CI 通過的版本，所以 push 到網站更新會多等 CI 跑完的那幾分鐘 → 使用者先前的決定。
- 等收錄鎖的工作搬到 mini-deploy（它的 `projects.toml` 對 knowledge-garden 設 `lock = "/tmp/kb-inbox.lock"`，
  在 mini-deploy 那邊另一個 TASK 做）。`deploy/update.sh` 被呼叫時，鎖已經拿到、程式碼已經換好（Claude 決定）。
- `deploy/update.sh` 只印一行說明，不做別的：這個專案沒有常駐服務要重啟，套件安裝和建站本來就由下一輪收錄做
  （`process-inbox.sh` 看到 lock 檔比 `node_modules` 新會自己 `npm ci`）。不在這裡建站：拿著鎖建站會卡住收錄，
  下一輪又會再建一次（Claude 決定）。
- 放在 `deploy/update.sh`：mini-deploy 對每個專案只認這個位置（Claude 決定）。
- CI 的 Node 用 26，跟 mini（v26.10.0）同一大版；資料庫用 repo 的 `compose.yaml` 起，因為備份測試要
  `docker exec knowledge-garden-db`，測試密碼是 `process-inbox-test-password`（Claude 決定）。
- CI 加跑 `npx quartz build`：上線不再經過人手，建站壞掉的版本要在 CI 擋下。`content/notes/` 不在 git，
  CI 建的是沒有文章的站，擋的是設定與外掛的錯（Claude 決定）。
- Ubuntu 和 macOS 的差異（例如沒裝 zsh）只在 `ci.yml` 補，不改腳本與測試；補不起來的測試停下來問（Claude 決定，同 rent_house）。
- `AGENTS.md` 加一條：每個版本都要能只靠 `deploy/update.sh` 上線，push 到 `v5` 幾分鐘後就自動上線；
  要手動做的步驟（例如套用 `schema.sql` 的變更），先在 `TASK.md` 寫明上線順序、讓使用者裁決（Claude 決定，同 rent_house）。

## 上線步驟（驗收過後由 Claude 做）

1. merge mini-deploy 那邊的 PR（等鎖＋knowledge-garden 設定），先不到 mini pull。
2. 這個 PR squash merge 進 `v5`、刪分支。`deploy.yml` 在這個 commit 已經刪掉，runner 不會被觸發。
3. 等 `v5` 上的 CI 綠，到 mini 跑 `git -C ~/mini-deploy pull`。mini-deploy 第一輪把 mini 目前的 commit 當作已部署，
   下一輪等收錄鎖、快轉到這次的 commit、執行 `deploy/update.sh`。
4. 驗「上線後」三條。
5. 拆 runner：mini 上 `~/actions-runner-kg` 執行 `svc.sh stop`、`svc.sh uninstall`，用 GitHub 發的移除代碼跑 `config.sh remove`，刪掉資料夾。
