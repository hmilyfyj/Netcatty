# 命令执行参考

用于远程命令、系统信息、日志片段、进程检查、服务状态等任务。

## 短命令流程

已有默认目标 session：

```bash
<netcatty-cli-prefix> session --session <session-id> --json --chat-session <chat-session-id>
<netcatty-cli-prefix> exec --session <session-id> --json --chat-session <chat-session-id> -- "<command>"
```

需要发现 session：

```bash
<netcatty-cli-prefix> env --json --chat-session <chat-session-id>
<netcatty-cli-prefix> session --session <session-id> --json --chat-session <chat-session-id>
<netcatty-cli-prefix> exec --session <session-id> --json --chat-session <chat-session-id> -- "<command>"
```

`--` 后传入一个 shell-ready 命令字符串，保留命令内部引号。

## 长任务流程

适用于构建、扫描、迁移、watch、`tail -f`、持续 ping、长日志跟随。

```bash
<netcatty-cli-prefix> job-start --session <session-id> --json --chat-session <chat-session-id> -- "<command>"
<netcatty-cli-prefix> job-poll --job <job-id> --offset 0 --json --chat-session <chat-session-id>
<netcatty-cli-prefix> job-stop --job <job-id> --json --chat-session <chat-session-id>
```

轮询使用上一次结果里的 `nextOffset`。默认约 30 秒轮询一次，输出显示完成后立即停止轮询并分析结果。

## 命令选择

- `exec` 承载约 60 秒内完成的命令，例如 `hostname`、`pwd`、`whoami`、`uname -a`、`df -h`、`free -m`。
- 简单读取任务使用一条直接命令。
- 需要循环、分支、复杂解析时再写脚本。
- 避开 `$()` 和反引号形式的命令替换，Netcatty 安全策略可能拦截这类模式。
- 串口/raw session 和网络设备 session 会按原样发送命令，结果通常没有 exit code。
