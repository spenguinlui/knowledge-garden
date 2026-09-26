# TASK：模組化整理 3＋4，語意搜尋頁搬成本機 Quartz 外掛，重複常數加比對測試

## 要解決什麼問題

站上 `/search`（語意搜尋頁）的程式碼約 60 行 `<script>` 寫在 `content/search.md` 這篇「文章」裡，
Worker 網址 `https://kb-search.kb-search.workers.dev` 也寫死在裡面。`content/` 是知識資產，第③層要把搜尋改接 mini，
勢必得改這段程式，不該去改一篇文章。

另外有幾組常數各自寫在好幾個地方，改一邊忘了另一邊就會出錯（收錄通知的網址打不開、側欄少一個分類、搜尋靜悄悄失準）。
其中幾份在 YAML、Worker 設定、或會被序列化到瀏覽器執行的函式裡，沒辦法 import 同一個來源，所以改成用測試比對。

最後，搜尋 Worker 允許呼叫的來源寫的是 `http://localhost:8080`，但這個專案本機預覽用 41160，所以本機預覽時語意搜尋會失靈。

名詞：

- **元件外掛**：Quartz v5 的外掛種類之一，提供一個畫在版面上的元件（manifest `category: ["component"]`，用 `init(options)`
  接 `quartz.config.yaml` 傳來的設定）。寫法見 `docs/advanced/creating components.md` 與 `docs/advanced/making plugins.md`。
- **本機外掛**：`quartz.config.yaml` 的 `source` 寫成 `./` 開頭的路徑，`npx quartz plugin install` 會把它 symlink 到
  `.quartz/plugins/`。入口可以直接是 `.ts`（見 `quartz/plugins/loader/gitLoader.ts` 的 `getPluginEntryPoint`），不必先編譯。

## 做完怎麼確認（驗收條件）

- [ ] 先寫外掛的單元測試並跑到紅：元件在 slug 是 `search` 的頁面畫出搜尋框、在其他頁面什麼都不畫；
      瀏覽器端程式用的是 `init(options)` 傳進來的 Worker 網址。
- [ ] 常數比對測試（`kg/spec/`），寫完後各自故意改壞一份讓它紅一次、貼出輸出再改回：
  - 站台網址三份一致：`kg/src/capture/rules.ts` 的 `SITE`、`quartz.config.yaml` 的 `baseUrl`、`workers/kb-search/wrangler.toml` 的 `SITE_BASE`
  - 九大主分類兩份一致（同一組、同一順序）：`quartz.ts` 的 `MAIN`、`.claude/skills/capture/SKILL.md` 的主分類表
  - 向量模型名稱兩份一致：`scripts/index-notes.mjs` 的 `MODEL`、`workers/kb-search/src/index.ts` 呼叫的模型
  - 向量索引名稱兩份一致：`scripts/index-notes.mjs` 的 `INDEX`、`wrangler.toml` 的 `index_name`
- [ ] `cd kg && npm test` 全綠；dependency-cruiser 同時掃 `src` 與 `quartz-plugins`，`tsc --noEmit` 涵蓋外掛。
- [ ] `content/search.md` 沒有 `<script>`、沒有 Worker 網址，標題與開頭兩段說明文字不變。
- [ ] 模擬 CI（照 `deploy.yml`）：`rm -rf .quartz/plugins && npx quartz plugin install && npx quartz build` 成功，
      筆記數跟改之前一樣；`git status --short` 沒有範圍外的新檔。
- [ ] 根目錄 `npm test` 與 `npx tsc --noEmit` 維持全綠。
- [ ] 手動（Claude 驗收時做）：`npx quartz build --serve --port 41160`，`/search` 先看到說明文字、下面是搜尋框，
      外觀跟線上一樣；隨便一篇筆記頁沒有搜尋框。Worker 重新佈署後，在本機輸入查詢會列出結果。
- [ ] 上線後（Claude 做）：正式站 `https://knowledge.wayne-liu.com/search` 輸入查詢會列出結果。

## 動到的模組

