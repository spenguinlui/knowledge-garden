---
title: "用 Cloudflare Tunnel + Zero Trust 保護家用服務"
date: 2026-08-24
tags: [infra, cloudflare, security, zero-trust, from-threads]
source_url: "https://www.threads.com/share/BAWo55UhZY/"
source_type: threads
captured_at: 2026-08-24T12:03:02+0800
---

> 原文：[Threads](https://www.threads.com/share/BAWo55UhZY/)

## 摘要

作者 cashwugeek 推薦用 Cloudflare 的 **Tunnel** 與 **Zero Trust** 來對外安全地暴露家用服務（NAS、自架網站、內網後台等）。核心價值：不用開防火牆 port、不用固定 IP、不曝露家裡真實位址，還能在連線前先做身分驗證。原貼文連到其部落格文章「用 Cloudflare Zero Trust 保護家用服務」（本次未能抓到內文，僅存概念）。

## 重點

- **Cloudflare Tunnel（前身 Argo Tunnel）**：在家裡跑一個 `cloudflared` 常駐程式，由它主動向 Cloudflare 建立一條加密的 outbound 連線。外部流量走 Cloudflare 邊緣再經此隧道回到家中服務——**家用路由器完全不需開任何 inbound port**，攻擊面大幅縮小。
- **不需公網 IP / DDNS**：因為連線是家裡主動撥出去的，就算是浮動 IP、被 ISP CGNAT 也能用。
- **Zero Trust（零信任）**：預設「誰都不信任」，每次存取都要驗證。可在 Cloudflare Access 設定政策——例如「只有這幾個 Google 帳號的 email 能進」，連到服務前先跳登入頁做身分驗證，服務本身可以完全不必自己實作登入。
- **典型組合**：`cloudflared` 隧道負責「安全地把服務接出來」，Cloudflare Access（Zero Trust）負責「誰能進來」。兩者疊加＝對外零開 port ＋ 存取前先驗身分。
- 適用情境：自架 NAS 管理介面、家用 Home Assistant、內部工具、side project 的後台，想給自己或少數人用又不想整個開放到公網。
- Cloudflare 這套個人／小規模使用多在免費額度內即可跑起來。

## 個人洞見

比起傳統「開 port + DDNS + 自己扛防火牆」，這套把「暴露服務」和「驗證身分」都外包給 Cloudflare 邊緣，家裡只留一條主動外撥的隧道，安全模型乾淨很多。跟我已收錄的 [[cloudflare-pages-deploy|Cloudflare Pages 靜態託管]] 是同一生態系——Pages 管公開靜態站，Tunnel + Zero Trust 管私有服務，可以搭成一整套自架方案。原貼文那篇部落格文章值得之後補抓細節設定。
