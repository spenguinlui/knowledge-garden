---
title: "Strangler Fig：在舊系統旁長出新系統、逐步蠶食取代的搬遷模式"
date: 2026-08-16
tags: [dev, patterns, architecture, migration]
source_url: "https://martinfowler.com/bliki/StranglerFigApplication.html"
source_type: article
captured_at: 2026-08-16T22:55:57+0800
---

> 🔗 原文：[martinfowler.com](https://martinfowler.com/bliki/StranglerFigApplication.html)

## 摘要

Strangler Fig（絞殺榕）是 Martin Fowler 提出的舊系統改造模式：不做一次性的大改寫，而是在舊系統旁邊逐步建立新元件，把功能一塊塊搬過去，直到新系統完全接手、舊系統自然萎縮退場。名字來自絞殺榕——寄生在宿主樹上、慢慢長出自己的根與枝葉，最後宿主枯死、只剩榕樹站在原地。

## 重點

- **核心精神**：漸進替換（incremental replacement）取代 big-bang 重寫，把「一次巨大風險」拆成「多次小風險」。
- 四個活動（不必照順序）：
  - **釐清目標（Clarify Outcomes）**：先讓各方對「要達成什麼」有共識。
  - **拆解問題（Decompose）**：在舊系統裡找「接縫（seam）」，切出可以獨立替換的元件。
  - **增量交付（Deliver Incrementally）**：一小塊一小塊替換，降低失敗代價。
  - **組織演化（Evolve）**：連帶更新開發流程與團隊結構，讓改造能持續。
- **關鍵好處**：風險降低（單塊替換失敗損失小）、更早見效（新元件上線就能產生業務價值，不必等全部完工）、每輪都是學習（越搬越懂系統與業務）、進度可見（投資與回報漸進透明）。
- 反直覺的一點：搭建「過渡期的架構」看似浪費，但降低的風險與提早的回報遠大於這些成本。
- 常見的接縫工具是一層路由/代理（facade），把請求依功能導向舊系統或新系統，搬完一塊就把流量切過去。

## 個人洞見

這正是我在做的 `core_web` 蠶食搬遷——不是停機重寫，而是在旁邊長新系統、一塊塊接管舊功能。這篇給了這件事一個正式的名字與框架：與其憑感覺切，不如刻意去找「接縫」，並且用「路由層切流量」當作每塊搬完的驗收點。也提醒我把「組織演化」一起算進去，不只是搬程式碼。
