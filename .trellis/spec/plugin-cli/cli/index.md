# Plugin CLI

`packages/plugin-cli` 负责 init / pack / validate `.ncpkg`。

## 入口

- [Directory Structure](./directory-structure.md)

## 规则

- 打包与解包走 `archive.ts` 的 `buildPluginPackage` / `extractPluginPackage`。
- manifest 校验走 `manifest.ts`，schema 来自 plugin-contract。
- 路径安全走 `packagePath.ts` 的 `assertSafePackagePath`。
- 兼容性检查走 `compatibility.ts`。
- 命令入口：`commands.ts`（`initPlugin` / `buildPlugin` / `packPlugin` / `validateTarget`）。

参考：`packages/plugin-cli/src/index.ts`、`packages/plugin-cli/src/cli.ts`
