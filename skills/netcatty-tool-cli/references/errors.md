# 错误处理参考

当 Netcatty CLI 返回错误、超时、阻塞、需要审批或找不到 session 时阅读。

## 处理规则

- 报告 Netcatty 返回的 `code` 与 `message`。
- `APP_NOT_RUNNING`：提示启动 Netcatty 桌面应用。
- `SESSION_NOT_FOUND`：重新执行 `env --json --chat-session <chat-session-id>` 获取当前 scope 内 session。
- `COMMAND_ALREADY_RUNNING`：等待当前 session 的在途命令完成，或使用已有 job 的 poll/stop。
- `RPC_TIMEOUT`：说明当前调用超过 Netcatty RPC 等待时间，长任务场景切换到 `job-start`。
- 审批拒绝或 observer 模式：报告当前权限状态。
- 安全策略拦截：保留原始错误，选择更直接、更小的命令形态。

## 输出格式

```text
Netcatty CLI 返回错误：
code: <code>
message: <message>
```

随后给出下一步动作，例如重新发现 session、等待任务完成、请求用户在 Netcatty UI 中调整权限。
