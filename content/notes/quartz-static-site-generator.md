---
title: "Quartz：把 markdown 筆記變成數位花園的靜態站產生器"
date: 2026-08-16
tags: [tools, knowledge-management, static-site, from-web]
source_url: "https://quartz.jzhao.xyz"
source_type: article
captured_at: 2026-08-16T00:00:00+08:00
---

> 原文：[quartz.jzhao.xyz](https://quartz.jzhao.xyz)

## 摘要

Quartz 是專為「數位花園」（digital garden）設計的靜態網站產生器：丟一個資料夾的
markdown 進去，就得到一個有 graph view、雙向連結、全文搜尋、tag 頁的網站。
v5 改用 YAML 設定檔 + community plugin 系統，Node ≥ 22。

## 重點

- **Obsidian 相容**：`[[wikilink]]`、callout、mermaid 都支援，vault 可直接發布
- **內建 graph view**：筆記間的連結自動畫成互動圖，這是選它而不是一般 SSG 的主因
- **backlinks**：每頁自動列出「誰連到我」，關聯是雙向的
- **全文搜尋**：Flexsearch 打包進站內，靜態站也能搜（中文 OK）
- 部署到 [[cloudflare-pages-deploy|Cloudflare Pages]] 免費，push 即發布

## 個人洞見

比起自己用 Next.js 刻，Quartz 把知識庫網站最難的三件事（graph、雙向連結、搜尋）
都做成內建，符合「用成熟品、不重造輪子」原則。本站就是用它蓋的。
