---
title: "用 /claude-api prompt-audit 幫 Claude Code 環境做健檢"
date: 2026-09-09
tags: [ai-skill, claude-code, prompt, from/threads]
source_url: "https://www.threads.com/share/BAShF3Z0nq/"
source_type: threads
captured_at: 2026-09-09T17:40:20+0800
---

> 原文：[Threads](https://www.threads.com/share/BAShF3Z0nq/)

## 摘要

作者 vder 建議在 Fable 5.1 裡用 `/claude-api prompt-audit` 指令，定期回頭審視自己的 CLAUDE.md 與 Skills 是否需要更新。這相當於幫 Claude Code 環境做一次「健康檢查」，在小問題演變成大麻煩前先揪出來修掉。

## 重點

- 指令：`/claude-api prompt-audit`（在 Fable 5.1 環境下），用來審查既有的 `CLAUDE.md` 檔與 Skills。
- 常見要修的問題：
  - **過時的 prompt**：情緒化 / 命令式措辭（例如一堆 "must do…"）、語意不清的用字。
  - **脆弱的 Skill**：把個別特例當成通則寫死、把路徑與版本號 hardcode 進去。
  - **不清楚的工具描述**（tool descriptions）。
  - **過時的設定**（configurations）。
- 定位：這是一次性的「健檢」動作，適合定期跑一次，主動找出潛在問題而非等它爆掉。

## 個人洞見

prompt / skill 跟程式碼一樣會技術債化——寫死的路徑、只針對當時某個案例的規則，時間久了會反過來誤導 agent。把「審視 prompt」當成例行維護，跟 [[ten-claude-skills-research-writing-coding|整理常用 Skills]] 的思路一致：花園要定期除草。
