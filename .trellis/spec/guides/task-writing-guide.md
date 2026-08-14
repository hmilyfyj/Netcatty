# Task 文档写作指南

适用：`prd.md`、`design.md`、`implement.md`、`task.json` 的 title/description、jsonl 的 reason。

## 规则

- 中文短句。路径、命令、类型名、IPC 名保持英文。
- 标题用中文动宾短语，20 字以内。
- Goal 一段话说清做什么、影响哪一层。
- Requirements 一条一个动作。
- Acceptance Criteria 必须能用命令、页面、IPC、日志或 diff 核对。
- 轻量任务可以只有 `prd.md`。跨进程、改 storage schema、改 plugin contract 时补 `design.md` 和 `implement.md`。

## 反模式

- 只写「完成开发」。
- 把镖局 Astro/GraphQL 模板原样贴进本仓任务。
- 验收里没有可执行命令或可观察行为。
