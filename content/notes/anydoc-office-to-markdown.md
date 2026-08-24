---
title: "anydoc：把 14 種文件格式一鍵轉成乾淨 Markdown 的 Rust 工具"
date: 2026-08-24
tags: [tools, markdown, rust, from-threads]
source_url: "https://www.threads.com/share/BAbyOJuMWu/"
source_type: threads
captured_at: 2026-08-24T12:10:20+0800
---

> 原文：[Threads](https://www.threads.com/share/BAbyOJuMWu/)（作者 sw_ai_life）

## 摘要

Firecrawl 團隊開源了 `anydoc`，一個用 Rust 寫的文件轉換工具，能把 Word、PowerPoint、Excel、OpenDocument、RTF、EPUB、CSV、PDF 等 14 種常見辦公室格式，統一轉成結構清晰、樣式乾淨的 Markdown。專案放在 GitHub（`github.com/firecrawl/anydoc`），並提供 Node.js 與 Python 的 binding。

## 重點

- 一次涵蓋 **14 種格式**：Word、PowerPoint、Excel、OpenDocument、RTF、EPUB、CSV、PDF 等，全部輸出成 Markdown。
- 用 **Rust** 開發，主打轉出來的 Markdown「結構清晰、樣式乾淨」（clean Markdown），適合再餵給 LLM 或知識庫。
- 提供 **Node.js 與 Python bindings**，可直接嵌進既有工作流，不必只當 CLI 用。
- 出自 **Firecrawl** 團隊（做網頁抓取轉 Markdown 起家），這是他們把「任意輸入轉乾淨 Markdown」的思路從網頁延伸到本地文件。
- GitHub：`github.com/firecrawl/anydoc`。

## 個人洞見

把各種辦公室文件統一成乾淨 Markdown，正是 RAG / 知識庫 pipeline 的前處理痛點——這類工具能省去為每種格式各寫一套 parser 的功夫。對這個花園而言，它是「把外部素材收進來」的上游工具，跟 [[knowledge-retrieval-over-storage|重檢索輕儲存]] 的思路互補：先轉成純文字，之後才好被檢索與連結。
