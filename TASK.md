# TASK：第②層 5a，筆記 Markdown ⇄ 資料的雙向轉換（純函式＋全量來回測試）

## 要解決什麼問題

第②層要把文章搬進 mac mini 的 Postgres 當正本，站台改由 mini 從資料庫匯出 Markdown 再建站。
切換那天最怕的是「匯進去、匯出來」之後文章變了樣：欄位掉了、時間時區被改寫、標題引號跑掉，站台跟著變。

所以切換之前，先把「一篇筆記的 Markdown」和「一筆筆記資料」之間的轉換寫成純函式（只吃字串、吐結果，不碰檔案和資料庫），
拿現有全部筆記來回轉一遍，證明一字不差。這一步不建表、不匯入、不切換，站台與收錄流程完全不受影響，
也不會出現第二份正本。

現況（2026-09-26 讀過 `content/notes/` 全部 54 篇）：

- frontmatter 只有 6 個欄位，順序固定：`title`、`date`、`tags`、`source_url`（3 篇沒有）、`source_type`、`captured_at`。
  規格寫在 `.claude/skills/capture/SKILL.md`。
- `title`、`source_url` 一律雙引號；`tags` 一律寫成 `[a, b, c]`；`date` 是 `YYYY-MM-DD`。
- `captured_at` 有兩種時區寫法：`+08:00`（10 篇）與 `+0800`（44 篇），要原樣保留。
- frontmatter 結束後都空一行才接內文；每篇檔尾都有換行；沒有 CRLF；沒有附件或圖片。

## 做完怎麼確認（驗收條件）

先寫測試、跑到紅、貼出紅的輸出，才准寫實作。

- [ ] `cd kg && npm test` 全綠，其中包含：
  - **全量來回測試**：讀 `content/notes/*.md` 每一篇，`renderNote(parseNote(slug, 原文))` 跟原文逐位元組相同；
    `parseNote(slug, renderNote(資料))` 跟資料完全相等。測試名稱或失敗訊息要帶檔名，壞哪篇一眼看得出來。
  - 單元測試：沒有 `source_url` 的筆記；`captured_at` 兩種時區寫法都原樣保留；標題含雙引號或反斜線時，
    轉出去再轉回來還是同一個標題；少了必填欄位、或出現規格外的欄位時丟出錯誤，錯誤訊息點名欄位。
  - 邊界檢查：新規則擋住 `src/notes/` import `pg`、`node:fs`、`node:child_process` 這類 I/O 模組；
    在 `kg/spec/fixtures/` 補一組故意違規的範例證明規則有效。
- [ ] `git status --short` 只出現範圍內的路徑；`content/` 沒有任何改動。

## 動到的模組

- 新增 notes 模組 `kg/src/notes/`；更新 `ARCHITECTURE.md`（模組表加一列、補上 notes 的純函式規則）。

## 範圍內

- `kg/src/notes/`：`index.ts` 對外公開 `parseNote`、`renderNote` 與筆記資料的型別；轉換寫成純函式。
- `kg/spec/`（測試與違規範例）、`kg/.dependency-cruiser.cjs`（新規則）、`kg/package.json`／`package-lock.json`（加 `yaml`）。
- `ARCHITECTURE.md`。

## 範圍外（這次不准碰）

- `content/`（只讀；任何一篇來回不一致就停下來回報，不准改筆記去配合程式）
- `kg/src/capture/`、`.claude/skills/capture/`、`db/`、`scripts/`、`workers/`、`quartz/`、`quartz.config.yaml`、`.github/`
- 建資料表、匯入資料、改建站或佈署方式（那是下一個 TASK：一次切換）
- mini；不准 git commit、不准 push

## 已裁決的分歧點

- 這一步只做轉換與測試，不建表、不切換；切換時才需要使用者決定的事（`content/notes` 留不留 git、推上 GitHub 就建站的流程停不停、
  搜尋索引改從哪讀）留到切換的 TASK 再問（Claude 決定：這些不影響轉換函式的設計）。
- 文章只透過 LINE／Claude 修改，筆電不再手動編輯 Markdown（使用者 2026-09-24 已決定，這次不重問）。
- 新模組 `notes`，路徑 `kg/src/notes/`，將來擁有文章的資料表（切換時才建）。可以依賴：無（Claude 決定）。
- `src/notes/` 整個先當純計算：dependency-cruiser 加一條 `forbidden` 規則禁止 import I/O 模組。切換時要加資料庫讀寫，
  再把純計算收進子資料夾、規則跟著縮小範圍（Claude 決定，依 `ARCHITECTURE-GUIDE.md` 第 2 節）。
- 筆記資料的欄位：`slug`（檔名去掉 `.md`，由呼叫端傳入）、`title`、`date`、`tags`（字串陣列）、`sourceUrl`（可省略）、
  `sourceType`、`capturedAt`、`body`（frontmatter 之後空行以下的全部內文，原樣）。`date` 與 `capturedAt` 存原字串，
  不轉成 Date（Claude 決定：兩種時區寫法都要能原樣轉回去）。
- 解析用 `yaml` 套件（加進 `kg/package.json`，不去借根目錄的）；輸出用固定樣板照上面的欄位順序與引號規則寫，
  不用 YAML 函式庫的輸出（Claude 決定：函式庫輸出的格式跟現有筆記不同，無法逐位元組一致）。標題的雙引號與反斜線用
  YAML 雙引號字串的跳脫規則處理。
- 規格外的欄位與缺少必填欄位一律丟錯，不默默略過（Claude 決定：切換時匯入 54 篇要嘛全對、要嘛停下來）。
- 全量來回測試放在 `npm test`（不需要資料庫）。之後 mini 收進格式不合的新筆記，筆電 `npm test` 會紅，
  那是切換前該修的真問題，不放寬測試（Claude 決定）。
