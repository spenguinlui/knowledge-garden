---
title: "career-ops：本地跑的開源 AI 求職 agent，兩月衝上 6.8 萬星"
date: 2026-08-26
tags: [ai-agent, tools, job-search, from/threads]
source_url: "https://www.threads.com/share/BBqGp3rmVf/"
source_type: threads
captured_at: 2026-08-26T10:01:59+0800
---

> 原文：[Threads](https://www.threads.com/share/BBqGp3rmVf/)

## 摘要

Santiago Fernández 因為「投了 740 份履歷只換到 1 個 offer」而做了 **career-ops**——一個開源的 AI 求職 agent。它在本地端自動幫你篩選、評分、排序來自 150+ 家公司職缺入口的機會，履歷不上雲，主打隱私。專案不到兩個月拿下 6.8 萬顆 GitHub star，是近期成長最快的專案之一。核心主張：**篩選效率比投遞數量重要**。

## 重點

- **痛點**：作者親身經歷 740 投 1 中的求職資訊不對稱，靠海投拼機率既低效又痛苦
- **做的事**：跨 150+ 公司職缺入口自動抓取，依技能、經驗、地點、偏好、薪資替每個職缺**評分並排序**
- **隱私優先**：完全在**本地端**執行，履歷不上傳雲端；MIT 授權開源
- **用法**：走 CLI，可搭配 Claude / Cursor 這類 coding agent，或直接跑 Python 執行
- **成績**：兩個月內 6.8 萬 GitHub star
- **保留態度**：AI 擅長大規模篩選與媒合，但「是否真的提高錄取率」目前**未被驗證**——省的是找對職缺的時間，不是保證上岸

## 個人洞見

這是「把 agent 用在個人生活流程」的好例子：不是寫程式的 coding agent，而是把重複、規則化的資訊篩選外包給 agent。跟 [[building-effective-agents|先用 workflow 再上自主 agent]] 的思路一致——求職篩選本質是有明確評分規則的流程，適合先用結構化 workflow 而非全自主。值得留意的反例思考：當所有求職者都用同款工具海篩海投時，資訊不對稱會不會只是換個形式回來。
