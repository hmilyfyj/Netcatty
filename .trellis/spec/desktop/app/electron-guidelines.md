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

## CLI 宿主绑定会话

### 1. 范围 / 触发

同步 CLI 实现与 `skills/netcatty-tool-cli/` 文档、validator；这是内部宿主集成，不扩展第三方手动启动契约。

### 2. 签名

`netcatty-tool-cli exec --session <id> --json -- "<shell-ready command>"`；`env` / `session` / `job-start` / `job-poll` / `job-stop` / `sftp <op>` 的会话绑定均由宿主注入。

### 3. 契约

宿主提供 `NETCATTY_TOOL_CLI_DISCOVERY_FILE` 和 `NETCATTY_CLI_CHAT_SESSION_ID`。session-backed 命令还需 `--session`，job 操作需 `--job`。不存在 `--chat-session` 参数；文档必须跟随 CLI 当前签名。`exec` 的 `--` 后只有一个保留内部 shell quoting 的字符串。

### 4. 校验 / 错误矩阵

缺少绑定 chat session → `requireChatSession` 拒绝并提示环境变量；缺少 session/job 参数 → 对应命令拒绝；SFTP 只接受已连接 SSH-backed session。审批和 scope 仍走应用原边界。

### 5. Good / Base / Bad

Good：宿主绑定 chat，明确选择 scope 内 session。Base：`status --json` 读取运行状态。Bad：在示例中保留已移除的 chat-session 参数，或用自造环境值绕过宿主绑定。

### 6. 必需测试

`npm run test:skill` 校验必需示例、引用和环境变量且禁止失效参数；`electron/cli/cliChatSession.test.cjs` / `netcatty-tool-cli.test.cjs` 验证缺绑定和参数错误。

### 7. Wrong / Correct

Wrong：文档要求调用者传 chat-session flag。Correct：复用宿主命令前缀及已注入的 `NETCATTY_CLI_CHAT_SESSION_ID`，按最新 CLI reference 串行调用。
