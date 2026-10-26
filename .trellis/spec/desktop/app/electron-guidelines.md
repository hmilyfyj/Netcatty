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

## SSH ChaCha20 后备

### 1. 触发范围

Electron 缺少原始 `chacha20` 时，通过既有 ssh2 补丁补齐；终端、SFTP、跳板和转发复用同一后端与共享算法过滤。

### 2. 内部接口

`require('ssh2/lib/protocol/crypto.js')` 导出 `CHACHA20_SUPPORTED: boolean` 和既有 `init: Promise`。支持列表与 `sshAlgorithms.cjs` 共用此能力，握手必须等待 `init`。

### 3. 加密约定

无原生能力时，`init` 动态 import 锁定的 `@noble/ciphers/chacha.js`，使用 `chacha20orig(key, iv.subarray(8), data, undefined, iv.readUInt32LE(0))`。保持动态 import，兼容 Node 22 和 ASAR 中的 ESM 依赖。SSH 使用两把32字节密钥、8字节 nonce；复用 ssh2 的 Poly1305 与恒定时间标签校验，验证成功后才能交付明文。

### 4. 错误行为

| 条件 | 结果 |
| --- | --- |
| 原生和后备依赖都缺失 | 能力为 false，列表排除 ChaCha20，保留可运行的 AES |
| 后备可 resolve，但 import 失败或缺少函数导出 | `init` 拒绝，连接终止，不误报握手成功 |
| 包长度错误、MAC 篡改或截断 | 拒绝或等待完整包，不交付未认证明文 |

### 5. 兼容场景

原生可用时沿用原路径；仅后备可用时保留 ChaCha20；无原生能力时跳过 ChaCha addon，但保留 AES 绑定和默认 AES 优先顺序。

### 6. 验证

协议测试断言与 OpenSSL 完整包逐字节一致、分片和序号回绕正确、篡改不交付明文；另用真实打包应用验证 ASAR 导入、独立 OpenSSH、SFTP、跳板和主机校验。命令见质量规范。

### 7. 常见误用

仅放开算法列表，或改用 TLS/IETF 的 ChaCha20-Poly1305，都会破坏 SSH 互通。应保留 SSH 包结构，仅补齐原始流加密，并同步支持列表和初始化边界。

## 反模式

- 在组件里直接 `ipcRenderer.invoke`。
- 给插件再发明一套私有 RPC shape。
- 绕过 `PluginManager` 从 renderer IPC 改插件状态。
- 把 vault 密码或 privateKey 返回给 AI / MCP。

## Dropbear 目录探测

Dropbear 的 SSH exec 请求超过 9000 字节会关闭整条传输，连带断开交互终端。`getSessionPwd` 使用短命令 `exec sh -s`，复用 `executeBoundedSshCommand` 的 `onStream` 将原脚本通过 stdin 发送并结束输入；保留 sshd PPID、watchdog 与共享会话归属校验。增加内部探测脚本时检查请求长度，必要时传 stdin，不靠关闭自动探测规避。

验证包含请求长度/完整 stdin 的回归测试，以及实际应用中自动探测后继续输入。仅验证 ssh2 握手或提前主动退出 shell，会漏掉渲染进程稍后发起的目录探测。

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
