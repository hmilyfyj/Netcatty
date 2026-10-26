## 问题

FEATURE-942 安装后，真实 OpenWrt 在完整 React 终端初始化时断开。隔离界面可稳定复现；关闭自动探测后连接与输入正常，显式调用 getSessionPwd 随即断开。路由器 Dropbear 日志为 `String too long`。超长目录探测脚本嵌入 exec 请求，超过 Dropbear 的 9000 字节限制。

## 改动范围

复用 executeBoundedSshCommand 的 onStream，使用短命令 `exec sh -s`，通过 stdin 传送原有脚本并结束输入。保留外层 shell 的 sshd PPID、watchdog 清理、目标 shell PID、共享连接和 fallback 语义。调用者、IPC、存储和 SSH 算法无需变更。

## 验收

- 回归测试先证明旧请求超过 9000 字节，再验证短命令与完整 stdin、EOF。
- 目录探测、共享连接恢复、超时、lsof/fallback 及相关 bridge 测试通过。
- lint、构建及包内算法检查通过。
- arm64 实际包完整 React 连接原路由器，自动初始化后连接仍可输入；显式 cwd 查询与 SFTP 读取不关闭终端。
- 提交后续 PR 到 hmilyfyj/Netcatty main，更新本机安装；保留现有用户配置和旧应用备份。

## 边界

路由器 `/etc/profile:41` 调用不存在的 `/usr/bin/zsh`，与本次断开独立。本任务不修改路由器文件、不安装 zsh。
