# 本地备份文件

## 1. 范围 / 触发

设置的手动保存与从文件恢复跨越 UI、快照构建、preload 和主进程文件 I/O。它们复用本地恢复点格式，独立于云服务和自动历史保留策略。

## 2. 签名

- `exportVaultBackupFile({ payload: SyncPayload })` → `{ canceled: boolean, path?: string, backup?: LocalVaultBackupPreview }`。
- `readVaultBackupFile()` → `{ canceled: boolean, path?: string, backup?: LocalVaultBackupPreview, payload?: SyncPayload }`。
- IPC：`netcatty:vaultBackups:exportFile` / `netcatty:vaultBackups:readFile`。

## 3. 契约

完整本地快照由 `onBuildLocalPayload` 构建，支持异步读取。主进程系统对话框选择路径；渲染器不指定读写路径。保存 `formatVersion: 1`、`payloadEncoding: safeStorage-v1`、`reason: manual` 的加密记录，用于原本机加密环境恢复。文件不进入自动历史，不受保留份数清理。

保存使用目标文件旁的独占临时文件、fsync 和原子替换；相邻文件用于原子写入，区别于可清理的 SFTP 下载临时文件。恢复文件只读取和预览，确认后通过 `withRestoreBarrier` 与现有 `applyProtectedSyncPayload` 应用。无云主密钥时保存仍可用，恢复沿用现有凭据加密门禁。

## 4. 验证与错误矩阵

- 取消任一文件对话框 → `{ canceled: true }`，不写文件、不应用配置、不弹成功提示。
- 文件过大、未知格式、解密不可用、必要数组缺失、指纹不匹配 → 报错，保留当前配置。
- 保护性备份无法保存 → 中止覆盖，不绕过既有错误。
- 加密不可用 → 禁止明文降级。
- 写入失败 → 报错并清理临时文件，不提前显示成功。

## 5. Good / Base / Bad

Good：选择文件名保存，之后从文件查看条目数量并确认恢复。Base：自动恢复点和刷新历史保持原行为。Bad：把渲染器传入的任意路径当读写指令，或仅打开文件就覆盖当前配置。

## 6. 必需测试

桥接测试验证自选路径往返、没有明文凭据、取消无副作用、无效文件和加密失败；UI 测试验证等待确认、取消不应用、使用本地恢复回调和忙碌门禁。原有自动备份与保护性恢复测试仍通过。

## 7. Wrong / Correct

Wrong：用云同步 payload 导出，或直接把 `readVaultBackupFile().payload` 写进 vault。

Correct：等待完整 `onBuildLocalPayload`；文件读取后显示确认，确认后调用既有保护性本地恢复回调。
