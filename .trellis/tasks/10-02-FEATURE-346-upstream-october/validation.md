# 十月上游合并验证

输入：fork `1ab475ed`，upstream `b2ed83ae5108b479d1b509aba208a233e5240a0f`，Node `v22.23.2`。不修改用户全局 npm 配置、不替换已安装应用；只推送 fork。

## 已通过

- `npm ci --ignore-scripts=false`：exit 0，应用全部 patch-package / xterm patches 与 native rebuild。初次 npm ci 被用户 ignore-scripts 配置隐式跳过 lifecycle，首次失败结果已作废，修正输入后重测。
- 定向回归：188 项初始冲突回归通过；最终 group/global/zoom/paste/snapshot/Tray 一批 273/273，exit 0。
- `npm run lint`：exit 0，0 errors / 18 warnings。
- `npm test`：exit 0，13083 tests，13036 pass / 47 skip / 0 fail / 0 cancelled。用户 ignore-scripts 配置仍跳过 pretest，因此分别验证内部包构建及 `npm run check:codebuddy-sdk-contract`，不误称 lifecycle 已自动运行。
- `npm run build`：exit 0；有大 chunk 提示，未新增抑制。
- `npm run generate:capability-tools`：exit 0，生成文件无 drift。
- `npm run check:codex-app-server-schema` / `npm run check:plugin-contract`：均 exit 0。
- 复用已通过 build，`CSC_IDENTITY_AUTO_DISCOVERY=false NODE_OPTIONS=--disable-warning=DEP0190 npx --no-install electron-builder --config electron-builder.config.cjs --dir --mac --arm64 --publish=never`：exit 0。Mach-O arm64，ad-hoc codesign 验证成功；ASAR 内 Monaco loader、renderer index、CLI/skill、plugin-contract/sdk dist 均存在。
- `npm run test:plugin-runtime:electron`：exit 0，`PLUGIN_RUNTIME_SMOKE_OK`，隔离 userData 的 BrowserWindow / utilityProcess 真机冒烟通过并清理夹具，不使用用户应用数据。
- 独立 review、staged/unstaged diff-check：通过，无未解决冲突。

## 未通过：继承问题，未扩修

- `npx tsc --noEmit`：exit 2，747 条诊断。纯上游同环境 745 条；逐诊断比较仅 5 条非上游，均来自原 fork 已有 Docker/timeout 孤立代码，无本次合并新增错误。详情见 `review.md`。
- `npm run test:plugin-runtime`：exit 1，462 tests：458 pass / 2 fail / 1 cancelled / 1 skip。纯上游的失败两文件基线 22 tests：19 pass / 2 fail / 1 cancelled，exit 1，同样复现。
- `pluginSyncSidecarService` 两项失败：当前 Node 22 SQLite 读取含 NUL 的 TEXT key 被截断，丢失 settings sidecar 标识；上游源码未被本次合并修改。
- `networkBroker` timeout 夹具取消：AbortSignal timeout 不保持 event loop，而 fake fetch 没有 referenced handle；上游相同夹具问题。
- 插件宿主属于默认关闭的 internal preview，本次不扩大存储格式迁移或插件功能修复。不能宣称全部检查 green。

## 日志依据

原始日志保存在任务工作目录，不提交巨量输出：`october-full-tests-final.log`、`october-final-global-regressions.log`、`october-final-lint.log`、`october-build.log`、`october-pack-dir.log`、`october-typecheck-final.log`、`october-upstream-typecheck-final.log`、`october-plugin-runtime.log`、`october-upstream-plugin-baseline.log`。
