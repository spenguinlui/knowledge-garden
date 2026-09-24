#!/bin/zsh
set -u

PROJECT_ROOT="${0:A:h:h}"
PROCESS_INBOX="$PROJECT_ROOT/scripts/process-inbox.sh"
TEST_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/process-inbox-test.XXXXXX")
DB_CONTAINER="knowledge-garden-db"
DB_USER="knowledge_garden"
TEST_DB="knowledge_garden_test_${$}_${RANDOM}"
typeset -i PASSED=0
typeset -i FAILED=0
typeset -i DB_READY=0

cleanup() {
  if (( DB_READY )); then
    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 \
      -c "DROP DATABASE IF EXISTS \"$TEST_DB\" WITH (FORCE)" >/dev/null 2>&1 || true
  fi
  if [[ "${KEEP_TEST_ROOT:-0}" == 1 ]]; then
    print -r -- "保留測試資料：$TEST_ROOT"
  else
    rm -rf "$TEST_ROOT"
  fi
}
trap cleanup EXIT

setup_database() {
  if ! POSTGRES_PASSWORD='process-inbox-test-password' \
      docker compose -f "$PROJECT_ROOT/compose.yaml" up -d >/dev/null 2>&1; then
    fail '測試資料庫啟動' 'docker compose up -d 失敗'
    return 1
  fi
  local ready=false
  for _ in {1..30}; do
    if docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d postgres >/dev/null 2>&1; then
      ready=true
      break
    fi
    sleep 1
  done
  if [[ "$ready" != true ]]; then
    fail '等待測試資料庫' '30 秒內沒有 ready'
    return 1
  fi
  if ! docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 \
      -c "CREATE DATABASE \"$TEST_DB\"" >/dev/null 2>&1; then
    fail '建立獨立測試 database' "$TEST_DB"
    return 1
  fi
  DB_READY=1
  if ! docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$TEST_DB" -v ON_ERROR_STOP=1 \
      < "$PROJECT_ROOT/db/schema.sql" >/dev/null 2>&1; then
    fail '套用測試 schema' 'db/schema.sql 執行失敗'
    return 1
  fi
}

db_query() {
  docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$TEST_DB" -Atqc "$1"
}

fail() {
  print -r -- "not ok - $1"
  [[ -n "${2:-}" ]] && print -r -- "  $2"
  FAILED+=1
}

pass() {
  print -r -- "ok - $1"
  PASSED+=1
}

assert_contains() {
  local file="$1" needle="$2" label="$3"
  if grep -Fq -- "$needle" "$file"; then
    return 0
  fi
  fail "$label" "找不到：$needle"
  return 1
}

assert_not_contains() {
  local file="$1" needle="$2" label="$3"
  if grep -Fq -- "$needle" "$file"; then
    fail "$label" "不應出現：$needle"
    return 1
  fi
  return 0
}

assert_equals() {
  local expected="$1" actual="$2" label="$3"
  if [[ "$actual" == "$expected" ]]; then
    return 0
  fi
  fail "$label" "預期：$expected；實際：$actual"
  return 1
}

setup_case() {
  local name="$1"
  CASE_ROOT="$TEST_ROOT/$name"
  REPO="$CASE_ROOT/repo"
  REMOTE="$CASE_ROOT/remote.git"
  FAKE_BIN="$CASE_ROOT/bin"
  LINE_LOG="$CASE_ROOT/line.log"
  HTTP_LOG="$CASE_ROOT/http.log"
  SLEEP_LOG="$CASE_ROOT/sleep.log"
  CLAUDE_LOG="$CASE_ROOT/claude.log"

  mkdir -p "$REPO/scripts" "$REPO/inbox" "$REPO/content/notes" "$FAKE_BIN"
  : > "$LINE_LOG"
  : > "$HTTP_LOG"
  : > "$SLEEP_LOG"
  : > "$CLAUDE_LOG"
  cp "$PROCESS_INBOX" "$REPO/scripts/process-inbox.sh"
  touch "$REPO/inbox/.gitkeep"

  git init --bare -q "$REMOTE"
  git -C "$REPO" init -q -b v5
  git -C "$REPO" config user.name "Process Inbox Test"
  git -C "$REPO" config user.email "process-inbox-test@example.com"
  git -C "$REPO" remote add origin "$REMOTE"
  git -C "$REPO" add scripts/process-inbox.sh inbox/.gitkeep
  git -C "$REPO" commit -qm "test fixture"
  git -C "$REPO" push -qu origin v5
  git -C "$REPO" branch --set-upstream-to=origin/v5 v5 >/dev/null

  cat > "$FAKE_BIN/claude" <<'FAKE_CLAUDE'
#!/bin/zsh
print -r -- "$TEST_SCENARIO" >> "$CLAUDE_LOG"
case "$TEST_SCENARIO" in
  new)
    print -r -- '# new note' > content/notes/new-note.md
    ;;
  update)
    print -r -- 'updated' >> content/notes/existing-note.md
    ;;
  both)
    print -r -- '# new note' > content/notes/new-note.md
    print -r -- 'updated' >> content/notes/existing-note.md
    ;;
  timeout)
    print -r -- '# slow note' > content/notes/slow-note.md
    ;;
  push-fail)
    print -r -- '# push fail note' > content/notes/push-fail-note.md
    ;;
  no-change)
    ;;
  fail)
    print -r -- "${(l:4100::x:)}TAIL_ERROR" >&2
    exit 1
    ;;
  retry-once)
    if [[ $(wc -l < "$CLAUDE_LOG") -eq 1 ]]; then
      print -r -- 'first attempt failed' >&2
      exit 1
    fi
    print -r -- '# retried note' > content/notes/retried-note.md
    ;;
