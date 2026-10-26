# 本地备份文件验证

输入：fork `origin/main@8686441e`，Node `v24.15.0`，Apple Silicon arm64；独立任务 checkout，没有修改用户原主仓。

## 功能验证

- 新文件桥接测试最初因缺少 exportBackupFile/readBackupFile 接口失败（RED）；实现后桥接、既有自动备份与 preload 测试 35 项通过（GREEN）。
- UI、保护性恢复、语言和收敛迁移定向检查共 59 项通过。覆盖保存路径、加密往返、取消、写入/rename 失败保留原文件、临时文件清理、损坏/超大/解密不可用输入、恢复确认与覆盖前保护性备份、无云主密钥时可保存，以及异步完整快照。
- 手动文件不进入自动历史；即使保存在自动备份目录，也不受保留份数清理。

## 项目检查

- `npm ci --ignore-scripts=false`：exit 0，应用依赖 patches 和 native rebuild。
- `npm run lint`：exit 0，0 errors / 18 既有 warnings。独立审查新增静态签名修正后，受影响文件 ESLint 复验通过。
- `npm --ignore-scripts=false test` 最终：exit 0，13105 tests / 13061 pass / 44 skip / 0 fail。首批两个文件因 Electron 首次按需并发下载失败而失败；预先安装二进制后重跑全量，保留最终结果。没有修改生产逻辑来绕过环境失败。
- `npm run build`：exit 0；已有大 chunk 提示保留。
- ARM64 目录打包：exit 0，显式关闭 notarization、使用 ad-hoc 签名。Mach-O arm64，`codesign --verify --deep --strict` 通过，ASAR 含新增保存/读取 IPC 与 preload API。
- `git diff --check`：通过。
- 全量 TypeScript 检查仍不通过：同依赖、已生成内部包的独立原始基线 747 条诊断，最终 746 条；按文件、错误内容及等价 union 排序归一化，新增 0 条，移除既有异步快照回调错误 1 条。没有宣称全量类型检查通过。
- 独立审查没有未解决的本次功能问题。

## 安装

正常退出旧应用，离线备份用户数据，1575 个文件逐一 SHA-256 校验一致，约 125.6 MiB；保留旧应用和 RESTORE.md。备份位于 `~/Library/Application Support/Netcatty-backups/pre-local-backup-20261003-165602/`，父目录仅当前用户可访问。

从任务 checkout 构建的 ARM64 安装包已覆盖 `/Applications/Netcatty.app`，ASAR SHA-256 与产物一致：`bd80801c1399cb318d6c9b1dd5eb1117c2b1d566ce95fe942c70d9449f7f33df`。应用启动进程来自正式安装路径，CLI 状态接口正常、discoveryFilePresent=true。

使用入口：设置 → 同步与云 → 本地备份文件 → 保存备份…。选择路径和文件名保存；从文件恢复时先预览确认。文件通过本机 safeStorage 加密，用于本机恢复。
