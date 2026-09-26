import { publishedMessage, siteUpdateFailedMessage, stillBuildingMessage } from "./messages.ts";
import { noteUrl } from "./rules.ts";
import type { CapturedNotes } from "./run.ts";

const DEPLOY_POLL_INTERVAL_SECONDS = 15;
const DEPLOY_WAIT_TIMEOUT_SECONDS = 300;

export type AnnounceOptions = {
  notify: (message: string) => Promise<void>;
  statusOf: (url: string) => Promise<number | null>;
  sleep: (seconds: number) => Promise<void>;
};

// 佈署之後把這輪收錄的筆記發 LINE：網站更新成功就等網址上線再發，失敗就告訴使用者下一輪會重試
export async function announceNotes(notes: CapturedNotes, siteUpdated: boolean, options: AnnounceOptions): Promise<void> {
  const paths = [...notes.added, ...notes.updated];
  if (paths.length === 0) return;
  if (!siteUpdated) {
    await options.notify(siteUpdateFailedMessage(paths));
    return;
  }
  const ready = await waitUntilPublished(paths, options);
  await options.notify(ready ? publishedMessage(notes.added, notes.updated) : stillBuildingMessage(paths));
}

// 佈署後立刻查一次，之後每隔固定秒數再查，整批共用同一個上限
async function waitUntilPublished(notes: string[], { statusOf, sleep }: AnnounceOptions): Promise<boolean> {
  const rounds = Math.floor(DEPLOY_WAIT_TIMEOUT_SECONDS / DEPLOY_POLL_INTERVAL_SECONDS);
  for (let round = 0; round <= rounds; round++) {
    let ready = true;
    for (const note of notes) {
      if ((await statusOf(noteUrl(note))) !== 200) ready = false;
    }
    if (ready) return true;
    if (round < rounds) await sleep(DEPLOY_POLL_INTERVAL_SECONDS);
  }
  return false;
}