esac
FAKE_CLAUDE

  cat > "$FAKE_BIN/curl" <<'FAKE_CURL'
#!/bin/zsh
typeset data="" url=""
while (( $# > 0 )); do
  case "$1" in
    -d)
      shift
      data="${1:-}"
      ;;
    http*)
      url="$1"
      ;;
  esac
  shift
done

if [[ "$url" == "https://api.line.me/v2/bot/message/push" ]]; then
  print -r -- "$data" >> "$LINE_LOG"
  exit 0
fi

print -r -- "$url" >> "$HTTP_LOG"
if [[ "$TEST_SCENARIO" == timeout ]]; then
  print -n -- 404
else
  print -n -- 200
fi
FAKE_CURL

  cat > "$FAKE_BIN/sleep" <<'FAKE_SLEEP'
#!/bin/zsh
print -r -- "${1:-}" >> "$SLEEP_LOG"
FAKE_SLEEP

  chmod +x "$FAKE_BIN/claude" "$FAKE_BIN/curl" "$FAKE_BIN/sleep"

  db_query 'TRUNCATE capture_jobs' >/dev/null
}

seed_existing_note() {
  print -r -- '# existing note' > "$REPO/content/notes/existing-note.md"
  git -C "$REPO" add content/notes/existing-note.md
  git -C "$REPO" commit -qm "seed existing note"
  git -C "$REPO" push -q
}

reject_pushes() {
  cat > "$REMOTE/hooks/pre-receive" <<'REJECT_PUSH'
#!/bin/sh
exit 1
REJECT_PUSH
  chmod +x "$REMOTE/hooks/pre-receive"
}

run_pipeline() {
  local scenario="$1"
  local db_container="${2:-$DB_CONTAINER}"
  local seed_inbox="${3:-yes}"
  if [[ "$seed_inbox" == yes && ! -f "$REPO/inbox/item.json" ]]; then
    print -r -- '{}' > "$REPO/inbox/item.json"
  fi
  PATH="$FAKE_BIN:$PATH" \
    KB_DIR="$REPO" \
    LINE_CHANNEL_ACCESS_TOKEN="test-token" \
    LINE_USER_ID="test-user" \
    LINE_LOG="$LINE_LOG" \
    HTTP_LOG="$HTTP_LOG" \
    SLEEP_LOG="$SLEEP_LOG" \
    CLAUDE_LOG="$CLAUDE_LOG" \
    TEST_SCENARIO="$scenario" \
    POSTGRES_USER="$DB_USER" \
    POSTGRES_DB="$TEST_DB" \
    DB_CONTAINER="$db_container" \
    DEPLOY_POLL_INTERVAL_SECONDS=1 \
    DEPLOY_WAIT_TIMEOUT_SECONDS=2 \
    "$REPO/scripts/process-inbox.sh" >> "$CASE_ROOT/process.log" 2>&1
}

test_new_note() {
  setup_case new
  run_pipeline new
  local before=$FAILED
  assert_contains "$LINE_LOG" '新增：' '新增一篇：訊息有「新增」組'
  assert_contains "$LINE_LOG" 'https://knowledge.wayne-liu.com/notes/new-note' '新增一篇：訊息有正確網址'
  assert_not_contains "$LINE_LOG" '更新：' '新增一篇：不應有「更新」組'
  (( FAILED == before )) && pass '新增一篇筆記'
}

