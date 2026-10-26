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
| AC-5 | 真实 Electron、ASAR、arm64包、原路由器 | GREEN；用户允许1Password签名后，路由器shell及只读SFTP通过 |
| AC-6 | focused test/lint；全库检查、构建及PR | 测试/lint/构建 GREEN；tsc 与基线相同；自有 fork main 的 PR #15 |
| AC-7 | 包内6种cipher、4种密钥交换、6种签名；缺依赖拒绝；CI上传前门槛 | macOS arm64实际包 GREEN；Windows/Linux路径与失败传播夹具 GREEN，未实机 |

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

### 补齐的应用回归

在同一独立构建包上，通过真实 preload/IPC 继续验证，共23项应用检查全部通过：

- local、remote、dynamic forwarding 各64KiB随机数据往返一致，随后正常停止；动态转发实际提供 SOCKS5 SSH 代理。
- HTTP CONNECT、SOCKS5、ProxyCommand 三种 SSH 代理均可登录并运行终端命令。
- 首次主机密钥信任接受/拒绝均符合选择；密钥变化仍被拒绝。
- 临时独立系统 ssh-agent 仅装入合成密钥，认证成功；未调用真实1Password agent。
- 混合 AES/ChaCha OpenSSH 的新日志确认默认实际协商 AES128-GCM。
- 密码及 PAM 单密码 keyboard-interactive 经终端 worker 登录并收到终端数据；外部 SFTP 的验证码 keyboard-interactive 成功及取消经真实 IPC 验证，成功后 REALPATH 返回正确。验证码由夹具监听器提交，未验证完整 React 终端验证码弹窗操作。

早期终端验证码夹具直接启动后端、未创建对应 React 标签页，UI 按现有规则自动取消。已改用支持外部交互认证的 SFTP 入口完成验证码验证；没有更改生产 MFA 逻辑来迎合夹具。所有测试连接、agent、应用及fixture进程均由 finally 收尾。

### 发布包算法守卫

```sh
npx eslint --no-ignore --global process --global Buffer --global console --global __filename scripts/verify-packaged-ssh-crypto.cjs
node scripts/verify-packaged-ssh-crypto.cjs release/FEATURE-942
```

均退出0。守卫启动实际包内 Electron，以其默认后端完成6种现代 AES/ChaCha SSH 包往返，核对 SSH/SFTP 默认、legacy和自定义列表；完成 X25519及3种ECDH共享值比对、Ed25519/RSA-SHA2/ECDSA共6种签名与篡改拒绝。返回 Electron42.3.3、arm64、nativeChaCha=false、result=PASS。

旧安装包的缺依赖负向检查退出1。独立复核的VM夹具覆盖5种宿主路径、非零退出传播、空输出/FAIL、超时和包外依赖拒绝；YAML解析及macOS/Windows、Linux x64、Linux arm64三个构建job在上传前执行的门槛检查通过。Windows/Linux仅模拟路径与控制流，实际包仍由对应平台构建验证。

依赖解析必须留在ASAR内，不能借用开发目录；外层除退出0还必须收到PASS JSON。CI在构建后、上传前运行，失败阻止该job上传。本次只新增守卫、CI和文档，产品代码未再改变，因此复用已通过的全库测试和独立构建包。

### 原 Dropbear 路由器

使用真实新构建包的主进程、ssh2和共享算法列表，与原 Dropbear 2024.86 路由器完成握手：双向均协商 `chacha20-poly1305@openssh.com`，且与已知主机密钥指纹匹配。原 cipher 不匹配问题已消失。

最初探测只做握手，1Password SSH agent此前拒绝签名。2026-10-26收到用户「已同意」后，用同一个独立arm64构建包的Electron主进程、包内ssh2和共享算法列表重新验证：既有1Password agent签名成功，实际登录原路由器；终端执行`uname -a`及标记输出，正常退出；同一SSH连接打开SFTP，只读列出根目录18项。已知主机密钥匹配，双向均使用ChaCha20。结果断言确认`login=true`、`verifiedHostKey=true`及SFTP目录读取成功。未修改路由器配置，未上传或写入SFTP文件。

首次登录探针因目标没有`stty`而在尺寸断言失败，实际认证和命令当时已成功。调整探针以明确报告该环境限制后复验通过；没有安装工具或修改产品代码。已发送window-change，但无法在该路由器读取实际终端尺寸；尺寸变化已在独立OpenSSH应用验收中验证。探针仅从包内主进程调用ssh2，真实preload/IPC/terminal worker路径的完整行为由前述独立OpenSSH回归覆盖。应用及连接均已收尾。

### 独立复核与边界

check 子代理复核完整产品 diff、安全边界、原补丁保留及针对性测试，未发现具体产品缺陷，并同步 Electron 与质量规范。主会话再次检查依赖锁、补丁区块和实际应用结果。

Windows/Linux、Intel Mac 未实机验证。未安装到日用应用、未发布上游或 Release、未合并 PR；外部 CI 由托管平台执行，本地通过不代表远端 CI 已完成。

原始日志和夹具留在任务工作区；不提交安装包提取源码、密钥、profile或本机用户路径。公开交付仅包含脱敏结果及必要的维护说明。

产品实现提交：`f1bfd6ec`；发布包守卫提交：`8c977337`；PR：<https://github.com/hmilyfyj/Netcatty/pull/15>（base `main`，head `agent/agent/a62e6ce604e4`）。原路由器shell及只读SFTP验收已通过，等待用户审阅PR。

独立arm64测试包已生成并通过ZIP完整性检查；150MB附件上传返回Multica服务器错误，确认没有发布评论，不反复上传大包。最终评论交付PR及小型验证报告，不声称安装包已成功交付。
