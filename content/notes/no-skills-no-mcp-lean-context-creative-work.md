---
title: "No Skills, No MCP：創意類任務關掉外掛，Claude 反而更快更省"
date: 2026-09-26
tags: [ai-skill, claude-code, context-engineering, from/threads]
source_url: "https://www.threads.com/@be.ai.curator/post/DdqID51iWX0"
source_type: threads
captured_at: 2026-09-26T00:42:16+0800
---

> 原文：[Threads](https://www.threads.com/@be.ai.curator/post/DdqID51iWX0)

## 摘要

作者 @be.ai.curator 分享一個在 Opus 5.5 上的小技巧：在 prompt 後面加一句「No Skills, No MCP」，明確要求模型不要載入任何 skill、不要呼叫 MCP。他只丟一段 prompt，思考強度開中等，12 分鐘就拿到一支手繪風格的發表影片，週用量只消耗 1%。核心論點是：平常裝的 skill 與接的 MCP 雖然好用，但每次對話都要先把它們的說明與工具定義塞進 context，等於固定成本；幾輪下來 token 很快乾掉。模型夠聰明時，創意類工作少一點約束反而成果更好。

## 重點

- **小密語**：`No Skills, No MCP`，直接附在 prompt 後，讓模型跳過 skill 載入與 MCP 工具呼叫。
- **實測數字**：一段 prompt、思考強度中等、12 分鐘產出手繪發表影片、週用量只動 1%。
- **固定成本的來源**：skill 的說明文件、MCP（Model Context Protocol，讓模型接外部工具的協定）的 tool schema，每次對話都要進 context window，不管這輪用不用得到。
- **適用範圍**：作者強調是「創意類工作」；需要精確格式、既有規範或外部資料的任務，skill 與 MCP 仍有價值。
- **後續**：原貼文說下方會分享這 12 分鐘的實際產出，以及搭配 Claude Design 的進階玩法，但回覆串未能抓取。

## 個人洞見

這跟 [[vercel-prompting-principles-60b-tokens|Vercel 的 prompt 原則]] 和 [[prompt-audit-model-upgrade-cost-savings|prompt audit 省成本]] 是同一件事的不同切面：context 不是免費的，塞進去的每樣東西都在稀釋注意力、燒 token。我自己的 Claude Code 也裝了一堆 skill（見 [[ten-claude-skills-research-writing-coding|十個 Claude Skills]]），值得反過來想：哪些任務其實裸跑更好？做設計或影片類的東西，可以先「No Skills, No MCP」跑一版看看，需要規範時再用 [[claude-design-skills-anti-cliche-checklist|設計 Skill]] 收斂。
