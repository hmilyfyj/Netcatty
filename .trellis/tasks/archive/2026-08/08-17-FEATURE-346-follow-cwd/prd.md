# 恢复 SFTP 跟随终端目录

## Goal

合并上游后，SFTP 侧栏不再跟着终端 `cd` 换目录。把全局默认改回开启，使分组 tab 里打开的 SFTP 继续跟随当前控制台路径。

## 背景/已知事实

- 用户反馈：SFTP 能开了，但终端换目录后侧栏不自动切。
- 旧 fork `87b63991` 的 `TerminalLayer.syncSftpLocationToSessionCwd` 在每次 cwd 解析（initial / command / osc）时无条件写入 `sftpInitialLocationForTab`。
- 上游改成开关 `sftpFollowTerminalCwd`，默认在 `settingsStateDefaults.ts` 是 `false`。
- `useSettingsState` 读取逻辑是 `stored === 'true' ? true : DEFAULT`，安装新版后会把 false 写进 localStorage。
- 跟随真正生效还依赖 `shouldProbeCommandCwd`：SFTP 面板打开且 follow 为真时，命令后才会补探 pwd。
- 分组 tab 的 host 已存在 `sftpHostForTab[group-*]`（`ce2aa139`），打开面板后探针能对上。

## Requirements

- `DEFAULT_SFTP_FOLLOW_TERMINAL_CWD` 改为 `true`，`terminalSettingsStore` 默认值一并改。
- 主机未单独覆盖时，SFTP 跟随当前终端 cwd。
- 补单测锁住默认开启。
- 重新构建并安装到 `/Applications/Netcatty.app`。不推给 `binaricat/Netcatty`。

## 范围外

- 不改 Docker 容器 cwd / 容器 SFTP。
- 不改跟随算法（blocked / handled / OSC 7 探针）。

## Acceptance Criteria

- [x] AC-1: `node --test --import tsx application/state/settingsStateDefaults.test.ts components/sftp/sftpFollowTerminalCwd.test.ts` 通过，且默认跟随为 true。
- [x] AC-2: 主机没有 `sftpFollowTerminalCwd` 覆盖时，`resolveHostFollowTerminalCwd(undefined, DEFAULT)` 为 true。
- [x] AC-3: 本机安装版打开分组 tab 的 SFTP 后，终端 `cd` 到别的目录，侧栏路径跟着变。（FEATURE-346 已 done，代码随 PR #5 合入 main）
