# 十月上游合并独立审查

审查基线：fork `1ab475ed`、upstream `b2ed83ae`。已读取角色指令、check.jsonl 全部规范及 PRD / design / implement。检查 19 个原冲突、fork 相对上游的主机组、SFTP、关闭保护、fresh-auth、Monaco、CLI 接缝；检查 desktop 及三个 plugin package 规范入口，plugin packages 本次无代码差异。

## Findings（fixed）

- `application/state/sessionSnapshotStore.test.ts`：fork 夹具遗漏上游新 `canUseGlobalBroadcast` / `toggleGlobalBroadcast` / `isGlobalBroadcastEnabled` 字段；补齐，移除合并新增类型错误。
- `components/TrayPanel.tsx`：fork remote-group 使用上游 `WorkspaceGroup` 新关闭按钮却未传 `onCloseSession`，点击会调用未定义回调；接回现有 `handleCloseSession`。`components/TrayPanel.closeSession.test.ts` 验证两种组实例都接关闭回调。
- `domain/models/terminalGroup.ts`：fork 从 `terminal` 导入未导出的 `HostProtocol`；改从定义所在 `connection` 导入，移除 unused `TerminalSession`。
- 全局广播：发现首次解决方案把所有主机组排除，导致上游新增广播对 SSH tab 不可用。主会话决定按顶层 tab 语义广播，实施代理适配每组活动 console + orphan，隐藏/非活动 console 不参与。独立审查已确认 domain → session availability → stable hotkey context → renderer fanout 路径一致；保留 workspace 广播和敏感输入保护。
- 主机组放大：放大 A 后切换同组 B，旧目标覆盖 B 而 A 因活动 console 门禁隐藏，导致空白。实施代理让 selection validator 校验 group active console，并让 reconciliation 依赖 groups；切换清除旧 terminal zoom，side-panel zoom 不变。独立审查确认实现及纯函数回归匹配。
- Markdown 回归首次 6 项失败：查明依赖内缺少上游 numeric-comparison patch。主会话确认用户 npm 配置 `ignore-scripts=true` 导致 `npm ci` 隐式跳过 postinstall；使用 `npm ci --ignore-scripts=false` 成功应用 patch 和 native rebuild。不是合并生产源码错误，不更改 Markdown 生产逻辑。

## Findings（not fixed）

- TypeScript 全库检查未通过，不能报告 typecheck green。纯 upstream worktree 使用相同 Node / dependencies 重现 745 条诊断；当前集成为 747 条。按文件、诊断文本去除行号及 worktree 路径比较，非 upstream 诊断仅以下 5 条，均在原 fork 已存在：
  - `application/state/sftp/backend.ts` 两条：`SftpConnection` 没有 `backendType`。
  - `application/state/sftp/useSftpDirectoryListing.ts` 一条：bridge 没有 `dockerListFilesForSession`。
  - `application/state/useSftpBackend.ts` 一条：传 timeout-only options，但原 fork bridge 类型已经要求 `NetcattySSHOptions`。
  - `domain/terminalFileContext.ts` 一条：没有导出的 `DockerContainerSummary`。
- 上述 Docker helpers 没有生产消费方，旧 bridge / types 也无该 Docker 实现；`backend.ts`、`terminalFileContext.ts`、`useSftpBackend.ts` 与 fork `1ab475ed` 原文一致。保留继承代码，不扩展新 Docker 功能，也不靠假类型掩盖。
- 原 fork 主机组 Cmd+W / 部分 split shortcut 已按 session id 查找，不能识别 group tab；相关分支与原 fork 一致，不归因于本次合并，未扩大修复范围。
- 独立 plugin-runtime 检查未通过：458 pass / 2 fail / 1 cancelled / 1 skip。`electron/plugins` 与纯上游无代码差异；纯上游 `b2ed83ae` 对同两个测试文件重现相同 2 fail + 1 cancelled（22 tests / 19 pass，exit 1）。未扩展插件功能或更改生产代码。
  - `networkBroker.test.cjs:160`：`AbortSignal.timeout` 使用不保持事件循环存活的 timer，fake fetch 只等待 abort 且无 referenced handle；独立测试进程先结束，报 pending promise / event loop resolved。内存 keepalive 控制实验让该文件 7/7 通过（exit 0），表明该项是测试生命周期问题，不是 deadline error 分支失效。
  - `pluginSyncSidecarService.test.cjs:80`、`:250`：当前 Node `v22.23.2` 内置 SQLite 读取 NUL 分隔 TEXT 时截断。内存数据库实验输入 `com.example.sync.theme\0application\0application` 长 46，输出只有 `com.example.sync.theme` 长 22；`hex(key)` 仍含完整两个 `00` 及后续字段，`parseSettingsSidecarKey` 得到 null。因此 collect 丢弃 retained sidecar、hydrate 跳过写入。这是上游代码与当前 Node SQLite 兼容问题，未通过伪造测试/添加假类型掩盖。

## Verification

- `git diff --check`：exit 0；`git ls-files --unmerged` 无输出。
- Node：`v22.23.2`。
- TypeCheck：`npx tsc --noEmit`，exit 2；747 条既有诊断，无合并新增诊断；日志任务 workdir `october-typecheck-final.log`。
- Upstream control：只读 detached worktree `Netcatty-upstream-check`，同 dependencies；`npx tsc --noEmit`，exit 2，745 条；日志 `october-upstream-typecheck-final.log`。
- Lint：`npm run lint`，exit 0，0 errors / 18 warnings；复用实施代理最终 `october-final-lint.log`。
- 定向 tests：`node --test --import tsx domain/terminalBroadcast.test.ts domain/paneMagnification.test.ts application/state/useSessionState.globalBroadcast.test.ts application/state/terminalGroups.test.ts application/AppHandlers.globalHotkeys.test.ts components/terminalLayer/TerminalLayerWorkspaceSection.test.ts components/terminal/runtime/terminalPasteCancellation.test.ts components/terminal/runtime/terminalLinePaste.test.ts components/terminal/runtime/terminalUserPaste.test.ts application/state/sessionSnapshotStore.test.ts components/TrayPanel.closeSession.test.ts`，exit 0，273 pass / 0 fail；复用实施代理 `october-final-global-regressions.log`，包含本审查修复的 snapshot / Tray fixtures。
- 新增三份 spec 说明（主机组 surface / 广播、CLI 宿主绑定、npm scripts 配置）与实现及诊断一致，独立审查通过。
- 全量 tests：主会话最终 `npm test` exit 0，13036 pass / 47 skip；生产 build、ARM64 pack-dir 及生成契约/schema 校验 exit 0，复用主会话证据。没有把 plugin-runtime 或 typecheck 的既有失败报告为通过。
- Plugin control：`node --test electron/plugins/networkBroker.test.cjs electron/plugins/pluginSyncSidecarService.test.cjs` 在纯上游 worktree exit 1（19 pass / 2 fail / 1 cancelled），日志 `october-upstream-plugin-baseline.log`；in-process keepalive 只跑 networkBroker，exit 0（7 pass），日志 `october-upstream-network-keepalive.log`。
- 独立审查范围已完成，无未解决的合并新增发现。真实 Electron plugin smoke 由主会话另行收集，不替代以上失败边界。
