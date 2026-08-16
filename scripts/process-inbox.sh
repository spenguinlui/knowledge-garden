#!/bin/zsh
# process-inbox.sh — Mac mini 上由 launchd 每 5 分鐘跑一次：
# 消化 inbox/ 裡 LINE 丟進來的項目 → claude /capture 寫筆記 → commit + push。
# Claude 只寫筆記；git 收尾全由本 script 做（確定性）。
set -uo pipefail

KB="${KB_DIR:-$HOME/knowledge-garden}"
LOCK="/tmp/kb-inbox.lock"
MAX_FAILS=3

# 失敗告警用（LINE push）。放 scripts/local-env.sh（gitignored）：
#   export LINE_CHANNEL_ACCESS_TOKEN=...
#   export LINE_USER_ID=...
[[ -f "$KB/scripts/local-env.sh" ]] && source "$KB/scripts/local-env.sh"

# mkdir 原子鎖（macOS 無 flock），上一輪還沒跑完就直接退出
mkdir "$LOCK" 2>/dev/null || exit 0
trap 'rmdir "$LOCK"' EXIT

cd "$KB" || exit 1
git pull --rebase --quiet || { echo "$(date '+%F %T') git pull failed"; exit 1; }

setopt null_glob
items=(inbox/*.json)
[[ ${#items[@]} -eq 0 ]] && exit 0

notify() { # $1 = 訊息
  [[ -n "${LINE_CHANNEL_ACCESS_TOKEN:-}" && -n "${LINE_USER_ID:-}" ]] || return 0
  curl -s -o /dev/null -X POST https://api.line.me/v2/bot/message/push \
    -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"to\":\"$LINE_USER_ID\",\"messages\":[{\"type\":\"text\",\"text\":$(printf '%s' "$1" | jq -Rs .)}]}"
}

for f in $items; do
  id="${${f:t}%.json}"
  failfile="inbox/$id.failcount"
  fails=$(cat "$failfile" 2>/dev/null || echo 0)
  (( fails >= MAX_FAILS )) && continue

  echo "$(date '+%F %T') processing $id"
  if claude -p "/capture inbox/$id" \
      --permission-mode acceptEdits \
      --allowedTools "Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,Bash(date:*)"; then
    git rm -q --ignore-unmatch "inbox/$id.json" "inbox/$id.jpg" "$failfile"
    git add content/
    git commit -qm "capture: $id" || true   # claude 沒改東西也不算錯
  else
    echo $(( fails + 1 )) > "$failfile"
    git add "$failfile"
    git commit -qm "capture failed ($((fails + 1))/$MAX_FAILS): $id"
    (( fails + 1 >= MAX_FAILS )) && notify "❌ 收錄失敗（已重試 $MAX_FAILS 次，不再重試）：$id"
  fi
done

git push --quiet || notify "❌ knowledge-garden push 失敗，筆記卡在 mini 本機"
