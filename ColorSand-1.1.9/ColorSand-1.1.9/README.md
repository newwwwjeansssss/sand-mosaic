# ColorSand 1.1.9 关卡导出

来源：通过 ADB 读取已连接手机的 `puzzle.color.sand.blocks`，版本 1.1.9（versionCode 19）。仅覆盖安装包内置资源，未获取服务器新增关卡或手机当前 A/B 分组。

- `Levels/`：按 SandMosaic 现有结构输出的 497 份关卡 JSON，每 50 个资源一个文件夹，文件名为 `level_数字.json`。
- `Levels/catalog.json`：现有 version=2 索引格式。默认主线 1–470，循环 34–470，来自原包本地配置。颜色使用 ColorSand 原始调色板，物理规则使用当前 SandMosaic 规则。
- `Source/`：497 份原始关卡数据、原版配置和教程，保留变体与所有原始字段，便于进一步复核。
- `conversion-report.json`：原资源名、PathID、导出编号、像素与沙量校验、逐关适配说明。
- `core-validation.json`：当前游戏 C# 核心的读取和初始化校验结果（如已完成）。

编号 1–470 对应同名默认主线；471–497 是 24 份带后缀的变体及 `LevelData_1000`、`LevelData_2000`、`LevelData_2001` 三份额外资源，不接入默认主线。编号与原资源名的对应关系见转换报告。

所有沙画保持原始每格 32×32 像素，转换成现有 GrainRuns 位域格式，不缩放、不删沙。颜色 0 表示原图空像素，1–12 使用随包导出的调色板。不得与现有目录调色板直接混用。

这是独立导出包，尚未导入 Unity。索引的 `path` 是导入后的标准目标地址，不是本目录物理路径。资源编号与正式游戏现有编号重叠，接入前需要分配编号并更新索引，不能直接覆盖现有关卡。

## 适配边界

497 份均可按现有字段读取，不代表原版全部机关行为已经等价复原。138 份没有下述逐关适配提示；其余 359 份在报告中列出了复核项：

- 190 份含管道：原位置建立空沙仓并使用现有供沙队列，按颜色保留总沙量；原版管道直接吸收和当前沙仓供沙的接触边、速度存在差异。
- 115 份含沙仓盖：映射为整仓玻璃，解锁时机仍需实机核对。
- 108 份含双层盒：主颜色先吸收、DoubleBoxData 后吸收，需核对切层和钥匙触发。
- 97 份含钥匙锁：依照 KeyIds 建立对应锁组，保留关系；当前外观类型与原版金银铜分类不同。
- 63 份含伸缩障碍：映射为当前转轴臂，根格碰撞和颜色过滤需要实机核对。
- `LevelData_1000` 的原始沙量大于盒子总容量，已保留原值；该资源不在默认 470 关主线内。

以上分类可以重叠。原 VoidData 合并到不可通行墙格，视觉表现不同。奖励使用当前游戏的默认 100 金币。教程原数据单独保留，未接入当前游戏引导。未进行 Unity Editor、Player、手机逐关通关验证。

## 重新导出

工具：`tools/sandmosaic/export_colorsand.py`，依赖 `UnityPy==1.25.3`。在仓库根目录执行：

```sh
python tools/sandmosaic/export_colorsand.py --apk /path/to/base.apk --configs exports/ColorSand-1.1.9/Source/config-rows.json --output /path/to/output
```

`--configs` 输入是含 `name` 和 `data` 的配置行列表（GameConfig、LevelGroupDataSO），来自原安装包类型树解析；本目录 `Source/configs.json` 是便于审阅的按名称索引副本。原 APK 的 SHA-256 记录在转换报告中。
