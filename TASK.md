# TASK：收錄成功後，LINE 回筆記網址

## 目標

小柳三世（LINE bot）收到連結只回「已轉給收錄管線，幾分鐘後上花園」，之後就沒下文了。
mini 的收錄管線寫完筆記也不告訴人寫去哪，要看成果只能自己上站翻——翻標籤頁時很容易
手拼出 `/tags/notes/<slug>` 這種不存在的網址（實際會 404，正確的是 `/notes/<slug>`）。

這次要讓管線在筆記**真的能在網站上打開之後**，主動把網址 LINE 給使用者。
連結由管線給，就不會再有拼錯的機會。

## 名詞

- **收錄管線**：mini 上每 5 分鐘跑一次的 `scripts/process-inbox.sh`。
  它會 `git pull` → 對 `inbox/` 裡每個項目呼叫 `claude /capture` 寫成筆記 → commit → `git push`。
- **slug**：筆記檔名去掉 `.md`。網站網址就是 `https://knowledge.wayne-liu.com/notes/<slug>`。
- **Pages 佈署**：push 到 GitHub 後，Cloudflare Pages 會重建網站，約需 1–2 分鐘。
  這段時間內新筆記的網址還是 404。
- **notify()**：腳本裡既有的函式，用 LINE 的 push message API 發一則文字訊息給使用者。
  目前只有兩處呼叫，都是失敗時才發。

## 範圍內（只准動這些）

- `scripts/process-inbox.sh`
- 新增一支測試腳本（放 `scripts/` 下，名稱由實作者決定）
- `README.md` 的「收錄方式」那段，補一行說明收錄完會回網址

## 範圍外（動到就是驗收沒過）

- `content/`、`quartz/`、`quartz.config.yaml`、`workers/`、`.github/`
- `scripts/com.liu.kb-inbox.plist`（那是 mini 的 launchd 設定，路徑也是 mini 的，不要改）
- `scripts/index-notes.mjs`、`scripts/local-env.sh`
- 既有的失敗告警行為（重試 3 次仍失敗、push 失敗）——維持原樣，不要改文案或時機
- 任何「順手修」的東西

## 要做出什麼行為

1. **蒐集這一輪產出的筆記**
   每個項目收錄成功、且 `git commit` 真的產生了 commit 時，從該 commit 取出
   `content/notes/` 底下**新增**與**修改**的檔案，各自記下來（`git show --name-only`
   搭配 `--diff-filter`）。claude 沒改到東西、沒有 commit 的情況，不算數。

2. **push 成功才進入通知流程**
   `git push` 失敗時維持現狀：發既有的失敗告警，**不發**任何成功通知。

3. **等到網址真的能開才發**
   push 成功後，對這一輪蒐集到的網址輪詢 HTTP 狀態碼：**每 15 秒一輪，最多等 5 分鐘**
   （是整批共用一個 5 分鐘上限，不是每篇各等 5 分鐘）。全部回 200 就發通知。

4. **通知內容分「新增」與「更新」兩組**
   一輪只發一則訊息，多篇就多行。大致長這樣（確切文案實作者可微調，但必須分得出兩組）：

   ```
   🌱 已上花園

   新增：
   https://knowledge.wayne-liu.com/notes/<slug>

   更新：
   https://knowledge.wayne-liu.com/notes/<slug>
   ```

   某一組是空的就整組不要出現。

5. **超時也要講一聲**
   5 分鐘還沒全部變 200，就發一則說明「已收錄，站台還在建」並附上網址，
   不要默默不發——使用者寧可拿到一個晚點才能開的連結，也不要沒有下文。

## 驗收條件（先做到紅，才准動實作）

新增一支測試腳本，**不碰真的 LINE、不碰 mini、不呼叫真的 claude**。做法：
建一個臨時 git repo（含 bare 遠端，讓 `git pull` / `git push` 跑得動），用 `PATH` 前置
假的 `claude`（只負責照指定內容寫出 `content/notes/*.md`）與假的 `curl`
（記錄被呼叫的網址、依情境回 200 或 404，並把 LINE push 的內容寫到檔案供比對），
再用 `KB_DIR` 指向那個臨時 repo 跑 `process-inbox.sh`。

必須涵蓋這六種情況，每種都斷言「本來要發去 LINE 的內容」是否正確：

| # | 情境 | 預期 |
|---|------|------|
| 1 | 新增一篇筆記 | 訊息含 `https://knowledge.wayne-liu.com/notes/<slug>`，在「新增」組 |
| 2 | 更新既有筆記 | 網址出現在「更新」組 |
| 3 | 一輪同時有新增與更新 | 兩組都出現，各自列對的網址 |
| 4 | 網址一直回 404（模擬佈署很慢） | 5 分鐘上限後發「還在建」的訊息，且測試不會真的跑滿 5 分鐘（等待參數要可從外部覆寫） |
| 5 | `git push` 失敗 | 發既有的 push 失敗告警，**不發**成功通知 |
| 6 | claude 沒改到任何東西（沒有 commit） | 完全不發成功通知 |

**順序不可調換**：先把測試寫出來、跑一次、把失敗（紅）的輸出貼出來，才可以動
`process-inbox.sh`。實作完成的定義是這六項全綠。

## 回報時要附的手動驗證步驟

自動測試綠了之後，回報裡要寫一段使用者能照做的步驟，內容大致是：
丟一則連結給小柳三世 → 等幾分鐘 → 應收到第二則帶網址的 LINE → 點進去是筆記本文（不是 404）。

## 非目標（這次不做）

- 不改小柳三世（OpenClaw）那頭的回覆內容
- 不做失敗筆記的重送、不做通知的去重或彙整
- 不把網域改成 `pages.dev`，一律用正式網域 `https://knowledge.wayne-liu.com`
- 不動 mini 的部署方式（改動靠 push，mini 下一輪自己 `git pull`）
