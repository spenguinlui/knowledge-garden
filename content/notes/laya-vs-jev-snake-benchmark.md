---
title: "Laya vs Jev 貪吃蛇實測：同一套 typed decision，決策速度差 26 倍"
date: 2026-09-22
tags: [ai-model, benchmark, 即時互動, from/threads]
source_url: "https://www.threads.com/share/_uF3CjrFT/"
source_type: threads
captured_at: 2026-09-22T12:30:22+0800
---

> 原文：[Threads](https://www.threads.com/share/_uF3CjrFT/)

## 摘要

@jhinresh 用同一套貪吃蛇遊戲、同一套 typed decision（模型每步以固定結構化格式輸出決策）當基準，讓剛出的 Laya 和 [[jev-realtime-voice-virtual-try-on|Jev]] 各自由跑 30 秒。結果 Laya 以每秒 85 次決策拿下 46 分、蛇長 52；Jev 每秒僅 3.2 次決策，只得 1 分、蛇長 7。決策吞吐量的差距直接反映在遊戲成績上。

## 重點

- 測試設定：同一套貪吃蛇 + 同一套 `typed decision`，30 秒自由跑，控制變因只剩模型本身
- **Laya**：分數 46、蛇長 52、決策 **85 次/秒**
- **Jev**：分數 1、蛇長 7、決策 **3.2 次/秒**
- 決策速率差約 **26 倍**，在即時遊戲這種「反應速度即實力」的場景，吞吐量差距被直接放大成成績差距
- typed decision：要求模型每步輸出固定型別/結構的決策（而非自由文字），方便程式直接執行與計速
- 貼文互動：302 讚、19 留言、166 分享；作者感嘆「Jev 才剛出來，現在又多了 Laya，根本來不及玩」——這類輕量即時模型正密集出現

## 個人洞見

和 [[jev-realtime-voice-virtual-try-on|Jev 虛擬試衣]] 那篇的 $0.0011/620ms 對照看：620ms 約等於每秒 1.6 次決策，跟這裡實測的 3.2 次/秒同一量級；而 Laya 的 85 次/秒已經進入「每一幀都能問模型」的境界。即時 AI 應用的瓶頸正從「能不能做」變成「每秒能決策幾次」，這個指標值得持續追蹤。