test_updated_note() {
  setup_case update
  seed_existing_note
  run_pipeline update
  local before=$FAILED
  assert_contains "$LINE_LOG" '更新：' '更新一篇：訊息有「更新」組'
  assert_contains "$LINE_LOG" 'https://knowledge.wayne-liu.com/notes/existing-note' '更新一篇：訊息有正確網址'
  assert_not_contains "$LINE_LOG" '新增：' '更新一篇：不應有「新增」組'
  (( FAILED == before )) && pass '更新既有筆記'
}

test_new_and_updated_notes() {
  setup_case both
  seed_existing_note
  run_pipeline both
  local before=$FAILED
  assert_contains "$LINE_LOG" '新增：' '新增加更新：訊息有「新增」組'
  assert_contains "$LINE_LOG" 'https://knowledge.wayne-liu.com/notes/new-note' '新增加更新：新增網址正確'
  assert_contains "$LINE_LOG" '更新：' '新增加更新：訊息有「更新」組'
  assert_contains "$LINE_LOG" 'https://knowledge.wayne-liu.com/notes/existing-note' '新增加更新：更新網址正確'
  assert_contains "$LINE_LOG" '新增：\nhttps://knowledge.wayne-liu.com/notes/new-note\n\n更新：\nhttps://knowledge.wayne-liu.com/notes/existing-note' '新增加更新：網址分在正確組別'
  assert_equals 'content/notes/existing-note.md,content/notes/new-note.md' \
    "$(db_query "SELECT array_to_string(ARRAY(SELECT unnest(note_paths) ORDER BY 1), ',') FROM capture_jobs WHERE id = 'item'")" \
    '新增加更新：note_paths 記下全部筆記'
  (( FAILED == before )) && pass '一輪同時有新增與更新'
}

test_deploy_timeout() {
  setup_case timeout
  run_pipeline timeout
  local before=$FAILED
  assert_contains "$LINE_LOG" '還在建' '一直 404：訊息說明站台還在建'
  assert_contains "$LINE_LOG" 'https://knowledge.wayne-liu.com/notes/slow-note' '一直 404：訊息仍附網址'
  assert_contains "$HTTP_LOG" 'https://knowledge.wayne-liu.com/notes/slow-note' '一直 404：確實輪詢筆記網址'
  assert_contains "$SLEEP_LOG" '1' '一直 404：使用可覆寫的等待秒數'
  (( FAILED == before )) && pass '網址一直回 404'
}

test_push_failure() {
  setup_case push-fail
  reject_pushes
  run_pipeline push-fail
  local before=$FAILED
  assert_contains "$LINE_LOG" '❌ knowledge-garden push 失敗，筆記卡在 mini 本機' 'push 失敗：保留既有告警'
  assert_not_contains "$LINE_LOG" '已上花園' 'push 失敗：不發成功通知'
  assert_not_contains "$LINE_LOG" '還在建' 'push 失敗：不發超時通知'
  (( FAILED == before )) && pass 'git push 失敗'
}

test_no_commit() {
  setup_case no-change
  run_pipeline no-change
  local before=$FAILED
  if [[ -s "$LINE_LOG" ]]; then
    fail 'claude 沒改東西：不應發 LINE 訊息' "實際內容：$(<"$LINE_LOG")"
  fi
  if [[ -s "$HTTP_LOG" ]]; then
    fail 'claude 沒改東西：不應輪詢網址' "實際內容：$(<"$HTTP_LOG")"
  fi
  assert_equals 'done|0|0' \
    "$(db_query "SELECT status || '|' || cardinality(note_paths) || '|' || (commit_sha IS NOT NULL)::int FROM capture_jobs WHERE id = 'item'")" \
    'claude 沒改東西：任務完成但沒有筆記路徑或 commit SHA'
  (( FAILED == before )) && pass 'claude 沒改到任何東西'
}

test_db_success() {
  setup_case db-success
  run_pipeline new
  local before=$FAILED
  local head_sha=$(git -C "$REPO" rev-parse HEAD)
  local job=$(db_query "SELECT status || '|' || attempts || '|' || coalesce(commit_sha, '') || '|' || array_to_string(note_paths, ',') FROM capture_jobs WHERE id = 'item'")
  assert_equals "done|0|$head_sha|content/notes/new-note.md" "$job" '收錄成功：任務資料完整'
  assert_equals 'content/notes/new-note.md' "$(git -C "$REPO" show --name-only --format= HEAD | sed '/^$/d')" '收錄成功：commit 只包含 content/'
  if [[ -e "$REPO/inbox/item.json" ]]; then
    fail '收錄成功：inbox 檔案已刪除' "$REPO/inbox/item.json 仍存在"
  fi
  (( FAILED == before )) && pass '7 收錄成功寫入任務狀態'
}

