---
title: "讓 Claude 做出專業級網站：設計 Skill＋『AI 老套設計禁用清單』＋截圖自檢"
date: 2026-09-22
tags: [ai-skill, ui-ux, design, from/threads]
source_url: "https://threads.com/@aistart_up/post/Ddiyp4AEifg"
source_type: threads
captured_at: 2026-09-22T12:32:18+0800
---

> 原文：[Threads](https://threads.com/@aistart_up/post/Ddiyp4AEifg)（@aistart_up）

## 摘要

作者分享讓 Claude 產出「像專業設計師做的」網站的三件套：裝兩個設計 skill 補足審美知識、給一張「AI 老套設計清單」當負面約束（清單上的通通不准用）、最後讓 Claude 自己截圖檢查手機版，發現跑版就自己修。核心思路是把「好設計」拆成可載入的知識（skill）＋明確的禁令（blocklist）＋可驗證的回饋迴圈（截圖自檢）。

## 重點

- **設計 skill**：替 coding agent 載入封裝好的設計知識模組，補上版面、配色等預設缺乏的審美判斷（作者裝了兩個，貼文未給出具體名稱與連結）。
- **AI 老套設計清單**：把 AI 生成網頁常見的陳腔濫調（cliché）列成清單，明令禁用——用**負面清單**約束比只給正面範例更能避開「一眼 AI 味」。
- **截圖自檢迴圈**：要求 Claude 完工後自己截圖檢查行動版（RWD），哪裡跑版自己修——把驗收也交給 agent，形成 generate → verify → fix 的閉環。
- 貼文數據：23.2K 瀏覽、274 讚、591 分享；具體 skill 名稱與清單內容未公開，僅存方法論。

## 個人洞見

跟 [[design-skills-fix-ai-slop-web-design|用 Design Skill 治 AI Slop]] 是同一路數，但這篇多了兩個可操作的增量：一是**負面約束**（禁用清單）——與其教 AI 什麼是美，先擋掉已知的醜；二是**截圖自檢**——讓 agent 自己驗收視覺結果，而不是只信 code 寫完就好。搭配 [[impeccable-ai-ui-design-spec|Impeccable AI UI 設計規範]] 的正面規範與 [[github-ui-libraries-as-ai-design-templates|拿 GitHub UI library 當設計模板]]，正好湊成「正例＋反例＋驗證」三件套。
