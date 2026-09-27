---
title: "Git-as-queue：用 repo 目錄當任務佇列的輕量模式"
date: 2026-08-16
tags: [dev, architecture, patterns, git]
source_type: manual
captured_at: 2026-08-16T00:00:00+08:00
---

## 摘要

小型自動化系統需要「生產者丟任務、消費者慢慢處理」時，不一定要架 message queue——
用 git repo 裡的一個目錄（如 `inbox/`）當佇列就夠：生產者 commit 檔案進去，
消費者定時 pull、處理完刪檔再 push。

## 重點

- **天然持久化**：任務就是檔案，斷電、離線都不丟；git log 就是完整 audit trail
- **冪等靠檔名**：用訊息 ID 當檔名，重複投遞變成「檔案已存在」而自然去重
- **可 replay**：處理失敗的任務留在原地，修好消費者後自動重跑
- **免費**：對比 Cloudflare Queues（要付費方案）、SQS，零額外元件
- 適用邊界：低頻率（分鐘級延遲可接受）、單一消費者；高頻或多消費者就該用真 queue

## 個人洞見

本站的 LINE 收錄管線就是這個模式：webhook 把訊息寫進 `inbox/`，Mac mini 每 5 分鐘
消化一次。消費者與生產者只碰不同路徑，連鎖都幾乎不用。搭配
[[cloudflare-pages-deploy|Pages 的 build watch paths]] 排除佇列目錄，佇列 commit
不會觸發網站重建。
