# SFTP 参考

用于远程文件读取、写入、目录列表、上传、下载、改名、权限修改等任务。

## 前置检查

先确认目标 session：

```bash
<netcatty-cli-prefix> session --session <session-id> --json --chat-session <chat-session-id>
```

继续前核对：

- `connected` 为可用状态。
- `protocol` 为 SSH 相关会话。
- 文件任务的目标路径属于远程主机时使用 `--remote-path`。
- 保存到本机的目标路径使用 `--local-path`。

## 常用命令

列目录：

```bash
<netcatty-cli-prefix> sftp list --session <session-id> --remote-path <remote-path> --json --chat-session <chat-session-id>
```

读远程文本文件：

```bash
<netcatty-cli-prefix> sftp read --session <session-id> --remote-path <remote-path> --json --chat-session <chat-session-id>
```

写入小文本文件：

```bash
<netcatty-cli-prefix> sftp write --session <session-id> --remote-path <remote-path> --content "<text>" --json --chat-session <chat-session-id>
```

下载远程文件到本机：

```bash
<netcatty-cli-prefix> sftp download --session <session-id> --remote-path <remote-path> --local-path <local-path> --json --chat-session <chat-session-id>
```

上传本机文件到远程：

```bash
<netcatty-cli-prefix> sftp upload --session <session-id> --local-path <local-path> --remote-path <remote-path> --json --chat-session <chat-session-id>
```

删除远程路径：

```bash
<netcatty-cli-prefix> sftp delete --session <session-id> --remote-path <remote-path> --json --chat-session <chat-session-id>
```

## 路径语义

- `--remote-path` 表示远程服务器路径。
- `--local-path` 表示运行 Netcatty 的本机路径。
- 用户要求下载到 `/tmp`、`~/Downloads`、Desktop 等本机位置时使用 `sftp download`。
- 用户要求创建或修改远程文件时使用 `sftp write` 或 `sftp upload`。
- 已有本机文件需要传到远程时使用 `sftp upload`。
- 已知文本内容需要写到远程时直接使用 `sftp write`。
