# 会话类型参考

当目标 session 是串口、网络设备、Mosh、本地终端，或执行方式有疑问时阅读。

## 统一前置步骤

```bash
<netcatty-cli-prefix> session --session <session-id> --json --chat-session <chat-session-id>
```

使用返回值判断：

- `connected`：当前连接状态。
- `protocol`：`ssh`、`local`、`telnet`、`serial` 等。
- `shellType`：标准 shell 或 raw。
- `deviceType`：`network` 表示交换机、路由器、防火墙等网络设备。

## 执行策略

- 标准 shell session：传入一条 shell-ready 命令，Netcatty 返回 `stdout`、`stderr`、`exitCode`。
- 串口/raw session：命令按原样发送，使用设备原生命令。
- `deviceType: network`：命令按原样发送，使用厂商 CLI，例如 Huawei VRP、Cisco IOS。
- 本地 session：可以执行本机命令；SFTP 文件操作走本机文件系统工具。
- Telnet、串口、网络设备：文件传输能力依赖设备原生命令。

## 判断建议

- 常规 Linux/macOS/Windows shell 使用 `exec` 或长任务命令。
- 网络设备使用 `display`、`show`、`terminal length 0` 等设备命令。
- 串口/raw session 避免管道、重定向、子 shell、shell-only 语法。
