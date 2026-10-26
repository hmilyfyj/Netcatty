# Quality

## 命令

```bash
npm run lint
npm run lint:fix
npm test
node --test --import tsx path/to/file.test.ts
npm run build
```

单测用 Node 内置 test runner + `tsx`，测试文件与源码同目录：`*.test.ts` / `*.test.tsx` / `*.test.cjs`。

## 规则

- 领域函数和 hook 优先补单测。参考 `domain/host.ts`、`application/state/useVaultState.ts` 旁的测试。
- 改 storage key / schema 必须有迁移或兼容读，并补测试。
- 改 capability catalog 后验证 generated JSON 无 drift。
- 改 Codex App Server 协议后：`npm run generate:codex-app-server-schema` 与 `npm run check:codex-app-server-schema`。
- 插件运行时：`npm run test:plugin-runtime`；真实窗口冒烟：`npm run test:plugin-runtime:electron`。
- 渲染进程保持 ASCII，除非已有文件本身需要非 ASCII。
- 给上游 GitHub 开 issue 必须带 `[Bug]` / `[Feature]` / `[Other]` 前缀，并填 `.github/ISSUE_TEMPLATE/`。
- 本机 npm 若设置 `ignore-scripts=true`，依赖虽安装成功但 patch-package、Electron 与 native rebuild 未执行。新 checkout 使用 `npm ci --ignore-scripts=false`，确认 postinstall 日志后再测试/打包；不要修改用户全局 npm 配置。

## SSH 加密补丁

- 改 ssh2 或加密依赖后，跑 `node --test electron/bridges/sshAlgorithms.test.cjs electron/bridges/sshChaCha20.test.cjs electron/bridges/sshChaCha20.integration.test.cjs`，覆盖缺原生/缺依赖、OpenSSL 包对照、篡改拒绝、重协商、主机密钥与 AES 跳板。
- 另用真实 Electron 和独立打包应用验证动态 import、Poly1305 WASM 与实际连接；系统 Node 的通过不能替代 BoringSSL/ASAR 验证。
- 打包后运行 `node scripts/verify-packaged-ssh-crypto.cjs [release目录]`：使用当前架构的构建包内 Electron，校验 ASAR 中的 AES/ChaCha20 包往返、SSH/SFTP 列表、Curve25519/ECDH 和 Ed25519/RSA-SHA2/ECDSA。构建工作流在上传前执行；其他架构仍须各自实机验证。
- 重新生成 ssh2 patch 时排除 `package.json` 和 `lib/protocol/crypto/build/.*`，保留既有证书、SFTP、Comware 补丁；统一补丁的空白上下文前缀不是源码尾空格。

### 包内算法自检约定

1. 触发：升级 Electron/ssh2/加密依赖或修改打包布局后执行。
2. 命令：`node scripts/verify-packaged-ssh-crypto.cjs [release目录]`，目录默认 `release`，选取宿主平台和架构的 unpacked 应用。
3. 运行：由构建包的 Electron 设置 `ELECTRON_RUN_AS_NODE=1` 加载其 ASAR；只使用合成数据，不连接主机或访问凭据。成功输出 JSON，包含 `result: "PASS"`、`electron`、`arch`、`ciphers`、`keyExchange`、`signatures`。
4. 失败：缺包/依赖解析到包外、初始化或密码学断言失败、超时、被信号终止、非零退出、空输出或没有 PASS 结果，均让命令失败并阻止 CI 上传。
5. 场景：正确完整包通过；缺原语或漏依赖的包拒绝，禁止向上查找仓库 `node_modules` 补足依赖。
6. 检查：实际包验证加解密、密钥交换两端共享值及签名/篡改拒绝；外层选择路径和失败传播可用隔离夹具检查，不能代替跨平台实机。
7. 误用：普通 Node 直接 require 开发依赖，或只凭 Electron 退出0判定成功，都会漏掉包内能力问题；必须启动构建包并确认其 PASS 结果。

## 本仓 MR

本地 fork 的 Multica 任务 MR 目标是 `origin/main`。不要推 `upstream`（`binaricat/Netcatty`）。
