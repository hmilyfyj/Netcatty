# 接入 Trellis 并按镖局 node 配置平台

## Goal

给 Netcatty 接入 Trellis 0.6.14，平台组合对齐镖局 `saas-backend-node`：Claude Code、Codex、Pi Agent、Trae。仓库用 allowlist `.gitignore`，必须把 Trellis 与平台目录纳入可提交范围。spec 按本仓真实分层写，禁止留下 frontend/backend 空模板。

## 背景/已知事实

- 主仓 `/Users/fengit/workspace/tools/Netcatty`，主干 `origin/main@cb620ec3`，没有 `develop`。
- 镖局 node 已跟踪的平台目录：`.claude`、`.codex`、`.pi`、`.trae`，以及共享 `.agents/skills/`。`trellis platforms` 在该仓当前只报 Pi，是检测口径问题；本任务按 git 已跟踪平台对齐。
- 本仓 `.gitignore` 是三层 allowlist：根目录默认 `/*` 拒绝；`.claude/`、`.codex/` 在 Layer 3 再拒绝一次。不改 gitignore 则 Trellis 文件无法入库。
- `AGENTS.md` 已存在项目架构说明；`trellis init` 跳过了该文件，需要手工补 `<!-- TRELLIS:START -->` 块。
- 自动探测把 `packages/plugin-*` 和 `examples/plugins/hello-netcatty` 当成全部 package，`default_package` 写成了 `@netcatty/plugin-cli`，和 yaml key 对不上。主应用在仓库根：`domain/`、`application/`、`components/`、`infrastructure/`、`electron/`。
- 本机 CLI：`@mindfoldhq/trellis@0.6.14`。

## Requirements

- 执行 `trellis init --claude --codex --pi --trae -y -u fengit`，开发者身份为 `fengit`。
- `trellis platforms --json` 包含 claude-code、codex、pi、trae。
- `.gitignore` allowlist 放行 `.trellis/`、`.agents/`、`.claude/`、`.codex/`、`.pi/`、`.trae/`；本地态继续忽略（`.developer`、`.runtime`、`.claude/settings.local.json`）。
- `AGENTS.md` 保留现有项目说明，并加上 Trellis 指令块。
- `config.yaml` 声明 `desktop`（`.`）为默认包，保留 plugin-contract / plugin-sdk / plugin-cli；示例插件不进 package 列表。
- `.trellis/spec/` 按桌面应用与插件包写事实规范，删除空模板和 example-hello-plugin spec。
- 提交到 `feature/FEATURE-349-trellis`，MR 目标 `main`。

## 范围外

- 不改业务功能代码（SSH、主机展示、上游合并）。
- 不推送到上游 `binaricat/Netcatty`。
- 不把镖局的 Astro/GraphQL/Drizzle spec 原文搬过来。
- 不在本任务安装应用到本机。

## Acceptance Criteria

- [x] AC-1: `trellis platforms --json` 含 claude-code、codex、pi、trae 四个 id。
- [x] AC-2: `git check-ignore` 对 `.trellis/config.yaml`、`.claude/settings.json`、`.codex/config.toml`、`.pi/settings.json`、`.trae/hooks.json`、`.agents/skills/trellis-start/SKILL.md` 均不命中。
- [x] AC-3: `AGENTS.md` 含 `<!-- TRELLIS:START -->` / `<!-- TRELLIS:END -->`，且原有 domain/application/UI 说明仍在。
- [x] AC-4: `.trellis/config.yaml` 的 `default_package` 为 `desktop`，packages 仅 desktop / plugin-contract / plugin-sdk / plugin-cli。
- [x] AC-5: `.trellis/spec/` 无 `To fill` / `To be filled` / `placeholder`；`desktop` 规范引用真实路径（如 `domain/models.ts`、`infrastructure/config/storageKeys.ts`）。
- [x] AC-6: `python3 ./.trellis/scripts/task.py validate FEATURE-349` 通过；feature 分支已提交并可推到 origin。
