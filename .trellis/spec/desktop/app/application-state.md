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

## 主机组与顶层终端 surface

### 1. 范围 / 触发

同步上游终端功能时，fork 的多个 console 共用一个 host group tab；不能用 session id 代替顶层 tab，也不能让全局广播遗漏全部分组 SSH。

### 2. 签名

- `getSessionSurfaceTabId(session): string`：workspaceId 优先，其次 groupId，最后 session.id。
- `resolveGlobalBroadcastSessionIds(sessions, groups = []): string[]`。
- `resolveTerminalBroadcastTargetIds({ sessions, groups, sourceSessionId, globalBroadcastEnabled, directTargetSessionIds }): string[]`。

### 3. 契约

`groups` 提供 `{ id, activeSessionId }`。全局广播包含非 workspace、非 hidden 的独立 session 和每组唯一活动 console；读取实时 groups，而不是创建回调时的旧数组。workspace 内原广播和显式 direct targets 保持上游语义。窗格放大的 terminal 候选同样仅包含组活动 console；切换 console 清除旧 terminal 放大，不清 side-panel 放大。

### 4. 校验 / 错误矩阵

- group 缺失或 session 不是其活动 console → 不参与全局广播。
- 来源不存在、不在参与集合或未启用全局广播 → 无全局 targets。
- 组内编辑器未成功关闭 → 保留 owner group；busy 检查探测组全部 console。

### 5. Good / Base / Bad

Good：两个主机组 A/B 各广播到对方当前活动 console。Base：两个独立 tab 保持上游行为。Bad：向组内隐藏 console 发命令，或切换 console 后仍把旧 console 当放大目标导致空白。

### 6. 必需测试

`domain/terminalBroadcast.test.ts` 验证活动 console、缺组 fail-closed、隐藏 console 排除；`application/AppHandlers.closeTabsBatch.test.ts` 验证关闭组与存活编辑器保护；pane magnification 回归验证活动 console 切换。

### 7. Wrong / Correct

Wrong：`session.workspaceId || session.id` 作为 SFTP/侧栏 owner，或全局排除所有 `groupId`。Correct：通过 `getSessionSurfaceTabId(session)` 定位 surface，广播通过实时 groups 选择活动 console。
