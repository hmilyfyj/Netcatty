# Application State

## 何时使用

改主机仓库、会话、设置、AI 聊天状态，或调整持久化时机。

## 本地模式

- Hook 拥有状态，组件只消费返回值。
- `useVaultState` 管 hosts / keys / snippets / groups / notes，并调用 domain 规范化后再写入 adapter。
- `useSessionState` 管终端会话与 workspace 生命周期。
- `useSettingsState` 管主题、强调色、终端主题、同步配置。
- 终端侧栏布局走 `useTerminalSidePanelLayoutState.ts`；关闭整个侧栏要清该终端的 split tree。
- AI 回合由 `infrastructure/ai/harness/agentRuntime.ts` 编排，`useAIChatStreaming` 只管 UI 状态，停止一律 `stopAgentTurn()`。

参考：

- `application/state/useVaultState.ts`
- `AGENTS.md` 的 Application State / AI Agent Harness 两节

## 反模式

- 组件里再开一份 hosts/sessions 的 `useState` 并自己写 storage。
- 在 hook 之外直接改 `localStorage`。
- 为 Stop 再加一条平行 abort 路径。
