# Electron

## 何时使用

改主进程、IPC、SSH/SFTP/终端、CLI、MCP、插件宿主。

## 本地模式

- 入口 `electron/main.cjs`：先装 crash / process error guard，再挂 bridge。
- 一个能力一个 `electron/bridges/<name>Bridge.cjs`，用 `ipcMain` 暴露。测试文件紧挨着：`*.test.cjs`。
- 渲染进程只通过 `window.electron`（`electron/preload.cjs` + `preload/api.cjs`）调用主进程。
- 能力目录：`electron/capabilities/catalog/` + `electron/capabilities/codegen/toolSurfaces.cjs`。改 catalog 后跑 `npm run generate:capability-tools`。
- 内部 CLI `electron/cli/netcatty-tool-cli.cjs` 与 MCP `electron/mcp/netcatty-mcp-server.cjs` 是内部集成面，默认不当公共 API 扩展。
- 插件宿主 `electron/plugins/` 仅在 `NETCATTY_PLUGIN_DEV=1` 时启用。公共线协议只来自 `packages/plugin-contract/schema/`。
- 插件安装/启停必须走 `PluginManager`。RPC 相关走 `PluginRpcRouter`，运行时身份由宿主分配。
- SFTP 写/传输、`portforward_start`、`host_notes_set` 在 confirm 模式要审批；observer 模式禁止写。

参考：

- `electron/main.cjs`
- `electron/bridges/`
- `AGENTS.md` Capability exposure / Plugin host runtime

## 反模式

- 在组件里直接 `ipcRenderer.invoke`。
- 给插件再发明一套私有 RPC shape。
- 绕过 `PluginManager` 从 renderer IPC 改插件状态。
- 把 vault 密码或 privateKey 返回给 AI / MCP。
