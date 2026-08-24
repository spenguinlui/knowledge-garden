---
title: "GCP Landing Zone：企業上雲前先打好的「雲端地基」"
date: 2026-08-24
tags: [infra, gcp, cloud-architecture, governance, from/threads]
source_url: "https://www.threads.com/@_vic_work/post/DarXXl3k1Ae"
source_type: threads
captured_at: 2026-08-24T12:27:11+0800
---

> 原文：[Threads](https://www.threads.com/@_vic_work/post/DarXXl3k1Ae)

## 摘要

Landing Zone 是企業把系統搬上雲之前，先建立好的一套「雲端地基」（Cloud Foundation）。它的核心是在遷移前就設計好一套**可規模化**的治理架構，讓 IAM、網路、資安政策從一開始就有秩序，避免專案愈開愈多後整個環境失控。

## 重點

- **Landing Zone = 雲端地基**：搬系統上雲前先鋪好的基礎架構與治理框架，不是搬完再補。
- **要解決的痛點**：大型企業常同時管理數十到數百個 project（正式／開發／測試環境），若一開始沒有治理架構，IAM 權限、網路、資安政策會糾纏成一團亂麻。
- **核心做法**：先建立一套**可以規模化的 Cloud Foundation**——把組織結構、權限邊界、網路拓撲、安全基線標準化，後續開新專案時直接套用而非各自為政。
- **IAM（Identity and Access Management）**：Google Cloud 的身分與存取權限管理，Landing Zone 會事先規劃好誰能碰哪些資源。
- **資源**：作者附上 Google Cloud 官方 Landing Zone 文件，以及一份可拿來學習的 ChatGPT 教學。

## 個人洞見

「先打地基再蓋房」的思維其實跨平台通用——不論 GCP、AWS 還是自架服務，權限與網路的混亂多半來自「先能跑再說、之後再整理」，而之後往往整理不動。這跟自架時用 [[cloudflare-zero-trust-home-services|Cloudflare Zero Trust 統一入口與存取控制]]的動機一致：與其事後補權限，不如一開始就把存取邊界設計進架構裡。
