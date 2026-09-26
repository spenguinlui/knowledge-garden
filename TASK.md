# TASK：模組化整理 1，合 upstream v5 並移除 dependabot

## 要解決什麼問題

fork 從 `075afd3`（2026-08-12）分岔後沒合過 upstream（Quartz 原作者 `jackyzha0/quartz` 的 `v5`），
現在落後 9 個 commit，其中 `f8b1a4d feat!: adopt 1.0.0 ecosystem` 把所有 `@quartz-community/*` 升到 `^1.0.0`、
`@quartz-themes/core` 升到 `^2.0.0`。落後越久，`package.json`／`package-lock.json` 的衝突越大。
後面的整理（收錄改寫、搜尋頁搬成外掛）都假設站台跑在最新的外掛版本上，所以先合。

另外 dependabot（GitHub 自動開套件升級 PR 的機器人）在 fork 上一直開 PR 升根目錄套件，
會讓根目錄 `package.json` 跟 upstream 越差越多。套件升級改成只走「合 upstream」。

名詞：

- **主題套件**：`quartz.config.yaml` 的 `@quartz-themes/core` 設了 `theme: default`，它會去載入
  `@quartz-themes/default` 這個套件（core 1.x 與 2.0 都是這樣；沒裝的話建站時會自己跑 `npm install`）。
  這是我們在根目錄 `package.json` 唯一多加的一行，要保留，GitHub Actions 建站才不必臨時安裝。

## 做完怎麼確認（驗收條件）

合併前先記錄基準（在目前的 HEAD 上跑，輸出貼出來）：

- `npx quartz build` 的「Parsed N Markdown files」「Emitted N files」兩個數字。
- `public/index.css` 裡 `:root` 的顏色變數（`--light`、`--lightgray`、`--gray`、`--darkgray`、`--dark`、
  `--secondary`、`--tertiary`、`--highlight`，亮色與暗色兩組）。
- 根目錄 `npm test`、`npx tsc --noEmit` 的結果。

合併後：

- [ ] `git diff upstream/v5 -- package.json` 只多出 `"@quartz-themes/default": "^1.0.1"` 這一行。
- [ ] `rm -rf node_modules && npm ci` 成功，`npm ls @quartz-themes/core @quartz-themes/default` 顯示 core 2.x。
- [ ] `npx quartz build` 成功，Parsed 的筆記數跟基準一樣，建站時**沒有**出現自動安裝主題套件的訊息。
- [ ] `:root` 顏色變數兩組都跟基準一樣（主題有套上）。
- [ ] 根目錄 `npm test` 全綠；`npx tsc --noEmit` 不比基準差（基準綠就要綠）。
- [ ] `cd kg && npm test` 全綠。
- [ ] `.github/dependabot.yml` 已刪除，`.github/workflows/dependabot-automerge.yaml` 不存在。
- [ ] `git diff upstream/v5 --stat -- quartz/` 是空的。
- [ ] 手動（Claude 驗收時做）：`npx quartz build --serve --port 41160`，首頁正常；左側「分類」只列九大主分類加「來源」，
      來源底下顯示 Threads 這類中文／品牌名稱（`quartz.ts` 的 explorer 客製還有作用）；隨便點開一篇 `/notes/<slug>` 正常。

## 動到的模組

- 無功能模組。動的是 upstream 的套件清單與 `.github/`（ARCHITECTURE.md 的「外殼」），不改 ARCHITECTURE.md。

## 範圍內

- `git merge --no-ff --no-commit upstream/v5`，解 `package.json`、`package-lock.json` 衝突：
  `package.json` 取 upstream 版本再補回 `@quartz-themes/default` 那一行；`package-lock.json` 取 upstream 版本後用
  `npm install` 補上 default，不要整份重新生成。
- 刪 `.github/dependabot.yml`；合併帶進來的 `.github/workflows/dependabot-automerge.yaml` 也刪掉（不收）。
- 合併留在暫存區、不 commit，由 Claude 驗收後 commit（要是一個 merge commit，保留 upstream 歷史，下次合併才有正確的分岔點）。

## 範圍外（這次不准碰）

- `quartz/` 裡合併以外的任何改動、`quartz.ts`、`quartz.config.yaml`、`tsconfig.json`
- `content/`、`scripts/`、`db/`、`workers/`、`kg/`、`.claude/`、`deploy.yml`、`vectorize.yml`
- 合併之外另外升級或降級任何套件
- 建站壞掉、或外掛 1.0 需要改設定時：**停下來回報**，不要改 `quartz.config.yaml`／`quartz.ts` 去遷就
- 不准 git commit、不准 push、不准動 GitHub 上的 PR 或分支（那些由 Claude 收尾時做）

## 已裁決的分歧點

- 合併方式 → merge commit，不 rebase、不 squash。
- `@quartz-themes/default` → 保留（`theme: default` 靠它；沒裝會在建站時自動安裝，CI 不該這樣）。
- dependabot → 全部移除：刪 `dependabot.yml`、不收 `dependabot-automerge.yaml`（它限定 `jackyzha0/quartz`
  才執行，在 fork 是死檔）。收下後由 Claude 關掉 origin 的 PR #3、#5，刪掉 5 條 `dependabot/*` 遠端分支。
- 套件升級的管道 → 只走合 upstream。
- push 會觸發 Cloudflare Pages 用新套件建站 → 驗收過後問使用者再 push。
