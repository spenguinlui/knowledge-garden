---
title: "升級新模型前先跑 prompt audit：實測省 25% 成本、準確率還上升"
date: 2026-09-25
tags: [ai-skill, claude-code, prompt, from/threads]
source_url: "https://www.threads.com/share/BCCjWMZ-4H/"
source_type: threads
captured_at: 2026-09-25T14:14:38+0800
---

> 原文：[Threads](https://www.threads.com/share/BCCjWMZ-4H/)

## 摘要

作者 ericwu0324 轉述 Anthropic 的建議：升級到 Opus 5.5 時應該順手審視既有 prompt。為舊模型寫的 prompt 在新模型上常變得低效——引發不必要的冗長輸出與重複 tool call，白白花錢。用 `/claude-api prompt-audit` 掃一遍就能揪出這些反模式，實測不只省成本，準確率還提升。

## 重點

- 在 Claude Code 跑 `/claude-api prompt-audit`，會檢查 Skills、設定檔與平台程式碼中的 prompt 反模式。
- 內部 benchmark（44 張客服 ticket）：從 Opus 4.8 升到 5.5 成本先降 18%，再跑 audit 又省 9%，合計 **25%**。
- 準確率同時從 88% 提升到 92%——省錢與品質不是取捨。
- 被清掉的多是「儀式性 prompt」（ceremonial prompts）：強制多步驟流程、草稿分節規則、多餘的驗證步驟、互相矛盾的指令。
- 這些寫法對舊模型是輔助，對新模型反而是負債——模型能力升級後，過度指揮會拖累它。

## 個人洞見

跟 [[claude-api-prompt-audit-health-check|之前收錄的 prompt-audit 健檢筆記]] 是同一個工具的兩種用法：那篇講「定期除草」，這篇講「換模型時大掃除」。可以定一個習慣：每次升級模型版本，第一件事就是跑 audit，別讓為舊模型調教的 prompt 綁住新模型。
