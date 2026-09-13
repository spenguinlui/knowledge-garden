# knowledge-garden — 實作規約（codex 讀）

Quartz v5 fork 的個人知識花園站台 + 收錄管線。

- 只用 port 41160-41169（本機預覽 `npx quartz build --serve --port 41160`）。
- 選最簡單、完整滿足當下需求的實作；不做投機性抽象。
- 每個交付點保持可跑；不要為未完成的複雜度犧牲能動的版本。
- **`quartz/` 是 upstream 的碼**，要能 `git pull upstream v5` 升級：能靠
  `quartz.config.yaml`／`quartz.ts`／`content/` 解決的就不要改 `quartz/` 內部。
- `content/notes/*.md` 是知識資產，非經指示不要批次改寫或重跑格式化。
- 站台改動要本機 build 過再 push；push 到 `origin v5` 就會觸發 Cloudflare Pages 佈署。
- `scripts/local-env.sh` 是 gitignored 的本機真值（含 token），永遠不要提交或印出內容。
- `scripts/com.liu.kb-inbox.plist` 的路徑是 mac mini 的，不要改成筆電路徑。
