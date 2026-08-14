# TDD 思考指南

改生产行为、IPC 契约、storage schema、plugin contract、可见 UI 时使用。

## AC 映射

| AC | 行为 | 层级 | 文件或命令 | 证据 |
| --- | --- | --- | --- | --- |
| AC-1 | 可观察结果 | unit / integration / manual | 同目录 `*.test.ts` 或 `*.test.cjs` | RED 后 GREEN |

本仓测试入口：

```bash
node --test --import tsx path/to/file.test.ts
npm test
```

领域函数和 hook 优先 unit。bridge 用同目录 `*.test.cjs`。需要真窗口的插件路径才用 `npm run test:plugin-runtime:electron`。

## 证据格式

```text
RED:
Command: node --test --import tsx domain/host.test.ts
Failure: sanitizeHost > strips empty username
AC: AC-1

GREEN:
Command: node --test --import tsx domain/host.test.ts
Pass: 1 file
AC: AC-1
```

每条 AC 至少对应 RED/GREEN、BASELINE/GUARD 或 MANUAL 之一。
