# TASK：slug 加長度上限；搜尋索引失敗不再算成網站更新失敗

## 要解決什麼問題

2026-10-09 12:29 收錄的筆記 slug（網址最後那一段，也是檔名）有 60 個字元。站上的語意搜尋把每篇筆記存進
Vectorize（Cloudflare 的向量資料庫），用 `notes/<slug>` 當 id，id 上限是 64 bytes，這篇是 66，被拒收。
結果有三個：

1. 網站其實已經更新、筆記網址打得開，LINE 卻收到「網站更新失敗」，而且同一個版本重複建站、上傳了三次。
2. 更新索引時會把「上次成功之後變動過的文章」全部重送，這篇一直在名單裡，所以之後每收錄一篇都會再失敗一次。
3. 「下一輪會自動重試」這句話跟實際行為不符：總共只試 3 次就放棄。

## 做完怎麼確認（驗收條件）

先寫測試、跑到紅、貼出紅的輸出，才准寫實作。

**slug 長度（capture）**

- [ ] `kg/spec/capture-rules.spec.ts`：`rules.ts` 匯出 `MAX_SLUG_LENGTH`，值是 56。
- [ ] `kg/spec/db/capture.spec.ts`：claude 新寫一篇 slug 57 個字元的筆記 → 資料庫不變、任務記一次失敗、inbox 保留，
      `last_error` 含那個 slug、實際長度 57 與上限 56；slug 剛好 56 個字元 → 照常收錄。
- [ ] `kg/spec/duplicated-constants.spec.ts`：`.claude/skills/capture/SKILL.md` 寫的 slug 上限數字跟 `MAX_SLUG_LENGTH` 一樣，
      改一邊忘了另一邊就紅。

**索引與網站分開（publish）**

`kg/spec/db/publish.spec.ts`，既有的「佈署 3：索引失敗」那一條改寫，其餘新增：

- [ ] 索引失敗一次：佈署紀錄的 `status` 是 `done`、`attempts` 是 0；`index_status` 是 `failed`、`index_attempts` 是 1、
      `index_error` 存錯誤尾段；`runPublish` 回傳 true；不發 LINE。
- [ ] 同一個版本索引連續失敗：第 2、3 輪**只跑索引那一步**（不裝外掛、不建站、不上傳）；第 3 次失敗發一則下面的「索引放棄」訊息；
      第 4 輪什麼指令都不跑、不再發訊息。
- [ ] 索引失敗後下一輪成功：`index_status` 變 `done`、`index_error` 清空，之後的輪次不再跑索引。
- [ ] 索引的增量起點是「最後一個索引成功的版本」：版本 A 索引成功 → 文章 b 變動、版本 B 網站成功但索引失敗 →
      文章 c 變動、版本 C 索引成功時，stdin 同時列出 b 和 c。
- [ ] 同一輪有收錄、建站與上傳成功、索引失敗：LINE 發的是「🌱 已上花園」（照常等網址 200），不是「網站更新失敗」。
- [ ] 建站或上傳失敗時不跑索引，`index_status` 維持 `pending`（既有兩條測試補上這個斷言）。
- [ ] 沒有任何索引成功紀錄時用 `--all` 全量重建（既有測試照舊要綠）。

**訊息文字**

- [ ] `kg/spec/capture-rules.spec.ts` 與 `kg/spec/db/publish.spec.ts`：同一輪有收錄但建站或上傳失敗，訊息是
      `🌱 已收錄，但網站更新失敗。會再重試，連續失敗 3 次會另外通知：` 後面接每篇一行網址。
- [ ] 「索引放棄」訊息一字不差是
      `⚠️ knowledge-garden 搜尋索引更新失敗（已重試 3 次）。網站已更新，但這次變動的文章暫時搜不到；詳見 mini 的 ~/Library/Logs/kb-inbox.log`。

**整體**

- [ ] `cd kg && npm test` 全綠（邊界檢查、歸屬檢查、型別檢查都在裡面）。
- [ ] `cd kg && npm run test:db` 全綠（要先 `docker compose up -d` 起本機資料庫容器）。
- [ ] `git diff --stat` 只有「範圍內」列的檔案。

**使用者驗證（上線後）**

1. 打開 https://knowledge.wayne-liu.com/notes/claude-japanese-picture-book-travel-site-prompt → 看得到那篇旅遊行程網站的筆記。
2. 到 https://knowledge.wayne-liu.com/search 搜「繪本 旅遊行程」→ 結果裡有這一篇（現在搜不到）。
3. 用 LINE 丟一則新連結收錄 → 收到「🌱 已上花園」，沒有任何失敗訊息。

## 動到的模組

- capture：slug 長度檢查、訊息文字、收錄規則文件。
- publish：索引狀態跟網站狀態分開記、分開重試、分開通知；`publish.deploys` 表加三個欄位。
- notes：只動 mini 上的一筆資料（改 slug），不動程式。

沒有新模組，依賴規則不變。

## 範圍內

- capture：`kg/src/capture/rules.ts`（`MAX_SLUG_LENGTH`）、`kg/src/capture/run.ts`（`noteChanges` 對新增與修改的筆記檢查長度，
  超過就照既有的「筆記格式不合」路徑處理）、`kg/src/capture/messages.ts`（`siteUpdateFailedMessage` 的文字）、
  `.claude/skills/capture/SKILL.md`（產出規格與自檢清單各加一句 slug 最長 56 個字元）。
