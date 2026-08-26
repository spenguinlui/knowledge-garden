---
title: "WebMCP：讓網站直接把功能開放給瀏覽器裡的 AI 工具"
date: 2026-08-26
tags: [ai-agent, mcp, browser, from/threads]
source_url: "https://www.threads.com/share/_4HTvwpNC/"
source_type: threads
captured_at: 2026-08-26T10:08:47+0800
---

> 原文：[Threads](https://www.threads.com/share/_4HTvwpNC/)

## 摘要

OpenAI 發起了 WebMCP Challenge 黑客松。WebMCP 是一套開放標準，讓網站能把自己的功能以結構化的方式，直接從瀏覽器暴露給 AI 工具（如 Codex、Claude Code）使用。作者 jacoblincool 分享自己先前為另一場 Dev Challenge 做的 GPTD 專案，用類似概念但走的是自製方案。

## 重點

- **WebMCP** 是把 MCP（Model Context Protocol）帶進瀏覽器端的開放標準：網站主動提供結構化介面，讓 AI 工具能直接操作網站功能，不必各自寫爬蟲或後端串接。
- **OpenAI WebMCP Challenge**：一場圍繞這個標準的黑客松活動。
- 作者的 **GPTD（GigaPrompt Tower Defense）** 是先前 Dev Challenge 作品：讓 Codex 在**沒有後端**的情況下玩塔防遊戲，使用者能即時觀看 AI 的操作。
- GPTD 當時沒用 WebMCP 標準，而是自己設計了一套 **reverse WebSocket proxy**（反向 WebSocket 代理）來達成類似效果。
- GPTD 本身是「基於真實模擬」的塔防：圍繞真實資料中心 LLM 推論工程設計，遊戲裡每個數字都有現實根據。專案原始碼：`github.com/JacobLinCool/GPTD`。

## 個人洞見

MCP 從「AI 連本地工具/伺服器」延伸到「AI 連瀏覽器裡的網站」，代表 agent 生態正在往 web 端標準化——網站未來可能像提供 API 一樣，主動提供給 AI 用的 MCP 介面。值得關注這會不會取代目前 agent 靠爬蟲/DOM 操作網頁的做法。可搭配 [[claude-code-github-repos-limitations|補足 Claude Code 短板的工具]] 一起看 agent 工具的演進。
