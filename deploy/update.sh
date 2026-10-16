#!/bin/zsh
# 由 mini-deploy 拿著收錄鎖、切好 commit 之後呼叫。
# 這個專案沒有常駐服務要重啟；套件安裝和建站由下一輪收錄（scripts/process-inbox.sh）做。
print -r -- "程式碼已更新；下一輪收錄會建站並佈署。"
