# Sand Mosaic 编辑器规范

使用 building-game-level-editors 模板重建。遵守用户已要求保留全部 Unity 配置：保留 577 个关卡，不采用模板“只保留一关”的缩减建议；新增操作只创建一个最小可试玩样例，不复制已有配置作伪随机新关。

## 玩法与空间

整数网格、非矩形 ShapeCells、沙仓细粒网格。拖动盒子只在合法空间逐格移动，贴近沙仓外露边缘取同色沙粒；装满切换下一层或移除，机关依照 board.js 更新，限时内完成全部目标取胜。试玩状态不写回编辑配置。试玩支持暂停、重试、下一关，禁止双击直接胜利。

## 数据模型

关卡保留 Unity 原 JSON：id、m_Name、m_time、m_loopTime、m_reward、m_creationData（gridSize、containers、pits、linkedPits、gluedGroups、wall、pipes、grinders、garages、platformBlockers、dispensers、coloredGrids）。未知字段原样往返。

level/level-<id>.json 为工作副本；levels/ 原始数据与 catalog 不通过编辑器覆盖。文件路径不嵌入关卡内容。主线排序读取原 catalog，仅作为排序参考；新增文件动态扫描。全量 JSON 编辑可以处理嵌套隐藏机关、管道行和沙粒，常用位置、形状和标量由物品面板修改。画布支持选择、移动、放置、擦除和沙粒画笔。

## 资产

asset.json 维护颜色资产（colorIndex 对应 Unity Color 及 GrainRuns/GrainFills 的编码）和实体预设（kind 对应数组字段、defaults 对应 Unity 实体结构）。colorIndex 是原关卡的隐式引用键，不插入 assetId。颜色/预设删除和改 ID 前遍历全部工作关卡检查；有引用禁止。新图标仅进内存，统一保存后写 level/asset/。删除资产不自动删除磁盘图片，避免误删共享文件。

## 状态与保存

只读浏览器可浏览、检验、试玩；WebView 在 pywebviewready 后接入 files API，允许编辑。所有改动、撤销与重做都在内存。右上角保存只写改变过的文件；新文件 overwrite=false；已有未编辑异常关不阻止其他文件保存。校验失败不写入；API 部分失败保留未写成功状态，重试不会把已创建的新文件当不存在。刷新前确认丢弃修改；删除关卡需确认并在保存时执行。

## 验证边界

对原始工作副本验证 SHA-256 一致；577 关验证、样例实际模拟通关、接口与保存失败恢复测试、浏览器只读测试。原始异常 ID8/257/568 保留，校验报告明确显示。UI 必须区别校验通过与已人工通关。
