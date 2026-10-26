## 设计

主进程在 userData/vault-backup-settings.json 持久保存版本化目录配置，默认 userData/manual-backups。新增 getVaultBackupDirectory() → {path}、chooseVaultBackupDirectory() → {canceled,path?}，IPC directory / chooseDirectory。路径只来自主进程默认值和系统目录对话框；渲染器不传任意目录。

exportVaultBackupFile 保留已有契约但直接读取持久目录，不调用任何对话框。默认目录可首次创建；已配置目录消失或无权限则报错，不重新创建或静默回退。文件名包含时间与随机 id，独立保存，每次保存不覆盖已有备份。继续使用原子写入及 safeStorage 格式。

选目录取消不落盘；成功后原子写入配置，借已有 vaultBackups:changed 广播触发目录刷新。UI 显示只读完整目录、单独更改按钮和不带省略号的保存按钮，主密钥未配置也可使用。恢复文件仍可使用打开文件对话框。
