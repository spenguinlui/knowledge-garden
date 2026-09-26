# knowledge-garden 架構

階段：1 多模組
邊界檢查：`cd kg && npm test`（dependency-cruiser 掃 `kg/src` 與 `kg/quartz-plugins`，另有測試確認 `quartz/` 沒有引用 `kg/`、`workers/`）

自己寫的新程式一律放 `kg/`（獨立的 package.json、tsconfig、node_modules，不做 npm workspace），
讓根目錄的 package.json 維持 upstream 原樣。`quartz/` 與根目錄 package.json 是 upstream 的碼，不改。

`kg/src/<模組>/` 是一個模組，入口是它的 `index.ts`。規則寫在 `kg/.dependency-cruiser.cjs`：
不准循環依賴（`no-circular`）、只准 import 別的模組的 `index.ts`（`feature-entrance-only`）、
`src/shared/` 不准 import 功能模組（`shared-no-feature`）、`src/` 與 `quartz-plugins/` 不准 import `quartz/`（`no-upstream`）、
`src/notes/` 不准 import `fs`、`child_process`、`http`、`pg` 這類 I/O 模組（`notes-pure`）。
`kg/src/` 目前有 capture、notes 兩個模組，其餘都是還沒搬進 `kg/` 的既有程式。

notes 整個是純函式（只吃字串、吐結果，不碰檔案、資料庫、網路）。切換到資料庫時要加讀寫，
屆時把純計算收進子資料夾，`notes-pure` 跟著縮小到那個子資料夾。

`kg/quartz-plugins/<外掛>/` 是本機 Quartz 外掛：`quartz.config.yaml` 用 `source: ./kg/quartz-plugins/<外掛>` 載入，
建站時 symlink 到 `.quartz/plugins/`，TypeScript 原始碼直接當入口（不編譯）。外掛只准用 `@quartz-community/types`、`preact`
這類 Quartz 對外公開的套件（從根目錄 `node_modules` 解析），不准 import `quartz/` 內部。

## 模組
| 模組 | 路徑 | 職責（一句話） | 可以依賴 | 擁有的表 |
|---|---|---|---|---|
| site | `quartz.ts`、`quartz.config.yaml`、`content/search.md`、`kg/quartz-plugins/semantic-search/` | 站台客製化與語意搜尋頁（搜尋框是元件外掛，只畫在 `/search`） | upstream quartz；只經 HTTP 呼叫 search-api | 無 |
| capture | `kg/src/capture/`（外殼 `scripts/process-inbox.sh` 只上鎖、裝套件、啟動、當掉告警）、`.claude/skills/capture/`、`db/schema.sql` | inbox → /capture → 產出筆記、記錄任務狀態 | 無 | `capture.jobs` |
| notes | `kg/src/notes/` | 一篇筆記的 Markdown 與筆記資料互轉（`parseNote`、`renderNote`），現有筆記全量來回測試一字不差 | 無 | 無（切換到資料庫時擁有文章的表） |
| search-api（過渡） | `workers/kb-search/`、`scripts/index-notes.mjs` | 筆記寫進 Vectorize 索引、提供查詢 API；第③層完成時整個刪除 | 無 | 無（Vectorize `kb-index`） |
| 外殼 | `scripts/com.liu.kb-inbox.plist`、`.github/workflows/`、`compose.yaml` | 只負責排程、佈署、起資料庫容器 | — | — |

## 刻意保留的複本（有測試比對）
這幾組分散在 YAML、Worker 設定、瀏覽器端函式裡，沒辦法 import 同一個來源，
改由 `kg/spec/duplicated-constants.spec.ts` 讀檔比對，改一邊忘了另一邊測試就會紅。
- 站台網址：`kg/src/capture/rules.ts` 的 `SITE`、`quartz.config.yaml` 的 `baseUrl`、`workers/kb-search/wrangler.toml` 的 `SITE_BASE`
- 九大主分類（同一組、同一順序）：`quartz.ts` 的 `MAIN`、`.claude/skills/capture/SKILL.md` 的主分類表
- 向量模型名：`scripts/index-notes.mjs` 的 `MODEL`、`workers/kb-search/src/index.ts` 呼叫的模型（第③層隨 Worker 刪除）
- 向量索引名：`scripts/index-notes.mjs` 的 `INDEX`、`wrangler.toml` 的 `index_name`（第③層隨 Worker 刪除）

## 既有違規（只准變少）
- `index-notes.mjs` 自行解析 frontmatter → 計畫在 TASK 6（第③層）清掉

第②③④層的模組規劃與 TASK 順序見 `works/audits/2026-09-25/knowledge-garden.md` 的 C 節。
