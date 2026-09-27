#!/bin/zsh
# pull-notes.sh — 筆電預覽用：把 mini 最近一次匯出的文章（content/notes/）整個同步到筆電，mini 沒有的檔案刪掉。
# 文章正本在 mini 的資料庫，content/notes/ 不進 git；拉完就能 npx quartz build --serve --port 41160 預覽。
# 這裡只複製檔案，不連資料庫；筆電改了 content/notes/ 也不會回寫。
set -euo pipefail

cd "${0:A:h}/.."
rsync -a --delete liumac-mini:knowledge-garden/content/notes/ content/notes/
