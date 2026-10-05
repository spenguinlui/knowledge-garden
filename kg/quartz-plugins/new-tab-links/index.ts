import type { QuartzComponent } from "@quartz-community/types";
import { browserScript } from "./script.ts";

// 全站連結行為：什麼都不畫，只掛一支瀏覽器端程式（哪些連結開新視窗見 script.ts）
export function NewTabLinks(): QuartzComponent {
  const Component: QuartzComponent = () => null;
  Component.afterDOMLoaded = browserScript();
  return Component;
}
