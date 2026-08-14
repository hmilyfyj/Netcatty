# Infrastructure

## 何时使用

改存储、默认数据、主题、网络同步、AI SDK 适配。

## 本地模式

- 所有 storage 读写走 `infrastructure/persistence/localStorageAdapter.ts`。
- Key 集中在 `infrastructure/config/storageKeys.ts`。改 key 或 schema 必须带迁移或兼容读。
- 默认种子：`infrastructure/config/defaultData.ts`。终端主题：`infrastructure/config/terminalThemes.ts`。
- 网络与外部服务放 `infrastructure/services/`。
- AI harness 在 `infrastructure/ai/harness/`。Catty 走 AI SDK `streamText`；外部 agent 走 IPC / MCP。
- 同一窗口内 adapter 变更通过 `netcatty:local-storage-adapter-changed` 延迟派发，避免 render 阶段同步 setState。

参考：

- `infrastructure/config/storageKeys.ts`
- `infrastructure/persistence/localStorageAdapter.ts`
- `infrastructure/ai/harness/agentRuntime.ts`

## 反模式

- 新功能里写死 `'netcatty_xxx_v1'` 字符串，不进 `storageKeys.ts`。
- 临时文件用 `os.tmpdir()`。必须走 `tempDirBridge.getTempFilePath(fileName)`。
- 把 AI 回合生命周期写进 React hook，绕过 `AgentRuntime`。
