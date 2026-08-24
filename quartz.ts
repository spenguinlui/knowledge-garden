import { componentRegistry } from "./quartz/components/registry"
import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"

// 側欄顯示「分類」資料夾（Explorer 預設會把 tags 整包過濾掉）：
// 只露出主分類與來源 tag，細分 tag 仍靠筆記內點擊到達。
// ⚠️ 這些函式會被序列化到瀏覽器端執行——必須自包含，不能引用外部變數。
// 主分類清單與 .claude/skills/capture/SKILL.md 的九大類同步。
const explorerOverrides = {
  filterFn: (node: any) => {
    const MAIN = ["ai-agent", "ai-skill", "ai-model", "dev", "infra", "tools", "健康", "職涯", "生活"]
    const SRC = ["from-threads", "from-ig", "from-fb", "from-linkedin", "from-web"]
    if (node.isFolder && node.slugSegment === "tags") return true
    const slug = (node.data && node.data.slug) || ""
    if (slug.indexOf("tags/") === 0) {
      const tag = slug.slice(5)
      return MAIN.indexOf(tag) !== -1 || SRC.indexOf(tag) !== -1
    }
    return true
  },
  mapFn: (node: any) => {
    const NAMES: Record<string, string> = {
      "tags/from-threads": "來源：Threads",
      "tags/from-ig": "來源：IG",
      "tags/from-fb": "來源：FB",
      "tags/from-linkedin": "來源：LinkedIn",
      "tags/from-web": "來源：網頁文章",
    }
    if (node.isFolder && node.slugSegment === "tags") node.displayName = "分類"
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
