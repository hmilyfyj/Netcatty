---
name: netcatty-tool-cli
description: 当外部 AI 需要通过 Netcatty 已连接会话执行远程命令、长任务或 SFTP 文件操作时使用。适用于 Netcatty 的 Skills + CLI 集成模式，使用主程序提供的 netcatty-tool-cli 前缀访问当前授权的服务器会话。
---

# Netcatty Tool CLI

此 skill 用于外部 ACP/CLI agent 通过 Netcatty 操作当前授权范围内的终端会话。Netcatty 负责保存服务器、凭证、代理、跳板、权限和审批；agent 只通过 CLI 操作已暴露的 session。

## 快速路由

1. 使用宿主提示中给出的 Netcatty CLI 前缀。
2. 每次调用都带上 `--chat-session <chat-session-id>`。
3. 涉及目标会话的命令都带上 `--session <session-id>`。
4. 先按任务类型选路径：
   - 远程命令：阅读 `references/exec.md`。
   - 远程文件或目录：阅读 `references/sftp.md`。
   - 会话类型、网络设备、串口：阅读 `references/session-types.md`。
   - 取消、恢复、长任务诊断：阅读 `references/control-commands.md`。
   - CLI 报错：阅读 `references/errors.md`。

## 最短可用流程

已有默认目标 session 时：

```bash
<netcatty-cli-prefix> session --session <session-id> --json --chat-session <chat-session-id>
<netcatty-cli-prefix> exec --session <session-id> --json --chat-session <chat-session-id> -- "pwd"
```

需要发现可用 session 时：

```bash
<netcatty-cli-prefix> env --json --chat-session <chat-session-id>
<netcatty-cli-prefix> session --session <session-id> --json --chat-session <chat-session-id>
```

## 核心规则

- CLI 调用串行执行，等待上一条完成后再发下一条。
- `session` 查询是执行前的确认步骤，用它核对 `protocol`、`shellType`、`deviceType`、`connected`。
- `exec` 用于约 60 秒内完成的命令。
- 长时间运行、持续输出、构建、扫描、日志跟随类任务使用 `job-start`、`job-poll`、`job-stop`。
- 文件读写、目录列表、上传下载优先走 SFTP CLI。
- SSH 凭证、私钥路径、代理、跳板链由 Netcatty 管理，agent 直接使用 session。
- Netcatty CLI 的错误结果作为当前事实依据。

## 常用命令形态

```bash
<netcatty-cli-prefix> status --json
<netcatty-cli-prefix> env --json --chat-session <chat-session-id>
<netcatty-cli-prefix> session --session <session-id> --json --chat-session <chat-session-id>
<netcatty-cli-prefix> exec --session <session-id> --json --chat-session <chat-session-id> -- "hostname && pwd"
<netcatty-cli-prefix> job-start --session <session-id> --json --chat-session <chat-session-id> -- "npm run build"
<netcatty-cli-prefix> job-poll --job <job-id> --offset 0 --json --chat-session <chat-session-id>
<netcatty-cli-prefix> sftp list --session <session-id> --remote-path /tmp --json --chat-session <chat-session-id>
```

## 输出习惯

- 结构化结果优先用简短表格。
- 执行失败时报告 Netcatty 返回的 `code` 和 `message`。
- 涉及写操作、删除、上传、长任务停止时说明目标 session 与路径。
