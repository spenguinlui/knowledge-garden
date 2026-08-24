---
title: "用 Cloudflare Tunnel + Zero Trust 保護家用服務"
date: 2026-08-24
tags: [infra, cloudflare, security, zero-trust, from/threads]
source_url: "https://www.threads.com/share/BAWo55UhZY/"
source_type: threads
captured_at: 2026-08-24T12:03:02+0800
---

> 原文：[Threads](https://www.threads.com/share/BAWo55UhZY/)

## 摘要

作者 cashwugeek 推薦用 Cloudflare 的 **Tunnel** 與 **Zero Trust** 來對外安全地暴露家用服務（NAS、自架網站、內網後台等）。核心價值：不用開防火牆 port、不用固定 IP、不曝露家裡真實位址，還能在連線前先做身分驗證。原貼文連到其部落格文章「用 Cloudflare Zero Trust 保護家用服務」——本次已補抓內文，重點在「怎麼幫每個服務加上一道身分驗證關卡」。

## 重點

- **Cloudflare Tunnel（前身 Argo Tunnel）**：在家裡跑一個 `cloudflared` 常駐程式，由它主動向 Cloudflare 建立一條加密的 outbound 連線。外部流量走 Cloudflare 邊緣再經此隧道回到家中服務——**家用路由器完全不需開任何 inbound port**，攻擊面大幅縮小。
- **不需公網 IP / DDNS**：因為連線是家裡主動撥出去的，就算是浮動 IP、被 ISP CGNAT 也能用。
- **Zero Trust / Access（零信任）**：預設「誰都不信任」，每次存取都要驗證。用 Cloudflare Access 設政策——例如「只有這幾個 email 能進」，連到服務前先跳 Cloudflare 登入頁驗身分，服務本身可以完全不必自己實作登入。攻擊者連底層應用的登入畫面都看不到。
- **關鍵觀念：保護是「一個 hostname／path 綁一個 Access Application」**：每個要保護的服務都要各自建一個 Access Application。作者強調這最常被誤會——**沒替某個 subdomain 設 Application，那個 subdomain 就完全沒被保護**，跟有沒有開 SSO 無關。
- **設定步驟**：① 選驗證方式（個人用推薦 One-time PIN，Cloudflare 寄 email 驗證碼最省事）→ ② 建 Access Application，指定 subdomain＋網域、設政策（哪些 email 可進）、設 session 時長（個人用 24 小時）→ ③ SSO：登入一個受保護服務後，同政策下的其他服務靠網域層 cookie 一併放行。
- **哪些服務該不該套 Access**：**必保護** NAS 管理後台（風險最高）；**建議保護** 只有陽春登入的自架服務（FreshRSS、Uptime-Kuma）；**不能套** 靠 token 打 API 的服務（如 Bark 推播 API）——套了 Access 後 API 請求會被 Cloudflare 登入頁攔截、整個壞掉；**需自己補登入** 像 ChangeDetection.io 預設無密碼、得手動設防 SSRF。
- **沒被 Access 保護的服務**要靠：每服務獨立強密碼、能開就開 2FA/MFA、勤更新、盯著各服務自身漏洞。
- **架構一句話**：Tunnel 管「連得到」，Access 管「誰能連」——把連通性和存取控制拆開。
- Cloudflare 這套個人／小規模使用多在免費額度內即可跑起來。

## 個人洞見

比起傳統「開 port + DDNS + 自己扛防火牆」，這套把「暴露服務」和「驗證身分」都外包給 Cloudflare 邊緣，家裡只留一條主動外撥的隧道，安全模型乾淨很多。最容易踩雷的是「以為開了 SSO 就全站受保護」——實際上要一個服務一個 Access Application 逐一設，還要記得 token-based API（推播、webhook）不能套、會被登入頁擋死。跟我已收錄的 [[cloudflare-pages-deploy|Cloudflare Pages 靜態託管]] 是同一生態系——Pages 管公開靜態站，Tunnel + Zero Trust 管私有服務，可以搭成一整套自架方案。
