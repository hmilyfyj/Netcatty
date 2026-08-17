# 修复分组 tab 打开 SFTP 崩溃

## Goal

在主机分组 tab（`activeTabId` 为 `group-*`）里点 Open SFTP 时，终端层不再整页崩溃，侧栏 SFTP 能打开并绑到当前控制台。

## 背景/已知事实

- 用户截图 1：`队列服务器` 分组 tab（数量 2）内容区只剩 `Terminal could not load.` / Reload。这条文案来自 `LazyLoadBoundary` 的 `name="Terminal"`，是 TerminalLayer 渲染抛错。
- 用户截图 2：同一主机 Console 1 / Console 2 已连接，工具栏 `Open SFTP` 可点。
- `handleOpenSftp` 用 `activeTabIdRef.current` 当 tabId，分组 tab 会写成 `group-*`。
- `validAIScopeTargetIds` 只收 `session.id` 和 `workspace.id`，没收 `group.id`。
- `useTerminalLayerEffects` 会按这个集合 `filterTabsMap` 清掉 side panel / SFTP host。
- `listInvalidSftpPanelTabIds` 在 `sftpHostForTab` 一写入 `group-*` 就会把它当非法 tab 清掉。
- `handleStatusChange` 自动打开侧栏时用 `session.workspaceId || sessionId`，分组会话会写到 session UUID 上，和当前看到的 `group-*` 对不上。
- `listSftpConnectedHosts` / `SftpHostPicker` 直接调用 `host.label.toLowerCase()` / `localeCompare`，vault 里只要有一条没 label，SFTP 一挂载就会把整个 Terminal 层打爆。

## Requirements

- 合法终端 tab 集合必须包含 `group-*`（来自 `groups` 或 `session.groupId`）。
- 自动打开侧栏、SFTP 清理、AI scope 过滤都认这个集合，分组 tab 的 SFTP 状态不被立刻清掉。
- 自动打开侧栏的 tabId 用 `workspaceId || groupId || session.id`。
- SFTP 主机列表按 label 排序/过滤时，label 为空就回退 hostname，禁止对 undefined 调字符串方法。
- 补单测覆盖：合法 tab 含 group id；缺 label 的 host 不会让 `listSftpConnectedHosts` 抛错。
- 重新构建并安装到 `/Applications/Netcatty.app`。不推给 `binaricat/Netcatty`。

## 范围外

- 不改分组模型，不搬 Docker cwd / 主仓未提交 MCP 补丁。
- 不改独立 SFTP 顶栏页（`activeTabId === 'sftp'`）的交互。

## Acceptance Criteria

- [x] AC-1: `node --test --import tsx application/state/terminalGroups.test.ts domain/sftpConnectedHosts.test.ts` 通过，且包含 group tab id 与缺 label 用例。
- [x] AC-2: `validAIScopeTargetIds` / 等价集合包含当前 `groups[].id`，`listInvalidSftpPanelTabIds` 不会把仍打开的 `group-*` 清掉。
- [x] AC-3: 本机安装版在 `队列服务器` 这类分组 tab 点 Open SFTP，终端层保持可见，右侧出现 SFTP 面板。
