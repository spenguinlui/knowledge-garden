#!/bin/zsh
# pull-notes.sh — 筆電預覽用：把 mini 最近一次匯出的文章（content/notes/）整個同步到筆電，mini 沒有的檔案刪掉。
# 文章正本在 mini 的資料庫，content/notes/ 不進 git；拉完就能 npx quartz build --serve --port 41160 預覽。
# 這裡只複製檔案，不連資料庫；筆電改了 content/notes/ 也不會回寫。
set -euo pipefail

cd "${0:A:h}/.."
# 文章不進 git 的規則寫在這台機器的 .git/info/exclude，不能寫進 .gitignore：Quartz 建站會跳過 .gitignore 列到的檔案。
# 沒有就補上（前面多一個換行，原檔最後一行沒換行也不會黏在一起），有就不動
grep -qxF 'content/notes/' .git/info/exclude 2>/dev/null || print -r -- $'\ncontent/notes/' >> .git/info/exclude
rsync -a --delete liumac-mini:knowledge-garden/content/notes/ content/notes/
