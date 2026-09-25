# TASK：模組化整理 0，建 kg/ 骨架與 ARCHITECTURE.md

## 要解決什麼問題

專案實際上已經有站台、收錄、語意搜尋、資料庫四個功能，卻沒有模組清單，也沒有任何機器在檢查誰可以
依賴誰（盤點報告：`works/audits/2026-09-25/knowledge-garden.md`）。自己寫的 TS/JS 散在
`workers/`、`scripts/`，連型別檢查都沒涵蓋到。接下來要把收錄管線從 zsh 改寫成 TS（TASK 2）、
再做第②層（文章改存 DB 當正本），這些新程式碼需要一個已經有邊界檢查的地方落腳；
現在不先建好，新程式會又散在各處。

名詞：

- **kg/**：本專案自己寫的 TypeScript 放這裡。獨立的 `package.json`、`tsconfig.json`、`node_modules`，
  不做 npm workspace，讓根目錄的 `package.json` 維持 upstream（Quartz 原作者的版本）原樣。
- **邊界檢查**：dependency-cruiser（掃 import 方向的工具），違反規則就讓 `npm test` 失敗。

## 做完怎麼確認（驗收條件）

- [ ] 先寫規則測試 `kg/test/`：對下面四條規則各準備一組「故意違規」的小型範例檔，斷言
      dependency-cruiser 回報的違規包含該規則名稱；再準備一組「乾淨」範例，斷言零違規。
      在 `.dependency-cruiser.cjs` 還沒寫規則之前跑一次，貼出紅的輸出，才准寫規則。
- [ ] 另一個測試：掃 `quartz/` 底下所有檔案，不准出現 `kg/` 或 `workers/` 的引用。
- [ ] 刪掉 `kg/node_modules` 後 `cd kg && npm ci && npm test` 全綠。`npm test` 依序跑：
      dependency-cruiser 掃 `src`、`tsc --noEmit`、`node --test`。`kg/src/` 目前沒有程式碼，也要綠。
- [ ] 手動驗（Claude 驗收時做）：建 `kg/src/a/index.ts`、`kg/src/a/internal.ts`、`kg/src/b/index.ts`
      （從 `../a/internal.ts` import），`npm test` 失敗且訊息點名 `feature-entrance-only`；刪掉三個檔案後轉綠。
- [ ] 根目錄 `npx quartz build` 照樣成功（證明站台沒受影響，push 後觸發的佈署不會壞）。
- [ ] `git status --short` 只出現範圍內的路徑；`kg/node_modules` 沒被追蹤。

## 動到的模組

- 新增 `kg/`（目前空殼，只有工具與規則，第一個功能模組在 TASK 2 放進來）。
- 新增 `ARCHITECTURE.md`，記下現有模組：site、capture、search-api、外殼。

## 範圍內

- `kg/`：`package.json`（`private`、`type: module`、`engines.node >=22.18`，devDependencies 只有
  `dependency-cruiser`、`typescript`、`@types/node`）、`package-lock.json`、`tsconfig.json`（strict、noEmit，
  用 Node 原生跑 `.ts`，不裝 tsx）、`.dependency-cruiser.cjs`、`test/`。規則四條：
  - `no-circular`：禁止循環依賴。
  - `feature-entrance-only`：`src/<模組>/` 只准 import 別的模組的 `index.ts`。
  - `shared-no-feature`：`src/shared/` 不准 import 任何其他 `src/<模組>/`。
  - `no-upstream`：`src/` 不准 import `quartz/`。
- 根目錄新增 `ARCHITECTURE.md`，格式照 `works/ARCHITECTURE-GUIDE.md` 第 7 節。階段 1；邊界檢查
  `cd kg && npm test`；模組表只列現有的 site、capture、search-api、外殼（路徑、擁有的表以盤點報告 B 節為準，
  但路徑要寫現在的位置，例如 capture 是 `scripts/process-inbox.sh` 和 `.claude/skills/capture/`，擁有
  `capture_jobs`）；「既有違規」照盤點報告 B 節四條，各標上預計清掉的 TASK；第②③④層只寫一行指向盤點報告 C 節。
- `AGENTS.md`、`CLAUDE.md` 各補一行：自己寫的新程式放 `kg/`，模組規則看 `ARCHITECTURE.md`，
  改完跑 `cd kg && npm test`。`README.md` 的「目錄」表補 `kg/`、`ARCHITECTURE.md` 兩列。

## 範圍外（這次不准碰）

- `quartz/`、根目錄 `package.json`、`package-lock.json`、`tsconfig.json`、`quartz.ts`、`quartz.config.yaml`
- `scripts/`、`db/`、`compose.yaml`、`workers/`、`content/`、`.github/`、`.claude/`
- mini 與 Postgres：不連、不改表（`capture_jobs` 搬 schema 併進 TASK 2）
- 把任何既有程式搬進 `kg/`（收錄管線是 TASK 2，站台常數是 TASK 3，搜尋頁是 TASK 4）
- 不准 git commit、不准 push

## 已裁決的分歧點

- 範圍 → 只做骨架。`capture_jobs` 改名 `capture.jobs` 併進 TASK 2，SQL 只寫一次、mini 只動一次。
- 自己的程式放哪 → `kg/` 獨立套件，根目錄 `package.json` 不動。
- 模組表 → 只寫現有模組；`shared`、`line`、`notes`、`retrieval`、`ask` 真的出現時才加列。
  `kg/src/shared/` 這次不建。
- CI → 不接 GitHub Actions，只在本機跑，每個 TASK 驗收時由 Claude 跑。
- push 會觸發一次 Cloudflare Pages 佈署（`deploy.yml` 沒排除 `kg/`）→ 無害，不改 `deploy.yml`。
