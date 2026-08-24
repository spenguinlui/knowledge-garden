---
title: "五個 GitHub repo 補齊 Claude Code 的短板（看影片、記專案、前端、話多）"
date: 2026-08-24
tags: [ai-agent, claude-code, workflow, from/ig]
source_url: "https://www.instagram.com/p/Db0H1HQCbc6/"
source_type: ig
captured_at: 2026-08-24T12:23:36+0800
---

> 原文：[IG](https://www.instagram.com/p/Db0H1HQCbc6/)（jasonxtsai）

## 摘要

用久 Claude Code 會發現，真正卡住你的常常不是模型能力，而是周邊工作流的缺口。作者列出四個常見痛點，並各推一個安裝三分鐘內的 GitHub repo 來補齊。（輪播圖裡的實際 repo 名稱未能抓取，僅存文案描述的問題面向。）

## 重點

- **看不了影片**：Claude Code 原生無法讀影片內容，需要外掛工具把影片轉成可讀的文字/截圖脈絡。
- **每次開新 session 就把專案重讀一遍**：缺少跨 session 的記憶/專案索引，導致每次都要重新建立 context。
- **前端做出來全部長一樣**：預設產出的介面同質化嚴重，需要設計規範或風格注入來去除 AI slop。
- **會自己多寫兩百行你沒要的程式碼**：模型傾向過度實作，需要約束讓它只做被要求的事。
- 作者主張這些都是「工作流」問題而非「模型」問題，每個 repo 安裝都不到三分鐘。

## 個人洞見

跟 [[claude-code-github-repos-limitations|Claude Code 的既知限制]] 是同一條脈絡——把 agent 的短板當成可外掛補齊的模組，而不是等官方。前端同質化那點呼應 [[design-skills-fix-ai-slop-web-design|用設計技能修 AI slop]]；「話多、多寫程式碼」則是 context/約束工程的老問題。實際要用得回頭補上五個 repo 的名稱。
