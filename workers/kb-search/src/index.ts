/**
 * kb-search — 知識花園語意搜尋 API
 * POST /search {"q": "..."} → [{title, url, excerpt, score, tags}]
 * 查詢字串 embed（bge-m3）後查 Vectorize，回 top-k 筆記。
 */

interface Env {
  AI: Ai
  KB_INDEX: VectorizeIndex
  ALLOWED_ORIGINS: string
  SITE_BASE: string
}

// 每個 isolate 的 best-effort 限流（個人站夠用；真被打再上 WAF rule）
const hits = new Map<string, { n: number; t: number }>()
const LIMIT = 20 // 每分鐘每 IP

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const h = hits.get(ip)
  if (!h || now - h.t > 60_000) {
    hits.set(ip, { n: 1, t: now })
    return false
  }
  h.n++
  return h.n > LIMIT
}

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get("Origin") ?? ""
  const allowed = env.ALLOWED_ORIGINS.split(",")
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(req, env)
    if (req.method === "OPTIONS") return new Response(null, { headers: cors })
    if (req.method !== "POST") return new Response("POST /search", { status: 405, headers: cors })

    const ip = req.headers.get("CF-Connecting-IP") ?? "?"
    if (rateLimited(ip)) return new Response("slow down", { status: 429, headers: cors })

    let q: string
    try {
      q = String((await req.json<{ q?: string }>()).q ?? "").trim()
    } catch {
      return new Response("bad json", { status: 400, headers: cors })
    }
    if (!q || q.length > 500) return new Response("q required (≤500)", { status: 400, headers: cors })

    const emb = (await env.AI.run("@cf/baai/bge-m3", { text: [q] })) as { data: number[][] }
    const res = await env.KB_INDEX.query(emb.data[0], { topK: 8, returnMetadata: "all" })

    const results = res.matches
      .filter((m) => m.metadata)
      .map((m) => ({
        title: m.metadata!.title,
        url: `${env.SITE_BASE}/${m.metadata!.slug}`,
        excerpt: m.metadata!.excerpt,
        tags: m.metadata!.tags,
        score: Math.round(m.score * 1000) / 1000,
      }))

    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json", ...cors },
    })
  },
}
