#!/bin/zsh
# process-inbox.sh — Mac mini 上由 launchd 每 5 分鐘跑一次的外殼：
# 上鎖、確保 kg/ 套件裝好、執行收錄程式 kg/src/capture/main.ts、程式異常結束時發一次 LINE 告警。
# 收錄的業務邏輯全在 kg/src/capture/。
#
# 主體包在 { } 裡：收錄程式會 pull 改寫這支檔案，zsh 邊讀邊跑，不包起來會讀到改過的內容。
{
  set -uo pipefail

  KB="${KB_DIR:-$HOME/knowledge-garden}"
  LOCK="/tmp/kb-inbox.lock"
  CRASHED="/tmp/kb-inbox.crashed"

  # launchd 的 PATH 很短；Homebrew 在 Intel 與 Apple Silicon 的常見位置都補上。
  export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"

  # LINE 告警用。放 scripts/local-env.sh（gitignored）：
  #   export LINE_CHANNEL_ACCESS_TOKEN=...
  #   export LINE_USER_ID=...
  [[ -f "$KB/scripts/local-env.sh" ]] && source "$KB/scripts/local-env.sh"

  # mkdir 原子鎖（macOS 無 flock），上一輪還沒跑完就直接退出
  mkdir "$LOCK" 2>/dev/null || exit 0
  trap 'rmdir "$LOCK"' EXIT

  cd "$KB" || exit 1

  crashed() { # $1 = exit code；恢復正常前只發一次
    echo "$(date '+%F %T') capture exited with $1"
    [[ -e "$CRASHED" ]] && return 0
    touch "$CRASHED"
    [[ -n "${LINE_CHANNEL_ACCESS_TOKEN:-}" && -n "${LINE_USER_ID:-}" ]] || return 0
    curl -s -o /dev/null -X POST https://api.line.me/v2/bot/message/push \
      -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"to\":\"$LINE_USER_ID\",\"messages\":[{\"type\":\"text\",\"text\":\"❌ knowledge-garden 收錄程式異常結束（exit $1），詳見 mini 的 ~/Library/Logs/kb-inbox.log；恢復前不再重複通知\"}]}"
  }

  if [[ ! -d kg/node_modules || kg/package-lock.json -nt kg/node_modules/.package-lock.json ]]; then
    (cd kg && npm ci --omit=dev) || { crashed $?; exit 1; }
  fi

  node kg/src/capture/main.ts
  code=$?
  if (( code == 0 )); then
    rm -f "$CRASHED"
  else
    crashed $code
  fi
  exit $code
}
