import type { QuartzComponent, QuartzComponentProps } from "@quartz-community/types";
import { h } from "preact";
import { browserScript } from "./script.ts";

// Quartz 載入外掛時呼叫，options 是 quartz.config.yaml 這個外掛的 options
let workerUrl: string | undefined;

export function init(options?: Record<string, unknown>): void {
  workerUrl = typeof options?.workerUrl === "string" ? options.workerUrl : undefined;
}

// 語意搜尋框：只畫在 /search 這一頁，其他頁面什麼都不畫
export function SemanticSearch(): QuartzComponent {
  if (!workerUrl) {
    throw new Error("semantic-search：quartz.config.yaml 沒有設定 options.workerUrl");
  }

  const Component: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
    if (fileData.slug !== "search") return null;
    return h("div", { id: "kb-search-box" }, [
      h("input", {
        id: "kb-q",
        type: "search",
        placeholder: "例如：怎麼讓 AI 自動整理筆記",
        style:
          "width:100%;padding:.6rem .8rem;font-size:1rem;border:1px solid var(--lightgray);border-radius:8px;background:var(--light);color:var(--dark)",
      }),
      h("div", { id: "kb-results", style: "margin-top:1rem" }),
    ]);
  };
  // 搜尋框放在 afterBody，Quartz 在文章與 afterBody 之間固定有一條 hr；
  // 只在 search 頁藏掉它、拿掉頁尾上緣間距，讓搜尋框像原本一樣緊接在說明文字下面
  Component.css = `
body[data-slug="search"] article + hr { display: none; }
body[data-slug="search"] .page > #quartz-body .page-footer { margin-top: 0; }
`;
  Component.afterDOMLoaded = browserScript(workerUrl);
  return Component;
}
