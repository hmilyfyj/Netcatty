# Domain

## 何时使用

改 Host、Key、Workspace、凭证、笔记、端口转发等实体，或抽取可单测的纯函数。

## 本地模式

- `domain/` 只放纯 TypeScript：无 React、无 `localStorage`、无 `window.electron`。
- 实体从 `domain/models.ts` 再导出，实现按主题拆在 `domain/models/`。
- Host 规范化走 `domain/host.ts` 的 `sanitizeHost` / `normalizeDistroId`。
- Workspace 树操作走 `domain/workspace.ts`。
- 侧栏分屏树走 `domain/sidePanelLayout.ts`。
- 凭证占位与加密判断走 `domain/credentials.ts`。

参考：

- `domain/models.ts`
- `domain/host.ts`
- `application/state/useVaultState.ts`（只消费 domain，不把规范化写回 hook）

## 反模式

- 在 domain 里读 storage key 或发 IPC。
- 把 UI 文案或 Tailwind class 放进 domain。
- 新增实体类型却只写在组件 props 里。
