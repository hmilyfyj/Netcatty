# Plugin SDK 目录

- `packages/plugin-sdk/src/index.ts` — SDK 导出
- `packages/plugin-sdk/src/index.test.ts` — 契约对齐测试
- 构建：`packages/plugin-sdk/tsconfig.build.json`

宿主实现仍在 `electron/plugins/`，不要把 PluginManager / PluginRpcRouter 搬进 SDK。
