import { MAX_FAILS, noteUrl } from "./rules.ts";

export function publishedMessage(added: string[], updated: string[]): string {
  let message = "🌱 已上花園";
  if (added.length > 0) message += `\n\n新增：${added.map((slug) => `\n${noteUrl(slug)}`).join("")}`;
  if (updated.length > 0) message += `\n\n更新：${updated.map((slug) => `\n${noteUrl(slug)}`).join("")}`;
  return message;
}

export function stillBuildingMessage(slugs: string[]): string {
  return `🌱 已收錄，站台還在建，請稍後再開：${slugs.map((slug) => `\n${noteUrl(slug)}`).join("")}`;
}

export function siteUpdateFailedMessage(slugs: string[]): string {
  return `🌱 已收錄，網站更新失敗，下一輪會自動重試：${slugs.map((slug) => `\n${noteUrl(slug)}`).join("")}`;
}

export function gaveUpMessage(id: string): string {
  return `❌ 收錄失敗（已重試 ${MAX_FAILS} 次，不再重試）：${id}`;
}
