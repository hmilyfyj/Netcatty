# Desktop App Spec

仓库根目录是 Electron + React 桌面应用。日常功能任务默认读本目录。

## 入口

| Guide | 何时读 |
| --- | --- |
| [Directory Structure](./directory-structure.md) | 新建文件、判断归属 |
| [Domain](./domain-guidelines.md) | 改 Host / Workspace / 纯函数 |
| [Application State](./application-state.md) | 改 hooks、持久化边界 |
| [Components](./component-guidelines.md) | 改 UI、侧栏、AsidePanel |
| [Infrastructure](./infrastructure.md) | 改 storage key、adapter、service |
| [Electron](./electron-guidelines.md) | 改 main / bridge / preload / CLI / plugin host |
| [Quality](./quality-guidelines.md) | 写测试、lint、提交前检查 |
| [Capability Registry](./capability-registry.md) | 复用已有 bridge、catalog、AI harness |

## 数据流

UI (`components/`, `App.tsx`) → application hooks → domain 纯函数 → infrastructure adapter / `window.electron` IPC → `electron/bridges/*.cjs`。

组件不直接读 `localStorage`，不直接 `ipcRenderer`。

## 下一个 feature 的最小 context

```jsonl
{"file": ".trellis/spec/desktop/app/index.md", "reason": "桌面应用规范入口"}
{"file": ".trellis/spec/desktop/app/directory-structure.md", "reason": "确认文件归属"}
{"file": ".trellis/spec/desktop/app/quality-guidelines.md", "reason": "确认测试和检查命令"}
```

涉及状态或存储时再加 `application-state.md` 与 `infrastructure.md`。涉及 SSH/SFTP/终端/插件时再加 `electron-guidelines.md`。
