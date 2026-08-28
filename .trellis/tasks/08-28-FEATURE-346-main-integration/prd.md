# 合并主仓改动并重装应用

## 目标

把主仓根目录 `/Users/fengit/workspace/tools/Netcatty` 现存的未提交内容形成可恢复提交，安全合入 fork 的最新 `main`，随后让主仓根目录快进到合并结果，并从该目录构建 arm64 Netcatty、覆盖安装到 `/Applications/Netcatty.app`。最终安装包应来自主仓最新 `main`，且主仓工作区保持干净。

## 背景与已知事实

- issue `FEATURE-346` 已完成上游同步和功能回迁，fork 的 `origin/main` 当前为 `4a2fdedb`；本地主仓 `main` 仍在 `87b63991`，落后 `3161` 个提交。
- 主仓现有 `15` 个已跟踪修改文件和 `4` 个未跟踪文件，暂存区为空；改动规模为 `522` 行新增、`154` 行删除。
- 19 个路径中有 11 个与 `origin/main` 当前内容字节一致，包括安装脚本、`netcatty-tool-cli` skill、测试文档、验证脚本、MCP launcher 与 OpenAI skill 元数据。这些内容已通过 FEATURE-346 早期回迁进入远端主线。
- 其余 8 个路径为旧架构上的 MCP 主机发现/连接实现：`App.tsx`、`components/ai/ChatMessageList.tsx`、`electron/bridges/aiBridge.cjs`、`electron/bridges/mcpServerBridge.cjs`、`electron/mcp/netcatty-mcp-server.cjs`、`electron/preload.cjs`、`global.d.ts`、`package.json`。
- 当前主线已拆分 `AppShell` / `AppSideEffects` / publishers，并通过 `electron/capabilities/catalog/`、`vaultAgentBridge.cjs`、`vaultService.cjs` 提供 `host_open` 等能力；已有 `mcpServerBridge.hostOpenScope.test.cjs` 和 vault service 测试覆盖相关契约。
- `scripts/install-macos-app.sh` 会在 arm64 主机优先选择 `release/mac-arm64/Netcatty.app`，再覆盖 `/Applications/Netcatty.app`。
- 远端 `origin` 是 `hmilyfyj/Netcatty`；项目要求保留 fork 自用改动，远端 `upstream` `binaricat/Netcatty` 只读。

## 需求

- 在本地主仓 `main` 上把 19 个现存路径提交为一个原始快照，保留其完整历史和回滚点。
- 在从 `origin/main` 创建的正式 worktree `feature/FEATURE-346-main-integration` 中合入该快照提交。
- 对字节一致的 11 个路径保持主线内容；对旧架构的 8 个路径逐项核对当前主线等价能力，以当前架构和已有测试为准解决冲突。
- 运行 skill 静态校验、相关 MCP/Vault 测试、完整测试与生产构建；处理合并引入的真实失败。
- 把集成分支推到 fork，通过目标为 `main` 的 PR 合并，随后让主仓根目录 `main` 使用 `--ff-only` 同步远端。
- 退出运行中的 Netcatty，使用主仓根目录的安装脚本构建并覆盖安装 arm64 应用，然后启动安装版。
- 校验 `/Applications/Netcatty.app` 与主仓 `release/mac-arm64/Netcatty.app` 的 `app.asar` SHA-256 一致，并确认应用进程来自 `/Applications/Netcatty.app`。

## 范围外

- 不向 `binaricat/Netcatty` 上游推送任何提交。
- 不清理、丢弃或改写现有主仓未提交内容；先以提交形式完整保留。
- 不改变用户数据目录 `~/Library/Application Support/netcatty`，不迁移或重置 Vault 数据。
- 不新增与本次主仓合并、构建安装无关的产品功能。

## 验收标准

- [x] AC-1：本地主仓原始 19 个路径形成独立快照提交，`git show --stat <sha>` 可核对文件范围。
- [x] AC-2：集成 worktree 从 `origin/main@4a2fdedb` 起步并包含快照提交历史，所有冲突已解决，`git status --porcelain` 只包含本任务计划产物或为空。
- [x] AC-3：`npm run test:skill` 通过；`mcpServerBridge.hostOpenScope`、vault service/capability 相关测试通过。
- [x] AC-4：`npm test` 与 `npm run build` 通过；`git diff --check` 通过。
- [x] AC-5：集成结果通过 fork PR 合入 `origin/main`，本地主仓 `main` 可 `git merge --ff-only origin/main`，同步后工作区干净。
- [x] AC-6：从 `/Users/fengit/workspace/tools/Netcatty` 执行安装脚本成功，安装包为 arm64，主仓产物与 `/Applications/Netcatty.app` 的 `app.asar` SHA-256 相同。
- [x] AC-7：Netcatty 安装版启动成功，进程路径为 `/Applications/Netcatty.app/Contents/MacOS/Netcatty`，现有用户数据目录保持原位置。

## 检查证据

- 原始快照提交：`5366c722eb5c1d27a7e46bfd898bad00fda259c1`，包含 19 个路径。
- 集成提交：`8d4e25c3abef5cb22305f0d89df3b297a2e52b32`，父提交为 `4a2fdedb` 与 `5366c722`；合并树与 `4a2fdedb` 一致。
- 8 个冲突文件均保留当前主线架构；`host_open`、Vault bridge、capability registry 与 MCP scope 已存在等价能力。
- Node `v22.23.2` 下 `npm run test:skill`、33 项 MCP/Vault 定向测试、`npm test`（10108 通过、15 跳过）、`npm run build`、schema/contract/CodeBuddy 类型校验与 `git diff --check` 通过。
- 质量复核修复主线 Trellis lint 自赋值、Cursor SDK 探测误加载 Electron ABI，以及两条过时结构断言；`npm run lint` 通过并保留 11 条既有 warning。
- 本次只修复现有门禁与断言，无新增架构契约；规范回顾确认无需更新 `.trellis/spec/`。
- PR `https://github.com/hmilyfyj/Netcatty/pull/7` 已合并，远端和本地主仓 `main` 均为 `3f9ec2d3e38ad5927a6a22bd725a49874b007aca`。
- 主仓刷新锁定依赖后完成 arm64 覆盖安装；构建产物与安装版 `app.asar` SHA-256 均为 `cd47c2d7c420707c7bd2fdee70f1dcdc1a1f8105d4066a093c36b30f8cca5141`。
- 安装版以 PID `37926` 从 `/Applications/Netcatty.app/Contents/MacOS/Netcatty` 启动，bundle id 为 `com.netcatty.app`。
