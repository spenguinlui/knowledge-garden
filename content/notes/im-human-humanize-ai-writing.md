---
title: "im-human：讓 AI 中英文寫作「去 AI 味」的開源 skill（台灣用語）"
date: 2026-08-24
tags: [ai-skill, prompt, writing, from/threads]
source_url: "https://www.threads.com/share/BASTQOv-64/"
source_type: threads
captured_at: 2026-08-24T12:04:04+0800
---

> 原文：[Threads](https://www.threads.com/share/BASTQOv-64/)

## 摘要

`im-human` 是一個開源 skill，專門幫台灣使用者把繁體中文與英文文章「潤稿去 AI 味」。它針對三個痛點：AI 生成文字讀起來很假、學術論文的 AI 偵測率過高、以及 GitHub 上多數資源混用中國大陸用語。作者宣稱經過數十次迭代，能在 Claude 與 Codex 上用 `/` 一鍵啟用。

## 重點

- **用途**：改寫文字使其更像真人手筆，同時避開 AI 偵測工具（AI detector）。
- **啟用方式**：在 Claude 與 Codex 平台用 `/` 指令快速呼叫（skill / slash command 形式）。
- **主打成效**：作者示範同一段 prompt，AI 偵測率「從 88% 降到 0%」。
- **在地化賣點**：輸出用台灣慣用語，避免簡體中文圈的詞彙混入。
- **授權**：完全開源、免費，專案連結放在貼文留言。
- **開發過程**：經過數十次迭代調校。

## 個人洞見

「去 AI 味」本質上是一套風格化 prompt / skill，跟 [[eli5-explain-like-im-five-tool|ELI5 改寫工具]] 一樣，都是把「特定寫作風格」封裝成可一鍵呼叫的 skill。值得注意的是它把「台灣用語」當成獨立賣點——同語系的在地化其實是被低估的 niche。至於「AI 偵測率降到 0%」要保守看待：偵測器本身不可靠，數字更像行銷話術，但作為潤稿風格工具仍有實用價值。
