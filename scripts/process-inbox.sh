#!/bin/zsh
# process-inbox.sh — Mac mini 上由 launchd 每 5 分鐘跑一次：
# 消化 inbox/ 裡 LINE 丟進來的項目 → claude /capture 寫筆記 → commit + push。
# Claude 只寫筆記；git 收尾全由本 script 做（確定性）。
set -uo pipefail

KB="${KB_DIR:-$HOME/knowledge-garden}"
LOCK="/tmp/kb-inbox.lock"
MAX_FAILS=3
DB_CONTAINER="${DB_CONTAINER:-knowledge-garden-db}"
POSTGRES_USER="${POSTGRES_USER:-knowledge_garden}"
POSTGRES_DB="${POSTGRES_DB:-knowledge_garden}"
DEPLOY_POLL_INTERVAL_SECONDS="${DEPLOY_POLL_INTERVAL_SECONDS:-15}"
DEPLOY_WAIT_TIMEOUT_SECONDS="${DEPLOY_WAIT_TIMEOUT_SECONDS:-300}"

# launchd 的 PATH 很短；Docker Desktop 在 Intel 與 Apple Silicon 的常見位置都補上。
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"

# 失敗告警用（LINE push）。放 scripts/local-env.sh（gitignored）：
#   export LINE_CHANNEL_ACCESS_TOKEN=...
#   export LINE_USER_ID=...
[[ -f "$KB/scripts/local-env.sh" ]] && source "$KB/scripts/local-env.sh"

# mkdir 原子鎖（macOS 無 flock），上一輪還沒跑完就直接退出
mkdir "$LOCK" 2>/dev/null || exit 0
trap 'rmdir "$LOCK"' EXIT

cd "$KB" || exit 1

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

db_psql() {
  docker exec -i "$DB_CONTAINER" psql -X -v ON_ERROR_STOP=1 \
    -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
}

db_query() {
  local sql="$1"
  shift
  print -r -- "$sql" | db_psql -Atq "$@"
}

if ! print -r -- 'SELECT 1' | db_psql >/dev/null 2>&1; then
  echo "$(date '+%F %T') Postgres unavailable: $DB_CONTAINER"
  notify "❌ knowledge-garden 收錄資料庫連線失敗，本輪未處理 inbox"
  exit 0
fi

git pull --rebase --quiet || { echo "$(date '+%F %T') git pull failed"; exit 1; }

for f in $items; do
  id="${${f:t}%.json}"
  if ! print -r -- "INSERT INTO capture_jobs (id) VALUES (:'job_id') ON CONFLICT (id) DO NOTHING;" | \
      db_psql -v job_id="$id" >/dev/null; then
    echo "$(date '+%F %T') failed to register capture job: $id"
    notify "❌ knowledge-garden 收錄資料庫寫入失敗，本輪未處理 inbox"
    exit 0
  fi
done

new_notes=()
updated_notes=()

job_ids=("${(@f)$(db_query "SELECT id FROM capture_jobs WHERE status = 'pending' AND attempts < $MAX_FAILS ORDER BY created_at, id")}")
for id in $job_ids; do
  [[ -n "$id" && -f "inbox/$id.json" ]] || continue

  echo "$(date '+%F %T') processing $id"
  if claude_output=$(claude -p "/capture inbox/$id" \
      --permission-mode acceptEdits \
      --allowedTools "Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,Bash(date:*)" 2>&1); then
    [[ -n "$claude_output" ]] && print -r -- "$claude_output"
    # rm 而非 git rm：小柳三世寫的 oc-* 檔未被 git 追蹤，git rm 不會刪它們
    rm -f "inbox/$id.json" "inbox/$id.jpg"
    git add -A -- content/
    before_commit=$(git rev-parse HEAD)
    git commit -qm "capture: $id" -- content/ || true   # claude 沒改東西也不算錯
    after_commit=$(git rev-parse HEAD)
    commit_notes=()
    if [[ "$after_commit" != "$before_commit" ]]; then
      while IFS= read -r note; do
        if [[ -n "$note" ]]; then
          new_notes+=("$note")
          commit_notes+=("$note")
        fi
      done < <(git show --name-only --format= --diff-filter=A "$after_commit" -- content/notes/)
      while IFS= read -r note; do
        if [[ -n "$note" ]]; then
          updated_notes+=("$note")
          commit_notes+=("$note")
        fi
      done < <(git show --name-only --format= --diff-filter=M "$after_commit" -- content/notes/)
    fi

    if (( ${#commit_notes[@]} > 0 )); then
      note_paths_json=$(printf '%s\n' "${commit_notes[@]}" | jq -Rsc 'split("\n")[:-1]')
    else
      note_paths_json='[]'
    fi
    commit_sha=''
    [[ "$after_commit" != "$before_commit" ]] && commit_sha="$after_commit"
    print -r -- "UPDATE capture_jobs
       SET status = 'done', commit_sha = NULLIF(:'job_commit', ''),
           note_paths = ARRAY(SELECT jsonb_array_elements_text((:'note_paths_json')::jsonb)),
           last_error = NULL, updated_at = now()
       WHERE id = :'job_id';" | \
      db_psql -v job_id="$id" -v job_commit="$commit_sha" -v note_paths_json="$note_paths_json" \
      >/dev/null
  else
    [[ -n "$claude_output" ]] && print -r -- "$claude_output"
    last_error="${claude_output[-4000,-1]}"
    attempts=$(db_query "UPDATE capture_jobs
       SET attempts = attempts + 1,
           status = CASE WHEN attempts + 1 >= $MAX_FAILS THEN 'failed' ELSE 'pending' END,
           last_error = right(:'job_error', 4000), updated_at = now()
       WHERE id = :'job_id'
       RETURNING attempts;" -v job_id="$id" -v job_error="$last_error")
    (( attempts >= MAX_FAILS )) && notify "❌ 收錄失敗（已重試 $MAX_FAILS 次，不再重試）：$id"
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
