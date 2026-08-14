# Capability Registry

只登记已经落地、可复用的能力。

| 能力 | 入口 | 说明 |
| --- | --- | --- |
| Vault 状态 | `application/state/useVaultState.ts` | hosts/keys/snippets/notes 的读写与规范化 |
| 会话/分屏 | `application/state/useSessionState.ts` | 终端会话与 workspace 树 |
| 设置 | `application/state/useSettingsState.ts` | 主题、终端主题、同步配置 |
| Storage keys | `infrastructure/config/storageKeys.ts` | 全部持久化 key |
| Storage adapter | `infrastructure/persistence/localStorageAdapter.ts` | 唯一 localStorage 入口 |
| AsidePanel | `components/ui/aside-panel.tsx` | Vault 子页侧栏 |
| AgentRuntime | `infrastructure/ai/harness/agentRuntime.ts` | AI 回合生命周期 |
| Capability catalog | `electron/capabilities/catalog/` | 工具/CLI/MCP 的单一事实源 |
| Tool surfaces | `electron/capabilities/codegen/toolSurfaces.cjs` | agentKinds 与 surface 解析 |
| SSH bridge | `electron/bridges/sshBridge.cjs` | SSH 会话 |
| SFTP bridge | `electron/bridges/sftpBridge.cjs` | 远端文件 |
| Terminal bridge | `electron/bridges/terminalBridge.cjs` | 本地 shell / telnet / mosh |
| Port forward | `electron/bridges/portForwardingBridge.cjs` | 隧道 |
| AI bridge | `electron/bridges/aiBridge/` | 外部 SDK / Codex App Server |
| Vault AI bridge | `electron/bridges/aiBridge/vaultAgentBridge.cjs` | 给 agent 的 vault 只读视图，不含密钥 |
| Tool CLI | `electron/cli/netcatty-tool-cli.cjs` | 内部 CLI |
| MCP server | `electron/mcp/netcatty-mcp-server.cjs` | 外部 agent 工具面 |
| Plugin host | `electron/plugins/` | `NETCATTY_PLUGIN_DEV=1` 预览 |
| Plugin contract | `packages/plugin-contract` | 公共 schema 与线协议 |
| Temp files | `tempDirBridge.getTempFilePath` | 唯一临时目录入口 |
