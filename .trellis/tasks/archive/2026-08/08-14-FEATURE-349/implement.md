# 实现清单

## 已完成

- [x] 从 `origin/main` 建 worktree `feature/FEATURE-349-trellis`
- [x] `trellis init --claude --codex --pi --trae -y -u fengit`
- [x] `config.yaml` 改为 desktop 默认包
- [x] 创建 task `08-14-FEATURE-349`
- [x] 更新根 `.gitignore` allowlist
- [x] `AGENTS.md` 补 PROJECT / TRELLIS 标记块
- [x] `.gitattributes` 增加 journal `merge=union`
- [x] 删除 example-hello-plugin 与空 frontend/backend 模板
- [x] 写入 desktop / plugin-* / guides 事实 spec
- [x] 更新 `implement.jsonl` / `check.jsonl`
- [x] `task.py start`；platforms / check-ignore / placeholder / validate 已通过

## 待做

- [x] 提交并推到 origin，开目标 `main` 的 PR（https://github.com/hmilyfyj/Netcatty/pull/3 已 MERGED）

## 验证命令

```bash
trellis platforms --json
git add -n -- .trellis/config.yaml .claude/settings.json .codex/config.toml .pi/settings.json .trae/hooks.json .agents/skills/trellis-start/SKILL.md
rg -n "To fill|To be filled|placeholder" .trellis/spec || true
python3 ./.trellis/scripts/task.py validate FEATURE-349
git diff --check
```

## 回滚点

提交前可丢弃 worktree。提交后用 revert。不要在主仓 `main` 上直接改。
