---
title: "用 AI 把知識做成可玩的互動模擬來學習"
date: 2026-08-24
tags: [ai-skill, 學習方法, claude-code, from-threads]
source_url: "https://www.threads.com/share/BAZMDRBQmP/"
source_type: threads
captured_at: 2026-08-24T12:04:47+0800
---

> 原文：[Threads](https://www.threads.com/share/BAZMDRBQmP/)

## 摘要

一位工程師分享用 AI 學習的方法：與其要 AI 產出一長串塞滿 emoji 的文字解釋，不如讓它把主題轉成「可以玩的」互動動畫網頁。核心是把被動閱讀變成互動體驗，作者認為這比傳統投影片更好懂、也更適合拿來教學與簡報。

## 重點

- 四步驟流程：
  1. 用 Claude Code 的 **plan mode**（規劃模式）先建立主題的基礎知識庫
  2. 讓模型**驗證內容正確性**
  3. 把主題轉成 low-poly（低多邊形）、類似 SimCity 風格的互動動畫
  4. 發布到 **GitHub Pages** 變成人人可開的網頁工具
- 已做出五個互動模擬：半導體製造、火箭引擎、F1 引擎、EUV 微影機、以及把 LLM 架構視覺化成「小鎮」——token 在鎮裡移動
- 關鍵心法：學習載體從「文字說明」升級成「可互動的模擬」，降低理解門檻
- 刻意避免 AI 輸出冗長、滿是 emoji 的解釋文

## 個人洞見

這是「AI 當學習夥伴」很具體的一種玩法：把 Claude Code 從寫程式工具擴展成「生成教學互動網頁」的引擎。跟 [[eli5-explain-like-im-five-tool|ELI5 解釋工具]] 一樣都在追求「講到懂」，但這裡更進一步用互動與視覺化取代純文字；發布面則可搭 [[cloudflare-pages-deploy|靜態網頁部署]] 的思路。另外它也呼應 [[im-human-humanize-ai-writing|去 emoji、去 AI 味]] 的偏好——刻意不要那種堆砌 emoji 的輸出。
