---
title: "ELI5：一句指令把任何概念變成「五歲也懂」的圖解網頁"
date: 2026-08-24
tags: [ai-skill, prompt, coding-agent, from/threads]
source_url: "https://www.threads.com/share/BAUAkyYO2v/"
source_type: threads
captured_at: 2026-08-24T12:02:22+0800
---

> 原文：[Threads](https://www.threads.com/share/BAUAkyYO2v/)

## 摘要

Anthropic 內部有個工具叫 `ELI5`（Explain Like I'm 5，「像對五歲小孩解釋」）。使用者輸入 `/eli5 <主題>`，它就生成一頁 HTML：大量視覺、極少文字，把任何概念解釋給零背景的人聽。原 po 也拿它跟 Matt Pocock 的 `/wait-what` 工具做比較。

## 重點

- `ELI5` 是 slash command 形式的工具：`/eli5 <topic>` 一句話觸發。
- 產出是**一頁 HTML**，設計取向是「大圖 + 少字」，刻意壓低文字量、拉高視覺比重，讓沒有先備知識的人也能秒懂。
- 命名來自英文社群常見縮寫 **ELI5**（Explain Like I'm 5），意即「講到五歲小孩都聽得懂」。
- 原 po 拋出的討論點：ELI5 跟 Matt Pocock 的 `/wait-what` 有何差異——兩者都是「把難懂的東西講白」類的 AI 工具。
- 這是一種把 AI 當「解釋器」的用法：不是查資料，而是為特定讀者（零背景者）重新編排與視覺化既有知識。

## 個人洞見

這其實就是一個包裝好的 prompt/skill——把「用大圖少字解釋給外行」這個需求固化成一句指令。跟花園裡 [[building-effective-agents|打造有效 agent]] 的思路一致：與其每次重寫 prompt，不如把常用的解釋工作流做成可重用的 command。對做知識管理的人特別有用，可以拿來把自己筆記裡的硬概念轉成對外好懂的圖解。