- site：新增 `kg/quartz-plugins/semantic-search/`；更新 `ARCHITECTURE.md`。
- search-api：只改 `wrangler.toml` 的 `ALLOWED_ORIGINS`。

## 範圍內

- 新增 `kg/quartz-plugins/semantic-search/`（元件外掛，TypeScript 原始碼直接當入口）；`quartz.config.yaml` 加這個外掛
  （`source: ./kg/quartz-plugins/semantic-search`，選項帶 Worker 網址，版面放在內文之後）；刪 `content/search.md` 的搜尋框 HTML 與 `<script>`。
- `kg/`：比對測試與外掛測試放 `kg/spec/`；`.dependency-cruiser.cjs` 的 `no-upstream` 改成同時管 `quartz-plugins/`；
  `npm test` 掃 `quartz-plugins`；`tsconfig.json` 涵蓋外掛。
- `workers/kb-search/wrangler.toml`：`ALLOWED_ORIGINS` 的 `http://localhost:8080` 換成 `http://localhost:41160`。
- `ARCHITECTURE.md`、`README.md` 目錄表補外掛一列。

## 範圍外（這次不准碰）

- `quartz/`、根目錄 `package.json`／`package-lock.json`／`tsconfig.json`、`quartz.ts`
- `content/notes/`、`content/index.md`；`content/search.md` 除了刪搜尋框與 script 之外的文字
- `kg/src/capture/`（比對測試只讀它，不改）、`scripts/`、`.claude/`、`.github/`、`db/`
- `workers/kb-search/src/`、`scripts/index-notes.mjs`（比對測試只讀）
- 搜尋框的外觀、文案、防抖時間、結果格式（照搬，不改行為）
- 不准 git commit、不准 push、不准執行 `wrangler deploy` 或 `wrangler login`

## 上線步驟（使用者收下後由 Claude 做）

1. 使用者在對話框打 `! cd ~/sideproject/works/knowledge-garden/workers/kb-search && npx wrangler login` 登入。
2. Claude 在 `workers/kb-search` 跑 `npx wrangler deploy`（只帶新的 `ALLOWED_ORIGINS`），本機預覽驗搜尋。
3. commit、push，等 Cloudflare Pages 佈署完，到正式站驗搜尋。

## 已裁決的分歧點

- 本機預覽的語意搜尋這次一起修，驗收時使用者登入 wrangler，由 Claude 重新佈署 Worker（使用者決定）。
- `ALLOWED_ORIGINS` 直接把 8080 換成 41160，不保留 8080（Claude 決定：專案規定只用 41160-41169）。
- 外掛放 `kg/quartz-plugins/semantic-search/`（Claude 決定：自己的程式都在 `kg/`，根目錄維持 upstream）。
- 外掛用 TypeScript 原始碼當入口，不加 tsup 編譯步驟、不產生要進 git 的 `dist/`（Claude 決定：Quartz 載入器接受 `.ts` 入口，少一個建置步驟）。
- 外掛需要的 `preact`、`@quartz-community/types` 從根目錄 `node_modules` 解析（外掛實際路徑在 repo 底下），不在根目錄或 `kg/`
  另加依賴；需要 JSX 設定就在外掛資料夾放自己的 `tsconfig.json`（Claude 決定）。
- 只在 `/search` 顯示：元件自己判斷 slug 是不是 `search`，不去註冊 Quartz 內部的版面條件（Claude 決定：註冊條件要 import `quartz/`，違反 `no-upstream`）。
- 重複常數不收進 `kg/src/shared/`，改成比對測試（Claude 決定：另外幾份是 YAML、Worker 設定、瀏覽器端函式，無法 import；
  真正會 import 的只有 capture 一個模組，不符合進 `shared` 的門檻）。ARCHITECTURE.md 把這些從「既有違規」移到
  「刻意保留的複本（有測試比對）」。模型名與索引名那兩組在第③層隨 Worker 一起刪除。
- `content/search.md` 這篇文章保留（側欄「語意搜尋」連結與說明文字都靠它），只拿掉程式碼（Claude 決定）。
