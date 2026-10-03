# 本地备份目录验证

## 结果

配置一次目录后，保存直接产生新的加密备份文件，不调用保存或目录选择对话框。目录持久化，取消选择不改变配置；已配置目录丢失或不可写时报错，不静默另存。原有文件预览、确认恢复和保护性备份保留。

## 本次验证

- 受影响桥接、目录、文件导入、preload、应用、面板、多语言及同步迁移测试：75/75 通过。
- 独立审查的受影响测试：67/67 通过，无未解决发现。
- `npm run lint`：通过，0 errors / 18 warnings；受影响文件 ESLint 无错误或警告。
- TypeScript：基线与修改后均为 746 个诊断，新增及变化签名为 0。项目完整类型检查仍未通过。
- `npm run build`：通过；有既有大 chunk 提示。
- electron-builder macOS ARM64 本地目录打包：通过，ad-hoc 签名，未公证。
- 打包 ASAR 检查：包含目录 IPC/preload，备份桥接没有 `showSaveDialog`。
- 已安装应用：Mach-O arm64，`codesign --verify --deep --strict` 通过，安装 ASAR 与打包结果 SHA256 一致。
- 启动验证：安装后窗口已就绪，CLI status `ok=true`、`discoveryFilePresent=true`，活动终端会话 0。冷启动最初尚未就绪，随后确认正常。
- 本次未重跑全仓测试；上述测试为当前改动的受影响验证。

## 安装与回退

新版已安装到 `/Applications/Netcatty.app`。

- ASAR SHA256：`eed0a2f17408e3cea80f234f6414bfa1f101394c6a39cdda0caac8191124acdb`
- 安装前离线备份：`~/Library/Application Support/Netcatty-backups/pre-directory-backup-20261003-224629/`
- 已校验 1576 个数据文件、131724485 bytes；备份内保留原应用、数据、SHA256 清单和恢复说明。
- 未导出或修改钥匙串。手动备份依赖原本机加密环境，尚不支持跨设备恢复。

## 交付

更新既有 PR：<https://github.com/hmilyfyj/Netcatty/pull/14>，目标 `hmilyfyj/Netcatty:main`。
