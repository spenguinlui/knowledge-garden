#!/bin/zsh
# GitHub Actions 在 push 後執行：等收錄那一輪放鎖，再把 mini 的 clone 快轉到 origin/v5。
# 主體包在 { } 裡，因為 git pull 可能改寫這支正在執行的檔案。
{
  set -uo pipefail

  KB="${KB_DIR:-$HOME/knowledge-garden}"
  LOCK="${KB_INBOX_LOCK:-/tmp/kb-inbox.lock}"
  TIMEOUT="${UPDATE_CODE_TIMEOUT_SECONDS:-600}"
  waited=0

  until mkdir "$LOCK" 2>/dev/null; do
    if (( waited >= TIMEOUT )); then
      print -u2 -- "等候收錄鎖超過 ${TIMEOUT} 秒：$LOCK"
      exit 1
    fi
    sleep 1
    waited=$((waited + 1))
  done
  trap 'rmdir "$LOCK"' EXIT

  cd "$KB" || exit 1
  git pull --ff-only
}
