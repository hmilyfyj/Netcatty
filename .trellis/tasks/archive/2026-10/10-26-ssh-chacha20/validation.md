# SSH ChaCha20 验证记录

## 环境

- macOS arm64，Node 24.15.0 / OpenSSL 3.5.5，Electron 42.3.3。
- `npm ci --ignore-scripts=false` 成功；postinstall 的 ssh2 patch-package 和 Electron native rebuild 均执行成功。
- `npm install --save-exact @noble/ciphers@2.2.0 --ignore-scripts=false` 成功；新增依赖无运行时子依赖。
- 夹具使用临时目录、即时生成的 SSH host key 和内存文件，不接触用户凭据或真实主机数据。

## AC 映射

| AC | 验证 | 结果 |
| --- | --- | --- |
| AC-1 | SSH/SFTP 默认、legacy、自定义列表；缺原生和缺依赖；import 抛错和缺失导出 | GREEN |
| AC-2 | 28 个 OpenSSL 对照包，双向加解密、0/1/大序号/回绕、空包至32KiB、长度/包体/MAC分片、错误长度/篡改/截断 | GREEN |
| AC-3 | ChaCha-only 本地 SSH shell、64KiB exec/SFTP、server rekey；真实构建包连接 OpenSSH | GREEN |
| AC-4 | host key 匹配登录、换 key 拒绝；AES/ChaCha 两向跳板和 forwardOut；实际应用验证 | GREEN |
| AC-5 | 真实 Electron、ASAR、arm64包、原路由器 | 包及路由器握手 GREEN；路由器登录待 1Password 签名放行 |
| AC-6 | focused test/lint；全库检查、构建及PR | 测试/lint/构建 GREEN；tsc 与基线相同；自有 fork main 的 PR #15 |

## RED

Command:

```sh
node --test electron/bridges/sshChaCha20.test.cjs
```

在增加依赖和生产补丁之前运行：3项失败。模拟无原生 ChaCha20 时，真实 SSH encrypt 仍调用不可用的 OpenSSL 原语；缺能力导出；破损依赖未使初始化失败。随后补齐了 OpenSSL 包对照和完整连接测试。

## GREEN

```sh
node --test electron/bridges/sshAlgorithms.test.cjs electron/bridges/sshChaCha20.test.cjs electron/bridges/sshChaCha20.integration.test.cjs
npx eslint electron/bridges/sshAlgorithms.cjs electron/bridges/sshAlgorithms.test.cjs electron/bridges/sshChaCha20.test.cjs electron/bridges/sshChaCha20.integration.test.cjs
```

46项通过：34项算法、8项协议/初始化、4项本地完整SSH集成。lint退出码0。

测试通过运行时钩子使原生 `chacha20` 必须失败，验证真实 ssh2 会走后备。协议夹具分别加载独立 WASM 状态的原生和后备模块，使用相同明文包逐字节比较线上密文并双向解包。篡改和截断测试明确断言未交付明文。另以可加载 addon 夹具确认缺少原生 ChaCha20 时跳过其绑定，但保留 AES-GCM 加密/解密绑定。

## 补丁维护

```sh
npx patch-package ssh2 --exclude 'package\.json$|lib/protocol/crypto/build/.*'
```

必须排除本机 native 构建产物；最终补丁仅包含源码，保留原有 certificate/agent、SFTP raw filename 和 Comware 变更。`git diff --check` 对补丁中合法的空白上下文前缀报 trailing whitespace；不得把这些统一补丁前缀当作产品源码尾空格删除。

逐块比较 `HEAD:patches/ssh2+1.17.0.patch`：原7个文件区块中的6个逐字节相同；constants 保留原有 Comware 增补且新增能力过滤；唯一新增文件区块为 crypto.js。

## 实机与交付

### 全库检查

| 命令 | 结果 |
| --- | --- |
| `npm test` | 退出0；13,052通过、44跳过、0失败，共13,096项；约207秒 |
| `npm run lint` | 退出0；0错误、18项既有 warning |
| `npm run build` | 退出0；仍有既有的大 chunk 提示 |
| `npx tsc --noEmit` | 747项既有错误；以 `git archive HEAD` 隔离未修改基线并使用同一依赖，亦747项；归一化仓库根路径后输出逐字一致，无新增错误 |

系统 Node 与应用均为 arm64。未运行无关的 `npm audit fix`，不把既有类型错误或依赖审计问题扩入本次改动。

### 真实打包应用 / 独立 OpenSSH

```sh
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder \
  --config electron-builder.config.cjs --dir --mac --arm64 --publish=never \
  -c.mac.notarize=false -c.directories.output=release/FEATURE-942
```

成功生成独立 Electron 42.3.3 / macOS arm64 应用。afterPack UUID 修补与 ad-hoc 签名完成；未做 Developer ID 签名/公证，未覆盖日用安装。

从构建后的 `Netcatty.app` 启动，以真实 renderer preload API 经由 IPC、terminal worker、SSH/SFTP bridge 连接 macOS `OpenSSH_10.2p1`，验证全部通过：

- 仅 ChaCha20、AES128-CTR、AES128-GCM：登录、终端命令、resize、正常退出；ChaCha20断开后可重新连接。
- 独立 SFTP 与复用终端的 SFTP：各138KB写入/读取一致，仅操作即时夹具。
- AES→ChaCha、ChaCha→AES 两个方向的真实应用跳板。
- 实际应用主机校验：密钥变化拒绝连接。
- 主进程 `nativeChaCha=false`、`fallback=true`；noble 从 ASAR 内动态导入，ssh2/WASM 沿用既有 unpack 布局。

默认顺序仍为 AES128-GCM、AES256-GCM、AES128-CTR、AES192-CTR、AES256-CTR、ChaCha20。独立 userData/TMPDIR 隔离测试，使用 mock keychain 避免夹具 profile 触碰用户凭据；SSH 加密和主机校验未替换。Electron、sshd 和相关子进程均已收尾。

### 原 Dropbear 路由器

使用真实新构建包的主进程、ssh2和共享算法列表，与原 Dropbear 2024.86 路由器完成握手：双向均协商 `chacha20-poly1305@openssh.com`，且与已知主机密钥指纹匹配。原 cipher 不匹配问题已消失。

本次握手探测未尝试认证。现有1Password SSH agent此前拒绝签名，完整路由器 shell/只读 SFTP 登录待用户解锁并允许签名；不得把握手成功写成登录成功。没有更改路由器配置或文件。

### 独立复核与边界

check 子代理复核完整产品 diff、安全边界、原补丁保留及针对性测试，未发现具体产品缺陷，并同步 Electron 与质量规范。主会话再次检查依赖锁、补丁区块和实际应用结果。

Windows/Linux、Intel Mac 未实机验证。未安装到日用应用、未发布上游或 Release、未合并 PR；外部 CI 由托管平台执行，本地通过不代表远端 CI 已完成。

原始日志和夹具留在任务工作区；不提交安装包提取源码、密钥、profile或本机用户路径。公开交付仅包含脱敏结果及必要的维护说明。

实现提交：`f1bfd6ec`；PR：<https://github.com/hmilyfyj/Netcatty/pull/15>（base `main`，head `agent/agent/a62e6ce604e4`）。Multica issue 为 in_review，等待用户验收。
