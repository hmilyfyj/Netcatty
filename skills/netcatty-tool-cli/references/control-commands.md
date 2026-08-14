# 控制命令参考

用于运行状态诊断、取消当前 chat scope 的任务、恢复被取消的 scope。

## 常用命令

运行状态：

```bash
<netcatty-cli-prefix> status --json
```

取消当前 chat scope 的未完成工作：

```bash
<netcatty-cli-prefix> cancel --chat-session <chat-session-id> --json
```

恢复当前 chat scope 的执行能力：

```bash
<netcatty-cli-prefix> resume --chat-session <chat-session-id> --json
```

## 行为边界

- `cancel` 影响当前 `--chat-session` 范围内的 `exec`、session-backed SFTP 传输、运行中的 job。
- `resume` 用于同一个 `--chat-session`。
- 控制命令与同一 chat session 的其他 Netcatty CLI 调用串行执行。
