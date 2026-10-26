# 接入后备加密

## 行为差距与归属

Electron BoringSSL 不提供原始 ChaCha20。应用共享过滤与 ssh2 constants 双重排除了它；ssh2 JS 路径仍调用 Node crypto，单独解除过滤无法修复。

## 最小改动

1. `package.json` / lock：精确锁定生产依赖 `@noble/ciphers@2.2.0`。
2. `patches/ssh2+1.17.0.patch`：新增原语 helper，无原生能力时使用 noble。通过既有 `crypto.init` Promise 动态 import，兼容早期 Node22；握手继续等待 init，失败时明确终止。同步导出可用后备能力（可通过 resolve 判断安装存在），constants 承认真实能力，缺原生时不得选择原生 addon ChaCha 类。
3. `electron/bridges/sshAlgorithms.cjs`：共享过滤读取 ssh2 后备能力，不全局修改 crypto、不复制到每个 bridge。
4. 同目录算法/协议测试及必要真实 Electron 冒烟脚本；更新 Electron 规范与维护要求。

原生可用时保持原逻辑。SSH 两把32字节密钥、8字节 nonce、counter0/1 及独立长度包的结构保持不动。noble `chacha20orig` 的 nonce 使用 IV 后8字节，counter 使用 IV 前部的小端值。解密仍必须在 MAC 验证后交付。

## 调用边界

已搜索调用：终端 startSession、sshBridge 跳板、execCommand、moshStatsConnection、SFTP target/hops、portForwardingBridge。均复用共享算法构建和 ssh2；不改各自接口。保持 boringSslDhCompat 在 ssh2 加载前的顺序。

## 兼容与回退

保留原有证书/agent/SFTP raw filename/Comware 补丁、AES 列表顺序和认证/known-hosts。构建到独立目录及独立 userData，避免改日用安装。撤销依赖、增补补丁和共享过滤后可回退，无数据迁移。

## 已确认依据

前期附件已完成168组 OpenSSL/noble 对照及同版本 Electron 主进程/ASAR 动态 import 试验。原始资源在任务工作区 `../.task-evaluation/`，不向提交中带入安装包源码、凭据或本机路径。
