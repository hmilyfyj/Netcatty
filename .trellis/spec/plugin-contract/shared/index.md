# Plugin Contract

`packages/plugin-contract` 是插件公共线协议。改 manifest、RPC、stdio framing 或 schema 时读本目录。

## 入口

- [Directory Structure](./directory-structure.md)

## 规则

- 公共类型与常量从 `packages/plugin-contract/src/index.ts` 导出。
- JSON schema 只放 `packages/plugin-contract/schema/`。宿主和 CLI 都读这一份。
- generated 文件由契约生成，不手改 `src/generated/`。
- 线协议限制（JSON 深度、RPC 字节、stream window）用 generated limits，不要在宿主里再抄一套魔法数。

参考：

- `packages/plugin-contract/src/index.ts`
- `packages/plugin-contract/src/stdioFraming.ts`
- `AGENTS.md` Plugin host runtime
