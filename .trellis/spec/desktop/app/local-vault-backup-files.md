# 本地备份文件

## 1. 范围 / 触发

设置的手动保存与从文件恢复跨越 UI、快照构建、preload 和主进程文件 I/O。它们复用本地恢复点格式，独立于云服务和自动历史保留策略。

## 2. 签名

- `exportVaultBackupFile({ payload: SyncPayload })` → `{ canceled: boolean, path?: string, backup?: LocalVaultBackupPreview }`。
- `readVaultBackupFile()` → `{ canceled: boolean, path?: string, backup?: LocalVaultBackupPreview, payload?: SyncPayload }`。
- `getVaultBackupDirectory()` → `{ path: string }`。
- `chooseVaultBackupDirectory()` → `{ canceled: boolean, path?: string }`。
- IPC：`netcatty:vaultBackups:exportFile` / `netcatty:vaultBackups:readFile` / `netcatty:vaultBackups:directory` / `netcatty:vaultBackups:chooseDirectory`。

## 3. 契约

完整本地快照由 `onBuildLocalPayload` 构建，支持异步读取。主进程持有保存目录配置，位于 userData/vault-backup-settings.json；默认 userData/manual-backups。仅更改目录时打开系统目录对话框，取消不修改配置。直接保存读取当前持久目录，用时间与随机 id 命名新文件，不弹出保存对话框；渲染器不指定任意目录或文件路径。目录变更借 vaultBackups:changed 通知窗口刷新。

保存 `formatVersion: 1`、`payloadEncoding: safeStorage-v1`、`reason: manual` 的加密记录，用于原本机加密环境恢复。文件不进入自动历史，不受保留份数清理。此前用保存对话框导出的文件仍可读取，备份文件格式没有迁移。

保存使用目标文件旁的独占临时文件、fsync 和原子替换；相邻文件用于原子写入，区别于可清理的 SFTP 下载临时文件。恢复文件只读取和预览，确认后通过 `withRestoreBarrier` 与现有 `applyProtectedSyncPayload` 应用。无云主密钥时保存仍可用，恢复沿用现有凭据加密门禁。

## 4. 验证与错误矩阵

- 取消目录选择或打开备份文件 → `{ canceled: true }`，不写配置、不应用数据、不弹成功提示。
- 默认目录首次保存可创建；已选择目录不可用 → 明确报错，不重新创建、不静默回退。损坏目录配置可通过重新选择修复。
- 文件过大、未知格式、解密不可用、必要数组缺失、指纹不匹配 → 报错，保留当前配置。
- 保护性备份无法保存 → 中止覆盖，不绕过既有错误。
- 加密不可用 → 禁止明文降级。
- 写入失败 → 报错并清理临时文件，不提前显示成功。

## 5. Good / Base / Bad

Good：选择一次目录，以后点击保存直接产生新文件，之后查看文件条目数量并确认恢复。Base：默认目录可直接保存，自动恢复点和刷新历史保持原行为。Bad：每次保存重新询问路径，或已选择目录消失后偷偷保存到别处。

## 6. 必需测试

桥接测试验证默认及持久自选目录保存无对话框、重启后读取配置、同毫秒保存不覆盖、没有明文凭据、取消选目录无副作用、目录不可用和配置修复；UI 测试验证目录显示、窗口变更刷新、忙碌状态、等待恢复确认和取消不应用。原有自动备份与保护性恢复测试仍通过。

## 7. Wrong / Correct

Wrong：用云同步 payload 导出，或直接把 `readVaultBackupFile().payload` 写进 vault。

Correct：等待完整 `onBuildLocalPayload`；文件读取后显示确认，确认后调用既有保护性本地恢复回调。
