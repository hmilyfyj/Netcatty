# 实施计划

1. 记录双方 SHA、共同祖先和主仓脏文件。
2. merge 上游，逐项解决冲突并核对 fork 自用能力。
3. 按锁文件安装依赖并构建内部包。
4. 顺序运行 lint、fork 回归、npm test、npm run build 及生成契约校验，记录退出码。
5. 独立审查最终结果、检查规范影响并提交。
6. fetch fork main 检查目标更新，推送 PR 到 main 并按授权合并。
7. 主仓安全快进同步，复核脏文件内容和最终 SHA。

## 验证
`git diff --check`、`npm run lint`、`npm run test:skill`、MCP/Vault/多控制台/SFTP/Monaco 回归、`npm test`、`npm run build`、生成 capability 与 schema 校验。

测试批次顺序执行，隔离临时夹具。行为修改限于保留 fork 与上游集成兼容。