- publish：`kg/src/publish/schema.sql`（`CREATE TABLE` 直接寫成新的樣子）、`deploys.ts`、`run.ts`、`steps.ts`。
- 測試與文件：上面列的四個 spec 檔、`kg/spec/db/harness.ts`（測試需要才動）、
  `ARCHITECTURE.md`（publish 那列的職責補上索引狀態、「刻意保留的複本」加 slug 上限那一組）。

## 範圍外（這次不准碰）

- `workers/kb-search/`（包含 `index-notes.mjs` 的 id 產生方式；這個模組排定整個刪除，不在上面加東西）
- `kg/src/notes/`、`kg/src/main.ts`、`kg/src/capture/announce.ts`、`kg/src/capture/claude.ts`、`kg/src/capture/jobs.ts`
- `scripts/`、`.github/`、`quartz/`、`quartz.ts`、`quartz.config.yaml`、`kg/quartz-plugins/`、根目錄 `package.json`
- `content/`（不准靠手改匯出的筆記檔來處理那篇長 slug）
- 不准寫資料庫搬遷程式或相容舊欄位的分支；mini 上既有的表由上線步驟的 SQL 處理
- 不准 commit、push、ssh 連 mini、碰 mini 的資料庫（上線由 Claude 做）

## 已裁決的分歧點

- 既有那篇長 slug 的筆記改名，舊網址失效、不留轉址 → 使用者決定（專案慣例是不養錯網址）。
- 新 slug 是 `claude-japanese-picture-book-travel-site-prompt`（47 個字元）（Claude 決定）。
- 上限是 56 個字元：64 減掉前綴 `notes/` 的 6，再減掉長筆記切段時加在後面的 `#1`～`#9` 的 2。
  slug 是英文 kebab-case，字元數等於 bytes，用 `slug.length` 比就好。這個算式寫成 `MAX_SLUG_LENGTH` 旁的註解（Claude 決定）。
- 長度檢查放在 capture 的 `noteChanges`，不放進 notes 的 `parseNote`：上限來自搜尋索引的限制，不是 Markdown 格式的一部分；
  而且放進 notes，那篇既有的長 slug 會讓每一輪匯出都失敗（Claude 決定）。
- 新增與修改的筆記都檢查。既有筆記改名之後最長 53 個字元，不會誤傷（Claude 決定）。
- 重試時 claude 看不到上一次的錯誤訊息，這次不改。靠 `SKILL.md` 寫明上限來預防，程式檢查只是最後一道；
  真的連續三次都超長，使用者會收到既有的「❌ 收錄失敗」（Claude 決定）。
- `publish.deploys` 加三個欄位，不另開一張表：`index_status`（`pending`／`done`／`failed`，預設 `pending`）、
  `index_attempts`（預設 0）、`index_error`。一個網站版本本來就是一列，索引是那個版本的最後一步（Claude 決定）。
- `status`、`attempts`、`last_error` 從此只代表建站與上傳。兩步都成功就記 `done`，`runPublish` 回傳 true，不管索引（Claude 決定）。
- 索引只在目前版本的 `status` 是 `done` 時才跑；`index_status` 不是 `done` 而且 `index_attempts` 小於 3 就跑，上限沿用 `MAX_ATTEMPTS`。
  增量起點改成「`index_status = 'done'` 的紀錄裡 `updated_at` 最新那一筆的 `notes_updated_at`」，沒有就 `--all`（Claude 決定）。
- 索引第 1、2 次失敗不發 LINE，第 3 次才發：網站已經更新，前兩次多半是暫時性的（Claude 決定，訊息文字見驗收條件，使用者可在定稿前改）。
- 換了新版本（文章或 commit 變了）之後，舊版本沒跑完的索引不補跑：新版本的增量起點會把它漏掉的文章一起帶進來（Claude 決定）。
- 既有的「❌ knowledge-garden 網站更新失敗（已重試 3 次）」文字不動。

## 上線步驟（驗收過後由 Claude 做，會寫入 mini 的資料庫）

順序不能換：新程式會讀新欄位，欄位要先在。

1. mini 的資料庫加欄位，並把既有成功的紀錄標成索引也成功（它們當時確實有跑完索引）：
   ```sql
   ALTER TABLE publish.deploys
     ADD COLUMN index_status text NOT NULL DEFAULT 'pending' CHECK (index_status IN ('pending', 'done', 'failed')),
     ADD COLUMN index_attempts integer NOT NULL DEFAULT 0 CHECK (index_attempts >= 0),
     ADD COLUMN index_error text;
   UPDATE publish.deploys SET index_status = 'done' WHERE status = 'done';
   ```
2. commit、push 到 `origin v5`，等 GitHub Actions 綠燈、mini 拉到新 commit。
3. 改那篇筆記的 slug（已查過：沒有別篇筆記連到它，只有一筆任務紀錄記著舊 slug）：
   ```sql
   BEGIN;
   UPDATE notes.articles SET slug = 'claude-japanese-picture-book-travel-site-prompt', updated_at = now()
    WHERE slug = 'claude-japanese-picture-book-travel-itinerary-website-prompt';
   UPDATE capture.jobs
      SET note_slugs = array_replace(note_slugs, 'claude-japanese-picture-book-travel-itinerary-website-prompt',
                                     'claude-japanese-picture-book-travel-site-prompt')
    WHERE id = 'oc-1791520180';
   COMMIT;
   ```
4. 下一輪（60 秒內）mini 會自己建站、上傳、更新索引。確認 log 出現 `done`、佈署表最新一筆 `status` 與 `index_status` 都是 `done`、
   新網址回 200、舊網址回 404，再請使用者做上面三項驗證。
