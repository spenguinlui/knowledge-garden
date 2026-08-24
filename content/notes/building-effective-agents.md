---
title: "打造有效的 AI Agent：先用 workflow，別急著上自主 agent"
date: 2026-08-16
tags: [ai-agent, patterns, llm]
source_url: "https://www.anthropic.com/engineering/building-effective-agents"
source_type: article
captured_at: 2026-08-16T00:00:00+08:00
---

## 摘要

Anthropic 工程團隊整理了數十個生產環境 agent 案例後的結論：**成功的系統幾乎都不是複雜框架，
而是用簡單、可組合的模式堆出來的**。文章把「agentic system」拆成兩類——workflow（LLM 與工具
走**預先寫死的程式路徑**）與 agent（LLM **自己決定**流程與工具使用）——並給出五種 workflow 模式，
建議絕大多數場景先從最簡單的方案開始，只有在確實測得出改善時才加複雜度。

## 重點

- **Workflow vs Agent 的分界**：路徑由你寫死 = workflow；路徑由模型在 runtime 決定 = agent。
  前者可預測、好除錯；後者彈性高但延遲、成本、失控風險都上升。
- **Prompt chaining（提示鏈）**：把任務拆成序列步驟，前一步輸出餵給下一步，中間插**程式化的
  檢查關卡（gate）**。適合能明確拆解的任務，例如先寫行銷文案、再翻譯。
- **Routing（路由）**：先分類輸入，再導向各自專門化的下游處理。可以按客服問題類型分流，
  也可以把簡單問題路由到小模型省成本。
- **Parallelization（平行化）**：兩種變形——*sectioning*（拆成互不相依的子任務同時跑）與
  *voting*（同一任務跑多次取共識）。例如 guardrail 檢查與主回應平行跑、多視角同時審程式漏洞。
- **Orchestrator-workers（協調者–工人）**：中央 LLM **動態**拆解任務、分派給 worker、再彙整結果。
  與 sectioning 的差別在子任務**事先不知道有幾個**，例如跨多檔案的重構。
- **Evaluator-optimizer（評估–優化迴圈）**：一個 LLM 產出、另一個 LLM 給回饋，反覆迭代。
  前提是**評估標準夠明確**且迭代確實會變好，例如文學翻譯的潤稿。
- **自主 agent**：用在「連需要幾步都無法預測」的開放性問題。agent 在迴圈中靠環境回饋
  （工具執行結果）判斷進度並修正方向；必要配套是沙箱測試、guardrail、以及高品質的工具文件。
- **投資在工具設計上**：ACI（agent-computer interface，agent 與電腦的介面）該像 HCI 一樣認真對待——
  參數命名、範例、錯誤訊息設計，往往比換模型更能提升成效。
- 核心一句話：成功不在於**做出最精巧的系統，而是做出最合適的系統**。單次 LLM call 能解決就別上 agent。

## 個人洞見

這篇最實用的是把「agent」這個被講爛的詞切成可判斷的兩類：我手上的自動化多半屬於 workflow，
路徑其實我自己知道，硬包成 agent 只是把可除錯性換成不確定性。這個花園的收錄流程本身就是
prompt chaining（抓取 → 整理 → 寫檔），佇列那層則是
[[git-as-queue-pattern|git-as-queue 模式]]——同樣是「用最笨但可預測的機制取代精巧架構」的例子。
真要加 agent，第一件事應該是先把工具描述寫好，而不是先挑框架。
