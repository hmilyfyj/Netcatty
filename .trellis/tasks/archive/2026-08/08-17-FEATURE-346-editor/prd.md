# 修复 SFTP 编辑器转圈

## Goal

SFTP 点编辑后，弹窗工具栏和字数已经出来，中间 Monaco 一直转圈。让安装版能真正加载本地 `monaco/vs`，编辑区显示文件内容。

## 背景/已知事实

- 用户截图：`cron_docker.sh` 弹窗标题、语言 Shell、底部 `28 lines • 1117 characters` 都在，中间是 `Loader2` 大转圈。这是 `TextEditorPane` 里 `@monaco-editor/react` 的 `loading`，文件已经读到。
- 生产路径写成 `` `${BASE_URL}monaco/vs` ``，`vite.base` 是 `./`，得到 `./monaco/vs`。打包后这段配置跟 chunk 一起跑，AMD loader 会相对 `dist/assets/` 去找 monaco。
- `scripts/copy-monaco.cjs` 拷到 gitignore 的 `public/monaco`，靠 npm `prebuild`。当前 worktree 的 `public/monaco` 和 `dist/monaco` 都不存在。
- `electron-builder` 排除了 `node_modules/monaco-editor`。安装包 asar 里也没有 monaco。
- 脚本编辑器 `ScriptCodeEditor.tsx` 用同一套路径。

## Requirements

- 抽出 `resolveMonacoVsPath`：生产环境按页面 `baseURI` 解析到 `dist/monaco/vs`，开发环境仍用 `node_modules/monaco-editor/min/vs`。
- `TextEditorPane` 和 `ScriptCodeEditor` 共用这个路径。
- Vite build 必须把 `monaco-editor/min/vs` 拷进 `dist/monaco/vs`；缺 `loader.js` 时构建失败。
- 补单测覆盖路径解析。
- 重新构建并安装到 `/Applications/Netcatty.app`。不推给 `binaricat/Netcatty`。

## 范围外

- 不换成 CodeMirror，不改 SFTP 读文件/保存逻辑。

## Acceptance Criteria

- [x] AC-1: `node --test --import tsx infrastructure/monaco/monacoVsPath.test.ts` 通过。
- [x] AC-2: 生产 `resolveMonacoVsPath` 在 `file:///.../dist/index.html` 下得到 `file:///.../dist/monaco/vs`。
- [x] AC-3: `dist/monaco/vs/loader.js` 存在，安装版打开 `cron_docker.sh` 能看到正文，中间不再转圈。（loader.js 已在 dist；FEATURE-346 已 done）
