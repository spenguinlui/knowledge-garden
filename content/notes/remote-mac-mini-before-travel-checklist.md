---
title: "出國前遠端控管家中 Mac Mini 的八項檢查清單"
date: 2026-09-13
tags: [infra, networking, tailscale, remote-access, from/threads]
source_url: "https://www.threads.com/share/_0HkvTUFW/"
source_type: threads
captured_at: 2026-09-13T20:06:50+0800
---

> 原文：[Threads](https://www.threads.com/share/_0HkvTUFW/)

## 摘要

作者 dustin_gmat 首次出國旅行前，把家裡的 Mac Mini 當成遠端伺服器來佈署，列了一張出發前的檢查清單。核心是確保人不在家也能穩定連回機器、必要時還能靠家人重啟硬體救回連線。

## 重點

- **Tailscale 內網連通**：確認 Tailscale 已連上且 handshake 成功（握手成功代表兩端建立了直接的點對點連線，而非繞中繼）。
- **Mosh / SSH 打通**：SSH 是標準遠端登入；`Mosh`（mobile shell）在網路斷續、換 IP 時仍能保持連線，適合旅途中不穩的網路。
- **自動喚醒機制**：設定 wake-on-LAN 或防止機器進入無法喚醒的睡眠，確保遠端隨時連得上。
- **Herdr / 自架服務**：確認自架的伺服器服務開機自啟、正常運行。
- **最關鍵也最難的一項**：教在家的女友，緊急時怎麼重啟電腦和路由器——軟體都搞定了，最後的風險反而是沒人能重開那台卡住的機器。
- 互動數據：188 讚、15 留言、8 轉貼、81 分享、12,000 次瀏覽。

## 個人洞見

遠端佈署的真正單點故障往往不是軟體，而是「沒人在現場能重開機」。出國前把「人的 SOP」也準備好（誰能按電源鍵、路由器在哪），比多設一個服務更實際。這張清單可搭配 [[tailcat-tailscale-p2p-token|Tailscale 點對點連線]] 與 [[claude-code-vps-mosh-tmux|Mosh + Tmux 遠端工作流]]，也能用 [[cloudflare-zero-trust-home-services|Cloudflare Zero Trust]] 當另一條對外存取路徑。
