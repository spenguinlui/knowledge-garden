/**
 * kb-line-webhook（小柳二世）— LINE 雜物箱 → 私有 repo stash/
 *
 * 職責：收「不是知識」的雜項（租屋、影片、待辦連結…），純存檔不加工。
 * 流程：驗簽 → 過濾（只收自己的 message event）→ 寫 items/{yyyy-mm}/{messageId} 進 GitHub
 * → reply「進雜物箱了」。冪等：檔名 = messageId，GitHub 回 422（已存在）視為已處理。
 * 知識收錄請走小柳三世（OpenClaw 轉交 knowledge-garden）。
 */

interface Env {
  LINE_CHANNEL_SECRET: string
  LINE_CHANNEL_ACCESS_TOKEN: string
  GITHUB_TOKEN: string
  ALLOWED_LINE_USER_ID: string
  GITHUB_REPO: string
  GITHUB_BRANCH: string
}

interface LineEvent {
  type: string
  replyToken?: string
  source?: { userId?: string }
  timestamp: number
  message?: { id: string; type: string; text?: string }
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (req.method !== "POST") return new Response("ok", { status: 200 })

    const rawBody = await req.arrayBuffer()
    if (!(await verifySignature(req, rawBody, env.LINE_CHANNEL_SECRET))) {
      return new Response("bad signature", { status: 401 })
    }

    const { events = [] } = JSON.parse(new TextDecoder().decode(rawBody)) as {
      events: LineEvent[]
    }

    for (const ev of events) {
      if (ev.type !== "message" || !ev.message) continue
      if (ev.source?.userId !== env.ALLOWED_LINE_USER_ID) continue

      const m = ev.message
      const supported = m.type === "text" || m.type === "image"

      // 先 reply（reply token 約 1 分鐘失效），GitHub 寫入放 waitUntil
      if (ev.replyToken) {
        ctx.waitUntil(
          reply(env, ev.replyToken, supported ? "進雜物箱了 📦" : `還不會處理 ${m.type} 訊息 🙈`),
        )
      }
      if (!supported) continue

      ctx.waitUntil(storeToInbox(env, ev))
    }

    return new Response("ok", { status: 200 })
  },
}

async function verifySignature(
  req: Request,
  rawBody: ArrayBuffer,
  secret: string,
): Promise<boolean> {
  const signature = req.headers.get("x-line-signature")
  if (!signature) return false
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  )
  let sigBytes: Uint8Array
  try {
    sigBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0))
  } catch {
    return false
  }
  return crypto.subtle.verify("HMAC", key, sigBytes, rawBody)
}

async function storeToInbox(env: Env, ev: LineEvent): Promise<void> {
  const m = ev.message!
  const meta = {
    type: m.type,
    text: m.text ?? null,
    timestamp: ev.timestamp,
    messageId: m.id,
  }
  // 按月份歸檔：items/2026-08/<id>.json
  const month = new Date(ev.timestamp).toISOString().slice(0, 7)

  // 圖片先抓內容存 .jpg（LINE 內容 API 只保留一段時間，必須立刻取）
  if (m.type === "image") {
    const res = await fetch(`https://api-data.line.me/v2/bot/message/${m.id}/content`, {
      headers: { Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}` },
    })
    if (!res.ok) throw new Error(`LINE content API ${res.status}`)
    await githubPut(env, `items/${month}/${m.id}.jpg`, bufToBase64(await res.arrayBuffer()))
  }

  await githubPut(env, `items/${month}/${m.id}.json`, strToBase64(JSON.stringify(meta, null, 2)))
}

/** PUT 一個檔案進 repo；422 = 已存在（webhook 重送），視為成功 */
async function githubPut(env: Env, path: string, contentB64: string): Promise<void> {
  const res = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "kb-line-webhook",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `inbox: ${path}`,
        content: contentB64,
        branch: env.GITHUB_BRANCH,
      }),
    },
  )
  if (!res.ok && res.status !== 422) {
    throw new Error(`GitHub PUT ${path} → ${res.status}: ${await res.text()}`)
  }
}

async function reply(env: Env, replyToken: string, text: string): Promise<void> {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  })
}

function strToBase64(s: string): string {
  return bufToBase64(new TextEncoder().encode(s).buffer as ArrayBuffer)
}

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ""
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}
