import { MAX_FAILS, noteUrl } from "./rules.ts";

export const PUSH_FAILED_MESSAGE = "❌ knowledge-garden push 失敗，筆記卡在 mini 本機";

export function publishedMessage(added: string[], updated: string[]): string {
  let message = "🌱 已上花園";
  if (added.length > 0) message += `\n\n新增：${added.map((path) => `\n${noteUrl(path)}`).join("")}`;
  if (updated.length > 0) message += `\n\n更新：${updated.map((path) => `\n${noteUrl(path)}`).join("")}`;
  return message;
}

export function stillBuildingMessage(paths: string[]): string {
  return `🌱 已收錄，站台還在建，請稍後再開：${paths.map((path) => `\n${noteUrl(path)}`).join("")}`;
}

export function siteUpdateFailedMessage(paths: string[]): string {
  return `🌱 已收錄，網站更新失敗，下一輪會自動重試：${paths.map((path) => `\n${noteUrl(path)}`).join("")}`;
}

export function gaveUpMessage(id: string): string {
  return `❌ 收錄失敗（已重試 ${MAX_FAILS} 次，不再重試）：${id}`;
}
