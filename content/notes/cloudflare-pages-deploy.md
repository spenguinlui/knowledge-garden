---
title: "Cloudflare Pages：免費的靜態站託管與自動部署"
date: 2026-08-16
tags: [infra, cloudflare, deployment]
source_url: "https://developers.cloudflare.com/pages/"
source_type: article
captured_at: 2026-08-16T00:00:00+08:00
---

> 🔗 原文：[developers.cloudflare.com](https://developers.cloudflare.com/pages/)

## 摘要

Cloudflare Pages 是靜態網站託管服務：連上 GitHub repo 後，每次 push 自動 build +
部署到全球 CDN，個人用免費層就夠（每月 500 次 build、頻寬不限）。

## 重點

- **Git 整合**：push 到指定分支就觸發 build，preview branch 另給預覽網址
- **Build watch paths**：可設定「只有某些路徑變動才 build」——本站用它排除
  `inbox/`（收錄佇列）的 commit，省下無意義的重建
- **免費自訂網域** + 自動 HTTPS
- 同帳號可搭 Workers（API）、Vectorize（向量庫），一站到底
- 注意：預設 shallow clone，靠 git 時間戳的功能要在 build command 前加
  `git fetch --unshallow`（本站日期走 frontmatter，不需要）

## 個人洞見

[[quartz-static-site-generator|Quartz]] + Pages 是零維運組合：沒有伺服器、沒有月費，
知識庫的「發布」被壓縮成 `git push`。
