# 抖音小游戏图标 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为《雀趣消消乐》生成并验收 3 张可直接用于抖音小游戏后台的 600×600 PNG 方形图标。

**Architecture:** 以项目现有微信小游戏图标作为风格参考，分别生成“眨眼萌牌”“三牌消除”“雀趣组合”三个独立构图。生成结果保存到独立的 `assets/douyin/` 目录，再进行统一的精确缩放与像素、透明度、视觉内容检查。

**Tech Stack:** 内置图像生成工具、PNG、Pillow（仅用于精确缩放和机械验收）

## Global Constraints

- 数量：3 个独立候选图标。
- 格式：PNG；尺寸：每张精确 600×600 像素。
- 画布：完整正方形，四角不做圆角、透明圆角或圆角遮罩。
- 禁止内容：水印、二维码、平台标识、游戏名称及其他文字。
- 视觉：暖黄/金黄背景、绿色描边、红蓝绿麻将花色、Q 版轻立体休闲游戏插画。
- 文件命名：`douyin-icon-cute-tile.png`、`douyin-icon-match-three.png`、`douyin-icon-mahjong-fan.png`。

---

### Task 1: 生成三个候选图标

**Files:**
- Create: `assets/douyin/douyin-icon-cute-tile.png`
- Create: `assets/douyin/douyin-icon-match-three.png`
- Create: `assets/douyin/douyin-icon-mahjong-fan.png`

**Interfaces:**
- Consumes: `assets/wechat/mini-program-avatar-144.png` 至 `mini-program-avatar-144-v6.png` 作为风格参考。
- Produces: 三张正方形高分辨率 PNG 源图，供 Task 2 精确缩放与验收。

- [ ] **Step 1: 生成“眨眼萌牌”**

  使用 `logo-brand` 图像生成提示：单张拟人麻将牌居中、眨眼表情、暖黄色完整方形背景、绿色描边、少量星芒；无文字、水印、二维码、平台标识、圆角或透明边角。

- [ ] **Step 2: 生成“三牌消除”**

  使用 `logo-brand` 图像生成提示：三张麻将牌形成紧凑三角构图，中心碰撞星芒与消除粒子；保持同一配色和画风；无文字、水印、二维码、平台标识、圆角或透明边角。

- [ ] **Step 3: 生成“雀趣组合”**

  使用 `logo-brand` 图像生成提示：多张无文字花色麻将牌扇形绽放排布，以红蓝绿图形强化层次；保持同一配色和画风；无文字、水印、二维码、平台标识、圆角或透明边角。

- [ ] **Step 4: 视觉初检**

  逐张打开源图，确认主体完整、构图区别明显、风格统一，且不存在文字、乱码、水印、二维码、平台标识和视觉圆角。

### Task 2: 精确缩放并验收交付文件

**Files:**
- Modify: `assets/douyin/douyin-icon-cute-tile.png`
- Modify: `assets/douyin/douyin-icon-match-three.png`
- Modify: `assets/douyin/douyin-icon-mahjong-fan.png`

**Interfaces:**
- Consumes: Task 1 产出的三张正方形 PNG。
- Produces: 三张精确 600×600、可直接预览和选择的 PNG。

- [ ] **Step 1: 缩放到精确尺寸**

  使用 Pillow 的 LANCZOS 重采样将每张源图转为 600×600，并覆盖对应交付文件；保持 RGB/RGBA PNG，不添加圆角遮罩。

- [ ] **Step 2: 运行机械验收**

  对三个文件读取 `format`、`size` 和四角 alpha。预期每张 `format == "PNG"`、`size == (600, 600)`；若存在 alpha，四角 alpha 必须等于 255。

- [ ] **Step 3: 运行最终视觉验收**

  逐张以原始分辨率打开，确认无文字、水印、二维码、平台标识和圆角；主体在缩略图尺度清楚；三张构图不同且画风统一。

- [ ] **Step 4: 提交图标资产**

  ```powershell
  git add -- assets/douyin/douyin-icon-cute-tile.png assets/douyin/douyin-icon-match-three.png assets/douyin/douyin-icon-mahjong-fan.png
  git commit -m "feat: add Douyin mini-game icon candidates"
  ```

### Task 3: 将候选 A 修订为双麻将构图

**Files:**
- Modify: `assets/douyin/douyin-icon-cute-tile.png`

**Interfaces:**
- Consumes: Task 2 已验收的“眨眼萌牌”600×600 PNG 和用户确认的双牌设计修订。
- Produces: 保持原有画风、背景和主角气质的双麻将候选 A。

- [ ] **Step 1: 编辑候选 A**

  将原眨眼麻将保留为前景主角，在其后方斜向加入一张带不同圆点花色和开心表情的伙伴麻将；两张牌轻微靠拢，保持主次层级，禁止平均并排。

- [ ] **Step 2: 精确缩放**

  使用 Pillow LANCZOS 将编辑结果转为 600×600 RGB PNG，并覆盖 `assets/douyin/douyin-icon-cute-tile.png`。

- [ ] **Step 3: 机械与视觉验收**

  确认 PNG 尺寸为 600×600、模式为 RGB、四角不透明；视觉上确认恰好两张麻将、主角在前伙伴在后、无文字、水印、二维码、平台标识和圆角。

- [ ] **Step 4: 提交修订图标**

  ```powershell
  git add -- assets/douyin/douyin-icon-cute-tile.png
  git commit -m "feat: revise primary Douyin icon with two tiles"
  ```

