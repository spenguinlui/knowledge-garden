#!/bin/zsh
# process-inbox.sh — Mac mini 上由 launchd 每 60 秒跑一輪的外殼：
# 上鎖、確保根目錄與 kg/ 的套件裝好、執行 kg/src/main.ts、程式異常結束時發一次 LINE 告警。
# 一輪做的事（pull → 收錄 inbox → 建站、佈署、更新搜尋索引 → 發 LINE）全在 kg/src/。
# 檔名沿用 process-inbox.sh、launchd 名稱沿用 com.liu.kb-inbox，改名要多動 mini 的 launchd，沒有好處。
#
# 主體包在 { } 裡：程式會 pull 改寫這支檔案，zsh 邊讀邊跑，不包起來會讀到改過的內容。
{
  set -uo pipefail

  KB="${KB_DIR:-$HOME/knowledge-garden}"
  LOCK="/tmp/kb-inbox.lock"
  CRASHED="/tmp/kb-inbox.crashed"

  # launchd 的 PATH 很短；Homebrew 在 Intel 與 Apple Silicon 的常見位置都補上。
  # kg/node_modules/.bin 放最前面：佈署用的 wrangler 裝在 kg/，程式用名稱呼叫它。
  export PATH="$KB/kg/node_modules/.bin:$PATH:/usr/local/bin:/opt/homebrew/bin"

  # 放 scripts/local-env.sh（gitignored），每行 export，子程序才拿得到：
  #   export LINE_CHANNEL_ACCESS_TOKEN=...   # LINE 通知
  #   export LINE_USER_ID=...
  #   export CLOUDFLARE_API_TOKEN=...        # 佈署到 Cloudflare Pages、更新 Vectorize 索引
  #   export CLOUDFLARE_ACCOUNT_ID=...
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

  # 根目錄是建站用的 Quartz（要含 devDependencies，建站會用到 esbuild）；kg/ 只要正式依賴
  if [[ ! -d node_modules || package-lock.json -nt node_modules/.package-lock.json ]]; then
    npm ci || { crashed $?; exit 1; }
  fi
  if [[ ! -d kg/node_modules || kg/package-lock.json -nt kg/node_modules/.package-lock.json ]]; then
    (cd kg && npm ci --omit=dev) || { crashed $?; exit 1; }
  fi

  node kg/src/main.ts
  code=$?
  if (( code == 0 )); then
    rm -f "$CRASHED"
  else
    crashed $code
  fi
  exit $code
}
