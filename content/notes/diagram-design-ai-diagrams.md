---
title: "diagram-design：讓 AI 畫出不像 Mermaid 罐頭的專業架構圖"
date: 2026-08-24
tags: [tools, ai-diagram, coding-agent, from-threads]
source_url: "https://www.threads.com/share/BAjH_Omk3h/"
source_type: threads
captured_at: 2026-08-24T12:07:41+0800
---

> 原文：[Threads](https://www.threads.com/share/BAjH_Omk3h/)

## 摘要

一個開源專案（作者稱之為 diagram-design），專門解決「AI 生成的架構圖總是一股 Mermaid 圓角框味」的問題。它讓 AI 產出的圖表跳脫預設樣式，變成配色、字體都貼合品牌的專業視覺，並能塞進 Codex 或 Claude Code 當作日常畫圖的工具。

## 重點

- 支援 20+ 種圖表類型：架構圖、流程圖、循序圖（sequence）、狀態機、ER 圖、甘特圖等
- 產出**自包含的 HTML+SVG 檔案**（單一檔案就能開，不依賴外部資源）
- 會自動比對網站品牌，套用對應的配色與字型
- 提供三種風格：Light、Dark、Editorial
- 可把既有的 Mermaid 與 draw.io 圖轉進來重新設計
- 匯出 SVG/PNG，方便丟進部落格、簡報、Figma
- 作者建議：常請 AI 幫忙畫技術架構圖的人，值得把它接進 Codex / Claude Code

## 個人洞見

跟 [[impeccable-ai-ui-design-spec|impeccable]]（給 AI 一套設計規範）是同一個思路：AI 的預設輸出都有「罐頭味」，關鍵是外掛一層設計系統把它拉到專業水準。對常寫技術筆記或做架構說明的人，這比手動調 Mermaid 樣式省事多了，也很適合接進 [[ten-claude-skills-research-writing-coding|Claude Skills]] 的工作流。
