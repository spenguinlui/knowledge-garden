#!/bin/zsh
# backup-db.sh — Mac mini 上由 launchd 每天 04:30 跑一次的外殼：
# 用容器裡的 pg_dump 匯出整個資料庫、保留今天加前 6 天、任何一步失敗就發一則 LINE 告警。
# 輸出只寫到畫面，由 com.liu.kb-backup.plist 導進 ~/Library/Logs/kb-backup.log。
#
# 主體包在 { } 裡：收錄程式每 5 分鐘 pull 一次，可能在這支檔案跑到一半時改寫它，zsh 邊讀邊跑，不包起來會讀到改過的內容。
{
  set -uo pipefail

  KB="${KB_DIR:-$HOME/knowledge-garden}"
  BACKUPS="${BACKUP_DIR:-$HOME/backups/knowledge_garden}"
  CONTAINER="${DB_CONTAINER:-knowledge-garden-db}"
  TARGET="$BACKUPS/knowledge_garden-$(date '+%Y-%m-%d').dump"

  # launchd 的 PATH 很短；Homebrew 在 Intel 與 Apple Silicon 的常見位置都補上。
  export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"

  # LINE 告警用，同 process-inbox.sh，放 scripts/local-env.sh（gitignored）
  [[ -f "$KB/scripts/local-env.sh" ]] && source "$KB/scripts/local-env.sh"

  failed() { # 清掉半成品、發 LINE、以非 0 結束；舊備份一份都不刪
    echo "$(date '+%F %T') backup failed"
    rm -f "$TARGET.partial"
    if [[ -n "${LINE_CHANNEL_ACCESS_TOKEN:-}" && -n "${LINE_USER_ID:-}" ]]; then
      curl -s -o /dev/null -X POST https://api.line.me/v2/bot/message/push \
        -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" \
        -H 'Content-Type: application/json' \
        -d "{\"to\":\"$LINE_USER_ID\",\"messages\":[{\"type\":\"text\",\"text\":\"❌ knowledge-garden 每日備份失敗，詳見 mini 的 ~/Library/Logs/kb-backup.log\"}]}"
    fi
    exit 1
  }

  echo "=== $(date '+%F %T') backup to $TARGET"
  mkdir -p "$BACKUPS" || failed
  # DB_NAME 沒設就用容器的 POSTGRES_DB
  docker exec -e DB_NAME="${DB_NAME:-}" "$CONTAINER" \
    sh -c 'pg_dump -U "$POSTGRES_USER" -d "${DB_NAME:-$POSTGRES_DB}" --format=custom' > "$TARGET.partial" || failed
  mv "$TARGET.partial" "$TARGET" || failed
  find "$BACKUPS" -name 'knowledge_garden-*.dump' -mtime +6 -print -delete || failed
  echo "done: $(ls -lh "$TARGET" | awk '{print $5}')"
}
