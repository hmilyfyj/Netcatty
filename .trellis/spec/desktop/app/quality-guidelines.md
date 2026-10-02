# Quality

## 命令

```bash
npm run lint
npm run lint:fix
npm test
node --test --import tsx path/to/file.test.ts
npm run build
```

单测用 Node 内置 test runner + `tsx`，测试文件与源码同目录：`*.test.ts` / `*.test.tsx` / `*.test.cjs`。

## 规则

- 领域函数和 hook 优先补单测。参考 `domain/host.ts`、`application/state/useVaultState.ts` 旁的测试。
- 改 storage key / schema 必须有迁移或兼容读，并补测试。
- 改 capability catalog 后验证 generated JSON 无 drift。
- 改 Codex App Server 协议后：`npm run generate:codex-app-server-schema` 与 `npm run check:codex-app-server-schema`。
- 插件运行时：`npm run test:plugin-runtime`；真实窗口冒烟：`npm run test:plugin-runtime:electron`。
- 渲染进程保持 ASCII，除非已有文件本身需要非 ASCII。
- 给上游 GitHub 开 issue 必须带 `[Bug]` / `[Feature]` / `[Other]` 前缀，并填 `.github/ISSUE_TEMPLATE/`。
- 本机 npm 若设置 `ignore-scripts=true`，依赖虽安装成功但 patch-package、Electron 与 native rebuild 未执行。新 checkout 使用 `npm ci --ignore-scripts=false`，确认 postinstall 日志后再测试/打包；不要修改用户全局 npm 配置。

## 本仓 MR

本地 fork 的 Multica 任务 MR 目标是 `origin/main`。不要推 `upstream`（`binaricat/Netcatty`）。
