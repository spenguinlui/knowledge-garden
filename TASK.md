# TASK：第②層 5b-3，文章正本搬進 mini 的資料庫（content/notes 退出 git）

## 要解決什麼問題

文章現在是 git 裡的 `content/notes/*.md`，mini 收錄完要 commit、push，筆電也能直接改檔。第②層的目標是
**資料庫為唯一正本**（使用者 2026-09-24 決定），第③層要在它上面加原文與向量檢索，第④層要從 LINE 改文章。
備份（5b-1）與 mini 建站佈署（5b-2）都已上線，這一步把正本切過去：之後文章只存在 mini 的 Postgres，
網站、搜尋索引、筆電預覽都從資料庫匯出。

名詞：

- **匯出**：把資料庫裡的全部文章寫成 `content/notes/<slug>.md`（用 `renderNote`），資料庫沒有的檔案刪掉，資料夾跟資料庫一模一樣。
- **匯入**：讀 `content/notes/` 裡的檔案（用 `parseNote`，格式不合就丟錯），寫進資料庫。
- **一個網站版本**：程式碼的 commit 加上文章最後一次變動的時間，兩者任一個變了就要重新佈署。

## 做完怎麼確認（驗收條件）

先寫測試、跑到紅、貼出紅的輸出，才准寫實作。DB 測試跑在 `cd kg && npm run test:db`。

- [ ] notes：匯出後資料夾的檔案與資料庫一一對應（多的檔案被刪）；匯入全部檔案後再匯出，每個檔案跟原檔位元組相同；
      格式不合的檔案匯入時丟錯並點名 slug，而且整批一筆都不寫進資料庫。
- [ ] 收錄 1：inbox 有項目 → 先匯出 → 假 claude 新增一篇、改一篇 → 新增與修改的兩篇寫進資料庫，任務 done 記下兩篇 slug；
      沒有任何 git commit、沒有 push；LINE「已上花園」照舊分新增／更新兩組。
- [ ] 收錄 2：假 claude 寫出格式不合的筆記 → 資料庫不變，任務記一次失敗、存錯誤（含 slug 與原因），規則同 claude 失敗（3 次放棄並告警）。
- [ ] 收錄 3：假 claude 刪掉一個檔案 → 資料庫不刪那篇，下次匯出就回來。
- [ ] 佈署 1：只有文章變了（commit 沒變）→ 匯出、建站、佈署，索引 stdin 只列這次變動的文章（`M\tcontent/notes/<slug>.md`），記 done。
- [ ] 佈署 2：只有 commit 變了 → 照樣佈署；文章與 commit 都沒變 → 什麼都不做。沒有任何成功紀錄 → 索引 `--all`。
- [ ] 佈署 3：既有的失敗重試、3 次放棄告警、收錄後才發 LINE 等情境，改成以「網站版本」為單位後照樣全綠。
- [ ] 桌面送件：`node kg/src/capture/send.ts` 把一段文字（可附一張圖）包成 inbox 項目送到 mini：先傳 `.desk-<時間>.json`（圖先傳成 `.desk-<時間>.jpg`，png 先轉 jpg），
      傳完才改名去掉開頭的點；`ssh`、`scp` 用 `PATH` 前置的假指令攔截驗證參數與順序；mini 連不上時以非 0 結束並印出原因。
- [ ] `notes.spec.ts` 的全量來回改成跑 `kg/spec/fixtures/notes/` 的範例筆記（從現有筆記挑 3 篇有代表性的複製過去），不再讀 `content/notes/`。
- [ ] `cd kg && npm test`（含歸屬檢查）、`npm run test:db`、根目錄 `npm test` 全綠；`git ls-files content/notes` 是空的。
- [ ] 上線後（Claude 經 ssh 做，步驟見下）：資料庫有 55 篇（或當時 mini 上的實際篇數）；匯出結果跟切換前的檔案 `diff -r` 完全相同；
      網站任一篇與 `/search` 正常；備份手動跑一次並還原到臨時資料庫，文章篇數一致。
- [ ] 使用者驗證：LINE 丟一則收到「已上花園」；筆電 `/capture` 一則文字，終端機顯示已送出，1～2 分鐘內手機收到「已上花園」；
      筆電跑 `scripts/pull-notes.sh` 後 `npx quartz build --serve --port 41160` 看得到剛收的那篇。

## 動到的模組

- notes：從純函式模組變成擁有 `notes.articles` 表；純計算（`parseNote`／`renderNote`）收進子資料夾，`notes-pure` 規則縮到那個子資料夾。
- capture：收錄前匯出、收錄後匯入，不再碰 git；新增桌面送件 `send.ts`；`/capture` skill 加桌面送件的說明。
- publish：佈署單位改成「網站版本」，建站前先匯出。
- 外殼：新增 `scripts/pull-notes.sh`（筆電預覽從 mini 拉文章）。
- 依賴：capture → notes、publish → notes（都只用 notes 的 `index.ts`）；capture 與 publish 仍互不 import。

## 範圍內

- `kg/src/notes/`（子資料夾放純計算、`schema.sql`、資料庫讀寫、匯出／匯入、一次性搬家用的命令列入口）、`kg/src/capture/`、`kg/src/publish/`、兩個模組的 `schema.sql`、
  `kg/.dependency-cruiser.cjs`（`notes-pure` 縮小範圍）、`scripts/pull-notes.sh`、`.claude/skills/capture/SKILL.md`、`.gitignore`（加 `content/notes/`）、`git rm --cached -r content/notes`。
- `kg/spec/` 對應的測試與範例、`kg/spec/fixtures/notes/`。
- `ARCHITECTURE.md`、`README.md`、`CLAUDE.md`、`AGENTS.md` 講到文章在 git、手寫筆記、commit／push 的句子。