test_one_failure() {
  setup_case one-failure
  local commits_before=$(git -C "$REPO" rev-list --count HEAD)
  run_pipeline fail
  local before=$FAILED
  local commits_after=$(git -C "$REPO" rev-list --count HEAD)
  local job=$(db_query "SELECT status || '|' || attempts || '|' || right(last_error, 10) || '|' || length(last_error) FROM capture_jobs WHERE id = 'item'")
  assert_equals 'pending|1|TAIL_ERROR|4000' "$job" '失敗一次：次數與錯誤尾段有存'
  assert_equals "$commits_before" "$commits_after" '失敗一次：git commit 數不變'
  if [[ ! -e "$REPO/inbox/item.json" ]]; then
    fail '失敗一次：inbox 檔案保留' 'item.json 不見了'
  fi
  (( FAILED == before )) && pass '8 claude 失敗一次不 commit'
}

test_three_failures() {
  setup_case three-failures
  run_pipeline fail
  run_pipeline fail
  run_pipeline fail
  run_pipeline fail
  local before=$FAILED
  assert_equals 'failed|3' "$(db_query "SELECT status || '|' || attempts FROM capture_jobs WHERE id = 'item'")" '連續失敗：第三次後停止'
  assert_contains "$LINE_LOG" '❌ 收錄失敗（已重試 3 次，不再重試）：item' '連續失敗：保留既有告警文案'
  assert_equals '3' "$(wc -l < "$CLAUDE_LOG" | tr -d ' ')" '連續失敗：第四輪不呼叫 claude'
  (( FAILED == before )) && pass '9 連續失敗三輪後停止'
}

test_retry_has_one_job() {
  setup_case retry-one-job
  run_pipeline retry-once
  run_pipeline retry-once
  local before=$FAILED
  assert_equals '1' "$(db_query "SELECT count(*) FROM capture_jobs WHERE id = 'item'")" '重跑：任務表只有一列'
  assert_equals 'done|1|content/notes/retried-note.md' "$(db_query "SELECT status || '|' || attempts || '|' || array_to_string(note_paths, ',') FROM capture_jobs WHERE id = 'item'")" '重跑：第二輪成功完成同一任務'
  (( FAILED == before )) && pass '10 同一 inbox 重跑不重複登記'
}

test_db_unavailable() {
  setup_case db-unavailable
  local commits_before=$(git -C "$REPO" rev-list --count HEAD)
  run_pipeline new 'knowledge-garden-db-does-not-exist'
  local before=$FAILED
  if [[ ! -s "$LINE_LOG" ]]; then
    fail 'DB 連不上：發 LINE 告警' 'LINE log 是空的'
  fi
  if [[ ! -e "$REPO/inbox/item.json" ]]; then
    fail 'DB 連不上：inbox 原封不動' 'item.json 不見了'
  fi
  assert_equals "$commits_before" "$(git -C "$REPO" rev-list --count HEAD)" 'DB 連不上：沒有 commit'
  assert_equals '0' "$(wc -l < "$CLAUDE_LOG" | tr -d ' ')" 'DB 連不上：不呼叫 claude'

  setup_case db-unavailable-empty
  run_pipeline new 'knowledge-garden-db-does-not-exist' no
  if [[ -s "$LINE_LOG" ]]; then
    fail 'DB 連不上但 inbox 為空：不發 LINE 告警' "實際內容：$(<"$LINE_LOG")"
  fi
  (( FAILED == before )) && pass '11 DB 連不上安全結束'
}

test_repo_state() {
  local before=$FAILED
  local tracked=$(git -C "$PROJECT_ROOT" ls-files inbox/)
  assert_equals '' "$tracked" 'repo 狀態：inbox/ 沒有追蹤檔案'
  assert_contains "$PROJECT_ROOT/.gitignore" 'inbox/' 'repo 狀態：.gitignore 忽略 inbox/'
  (( FAILED == before )) && pass '12 inbox 退出 git'
}

if setup_database; then
  test_new_note
  test_updated_note
  test_new_and_updated_notes
  test_deploy_timeout
  test_push_failure
  test_no_commit
  test_db_success
  test_one_failure
  test_three_failures
  test_retry_has_one_job
  test_db_unavailable
fi
test_repo_state

print -r -- ""
print -r -- "結果：$PASSED 通過，$FAILED 失敗"
(( FAILED == 0 ))
