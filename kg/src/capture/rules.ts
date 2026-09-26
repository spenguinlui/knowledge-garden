export const MAX_FAILS = 3;
const ERROR_TAIL_LENGTH = 4000;
const SITE = "https://knowledge.wayne-liu.com";

// claude 失敗一次之後，任務的嘗試次數與狀態
export function afterFailure(attempts: number): { attempts: number; status: "pending" | "failed" } {
  const next = attempts + 1;
  return { attempts: next, status: next >= MAX_FAILS ? "failed" : "pending" };
}

export function errorTail(output: string): string {
  return output.slice(-ERROR_TAIL_LENGTH);
}

// `git show --name-status` 的輸出分成新增（A）與更新（M），其他變動不算
export function splitNoteChanges(nameStatus: string): { added: string[]; updated: string[] } {
  const added: string[] = [];
  const updated: string[] = [];
  for (const line of nameStatus.split("\n")) {
    const [status, path] = line.split("\t");
    if (status === "A") added.push(path);
    if (status === "M") updated.push(path);
  }
  return { added, updated };
}

export function noteUrl(path: string): string {
  return `${SITE}/notes/${path.replace(/^content\/notes\//, "").replace(/\.md$/, "")}`;
}
