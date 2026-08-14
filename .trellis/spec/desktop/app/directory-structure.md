# 目录结构

## 入口

- 渲染进程入口：`index.tsx`、`App.tsx`
- 领域：`domain/`（`models.ts` 再导出 `domain/models/*`）
- 应用状态：`application/state/`
- 基础设施：`infrastructure/{config,persistence,services,ai}`
- UI：`components/`，侧栏设计系统 `components/ui/aside-panel.tsx`
- 主进程：`electron/main.cjs`、`electron/bridges/`、`electron/preload.cjs`
- 能力目录：`electron/capabilities/catalog/`
- 内部 CLI：`electron/cli/netcatty-tool-cli.cjs`
- 插件宿主：`electron/plugins/`
- 插件包：`packages/plugin-{contract,sdk,cli}`
- 路径别名：`@/` = 仓库根（`tsconfig.json`、`vite.config.ts`）

## 规则

- 新纯逻辑放 `domain/`，文件旁写 `*.test.ts`。
- 新状态放 `application/state/useXxxState.ts`，不要在组件里自己持久化。
- 新 IPC 能力新建 `electron/bridges/<name>Bridge.cjs`，由 `electron/main/` / `registerBridges` 挂上，preload 再暴露。
- 渲染进程 TypeScript/ESM；主进程、bridges、CLI 用 CommonJS `.cjs`。
- `packages/*` 只放插件契约与工具，不把桌面 UI 搬进去。

## 反模式

- 在 `components/` 里写 Host 规范化或 workspace 树算法。
- 在 renderer 里 `require('fs')` 或直接 `ipcRenderer`。
- 新增根目录文件却不改 `.gitignore` Layer 2 allowlist。
