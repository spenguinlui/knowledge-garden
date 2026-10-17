import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

// deploy/update.sh 是 mini-deploy 更新程式碼後呼叫的部署入口；launchctl 換成 PATH 上的假指令
const script = fileURLToPath(new URL("../../deploy/update.sh", import.meta.url));
const bin = mkdtempSync(join(tmpdir(), "deploy-update-test-"));
after(() => rmSync(bin, { recursive: true, force: true }));
const log = join(bin, "launchctl.log");
writeFileSync(join(bin, "launchctl"), '#!/bin/zsh\nprint -r -- "$@" >> "$LAUNCHCTL_LOG"\nexit "${LAUNCHCTL_STATUS:-0}"\n');
chmodSync(join(bin, "launchctl"), 0o755);

function run(launchctlStatus: number) {
  rmSync(log, { force: true });
  return spawnSync("zsh", [script], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, LAUNCHCTL_LOG: log, LAUNCHCTL_STATUS: String(launchctlStatus) },
  });
}

test("部署入口重啟網站服務 com.liu.kb-web", () => {
  const result = run(0);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(log, "utf8").trim(), `kickstart -k gui/${userInfo().uid}/com.liu.kb-web`);
});

test("網站服務還沒裝（launchctl 失敗）不算部署失敗", () => {
  assert.equal(run(1).status, 0);
});