## 範圍外（這次不准碰）

- `quartz/`、根目錄 `package.json`、`quartz.config.yaml`、`quartz.ts`、`content/index.md`、`content/search.md`
- `workers/`（含 `index-notes.mjs`）、`scripts/process-inbox.sh`、`scripts/backup-db.sh`、兩個 plist、`compose.yaml`
- 改文章的功能（第④層）、原文與向量（第③層）
- git 歷史改寫（舊文章留在歷史裡）
- mini：實作階段不准連；不准 git commit、不准 push；不准真的 ssh／scp

## 上線步驟（使用者收下後由 Claude 做）

1. mini 上 `mkdir /tmp/kb-inbox.lock` 暫停；`cp -R content/notes ~/notes-before-switch`（切換前的最後一份檔案，也當額外備份）。
2. 套用資料表變更：建 `notes` schema 與表；`capture.jobs` 照新的 `schema.sql` 調整欄位；`publish.deploys` 砍掉重建（舊紀錄只有幾筆佈署歷史）。
3. push；mini 上 `git pull`（`content/notes` 會從工作目錄消失）；用 notes 的命令列入口從 `~/notes-before-switch` 匯入；
   匯出到 `content/notes` 後跟 `~/notes-before-switch` 做 `diff -r`，必須完全相同，不同就停下來、不解鎖。
4. `rmdir` 解鎖、`launchctl kickstart` 跑一輪（第一次佈署索引全量重建）；`launchctl kickstart gui/501/com.liu.kb-backup` 備份並還原比對。
5. 筆電 `git pull` 後 `content/notes` 也會消失，跑 `scripts/pull-notes.sh` 拉回來。請使用者做最後一條驗收。

## 已裁決的分歧點

- 資料庫為正本、`content/notes` 退出 git、筆電預覽從 mini 拉、筆電 `/capture` 改成送進 mini inbox（使用者 2026-09-26 決定）。
- 搬完到第④層之前**不提供改文章的方法**，文章只能新增（使用者 2026-09-27 決定）。收錄規則維持現況：同一個 URL 有新資訊時照舊更新既有那篇。
- 手寫筆記（筆電直接在 `content/notes/` 加檔）的做法取消，README 移除（隨「文章只透過 LINE／Claude 改」）。
- 表：`notes.articles`，欄位對應 `Note`（slug 主鍵、title、date、tags text[]、source_url 可空、source_type、captured_at、body）加 `created_at`、`updated_at`。
  `date`、`captured_at` 存原字串（`Note` 本來就這樣設計，才能一字不差轉回去）（Claude 決定）。
- notes 內部：純計算搬進 `kg/src/notes/markdown/`，`notes-pure` 只管這個子資料夾；資料庫讀寫與匯出／匯入放 notes 模組其他檔案，對外只經 `index.ts`（Claude 決定，照 `ARCHITECTURE.md` 原本寫好的計畫）。
- 匯入不要求「轉回去一字不差」：claude 寫的格式小差異（例如 tags 換行寫法）照樣收，匯出時統一成標準格式。一字不差只在上線那次用 `diff -r` 驗（Claude 決定：否則 claude 格式稍有不同就收錄失敗）。
- 收錄怎麼判斷新增／修改：匯出時記下每篇的內容，claude 跑完後比對，新檔是新增、內容變了是修改；刪掉的檔案不理會。
  一輪裡所有變動在同一個交易寫進資料庫（Claude 決定）。
- capture 不再碰 git：刪掉 commit、push 與「push 失敗」訊息；`capture.jobs` 拿掉 `commit_sha`，`note_paths` 改成 `note_slugs`（Claude 決定，不留相容欄位）。
- 網站版本 = commit + `notes.articles` 最大的 `updated_at`；`publish.deploys` 改以這兩個欄位為一筆，增量索引從上次成功那筆的文章時間之後變動的文章算起。
  文章沒有刪除的路徑，所以索引不處理刪除（Claude 決定）。
- 匯出由 notes 提供，capture（收錄前）與 publish（建站前）各自呼叫；兩邊都是整個資料夾重寫成跟資料庫一樣（Claude 決定）。
- 上線搬家用 notes 的命令列入口（`import <資料夾>`、`export <資料夾>`），它讀 `.env` 的資料庫設定，跟 `kg/src/main.ts` 相同做法；
  匯入是一般能力，不是一次性的程式，所以留著（Claude 決定）。
- 桌面送件：`/capture` 收到的不是 `inbox/<id>` 時，改呼叫 `node kg/src/capture/send.ts`，送進 mini 的 `~/knowledge-garden/inbox/`，
  格式照 skill 裡現有的 inbox JSON，id 用 `desk-<epoch 毫秒>`；先傳點開頭的暫存檔再改名，因為收錄程式會略過點開頭的檔案，避免讀到傳一半的檔（Claude 決定）。
  結果由 mini 發 LINE，終端機只顯示已送出（隨使用者「送進 mini inbox」的決定）。
- 筆電預覽：`scripts/pull-notes.sh` 用 `rsync -a --delete liumac-mini:knowledge-garden/content/notes/ content/notes/`，拉的是 mini 最近一次匯出的結果（Claude 決定：只是複製檔案，不必連資料庫）。
- 資料庫連線設定 `dbConfig` 從 capture 搬進 notes（notes 的命令列入口要用、notes 不能依賴 capture），`kg/src/main.ts` 改 import 那一行；
  main.ts 講「收錄（commit、push）」的註解、README「筆電也能手動跑 process-inbox.sh」那句一起更新（Claude 決定，實作中補裁）。
- 匯入除了 `parseNote` 還要 `renderNote` 寫得出來，寫不出來就當格式不合（否則之後每輪匯出都失敗，收錄卡住）（Claude 決定，實作中補裁）。
