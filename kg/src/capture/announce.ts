import { publishedMessage, siteUpdateFailedMessage } from "./messages.ts";
import type { CapturedNotes } from "./run.ts";

export type AnnounceOptions = {
  notify: (message: string) => Promise<void>;
};

// 網站更新之後把這輪收錄的筆記發 LINE；寫進資料庫並建站成功就是完成。
export async function announceNotes(notes: CapturedNotes, siteUpdated: boolean, options: AnnounceOptions): Promise<void> {
  const slugs = [...notes.added, ...notes.updated];
  if (slugs.length === 0) return;
  if (!siteUpdated) {
    await options.notify(siteUpdateFailedMessage(slugs));
    return;
  }
  await options.notify(publishedMessage(notes.added, notes.updated));
}
