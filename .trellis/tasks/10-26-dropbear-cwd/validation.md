## 结果

- 旧代码回归测试失败：目录探测 exec 请求超过 Dropbear 的 9000 字节上限。实际完整 React 界面及显式 cwd 查询也能稳定复现，路由器日志为 `String too long`。
- 修复后相关测试 176 通过、10 跳过，覆盖 cwd、bounded exec、连接复用、ET、server stats、SFTP cwd 及 inherited cwd。
- `npm run lint`、`npm run build`、arm64 打包、包内算法自检和代码签名校验通过。
- 在实际 arm64 包及 `/Applications/Netcatty.app` 安装位置分别运行完整 React 终端：等待自动初始化、继续输入、系统查询、cwd `/root` 与同一连接 SFTP 根目录 18 项读取均通过；终端保持连接。
- 本机应用已更新，原用户数据保留，替换前版本保留独立备份。新包 ASAR SHA-256 为 `c0501e27f66e0722aa0866aa11223d421520e399a3301b3775debcaa0e2a85db`。

## 未验证及独立问题

未重跑全库测试或 TypeScript 全库检查（本次仅修改 CJS bridge），未做 Windows/Linux 实机测试。包为本地 ad-hoc 签名，未公证。

远端 `/etc/profile` 调用不存在的 zsh 仍会报错；实测该提示不影响修复后的终端继续使用，路由器配置未修改。目标设备缺 stty，未重复声称窗口实际尺寸已核验。
