# 设计：主仓快照合并与安装

## 边界

本任务分为三个 Git 边界：主仓根目录只负责把现有脏工作区固化为快照；正式集成、冲突处理与验证在 `FEATURE-346-main-integration` worktree 完成；远端合并完成后，主仓根目录只做 `--ff-only` 同步和构建安装。这样既满足“把主仓文件 commit”，也让适配工作遵守正式 worktree 开发约束。

## Git 数据流

```text
local main@87b63991 + 19-path dirty tree
  -> snapshot commit S on local main

origin/main@4a2fdedb
  -> feature/FEATURE-346-main-integration
  -> merge S, resolve against current architecture
  -> integration merge commit I
  -> fork PR -> origin/main M
  -> local main --ff-only origin/main
```

快照提交 `S` 作为第二父链进入集成 merge，远端主线保留这批本地文件的原始历史。主仓根目录同步时无需 reset、stash 或改写历史。

## 冲突策略

- 11 个与当前主线完全一致的路径直接沿用主线内容，Git 可自动确认或按字节哈希核验。
- 8 个旧架构路径按能力而非旧文件形态核对：
  - renderer 主机状态由 `VaultPublisher` / `AppSideEffects` 管理；
  - host 打开能力由 `vaultAgentBridge`、`vaultService`、capability catalog 与 `host_open` 承担；
  - MCP scope 由当前 `mcpServerBridge` 拆分模块与 capability RPC 处理；
  - approval 展示由 `ExternalMcpApprovalsHost` 和共享 approval gate 承担；
  - preload 与类型声明沿用当前主线契约。
- 当前主线缺少快照中的可观察能力时，才在对应新模块补实现与测试；已有等价能力时保持主线实现，避免把旧 `App.tsx` 巨型组件和旧 monolith bridge 重新引入。

## 验证与回滚

- 静态：`git diff --check`、`npm run test:skill`。
- 定向：host_open scope、vault service、capability dispatch/adapter 测试。
- 全量：`npm test`、`npm run build`。
- 安装：脚本退出码、arm64 bundle、`app.asar` SHA-256、运行进程路径。
- 回滚点：快照提交 `S` 保留原始内容；集成 PR 合并前可关闭 PR；合并后可 revert 集成 merge。安装包可从主仓任一已验证提交重新构建覆盖。

## 兼容性

- 保持 bundle id `com.netcatty.app` 和用户数据目录，现有 Vault/密钥继续沿用。
- 只推 fork `origin`，上游 remote 保持只读。
- 采用 merge 保留历史，避免 rebase 改写已存在的 feature 提交。
