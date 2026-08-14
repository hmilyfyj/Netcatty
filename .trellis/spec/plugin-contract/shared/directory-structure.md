# Plugin Contract 目录

- `src/index.ts` — 公开导出：API 版本、manifest 文件名、`.ncpkg` 扩展名
- `src/generated/` — 契约类型与 limits
- `src/jsonValue.ts` — JSON 深度/节点校验
- `src/stdioFraming.ts` — Content-Length 帧
- `src/streamTransport.ts` — stream 窗口与 credit
- `schema/plugin-contract.schema.json` — 唯一公共 schema
- 测试：`src/*.test.ts`，由根目录 `npm run test:plugin-contract` 覆盖

## 反模式

- 在 `electron/plugins/` 再定义一份 RPC 字段。
- 手改 generated 文件来“先跑起来”。
