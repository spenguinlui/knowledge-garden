# knowledge-garden 架構

階段：1 多模組
邊界檢查：`cd kg && npm test`（dependency-cruiser 掃 `kg/src`，另有測試確認 `quartz/` 沒有引用 `kg/`、`workers/`）

自己寫的新程式一律放 `kg/`（獨立的 package.json、tsconfig、node_modules，不做 npm workspace），
讓根目錄的 package.json 維持 upstream 原樣。`quartz/` 與根目錄 package.json 是 upstream 的碼，不改。

`kg/src/<模組>/` 是一個模組，入口是它的 `index.ts`。規則寫在 `kg/.dependency-cruiser.cjs`：
不准循環依賴（`no-circular`）、只准 import 別的模組的 `index.ts`（`feature-entrance-only`）、
`src/shared/` 不准 import 功能模組（`shared-no-feature`）、`src/` 不准 import `quartz/`（`no-upstream`）。
`kg/src/` 目前只有 capture 一個模組，其餘都是還沒搬進 `kg/` 的既有程式。

## 模組
| 模組 | 路徑 | 職責（一句話） | 可以依賴 | 擁有的表 |
|---|---|---|---|---|
| site | `quartz.ts`、`quartz.config.yaml`、`content/search.md` | 站台客製化與語意搜尋頁 | upstream quartz；只經 HTTP 呼叫 search-api | 無 |
| capture | `kg/src/capture/`（外殼 `scripts/process-inbox.sh` 只上鎖、裝套件、啟動、當掉告警）、`.claude/skills/capture/`、`db/schema.sql` | inbox → /capture → 產出筆記、記錄任務狀態 | 無 | `capture.jobs` |
| search-api（過渡） | `workers/kb-search/`、`scripts/index-notes.mjs` | 筆記寫進 Vectorize 索引、提供查詢 API；第③層完成時整個刪除 | 無 | 無（Vectorize `kb-index`） |
| 外殼 | `scripts/com.liu.kb-inbox.plist`、`.github/workflows/`、`compose.yaml` | 只負責排程、佈署、起資料庫容器 | — | — |

## 既有違規（只准變少）
- 網址／主分類／模型名多處複製 → 計畫在 TASK 3 清掉（Worker 那份在 TASK 6 隨 Worker 刪除）
- `content/search.md` 內嵌程式 → 計畫在 TASK 4 清掉
- `index-notes.mjs` 自行解析 frontmatter → 計畫在 TASK 6（第③層）清掉

第②③④層的模組規劃與 TASK 順序見 `works/audits/2026-09-25/knowledge-garden.md` 的 C 節。
