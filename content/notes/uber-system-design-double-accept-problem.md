---
title: "Uber 系統設計面試：最難的不是配對司機，而是「一單被兩個司機同時接走」"
date: 2026-09-27
tags: [dev, system-design, 面試, from/threads]
source_url: "https://www.threads.com/@chunhao2026/post/DdwJtKnjvv0"
source_type: threads
captured_at: 2026-09-27T11:34:20+0800
---

> 原文：[Threads](https://www.threads.com/@chunhao2026/post/DdwJtKnjvv0)

## 摘要

@chunhao2026 的〈System Design Interview 系列〉Uber 篇。貼文開頭點出：大家都以為 Uber 系統設計最難的是「怎麼配對司機跟乘客」，其實最硬的問題是別的。貼文本身只抓到開頭一句（Threads 擋爬），但它連到的 wondering.app 課程大綱把答案講明了：真正難的是 **Double-Accept Problem**——同一張乘客訂單，被兩個司機幾乎同時按下「接單」，系統要保證只有一個人接到。這是分散式系統的一致性問題，比地理配對難處理得多。

## 重點

- **配對本身相對成熟**：司機定位用 geohash（把經緯度編成一串字元，字首相同代表在同一格子附近）切格子，找附近司機就是查鄰近格子，這部分有標準做法。
- **Double-Accept 才是硬點**：多台伺服器同時處理同一張單的「接單」請求，沒有協調機制就會兩個司機都成功。解法是 **distributed lock（分散式鎖）**——接單前先在共用儲存（例如 Redis）搶一把鎖，搶到的人才准接單。
- **訂單要有狀態機**：requested → matched → accepted → in-progress → completed，每一步只允許特定轉移，避免狀態亂跳。
- **請求不能掉**：乘客叫車請求要先寫進可靠儲存再處理，伺服器掛掉也不能讓一張單憑空消失。
- **即時通知用 WebSocket**：司機位置、訂單狀態要推給雙方的 App，不能靠 App 一直輪詢。
- **geo-sharding 撐規模**：依地理區域把資料與流量切到不同分片，台北跟東京的訂單互不干擾。
- 課程全長 15 課、5 大段：基礎（需求、API、架構）→ 位置追蹤 → 派單與一致性 → 可靠性與規模 → 計價與整合。課程連結：wondering.app/learn/system-design-uber-bx557f

## 個人洞見

面試講 Uber 若只講「附近找司機」會顯得淺，直接把話題引到「一單兩接」的一致性問題，能展現對分散式系統的理解。跟 [[interview-storytelling-backend|後端工程師如何說好自己的故事]] 同一個道理：先講別人沒想到的難點，再講怎麼解。
