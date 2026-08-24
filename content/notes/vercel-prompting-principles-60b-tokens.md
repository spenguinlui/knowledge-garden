---
title: "Vercel 燒 60B Tokens 淬煉出的 8 條 Prompt 原則"
date: 2026-08-24
tags: [ai-skill, prompt, context-engineering, from/threads]
source_url: "https://www.threads.com/share/BAWHMXP2R4/"
source_type: threads
captured_at: 2026-08-24T12:10:58+0800
---

> 原文：[Threads](https://www.threads.com/share/BAWHMXP2R4/)

## 摘要

Vercel 團隊在打造他們的 AI 產品時「燒掉 60B（600 億）Tokens」做實驗，最後把心得濃縮成 8 條有效撰寫 prompt 的核心原則。貼文作者認為這 8 條規則的實用性勝過市面上絕大多數的 prompt 教學。

## 重點

- 來源是 Vercel 團隊在實際產品規模上做的實驗，號稱耗費 60B Tokens 才得出結論——重點在於這些原則有大量真實用量背書，不是紙上談兵。
- 貼文本身只放了引言（「Vercel burned 60B tokens → 8 principles」），**8 條規則的完整內容未能從分享連結抓取**（Threads 擋爬 / 內文在圖片裡），此處僅存連結。
- 貼文互動數據：289K 瀏覽、2.6K 讚、272 轉發、1.6K 分享，屬高擴散內容。
- 這類「大廠實測後的 prompt 原則」通常圍繞：明確的角色與任務定義、給範例（few-shot）、拆解步驟、限定輸出格式、避免模糊指令、把約束條件講清楚等 context 工程主題（此為一般性推斷，非原文列點）。

## 個人洞見

要真正拿到那 8 條規則，得回 Threads 原文或找 Vercel 官方部落格的 prompt engineering 文章來對照。跟花園裡既有的 [[impeccable-ai-ui-design-spec|完美 AI UI 設計 prompt]]、[[im-human-humanize-ai-writing|讓 AI 寫作更像人]] 屬同一條「prompt / context engineering」脈絡，可一起收斂成自己的 prompt checklist。
