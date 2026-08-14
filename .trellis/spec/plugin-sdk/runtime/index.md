# Plugin SDK

`packages/plugin-sdk` 给插件作者用的运行时封装，类型全部来自 plugin-contract。

## 入口

- [Directory Structure](./directory-structure.md)

## 规则

- SDK 只包装 contract 类型与调用约定，不实现宿主侧安装/沙箱。
- 新增 RPC 方法先改 contract schema，再在 SDK 导出。
- 测试写在 `packages/plugin-sdk/src/index.test.ts`。

参考：`packages/plugin-sdk/src/index.ts`
