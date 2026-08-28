---
title: "Archify：讓 AI Agent 讀懂複雜程式庫的架構圖 Skill"
date: 2026-08-28
tags: [tools, ai-diagram, coding-agent, from/threads]
source_url: "https://www.threads.com/share/BAGU1ldOKm/"
source_type: threads
captured_at: 2026-08-28T22:27:26+0800
---

> 原文：[Threads](https://www.threads.com/share/BAGU1ldOKm/)

## 摘要

Archify 是一個給 coding agent 用的 skill，專門解決「看懂陌生程式庫」的難題。作者點出真正的痛點不是讀懂單一段程式碼，而是搞清楚系統各元件之間怎麼串接。Archify 能自動產生可互動的架構圖，把節點連回 Git 驗證過的原始碼，適合常需要 onboarding 新專案的團隊。

## 重點

- 相容多種 coding agent：Claude Code、Codex、Cursor、OpenCode
- 產生多種圖型：架構圖（Architecture）、工作流（Workflow）、時序圖（Sequence）、資料流（Data Flow）、生命週期（Lifecycle）
- 依賴追蹤：可往上游／下游追節點依賴，視覺化真實的執行路徑（execution path）
- Before/Delta/After 比較：顯示某次改動新增、移除、或重新接線的元件，適合 review 變更影響範圍
- 圖上節點可連回 Git 驗證過的原始碼位置（不是憑空生成，可對照）
- 匯出格式多元：HTML、PNG、SVG、WebM

## 個人洞見

跟 [[draw-architecture-text-to-diagram|draw-architecture]]、[[diagram-design-ai-diagrams|diagram-design]] 屬同一個 ai-diagram 家族，但定位不同：那兩個是「把想法畫成圖」，Archify 是「從既有 codebase 反向生成圖並連回原始碼」，更偏 code comprehension / onboarding 工具。Before/Delta/After 這個功能對 review PR、評估改動爆炸半徑特別有用，可搭配 [[claude-code-github-repos-limitations|補足 Claude Code 短板的專案]] 一起看。
