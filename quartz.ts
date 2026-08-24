import { componentRegistry } from "./quartz/components/registry"
import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"

// 側欄「分類」資料夾：主分類一層 +「來源」子資料夾（巢狀 tag from/*）。
// ⚠️ 函式會被序列化到瀏覽器端執行——必須自包含，不能引用外部變數。
// 主分類清單與 .claude/skills/capture/SKILL.md 的九大類同步。
const explorerOverrides = {
  filterFn: (node: any) => {
    const MAIN = ["ai-agent", "ai-skill", "ai-model", "dev", "infra", "tools", "健康", "職涯", "生活"]
    if (node.isFolder && node.slugSegment === "tags") return true
    if (node.isFolder && node.slugSegment === "from") return true
    const slug = (node.data && node.data.slug) || ""
    if (slug.indexOf("tags/from/") === 0) return true
    if (slug === "tags/from") return true
    if (slug.indexOf("tags/") === 0) return MAIN.indexOf(slug.slice(5)) !== -1
    return true
  },
  mapFn: (node: any) => {
    const NAMES: Record<string, string> = {
      "tags/from/threads": "Threads",
      "tags/from/ig": "IG",
      "tags/from/fb": "FB",
      "tags/from/linkedin": "LinkedIn",
      "tags/from/web": "網頁文章",
    }
    if (node.isFolder && node.slugSegment === "tags") node.displayName = "分類"
    if (node.isFolder && node.slugSegment === "from") node.displayName = "來源"
    const slug = (node.data && node.data.slug) || ""
    if (NAMES[slug]) node.displayName = NAMES[slug]
    return node
  },
}
componentRegistry.setOptionOverrides("@quartz-community/explorer", explorerOverrides)
componentRegistry.setOptionOverrides("explorer", explorerOverrides)

const config = await loadQuartzConfig()
export default config
export const layout = await loadQuartzLayout()
