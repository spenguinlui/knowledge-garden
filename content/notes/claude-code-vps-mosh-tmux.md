---
title: "把 Claude Code 跑在 VPS：Mosh + Tmux 讓筆電關了也能繼續跑"
date: 2026-08-24
tags: [ai-agent, claude-code, remote-workflow, from/threads]
source_url: "https://www.threads.com/@frugal_ptt/post/Dam89DrFDRd"
source_type: threads
captured_at: 2026-08-24T12:30:37+0800
---

> 原文：[Threads](https://www.threads.com/@frugal_ptt/post/Dam89DrFDRd)

## 摘要

把 Claude Code 部署在 VPS（雲端虛擬主機），再用 `Mosh` + `Tmux` 連上去操作。這樣做最大的好處是：可以隨時關上筆電，讓 agent 繼續在遠端跑，等重新打開裝置時自動接回原本的工作階段——不再被本機的續航、網路、或必須開著螢幕綁住。

## 重點

- **VPS**：租一台雲端伺服器（如 DigitalOcean、Linode、EC2），Claude Code 跑在上面而非本機。長時間任務不依賴筆電開關機。
- **Tmux**（terminal multiplexer）：終端機多工工具，把 session 保存在伺服器端。斷線後 process 不會被殺掉，重連時 `tmux attach` 就回到原畫面。
- **Mosh**（mobile shell）：SSH 的替代品，專為不穩定網路設計。網路切換、休眠、換 IP 都能自動重連，游標操作有即時回饋，不像 SSH 斷了就卡死。
- **組合效果**：Mosh 負責「連線層」的韌性（斷線自動接回），Tmux 負責「工作階段層」的持久（process 一直活著）。兩者疊加＝關筆電 → 通勤 → 重開 → 無縫接回正在跑的 agent。
- 適合場景：讓 coding agent 跑長時間的重構、測試、批次任務，不用一直守著螢幕。

## 個人洞見

這其實是「讓 async coding agent 真正 async」的土砲解法——不用等官方的雲端 agent 服務，自己拿 VPS + Mosh + Tmux 就能做到 session 持久化。跟 [[open-swe-async-coding-agent|Open SWE 的非同步 agent]] 想解決的是同一個痛點（agent 跑長任務時人不用一直盯著），只是這裡是自建基礎設施的路線。也可以搭 [[git-worktree-parallel-branches|git worktree]] 在同一台 VPS 上平行跑多個分支任務。
