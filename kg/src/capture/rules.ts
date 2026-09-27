export const MAX_FAILS = 3;
const ERROR_TAIL_LENGTH = 4000;
const SITE = "https://knowledge.wayne-liu.com";

// 收錄失敗一次之後（claude 失敗或寫出格式不合的筆記），任務的嘗試次數與狀態
export function afterFailure(attempts: number): { attempts: number; status: "pending" | "failed" } {
  const next = attempts + 1;
  return { attempts: next, status: next >= MAX_FAILS ? "failed" : "pending" };
}

export function errorTail(output: string): string {
  return output.slice(-ERROR_TAIL_LENGTH);
}

export function noteUrl(slug: string): string {
  return `${SITE}/notes/${slug}`;
}
