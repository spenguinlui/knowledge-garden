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
      name: "no-upstream",
      comment: "src/ 與 quartz-plugins/ 不准 import quartz/（upstream 的碼，在 kg/ 的上一層）。",
      severity: "error",
      from: { path: "^(src|quartz-plugins)/" },
      to: { path: "^(\\.\\./)*quartz/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
  },
};
