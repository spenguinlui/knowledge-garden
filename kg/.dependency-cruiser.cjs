/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      comment: "禁止循環依賴。",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "feature-entrance-only",
      comment: "src/<模組>/ 只准 import 別的模組的 index.ts。",
      severity: "error",
      from: { path: "^src/([^/]+)/" },
      to: { path: "^src/(?!$1/)[^/]+/(?!index\\.ts$)" },
    },
    {
      name: "shared-no-feature",
      comment: "src/shared/ 不准 import 任何其他 src/<模組>/。",
      severity: "error",
      from: { path: "^src/shared/" },
      to: { path: "^src/(?!shared/)[^/]+/" },
    },
    {
      name: "capture-publish-apart",
      comment: "capture 與 publish 互不 import；兩邊要用的東西由程式入口 src/main.ts 傳進去。",
      severity: "error",
      from: { path: "^src/(capture|publish)/" },
      to: { path: "^src/(?!$1/)(capture|publish)/" },
    },
    {
      name: "no-upstream",
      comment: "src/ 與 quartz-plugins/ 不准 import quartz/（upstream 的碼，在 kg/ 的上一層）。",
      severity: "error",
      from: { path: "^(src|quartz-plugins)/" },
      to: { path: "^(\\.\\./)*quartz/" },
    },
    {
      name: "notes-pure",
      comment:
        "src/notes/ 整個是純計算，不准 import 檔案、行程、網路、資料庫這類 I/O 模組。" +
        "切換到資料庫時純計算收進子資料夾，這條規則跟著縮小範圍。",
      severity: "error",
      from: { path: "^src/notes/" },
      to: {
        path: "^(fs|child_process|net|http|https|http2|dgram|dns|tls|worker_threads|readline)(/|$)|(^|/)node_modules/pg/",
      },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
  },
};
