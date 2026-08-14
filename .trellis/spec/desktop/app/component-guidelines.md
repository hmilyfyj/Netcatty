# Components

## 何时使用

改 Vault、终端、SFTP、设置、AI 侧栏或公共控件。

## 本地模式

- 组件只做展示和事件转发。业务计算放到 hook 或 domain。
- Vault 子页侧栏用 `components/ui/aside-panel.tsx`：`AsidePanel` / `AsidePanelHeader` / `AsidePanelContent`。
- AsidePanel 用 `absolute`，挂在 section 根节点；父级要 `relative` 或 `absolute inset-0`。
- 终端侧栏：`TerminalLayerSidePanelSection.tsx` 共用工具条；pane 内容宿主保持 `overflow-hidden`。工具面板用稳定 portal，不要在 host 未就绪时退回 `absolute inset-0`。
- 图标优先 `lucide-react`。已有 shadcn/Radix 封装放在 `components/ui/`。

参考：

- `components/ui/aside-panel.tsx`
- `AGENTS.md` Aside Panel Design System

## 反模式

- 手写 `fixed right-0 ... w-[380px]` 侧栏，而不用 AsidePanel。
- 在组件里 `fetch` / 直接读 `localStorage`。
- 把大段 view-model 计算堆在 JSX。
