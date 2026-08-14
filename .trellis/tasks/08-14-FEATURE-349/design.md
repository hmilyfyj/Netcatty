# 设计：Netcatty Trellis 接入

## 边界

- 只改流程与文档：`.trellis/`、平台目录、`.gitignore`、`AGENTS.md`、`.gitattributes`。
- 不改 `App.tsx`、bridges、domain、renderer 业务逻辑。
- 远端只推 `origin`（`hmilyfyj/Netcatty`），目标分支 `main`。

## 平台组合

对齐镖局 node 已入库目录：

| 平台 | 目录 | 作用 |
| --- | --- | --- |
| Claude Code | `.claude/` | commands / hooks / skills |
| Codex | `.codex/` + `.agents/skills/` | hooks、sub-agent、跨平台 skills |
| Pi Agent | `.pi/` | extension、prompts、agents |
| Trae | `.trae/` | commands / hooks / skills |

`.grok/` 在镖局是本地目录且被 gitignore，不纳入本仓。

## gitignore 策略

根目录是 default-deny。Layer 2 必须显式放行：

```
!.trellis/  !.trellis/**
!.agents/   !.agents/**
!.claude/   !.claude/**
!.codex/    !.codex/**
!.pi/       !.pi/**
!.trae/     !.trae/**
```

Layer 3 删除整目录拒绝 `.claude/`、`.codex/`，改成只拒本地态：

- `.claude/settings.local.json`
- `.grok/`

`.trellis/.gitignore` 继续忽略 `.developer`、`.runtime/`、`__pycache__`。

## 包与 spec 结构

```text
packages:
  desktop:            path: .
  plugin-contract:    path: packages/plugin-contract
  plugin-sdk:         path: packages/plugin-sdk
  plugin-cli:         path: packages/plugin-cli
default_package: desktop
```

spec 层按本仓真实边界，不用 frontend/backend 空壳：

```text
.trellis/spec/
  guides/
  desktop/app/
  plugin-contract/shared/
  plugin-sdk/runtime/
  plugin-cli/cli/
```

`desktop/app` 固化 AGENTS.md / CLAUDE.md 已验证约定：domain 纯函数、application hooks 管状态、infrastructure 管 I/O、components 只展示、electron bridges 走 IPC。

## 兼容与回滚

- 新增目录对运行时无影响；用户不读 Trellis 也能照常开发。
- 回滚：删 feature 分支或 revert 接入 commit。
- 上游合并时 `.gitignore` allowlist 可能冲突，按「放行 Trellis 目录、继续拒绝本地 agent 态」合并。
