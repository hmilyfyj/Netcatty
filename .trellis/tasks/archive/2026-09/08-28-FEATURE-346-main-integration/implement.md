# 实现清单

## 1. 固化主仓现场

- [x] 复核 19 个路径、diff、未跟踪文件和敏感信息扫描结果。
- [x] 在本地主仓 `main` 提交原始快照，记录 SHA。
- [x] 确认快照后主仓工作区干净。

## 2. 正式集成

- [x] 在 `feature/FEATURE-346-main-integration` 合入本地主仓快照提交。
- [x] 记录冲突文件；11 个字节一致路径沿用当前主线。
- [x] 对 8 个旧架构路径映射当前 `host_open` / Vault bridge / capability registry 实现。
- [x] 核对当前主线等价能力与现有测试，无需回迁旧架构实现。
- [x] 修复复核发现的 lint、Cursor SDK 探测与两条过时结构断言门禁。
- [x] 更新 Trellis AC 状态和检查证据。

## 3. 验证

```bash
git diff --check
npm run test:skill
node --test --import tsx electron/bridges/mcpServerBridge.hostOpenScope.test.cjs electron/capabilities/services/vaultService.test.cjs electron/capabilities/dispatch.test.cjs electron/capabilities/adapters/cliAdapter.test.cjs
npm test
npm run build
```

构建前根据 lockfile 状态运行 `npm install` 或 `npm ci`，依赖变动纳入检查。

验证统一使用 CI 对齐的 Node `v22.23.2`。全量结果为 10108 通过、15 跳过、0 失败；lint、schema、plugin contract、CodeBuddy 类型检查和生产构建通过。

## 4. 提交与远端合并

- [x] 提交集成结果和 Trellis 任务产物。
- [x] 推送 `feature/FEATURE-346-main-integration` 到 `origin`。
- [x] 创建目标为 `main` 的 PR，标题包含 `FEATURE-346`。
- [x] 合并 PR，fetch 后确认 `origin/main` 包含集成提交。
- [x] 主仓根目录执行 `git merge --ff-only origin/main` 并确认干净。

## 5. 主仓构建与安装

- [x] 退出当前 Netcatty 安装版和遗留开发版进程。
- [x] 在 `/Users/fengit/workspace/tools/Netcatty` 执行 `scripts/install-macos-app.sh`。
- [x] 校验 `file` / `lipo` 架构、bundle id、版本与两个 `app.asar` SHA-256。
- [x] 启动 `/Applications/Netcatty.app`，确认主进程路径和用户数据目录。

## 检查点

- 快照提交后：所有用户现有改动均可通过 Git 恢复。
- PR 合并前：全量测试和构建成功。
- 覆盖安装前：主仓 `main` 与 `origin/main` 对齐且工作区干净。
- 覆盖安装后：安装包哈希等于主仓构建产物。
