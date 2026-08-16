/**
 * index-notes.mjs — 把筆記 embed 進 Cloudflare Vectorize（kb-index）
 *
 * 用法：
 *   node scripts/index-notes.mjs --all                    # 全量重建（首次 backfill）
 *   node scripts/index-notes.mjs <git-diff --name-status 輸出>  # 增量（CI 用，stdin 餵）
 *
 * 環境變數：CLOUDFLARE_ACCOUNT_ID、CLOUDFLARE_API_TOKEN（Workers AI Run + Vectorize Edit）
 *
 * 索引單位：1 篇筆記 = 1 個向量（title + tags + 全文串接後 embed）。
 * 超長筆記（> MAX_CHARS）按 ## 段落切成 slug#1、slug#2…。
 * upsert 前先盲刪 slug 與 slug#1..#9（刪不存在的 id 無害），避免舊 chunk 殘留。
 */
import { readFileSync, existsSync, globSync } from "node:fs"

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID
const TOKEN = process.env.CLOUDFLARE_API_TOKEN
const INDEX = "kb-index"
const MODEL = "@cf/baai/bge-m3"
const MAX_CHARS = 6000 // bge-m3 上限 8192 tokens，中文抓保守
const API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}`

if (!ACCOUNT || !TOKEN) {
  console.error("缺 CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN")
  process.exit(1)
}

async function cf(path, body, contentType = "application/json") {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": contentType },
    body: contentType === "application/json" ? JSON.stringify(body) : body,
  })
  const json = await res.json()
  if (!res.ok || json.success === false) {
    throw new Error(`${path} → ${res.status}: ${JSON.stringify(json.errors ?? json)}`)
  }
  return json.result
}

async function embed(texts) {
  const result = await cf(`/ai/run/${MODEL}`, { text: texts })
  return result.data // [[1024 floats], ...]
}

/** 極簡 frontmatter 解析——schema 由 capture skill 控制，只取 title / tags */
function parseNote(path) {
  const raw = readFileSync(path, "utf8")
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) return { title: slugOf(path), tags: [], body: raw }
  const fm = m[1]
  const title =
    fm.match(/^title:\s*"(.+)"\s*$/m)?.[1] ?? fm.match(/^title:\s*(.+)$/m)?.[1] ?? slugOf(path)
  const tagsInline = fm.match(/^tags:\s*\[(.*)\]\s*$/m)?.[1]
  const tags = tagsInline
    ? tagsInline.split(",").map((t) => t.trim().replace(/^["']|["']$/g, "")).filter(Boolean)
    : [...fm.matchAll(/^\s+-\s+(.+)$/gm)].map((x) => x[1].trim())
  return { title, tags, body: m[2].trim() }
}

const slugOf = (path) =>
  path.replace(/^content\//, "").replace(/\.md$/, "")

function chunksFor(path) {
  const { title, tags, body } = parseNote(path)
  const slug = slugOf(path)
  const head = `${title}\n${tags.join(" ")}\n`
  const excerpt = body.replace(/[#*\[\]`>|-]/g, "").replace(/\s+/g, " ").slice(0, 200)
  const meta = { title, slug, tags, excerpt }
  if (head.length + body.length <= MAX_CHARS) {
    return [{ id: slug, text: head + body, metadata: meta }]
  }
  const parts = body.split(/^## /m).filter((p) => p.trim())
  const chunks = []
  let buf = ""
  for (const p of parts) {
    if (buf && buf.length + p.length > MAX_CHARS) {
      chunks.push(buf)
      buf = ""
    }
    buf += "## " + p
  }
  if (buf) chunks.push(buf)
  return chunks.map((text, i) => ({
    id: `${slug}#${i + 1}`,
    text: head + text.slice(0, MAX_CHARS),
    metadata: meta,
  }))
}

const staleIds = (slug) => [slug, ...Array.from({ length: 9 }, (_, i) => `${slug}#${i + 1}`)]

async function deleteIds(ids) {
  if (ids.length) await cf(`/vectorize/v2/indexes/${INDEX}/delete_by_ids`, { ids })
}

async function upsertFiles(paths) {
  const jobs = paths.filter((p) => existsSync(p)).flatMap(chunksFor)
  if (!jobs.length) return 0
  // 先清舊 chunk，再分批 embed + upsert
  await deleteIds(paths.flatMap((p) => staleIds(slugOf(p))))
  const BATCH = 20
  for (let i = 0; i < jobs.length; i += BATCH) {
    const batch = jobs.slice(i, i + BATCH)
    const vectors = await embed(batch.map((j) => j.text))
    const ndjson = batch
      .map((j, k) => JSON.stringify({ id: j.id, values: vectors[k], metadata: j.metadata }))
      .join("\n")
    await cf(`/vectorize/v2/indexes/${INDEX}/upsert`, ndjson, "application/x-ndjson")
  }
  return jobs.length
}

// ---- main ----
// 只索引筆記本體；首頁 / 搜尋頁等工具頁不進向量庫
const isNote = (p) => /^content\/notes\/.*\.md$/.test(p)

if (process.argv.includes("--all")) {
  const all = globSync("content/**/*.md").filter(isNote)
  const n = await upsertFiles(all)
  console.log(`全量重建：${all.length} 檔 → ${n} 向量`)
} else {
  // stdin：git diff --name-status 格式（A/M/D/Rxx\tpath[\tpath2]）
  const lines = readFileSync(0, "utf8").trim().split("\n").filter(Boolean)
  const upserts = []
  const deletes = []
  for (const line of lines) {
    const [status, a, b] = line.split("\t")
    if (status.startsWith("R")) {
      if (isNote(a)) deletes.push(a)
      if (isNote(b)) upserts.push(b)
    } else if (status === "D") {
      if (isNote(a)) deletes.push(a)
    } else if (isNote(a)) {
      upserts.push(a)
    }
  }
  await deleteIds(deletes.flatMap((p) => staleIds(slugOf(p))))
  const n = await upsertFiles(upserts)
  console.log(`增量：upsert ${upserts.length} 檔（${n} 向量）、刪 ${deletes.length} 檔`)
}
