#!/bin/zsh
set -u

PROJECT_ROOT="${0:A:h:h}"
PROCESS_INBOX="$PROJECT_ROOT/scripts/process-inbox.sh"
TEST_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/process-inbox-test.XXXXXX")
typeset -i PASSED=0
typeset -i FAILED=0

cleanup() {
  if [[ "${KEEP_TEST_ROOT:-0}" == 1 ]]; then
    print -r -- "保留測試資料：$TEST_ROOT"
  else
    rm -rf "$TEST_ROOT"
  fi
}
trap cleanup EXIT

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

setup_case() {
  local name="$1"
  CASE_ROOT="$TEST_ROOT/$name"
  REPO="$CASE_ROOT/repo"
  REMOTE="$CASE_ROOT/remote.git"
  FAKE_BIN="$CASE_ROOT/bin"
  LINE_LOG="$CASE_ROOT/line.log"
  HTTP_LOG="$CASE_ROOT/http.log"
  SLEEP_LOG="$CASE_ROOT/sleep.log"

  mkdir -p "$REPO/scripts" "$REPO/inbox" "$REPO/content/notes" "$FAKE_BIN"
  : > "$LINE_LOG"
  : > "$HTTP_LOG"
  : > "$SLEEP_LOG"
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
  print -r -- '{}' > "$REPO/inbox/item.json"
  PATH="$FAKE_BIN:$PATH" \
    KB_DIR="$REPO" \
    LINE_CHANNEL_ACCESS_TOKEN="test-token" \
    LINE_USER_ID="test-user" \
    LINE_LOG="$LINE_LOG" \
    HTTP_LOG="$HTTP_LOG" \
    SLEEP_LOG="$SLEEP_LOG" \
    TEST_SCENARIO="$scenario" \
    DEPLOY_POLL_INTERVAL_SECONDS=1 \
    DEPLOY_WAIT_TIMEOUT_SECONDS=2 \
    "$REPO/scripts/process-inbox.sh" > "$CASE_ROOT/process.log" 2>&1
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
  (( FAILED == before )) && pass 'claude 沒改到任何東西'
}

test_new_note
test_updated_note
test_new_and_updated_notes
test_deploy_timeout
test_push_failure
test_no_commit

print -r -- ""
print -r -- "結果：$PASSED 通過，$FAILED 失敗"
(( FAILED == 0 ))
