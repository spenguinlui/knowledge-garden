---
name: capture
description: 把一則輸入（URL / 純文字 / 截圖 / inbox item）整理成知識花園的一篇筆記。收錄外部文章、Threads/IG 貼文、隨手心得時用。
---

# /capture — 收錄一則知識進花園

把輸入整理成 `content/notes/<slug>.md` 一篇筆記。**只寫筆記檔，不碰 git**（commit/push 由呼叫方負責）。

## 輸入形式（自動判斷）

| 輸入 | 處理 |
|---|---|
| URL | WebFetch 抓內容。抓不到（登入牆/擋爬，Threads、IG 常見）→ 照樣寫筆記，內容記「僅存連結，未能抓取內文」+ URL 本身可推斷的資訊，**不算失敗** |
| 純文字 | 直接當素材整理（可能是別人貼文的複製、自己的心得） |
| 圖片路徑（截圖） | Read 讀圖（vision），把圖中文字與重點轉寫出來；圖片本身**不保留**（不搬進 content/） |
| `inbox/<id>` | 讀 `inbox/<id>.json`（格式見下），依其 `type` 走上面對應路徑；若有 `inbox/<id>.jpg` 就是截圖 |

`inbox/<id>.json` 格式：`{"type": "text"|"image", "text": "...", "timestamp": ..., "messageId": "<id>"}`。
text 內容若同時含 URL 與評語，URL 去抓、評語寫進「個人洞見」。

## 產出規格

檔案：`content/notes/<slug>.md`。slug 用英文 kebab-case（依主題意譯，非音譯），先 `ls content/notes/` 確認不撞名；撞名且主題相同 → **更新既有筆記**（補充新內容），不開新檔。

```markdown
---
title: "中文標題：一句話講清楚這篇在講什麼"
date: YYYY-MM-DD            # 今天
tags: [主分類, 其他tag...]   # 第一個 tag = 主分類，2–4 個
source_url: "https://..."    # 有來源 URL 才寫，沒有就整行省略
source_type: threads | ig | fb | linkedin | article | manual | other
captured_at: YYYY-MM-DDTHH:MM:SS+08:00   # 用 Bash `date +%FT%T%z` 取當下真實時間，不要用 00:00:00
---

> 🔗 原文：[來源名](完整URL)   ← 有 source_url 就必寫這行；社群平台用平台名（Threads/IG/FB/LinkedIn），一般網站用網域名。無來源 URL（手寫/純截圖）才省略

## 摘要

2–4 句話講清楚這則知識的核心。用自己的話重述，不是照抄原文。

## 重點

- 3–7 個 bullet，保留具體數字、指令、名詞（可加 `code`）
- 首次出現的術語配一句白話解釋

## 個人洞見

1–3 句：這則知識對我的意義、可以用在哪、跟已知的什麼有關。
輸入若含使用者自己的評語，放這裡。寫不出真洞見就省略此節，不硬掰。
```

正文語言：**繁體中文**（原文是英文也翻譯整理，專有名詞保留英文）。

## 分類（兩層制）

**第一個 tag = 主分類**，必須從這九個裡選一個（判斷文章最核心在講什麼）：

| 主分類 | 涵蓋範圍 |
|---|---|
| `ai-agent` | AI agent、自動化助理、coding agent、多代理協作 |
| `ai-skill` | 使用 AI 的技巧：prompt、RAG、context 工程、AI 工作流 |
| `ai-model` | 模型本身：LLM、embedding、訓練、benchmark |
| `dev` | 軟體開發：架構、設計模式、程式語言、git |
| `infra` | 雲端、部署、維運、網路、資安 |
| `tools` | 好用工具、生產力方法、知識管理 |
| `健康` | 運動、飲食、睡眠、醫療 |
| `職涯` | 職涯發展、管理、溝通、軟技能 |
| `生活` | 不屬於以上的生活類內容 |

**第二個 tag 起是細分標籤**（2–3 個），自由發揮但優先沿用既有筆記出現過的字
（`grep -h '^tags:' content/notes/*.md` 看現況），讓同主題筆記聚在同一個 tag 頁。

**最後一個 tag = 來源平台**（讓「從哪來」可以按分類逛）：
`from-threads` `from-ig` `from-fb` `from-linkedin`（社群）、`from-web`（一般網頁文章）。
手寫（manual）不加來源 tag；截圖判得出平台就加對應的。

## Wikilinks（關聯）

1. `grep -l` / 讀 `content/notes/` 既有筆記的 title 與 tags
2. 找出 2–5 篇真正相關的，在正文自然處嵌 `[[slug|顯示文字]]`（相關 = 主題有實質關聯，不是為連而連；一篇都沒有就不加，花園還小是正常的）
3. 連結格式用檔名 slug（不含 `notes/` 前綴與 `.md`）

## 自檢（寫完必做）

- [ ] YAML frontmatter 能被解析：title 有引號包住（防冒號炸 YAML）、tags 是 array、日期格式正確
- [ ] 第一個 tag 在受控清單內
- [ ] 有 `source_url` 的筆記，正文開頭有「> 🔗 原文：」連結行
- [ ] wikilinks 指向的檔案真的存在
- [ ] 檔案在 `content/notes/` 下、slug 是 kebab-case
