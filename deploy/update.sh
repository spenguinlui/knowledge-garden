#!/bin/zsh
# 由 mini-deploy 拿著收錄鎖、切好 commit 之後呼叫。
# 重啟常駐的網站服務（com.liu.kb-web）換成新程式碼；服務還沒裝在這台機器上時 launchctl 會失敗，不算部署失敗。
# 套件安裝和建站由下一輪收錄（scripts/process-inbox.sh）做。
launchctl kickstart -k "gui/${UID}/com.liu.kb-web" >/dev/null 2>&1 || true
print -r -- "程式碼已更新、網站服務已重啟；下一輪收錄會建站。"
