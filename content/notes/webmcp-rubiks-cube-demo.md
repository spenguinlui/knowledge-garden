---
title: "WebMCP 魔術方塊 Demo：網站不裝 AI，而是教用戶端 AI 怎麼用它"
date: 2026-09-03
tags: [ai-agent, mcp, browser, from/threads]
source_url: "https://www.threads.com/share/BAa36CikJ4/"
source_type: threads
captured_at: 2026-09-03T10:50:09+0800
---

> 原文：[Threads](https://www.threads.com/share/BAa36CikJ4/)

## 摘要

一個用魔術方塊示範 WebMCP 概念的互動 demo。使用者在 ChatGPT 桌面版打開該網頁，可以手動或叫 AI 打亂方塊，再請 agent 即時把它解開。核心一句話：**網站本身沒有任何 AI，而是告訴「使用者端的 AI」自己這個網站可以怎麼被使用**，並提供工具讓 agent 直接操作頁面。

## 重點

- **反過來的架構**：過去大家想的是「怎麼把 AI 塞進網站裡」；WebMCP 反轉這個方向——網站把自己的能力（tools）暴露給使用者端的 AI agent，由外部 AI 來驅動網站。
- **魔術方塊 demo**：在 ChatGPT 桌面版開啟頁面 → 打亂方塊 → 叫 agent 解開，全程可即時看到 AI 操作頁面元素。
- 這是把 **MCP（Model Context Protocol）** 帶進瀏覽器端的具體體現：網站像提供 API 一樣，主動提供給 AI 用的結構化介面。
- 對使用者的意義：不必為每個網站各自寫爬蟲或串後端，agent 直接照網站給的工具操作即可。
- 貼文互動：10.9K 次瀏覽、177 讚、14 留言、14 轉發（作者 coreplay7）。

## 個人洞見

這則用「魔術方塊」把 WebMCP 講得很直白：重點不在網站變聰明，而在網站學會「自我描述」給外部 AI。跟 [[webmcp-openai-challenge|WebMCP Challenge 黑客松]] 是同一套標準的不同切角——那篇談生態與活動，這篇給了最好懂的心智模型。若成主流，agent 靠 DOM 硬爬網頁的做法可能被取代，值得持續觀察。
