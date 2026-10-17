import type { QuartzComponent } from "@quartz-community/types";
import { browserScript } from "./script.ts";

export function TagEditor(): QuartzComponent {
  const Component: QuartzComponent = () => null;
  Component.css = `
#kg-tag-editor { margin: .5rem 0 1rem; padding: .75rem; border: 1px solid var(--lightgray); border-radius: 8px; }
.kg-tag-row { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; }
#kg-tag-editor select, #kg-tag-editor input, #kg-tag-editor button { font: inherit; color: var(--dark); background: var(--light); border: 1px solid var(--lightgray); border-radius: 6px; padding: .35rem .55rem; }
.kg-tag-remove, .kg-source-tag { display: inline-flex; align-items: center; }
.kg-tag-remove::after { content: " ×"; }
.kg-source-tag { color: var(--gray); padding: .35rem .55rem; border: 1px solid var(--lightgray); border-radius: 6px; }
.kg-tag-status { margin-top: .5rem; color: var(--darkgray); }
@media (max-width: 600px) { #kg-tag-editor input { width: 100%; box-sizing: border-box; } .kg-tag-row { align-items: stretch; } }
`;
  Component.afterDOMLoaded = browserScript();
  return Component;
}
