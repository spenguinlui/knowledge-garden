import { createReadStream } from "node:fs";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import pg from "pg";
import sirv from "sirv";
import { mainCategories, noteTags, tagCounts, updateTags } from "../notes/index.ts";
import { validateTags } from "./tags.ts";

export type WebServerOptions = {
  db: pg.ClientConfig;
  publicDir: string;
};

function json(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  let text = "";
  for await (const chunk of request) {
    text += chunk;
    if (text.length > 64 * 1024) throw new Error("request too large");
  }
  return JSON.parse(text);
}

export function createWebServer({ db, publicDir }: WebServerOptions): http.Server {
  // dev：每次請求都讀磁碟，public 被整個換掉後不用重啟；etag：瀏覽器重新確認時沒變就回 304
  const servePublic = sirv(publicDir, {
    dev: true,
    etag: true,
    onNoMatch(_request, response) {
      response.statusCode = 404;
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      createReadStream(join(publicDir, "404.html"))
        .on("error", () => response.end("找不到這個頁面"))
        .pipe(response);
    },
  });

  return http.createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-cache");
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      const match = url.pathname.match(/^\/api\/notes\/([^/]+)(\/tags)?$/);
      if (!match) {
        servePublic(request, response);
        return;
      }

      const slug = decodeURIComponent(match[1]);
      const client = new pg.Client(db);
      await client.connect();
      try {
        if (request.method === "GET" && match[2] === undefined) {
          const tags = await noteTags(client, slug);
          if (tags === null) json(response, 404, { error: "找不到文章" });
          else json(response, 200, { tags, tagCounts: await tagCounts(client), mainCategories: await mainCategories(client) });
          return;
        }

        if (request.method === "PUT" && match[2] === "/tags") {
          let body: unknown;
          try {
            body = await readJson(request);
          } catch {
            json(response, 400, { error: "請求內容不是有效 JSON" });
            return;
          }
          const tags = typeof body === "object" && body !== null && "tags" in body
            ? (body as { tags: unknown }).tags
            : undefined;
          const error = validateTags(tags, await mainCategories(client));
          if (error !== null) {
            json(response, 400, { error });
            return;
          }
          if (!(await updateTags(client, slug, tags as string[]))) {
            json(response, 404, { error: "找不到文章" });
            return;
          }
          json(response, 200, { tags });
          return;
        }

        json(response, 404, { error: "找不到" });
      } finally {
        await client.end();
      }
    } catch (error) {
      console.error(error);
      if (!response.headersSent) json(response, 500, { error: "伺服器錯誤" });
      else response.end();
    }
  });
}
