---
title: "impeccable：給 AI 一套設計規範，讓生成的 UI 不再有『罐頭味』"
date: 2026-08-24
tags: [ai-skill, ui-design, context-engineering, from/threads]
source_url: "https://www.threads.com/share/BAUwIfDsgh/"
source_type: threads
captured_at: 2026-08-24T12:06:13+0800
---

> 原文：[Threads](https://www.threads.com/share/BAUwIfDsgh/)

## 摘要

AI 生成的前端介面常有種千篇一律的「罐頭感」（AI 味）——間距隨意、字級混亂、配色安全但無趣。開源專案 **impeccable**（58k⭐）的作法是：與其寄望模型自己有品味，不如直接餵給 AI 一套明確的設計規範，把 padding、字階、配色都定義清楚，用約束提升輸出質感。

## 重點

- **impeccable** 是開源專案，累積約 58k GitHub stars，鎖定「AI 生成 UI 缺乏設計質感」這個痛點。
- 核心思路：提供給 AI 一份**設計規範（design spec）**當作生成時的依據，而非讓模型自由發揮。
- 規範內容至少涵蓋三塊：
  - **明確的 padding**：間距不再隨機，有一致的節奏。
  - **字階（typography hierarchy）**：標題、內文、註解的字級與層次規則。
  - **配色（color palette）**：預先定義好的顏色系統。
- 本質上是一種 **context 工程**：把「好設計長什麼樣」的知識前置注入，讓模型的輸出被拉進一個高品質的範圍內。

## 個人洞見

跟寫作上避免「AI 味」是同一個道理——問題不在模型不夠強，而在缺少明確約束。與其事後嫌棄輸出平庸，不如在 prompt / context 階段就餵一套規範。這和 [[im-human-humanize-ai-writing|去除 AI 寫作味]] 的思路一致：好的 context 設計比反覆重試更有效，值得在做 AI 前端生成或 design system 時參考。
