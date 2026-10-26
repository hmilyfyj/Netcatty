# 完成实现与验证

## 顺序

- [x] 使用 `npm ci --ignore-scripts=false` 安装依赖，确认 patch-package 执行。
- [x] 先增加无原生 ChaCha20 的失败测试并记录 RED。
- [x] 增加锁定依赖，修改 ssh2 源码后由 patch-package 生成增补补丁，保留已有变更。
- [x] 修改共享能力过滤，执行针对性协议及算法测试并记录 GREEN。
- [x] 运行隔离 SSH/SFTP/rekey/host verification/AES 回归与双方向跳板验证。
- [x] 运行真实 arm64 构建包与独立 OpenSSH 的加载/连接验证；原路由器已通过主机密钥校验和 ChaCha20 握手。
- [ ] 原路由器完整只读登录：等待1Password签名放行；不影响独立应用验证结果。
- [x] 执行 lint、tsc、全库测试、build 及打包；tsc与未改基线的747项错误完全相同，无新增。
- [x] 由 check 子代理复核完整 diff、安全边界、补丁完整性、测试与规范。
- [ ] 提交自有 fork，目标 main 创建 PR，最终一次评论交付，issue 置 in_review。

## 分工

implement 子代理负责依赖、ssh2 补丁、共享过滤和同目录自动化测试。主会话负责真实 Electron/ASAR/包与真实路由器验证、集成交付。避免并发编辑同一文件。check 子代理在实现后独立复核。

## 证据

在本目录 validation.md 记录 AC、命令、RED/GREEN 或 BASELINE/GUARD/MANUAL、运行环境与未覆盖范围。测试账号与夹具隔离，不改生产逻辑来绕过测试污染。外部CI不watch。
