// LINE push；沒設 token 就不發（例如筆電手動跑）
export async function notifyLine(message: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const to = process.env.LINE_USER_ID;
  if (!token || !to) return;
  try {
    await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to, messages: [{ type: "text", text: message }] }),
    });
  } catch (error) {
    console.error(`LINE push failed: ${String(error)}`);
  }
}
