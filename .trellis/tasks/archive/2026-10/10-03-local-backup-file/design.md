## 设计

复用 vaultBackupBridge 的 formatVersion=1、safeStorage-v1 加密记录，新增 manual 原因。主进程持有文件对话框和文件 I/O。exportVaultBackupFile({payload}) 返回 {canceled,path?,backup?}；readVaultBackupFile() 返回 {canceled,path?,backup?,payload?}。路径只由系统对话框选择，不接受渲染器指定任意路径。

导出文件独立于自动历史，使用权限 0600 的临时文件、fsync 和原子 rename 写入。导入校验大小、格式、必要 payload 数组和解密后指纹，拒绝损坏输入。使用现有保护性恢复流程和预览确认，失败不覆盖当前数据。读取加密文件用于本机恢复，UI 提示本机限制。

UI 从 SettingsSyncTab 传递完整 onBuildLocalPayload；LocalBackupsPanel 增加保存、从文件恢复、忙碌状态和成功/失败提示。云主密钥未配置时也可导出；恢复沿用现有门禁。
