---
title: "git worktree：同一個 repo 同時 checkout 多個分支到不同資料夾"
date: 2026-08-16
tags: [dev, git, ai-agent]
source_type: threads
captured_at: 2026-08-16T21:56:12+0800
---

## 摘要

`git worktree` 是 Git 內建但常被低估的功能：在同一個 repo 底下，把不同分支同時 checkout 到不同的資料夾工作。不必用 `git stash` 暫存手邊改動，也不必 `git clone` 出第二份程式碼，就能平行處理多條分支。

## 重點

- **worktree** = 從同一個 repo 展開的額外工作目錄，各自 checkout 不同分支，共用同一份 `.git` 物件庫。
- 用法：`git worktree add ../hotfix main` —— 在 `../hotfix` 資料夾開出一個 checkout 到 `main` 的工作區。
- 典型場景：改 bug 開一個 worktree、跑長時間測試開另一個 worktree，主工作目錄完全不被打斷。
- 免去 `git stash` 來回暫存、也免去 clone 第二份 repo 佔硬碟與重抓的成本。
- 搭配 AI coding agent 特別好用：每個 agent 各自一個 worktree，彼此互不踩腳、不會互相覆蓋改動。

## 個人洞見

跟 [[building-effective-agents|平行跑多個 coding agent]] 直接相關——worktree 提供了「每個 agent 一個隔離工作區」的乾淨機制，避免多 agent 同時改檔時互相衝突。也是繼 [[git-as-queue-pattern|用 git 當佇列]] 之後，另一個「把 git 當基礎設施而非只是版本控制」的用法。
