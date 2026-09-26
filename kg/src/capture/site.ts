// 查筆記網址的 HTTP 狀態碼；不跟隨轉址，連不上回 null
export async function statusOf(url: string): Promise<number | null> {
  try {
    return (await fetch(url, { redirect: "manual" })).status;
  } catch {
    return null;
  }
}
