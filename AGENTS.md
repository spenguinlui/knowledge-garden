# knowledge-garden — 實作規約（codex 讀）

Quartz v5 fork 的個人知識花園站台 + 收錄管線。

- 只用 port 41160-41169（本機預覽 `npx quartz build --serve --port 41160`）。
- 選最簡單、完整滿足當下需求的實作；不做投機性抽象。
- 每個交付點保持可跑；不要為未完成的複雜度犧牲能動的版本。
- **`quartz/` 是 upstream 的碼**，要能 `git pull upstream v5` 升級：能靠
  `quartz.config.yaml`／`quartz.ts`／`content/` 解決的就不要改 `quartz/` 內部。
- 自己寫的新程式放 `kg/`，模組規則看 `ARCHITECTURE.md`，改完跑 `cd kg && npm test`。
- `content/notes/*.md` 是知識資產，非經指示不要批次改寫或重跑格式化。
- 站台改動要本機 build 過再 push；push 到 `origin v5` 後，mac mini 下一輪（每 60 秒一輪）會 pull 下來建站並佈署到 Cloudflare Pages。
- `scripts/local-env.sh` 是 gitignored 的本機真值（含 token），永遠不要提交或印出內容。
- `scripts/com.liu.kb-inbox.plist` 的路徑是 mac mini 的，不要改成筆電路徑。

## 每次改動的規矩（works 功能改動循環）

- **動手前先讀專案根目錄的 `TASK.md`**，那是這次改動的目標與邊界。
  做到一半覺得方向不確定就回去重讀它，不要自行擴張。
- **「範圍外」列的東西一律不碰**，包含順手修的。動到了就是驗收沒過，理由再好都一樣。
- **`TASK.md` 沒寫到的決策不要自己定**：停下來，把問題和你想到的選項寫出來等人回答。
  猜一個繼續做，比停下來問貴得多。
- **驗收條件先做再實作**：能自動化的先寫測試、跑到紅、把紅的輸出貼出來，然後才動實作。
- **回報講人話**：三句話（改了什麼／為什麼這樣改／怎麼驗證的），
  後面附一段對方能照做的驗證步驟。標準是 Junior 工程師看得懂：名詞第一次出現要解釋，
  不要用流程術語當名詞，講「什麼變了」而不是「我做了哪些步驟」。
