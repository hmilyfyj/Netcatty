# Netcatty Tool CLI Skill 测试方法

这份测试用于确认外部 AI 能通过 `netcatty-tool-cli` 操作 Netcatty 已授权的服务器会话。

## 0. Skill 引用方式

skill 位于：

```text
skills/netcatty-tool-cli/SKILL.md
```

外部 AI 在 Netcatty 的 `Skills + CLI` 模式下会收到宿主提示，提示中包含 CLI 前缀、`--chat-session` 和默认目标 session。支持手动安装 skill 的客户端可引用整个目录：

```text
skills/netcatty-tool-cli
```

## 1. 静态校验

在仓库根目录执行：

```bash
npm run test:skill
```

期望结果：

```text
Netcatty skill validation passed.
```

覆盖内容：

- `skills/netcatty-tool-cli/SKILL.md` frontmatter。
- `references/*.md` 引用文件。
- `agents/openai.yaml` UI 元数据。
- 常用 CLI 命令示例与 `--chat-session` 约束。

## 2. CLI 桥接校验

启动包含当前代码的 Netcatty 桌面应用，并至少打开一个已连接服务器 session。然后在仓库根目录执行：

```bash
node electron/cli/netcatty-tool-cli.cjs status --json
```

期望 JSON 中包含：

- `ok: true`
- `environment: "netcatty-terminal"`
- `permissionMode`
- `discoveryFilePresent: true`

如果这里返回 `APP_NOT_RUNNING`，当前运行的 Netcatty 版本还没有启动工具桥，退出并重新启动包含本次修复的应用。

发现当前 chat scope 内 session：

```bash
node electron/cli/netcatty-tool-cli.cjs env --json --chat-session manual-test
```

拿到某个 `sessionId` 后执行：

```bash
node electron/cli/netcatty-tool-cli.cjs session --session <session-id> --json --chat-session manual-test
node electron/cli/netcatty-tool-cli.cjs exec --session <session-id> --json --chat-session manual-test -- "pwd && hostname"
```

## 3. SFTP 校验

目标 session 是已连接 SSH 会话时执行：

```bash
node electron/cli/netcatty-tool-cli.cjs sftp list --session <session-id> --remote-path /tmp --json --chat-session manual-test
```

期望返回远程 `/tmp` 列表。需要读写文件时，先用临时路径做小文件：

```bash
node electron/cli/netcatty-tool-cli.cjs sftp write --session <session-id> --remote-path /tmp/netcatty-skill-test.txt --content "hello from netcatty skill" --json --chat-session manual-test
node electron/cli/netcatty-tool-cli.cjs sftp read --session <session-id> --remote-path /tmp/netcatty-skill-test.txt --json --chat-session manual-test
node electron/cli/netcatty-tool-cli.cjs sftp delete --session <session-id> --remote-path /tmp/netcatty-skill-test.txt --json --chat-session manual-test
```

## 4. 外部 AI 校验

在 Netcatty 设置中选择 `Skills + CLI` 工具集成模式，连接一个服务器 session，然后向外部 AI 发送：

```text
使用 $netcatty-tool-cli 查看当前 Netcatty 会话，在默认服务器上执行 pwd 和 hostname，并把结果用表格返回。
```

期望行为：

- AI 先执行 `session` 或 `env`。
- AI 执行 `exec --session ... --chat-session ...`。
- AI 直接使用 Netcatty session，服务器凭证继续由 Netcatty 管理。

再测试 SFTP：

```text
使用 $netcatty-tool-cli 列出默认服务器 /tmp 目录的前 10 个条目。
```

期望行为：

- AI 先确认 session metadata。
- AI 对 SSH session 使用 `sftp list`。
- AI 返回文件列表或 Netcatty CLI 的明确错误。
