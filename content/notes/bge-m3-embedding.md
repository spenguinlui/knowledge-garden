---
title: "bge-m3：中文友善的開源 embedding 模型"
date: 2026-08-16
tags: [ai-model, rag, embedding, from-web]
source_url: "https://developers.cloudflare.com/workers-ai/models/bge-m3/"
source_type: article
captured_at: 2026-08-16T00:00:00+08:00
---

> 原文：[developers.cloudflare.com](https://developers.cloudflare.com/workers-ai/models/bge-m3/)

## 摘要

bge-m3（BAAI General Embedding, M3）是北京智源開源的多語 embedding 模型，
把文字轉成 1024 維向量供語意搜尋用。M3 = Multi-lingual（100+ 語言）、
Multi-granularity（最長 8192 tokens）、Multi-functionality（dense / sparse / colbert）。

## 重點

- **中文表現好**：對中英夾雜的技術筆記是實用等級，這是選它的主因
- Cloudflare Workers AI 有託管版（`@cf/baai/bge-m3`），呼 API 即用、免自架 GPU
- dense 輸出 1024 維，配向量庫（如 Vectorize）做 cosine 相似度查詢
- 定價 $0.012 / M input tokens，個人筆記量級下趨近免費

## 個人洞見

語意搜尋（RAG 的 retrieval 半邊）對個人知識庫的價值：用「意思」找筆記，
不記得關鍵字也找得回來——這正好補上 [[quartz-static-site-generator|Quartz]]
內建全文搜尋（關鍵字比對）搆不到的那一塊。
