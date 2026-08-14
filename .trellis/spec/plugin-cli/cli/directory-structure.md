# Plugin CLI 目录

- `src/cli.ts` / `src/commands.ts` — 命令边界
- `src/archive.ts` — `.ncpkg` 打包解包
- `src/manifest.ts` — manifest 读取与校验
- `src/compatibility.ts` — 目标兼容
- `src/packagePath.ts` — 打包路径白名单
- `src/constants.ts` — 包大小等限制
- 测试：`src/cli.test.ts`

不要在桌面应用里复制一份打包逻辑。示例插件 `examples/plugins/hello-netcatty` 只作样例，不单独维护 spec。
