# 修复主机 tab 终端无法输入

## Goal

主机分组 tab 的 `activeTabId` 是 `group-*`，pane 可见性仍按 `activeTabId === sessionId` 判断，导致已连接终端 `pointer-events: none`，键盘和工具栏按钮无响应。在 `getTerminalPaneSnapshot` 把当前分组控制台当成可见 solo pane。

## 背景/已知事实

- 用户截图：`队列服务器` 主机 tab 已连接，有 `Console 1` 条，右上角工具栏和 prompt 处标红；微信输入法已弹出，终端无回显。
- 连接能建立、输出能显示，说明 PTY 正常；点不动、输不进说明 pane 被当成 hidden。
- `components/terminalPaneVisibility.ts` 的 `getTerminalPaneSnapshot` 在非 workspace 时只认 `activeTabId === sessionId`。分组 tab 的 id 是 `group-...`。
- hidden pane 走 `resolveInactiveTerminalPaneStyle`：`pointerEvents: "none"`，且 `hibernateHiddenTabs` 为 false 时仍 `visibility: visible`，和截图一致。

## Requirements

- `getTerminalPaneSnapshot` 在 `sessionGroupId === activeTabId` 且该 session 是当前控制台时返回 `solo|<sessionId>`。
- 同一 group 里非当前控制台保持 hidden。
- `TerminalPane` 把 `session.groupId` 和当前 `activeGroupedSessionId` 传给 snapshot。
- 补单测覆盖 group tab 可见 / 非当前控制台 hidden。
- 重新构建并安装到 `/Applications/Netcatty.app`。不推给 `binaricat/Netcatty`。

## 范围外

- 不改分组模型、不改 tab 归组逻辑。
- 不修 Docker cwd、不搬主仓未提交 MCP 补丁。

## Acceptance Criteria

- [x] AC-1: `node --test --import tsx components/terminalPaneVisibility.test.tsx` 通过，且包含 group tab 用例。
- [x] AC-2: 主机分组 tab 激活时，当前控制台 snapshot 为 `solo|<sessionId>`，同组其它控制台为 `hidden`。
- [x] AC-3: 本机安装版打开远程会话后，终端可输入，右上角工具栏按钮可点。（FEATURE-346 已 done，代码随 PR #5 合入 main）
