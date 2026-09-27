---
title: "Anthropic AI-native SDLC：瓶頸不再是寫程式，而是規劃、審查、部署"
date: 2026-08-26
tags: [ai-agent, claude-code, workflow, sdlc, from/threads]
source_url: "https://www.threads.com/share/_s0TKYu0C/"
source_type: threads
captured_at: 2026-08-26T09:27:13+0800
---

> 原文：[Threads](https://www.threads.com/share/_s0TKYu0C/)（asgard_ai_platform 分享）；另見 [Threads](https://www.threads.com/share/BAHHKNsxtm/)（ericwu0324 分享，同一份 Anthropic guide）。官方出處：claude.com/blog/the-ai-native-sdlc

## 摘要

Anthropic 提出一套「AI-native SDLC（軟體開發生命週期）」手冊，核心主張是：在 AI 協作時代，**寫程式已經不再是最大瓶頸**，真正卡住效率的是規劃、審查、部署這些**人類主導**的環節。手冊把開發流程拆成六個階段，每一階段都設計成「AI 做例行工作、人類守關鍵決策點」的分工，並讓整條 commit chain 成為審計軌跡。

## 重點

- **Planning（規劃）**：把需求寫進 `intent.md`，作為與 Claude 協作的意圖文件——先講清楚「要做什麼、為什麼」。
- **Design（設計）**：用公司內部的 skill（可重用的 AI 指令包）產生規格書 spec。
- **Development（開發）**：先用 **plan mode** 驗證做法方向，確認無誤再進實作，避免 AI 一頭埋進去做錯方向。
- **Testing（測試）**：讓 agent 先跑一輪初步驗證（自我檢查），再交給人類 review，減少人看的量。
- **Deployment（部署）**：用 **hooks** 攔截、擋掉未經核准的動作——把「不該做的事」用機制卡死，而非靠人盯。
- **Operations（維運）**：偵測到的異常自動轉成新的 intent，形成「異常 → 意圖 → 修正」的回饋迴圈。
- **核心哲學**：人類保留最終決策責任，AI 處理例行任務；人的注意力集中在被標記的檢查點（flagged checkpoints），整條 commit 鏈當作可追溯的稽核紀錄。
- **Sequential Output Protocol（另一種分法）**：`Intent → Spec → Plan → Code → Eval → Deploy`，每一步的產出都是下一步的 context——把整個 SDLC 重構成一條「agent 讀得懂、執行得了、驗證得到、稽核得回」的鏈。
- **平行度的真正上限**：能同時跑多少工作流，取決於**一個人能 review 幾條**，而非開了幾個 AI model；審查能力才是新的瓶頸。
- **知識沉澱進 repo**：團隊經驗、限制、踩過的雷應該嵌進 repository（而非只留在個人腦袋），agent 才能讀到並延續。
- **自主驗證**：agent 必須能自己測試、觀察結果、修正問題；沒有可靠的回饋機制，再強的模型也會偏離目標。

## 個人洞見

這套框架和 [[building-effective-agents|「先用 workflow，別急著上自主 agent」]] 的精神一致：不是把整條流程交給 AI 全自動，而是把 AI 嵌進**既有的人類決策節點之間**，用 `intent.md`、plan mode、hooks 這些具體機制把「人該把關的地方」明確化。對照我自己用 [[claude-code-github-repos-limitations|Claude Code]] 的習慣，最值得抄的是把「意圖」文件化（intent.md）與「用 hooks 擋危險動作」——這正好呼應這個知識花園本身用 skill + git commit 當工作流的做法。
