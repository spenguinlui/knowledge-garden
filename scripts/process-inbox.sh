#!/bin/zsh
# process-inbox.sh — Mac mini 上由 launchd 每 5 分鐘跑一次：
# 消化 inbox/ 裡 LINE 丟進來的項目 → claude /capture 寫筆記 → commit + push。
# Claude 只寫筆記；git 收尾全由本 script 做（確定性）。
set -uo pipefail

KB="${KB_DIR:-$HOME/knowledge-garden}"
LOCK="/tmp/kb-inbox.lock"
MAX_FAILS=3
DEPLOY_POLL_INTERVAL_SECONDS="${DEPLOY_POLL_INTERVAL_SECONDS:-15}"
DEPLOY_WAIT_TIMEOUT_SECONDS="${DEPLOY_WAIT_TIMEOUT_SECONDS:-300}"

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

new_notes=()
updated_notes=()

for f in $items; do
  id="${${f:t}%.json}"
  failfile="inbox/$id.failcount"
  fails=$(cat "$failfile" 2>/dev/null || echo 0)
  (( fails >= MAX_FAILS )) && continue

  echo "$(date '+%F %T') processing $id"
  if claude -p "/capture inbox/$id" \
      --permission-mode acceptEdits \
      --allowedTools "Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,Bash(date:*)"; then
    # rm 而非 git rm：小柳三世寫的 oc-* 檔未被 git 追蹤，git rm 不會刪它們
    rm -f "inbox/$id.json" "inbox/$id.jpg" "$failfile"
    git add -A inbox/ content/
    before_commit=$(git rev-parse HEAD)
    git commit -qm "capture: $id" || true   # claude 沒改東西也不算錯
    after_commit=$(git rev-parse HEAD)
    if [[ "$after_commit" != "$before_commit" ]]; then
      while IFS= read -r note; do
        [[ -n "$note" ]] && new_notes+=("$note")
      done < <(git show --name-only --format= --diff-filter=A "$after_commit" -- content/notes/)
      while IFS= read -r note; do
        [[ -n "$note" ]] && updated_notes+=("$note")
      done < <(git show --name-only --format= --diff-filter=M "$after_commit" -- content/notes/)
    fi
  else
    echo $(( fails + 1 )) > "$failfile"
    git add "$failfile"
    git commit -qm "capture failed ($((fails + 1))/$MAX_FAILS): $id"
    (( fails + 1 >= MAX_FAILS )) && notify "❌ 收錄失敗（已重試 $MAX_FAILS 次，不再重試）：$id"
  fi
done

if ! git push --quiet; then
  notify "❌ knowledge-garden push 失敗，筆記卡在 mini 本機"
  exit 0
fi

all_notes=("${new_notes[@]}" "${updated_notes[@]}")
(( ${#all_notes[@]} == 0 )) && exit 0

note_url() {
  local path="$1"
  local slug="${${path#content/notes/}%.md}"
  print -r -- "https://knowledge.wayne-liu.com/notes/$slug"
}

# 第 0 輪在 push 後立刻檢查；之後每隔指定秒數檢查，整批共用同一個上限。
max_wait_rounds=$(( DEPLOY_WAIT_TIMEOUT_SECONDS / DEPLOY_POLL_INTERVAL_SECONDS ))
all_ready=false
for (( round = 0; round <= max_wait_rounds; round++ )); do
  all_ready=true
  for note in $all_notes; do
    http_status=$(curl -s -o /dev/null -w '%{http_code}' "$(note_url "$note")") || http_status=""
    if [[ "$http_status" != 200 ]]; then
      all_ready=false
    fi
  done
  [[ "$all_ready" == true ]] && break
  (( round < max_wait_rounds )) && sleep "$DEPLOY_POLL_INTERVAL_SECONDS"
done

if [[ "$all_ready" == true ]]; then
  message="🌱 已上花園"
  if (( ${#new_notes[@]} > 0 )); then
    message+=$'\n\n新增：'
    for note in $new_notes; do
      message+=$'\n'"$(note_url "$note")"
    done
  fi
  if (( ${#updated_notes[@]} > 0 )); then
    message+=$'\n\n更新：'
    for note in $updated_notes; do
      message+=$'\n'"$(note_url "$note")"
    done
  fi
else
  message="🌱 已收錄，站台還在建，請稍後再開："
  for note in $all_notes; do
    message+=$'\n'"$(note_url "$note")"
  done
fi

notify "$message"
