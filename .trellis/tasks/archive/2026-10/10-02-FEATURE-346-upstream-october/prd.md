# 同步十月上游改动

## 目标
合并 binaricat/Netcatty 上游 main 到 fork main，随后同步本地主仓。用户所称 master 对应现有 main；保留 fork 自用能力和主仓未提交改动。

## 背景
- fork 起点 `1ab475ed`，上游快照 `b2ed83ae5108b479d1b509aba208a233e5240a0f`，共同祖先 `93d41dc6`。
- 上游新增 971 个提交，涉及 1228 个文件。
- 主仓 `/Users/fengit/workspace/tools/Netcatty` 当前 main `81eea397`，11 个 Trellis/提示词文件有用户改动。

## 要求
- 保留多控制台主机 tab、SFTP 默认跟随目录、Monaco 打包资源、CLI skill 与安装脚本。
- 解决冲突并验证最终代码。
- 只推送 hmilyfyj/Netcatty，PR 目标 main；合并后快进同步主仓。
- 主仓脏文件保持原内容且不提交；同步写入重叠时先保存明确路径的可恢复快照，快进后恢复原文件并逐一校验内容。无法安全保留时停止并报告。

## 验收
- [ ] 上游和 fork 原 main 均为最终提交祖先，无未解决冲突。
- [ ] lint、相关回归、全量测试及生产构建通过，失败有明确记录。
- [ ] PR 合入 fork main，主仓完成同步且用户改动保持一致。

## 范围
本次交付为代码合并与本地主线同步。生产构建用于验证；安装版沿用当前版本。
