# Sand Mosaic H5

当前首页为关卡编辑器，使用说明见 [EDITOR_README.md](EDITOR_README.md)。原纯游戏入口为 `play.html`。

macOS（Apple Silicon）：双击 `Start.command`，或在此目录运行 `bash start.sh`。需要 arm64 Python 3.11–3.13，首次启动会联网安装依赖。Windows：双击 `start.exe`。两者均无需 Node.js。

## 关卡与配置

- `levels/level_*.json`：Unity 中 577 个原始文件，逐字节复制。
- `levels/catalog.json`：Unity 原目录，550 项主线、150 项循环；主线第 1 关对应原始 ID 58。
- 页面支持主线、循环、原始 ID 三种浏览方式及搜索。主线末关完成后切入循环。
- `import-manifest.json` 记录源路径及 SHA-256。`node import-unity.cjs` 可从原 Unity 目录重新同步原文件。
- 运行时可变状态独立于配置；重开不会污染 JSON 或原始对象。

## 兼容与问题

沙粒支持 `GrainRuns` 和旧式 `GrainFills`。H5 运行时在 `board.js` 中实现移动碰撞、方向锁、冻块、锁钥匙、桌布、多层盒子、胶合组、玻璃、岩石、车库、转轴、管道、隐藏平台、出盒队列、彩色地格、计时和过关判定。`sand.js` 负责粒子网格；`app.js` 是纯游戏页面 `play.html` 的入口；编辑器入口为 `static/js/editor.js`。

原始 ID 8（时间 0）、257（空目标）、568（红沙容量缺口）有原配置问题，原样保留且页面明确提示。详见 [COMPATIBILITY.md](COMPATIBILITY.md)。

当前是 Canvas 俯视实现，采用整格拖动，没有复刻 Unity 的连续插值、3D 模型、音效和飞沙动画，也未接入体力、商业化与道具系统。HammerCount 在当前 Unity SandBoard 核心中没有独立的消除规则，H5 同样不虚构该规则。

## 验证

以下脚本仅供开发验证，需要 Node.js；日常使用编辑器不需要。浏览器回归测试使用 `node tests/preview-server.cjs` 启动测试服务（默认端口 8765，可通过 PORT 指定），并将 EDITOR_TEST_URL 设置为对应地址。

```text
node audit-levels.cjs
node verify-board.cjs
node verify-app.cjs
```

覆盖源文件哈希、所有关卡构建与短步模拟、关键机制测试、576 个可加载关卡的 Canvas 绘制调用、关卡列表及循环切换、异常关卡恢复。

这些是程序验证，**不是 577 关人工通关或浏览器视觉验收**。浏览器访问此前被工具策略拦截，未以其他浏览器绕过。旧版遗留脚本与下载模板已清理。
