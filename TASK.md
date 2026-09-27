# TASK：5b-3 上線修正，建站看不到文章（content/notes 不能寫在 .gitignore）

## 要解決什麼問題

5b-3 上線（`97d2181`）後第一次建站只找到 2 個檔案，網站上所有文章頁都變成 404。原因是 Quartz（upstream，不能改）
建站時會跳過 `.gitignore` 列到的檔案（`quartz/util/glob.ts` 的 `gitignore: true`、`quartz/build.ts` 的 `isGitIgnored`），
而 5b-3 把 `content/notes/` 加進了 `.gitignore`。網站已用 Cloudflare 回滾到上一版（`fe206c1`，55 篇都在），
mini 的收錄暫停中（`/tmp/kb-inbox.lock`），LINE 丟進來的項目會留在 inbox 等恢復後處理。

實測：globby（Quartz 用的套件）只讀 `.gitignore` 檔，不讀 `.git/info/exclude`；git 兩個都讀。
所以把「content/notes 不進 git」這條規則從 `.gitignore` 搬到各台機器的 `.git/info/exclude`，git 照樣不追蹤，Quartz 看得到。

## 做完怎麼確認（驗收條件）

先寫測試、跑到紅、貼出紅的輸出，才准寫實作。

- [ ] 防呆測試（放 `cd kg && npm test` 會跑的地方）：把根目錄 `.gitignore` 複製進一個臨時的新 git repo，
      `git check-ignore content/notes/x.md` 必須判定「不忽略」（臨時 repo 沒有 `.git/info/exclude`，量到的只有 `.gitignore`，跟 Quartz 看到的一樣）。
      現在的 `.gitignore` 跑這條是紅的。
- [ ] `scripts/pull-notes.sh`：`.git/info/exclude` 沒有 `content/notes/` 這一行時補上，已經有就不重複加（`kg/spec/pull-notes.spec.ts`）。
- [ ] `scripts/process-inbox.sh`：每輪啟動 `kg/src/main.ts` 之前做同樣的補行，有就不加（`kg/spec/db/shell.spec.ts`）。
- [ ] `cd kg && npm test`、`npm run test:db`、根目錄 `npm test` 全綠。
- [ ] （Claude 驗）筆電 `.git/info/exclude` 補上那行後 `git status` 看不到 content/notes；`npx quartz build` 印出 57 個 input files（55 篇＋index＋search）。
- [ ] 上線後（Claude 經 ssh）：mini 建站 log 是 57 個 input files；網站任一篇文章 200；`/search` 正常。
- [ ] 使用者驗證（同 5b-3）：LINE 丟一則收到「已上花園」；筆電 `/capture` 一則，終端機顯示已送出、手機收到「已上花園」；
      筆電 `scripts/pull-notes.sh` 後 `npx quartz build --serve --port 41160` 看得到剛收的那篇。

## 動到的模組

- 外殼：`scripts/pull-notes.sh`、`scripts/process-inbox.sh`、根目錄 `.gitignore`。

## 範圍內

- `.gitignore` 拿掉 `content/notes/`；`scripts/pull-notes.sh`、`scripts/process-inbox.sh` 各加補行；`kg/spec/` 對應測試。
- `AGENTS.md`、`CLAUDE.md`、`README.md`、`ARCHITECTURE.md` 講到 content/notes 不進 git 的句子，補一句「規則寫在各機器的 `.git/info/exclude`，
  不能寫進 `.gitignore`，因為 Quartz 建站會跳過 `.gitignore` 列到的檔案」。

## 範圍外（這次不准碰）

- `quartz/`、根目錄 `package.json`、`quartz.config.yaml`、`quartz.ts`、`content/index.md`、`content/search.md`、`workers/`
- `kg/src/`（程式邏輯沒錯，只是規則放錯地方）、兩個 plist、`compose.yaml`、`scripts/backup-db.sh`
- 真正的 `.git/info/exclude`（筆電與 mini 的由 Claude 處理，測試只准用臨時 repo）
- mini：不准連；不准 git commit、push；不准 git add content/notes

## 上線步驟（驗收過後由 Claude 直接做，不另等「收下」：網站文章頁與收錄現在都卡著）

1. commit、push；mini 仍在暫停中，`git pull`，手動補 `.git/info/exclude` 那一行。
2. `rmdir` 解鎖、`launchctl kickstart`：新 commit 就是新的網站版本，會重新建站；確認 log 是 57 個 input files、文章頁 200。
3. 請使用者做三項驗證。

## 已裁決的分歧點

- 規則放 `.git/info/exclude`，由會產生 content/notes 的兩個外殼腳本自己補上（mini 每輪、筆電每次拉文章）；
  新 clone 在跑這兩個腳本之前沒有 content/notes，不會有漏掉的空窗（Claude 決定）。
- 不改用「匯出到 repo 外的資料夾、建站指定 `-d`」：`index-notes.mjs`（範圍外）直接讀 `content/notes/`，文章會變兩份，改動也大得多（Claude 決定）。
- 不改 Quartz（upstream 規則）（Claude 決定）。
- 事故補救：網站已用 Cloudflare Pages 回滾到 `fe206c1` 那次佈署；`publish.deploys` 裡那筆壞掉的 done 不動，
  新 commit 就是新的網站版本，自然重建（Claude 決定）。
- 5b-3 的驗收漏了「真的跑一次建站、數 input files」：之後動到 content/ 或建站流程的 TASK，Claude 驗收時一律跑一次 `npx quartz build` 看檔數（Claude 決定）。
- 外殼防呆「腳本裡沒有 git 指令」改成只擋真的 git 指令，`.git/` 路徑不算（Claude 決定，實作中補裁）。
