# 《雀趣消除乐》软著材料包 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 生成《雀趣消除乐游戏软件 V1.0》个人软著申请所需的四份 Word 材料，并统一项目内用户可见游戏名称。

**Architecture:** 使用一个可复现的 Python 文档构建脚本读取项目自有 TypeScript 源文件，生成信息采集表、软件说明书、源程序鉴别材料和提交核对清单。项目改名与文档生成分开提交；所有 DOCX 使用 `compact_reference_guide` 设计预设，源程序文档采用等宽字体专用覆盖，并通过 LibreOffice 渲染逐页检查。

**Tech Stack:** Cocos Creator 3.8.7、TypeScript、Python 3、python-docx、LibreOffice/Poppler 渲染工具

## Global Constraints

- 软件全称：雀趣消除乐游戏软件；简称：雀趣消除乐；版本号：V1.0。
- 著作权人：自然人；独立开发；原始取得；全部权利；未发表。
- 开发完成日期：2026年7月18日。
- 姓名、身份证号码、手机号、邮箱、通讯地址必须留空，不得虚构。
- 项目根目录名称保持不变；不修改第三方依赖、缓存和构建产物。
- 抖音小游戏名称、游戏内展示名称与软著名称/简称统一为“雀趣消除乐”。
- 文档输出目录：`docs/soft-copyright/`；内部渲染目录：`tmp/soft-copyright-render/`。

---

### Task 1: 统一项目名称

**Files:**
- Modify: `package.json`
- Modify: `assets/scripts/DuiDuiMahjongGame.ts`
- Modify: `docs/superpowers/specs/2026-07-18-douyin-mini-game-icons-design.md`
- Modify: `docs/superpowers/plans/2026-07-18-douyin-mini-game-icons.md`

**Interfaces:**
- Consumes: 已确认的新名称“雀趣消除乐”。
- Produces: 项目配置、游戏内标题和当前项目文档中的统一名称。

- [ ] **Step 1: 写入名称一致性检查脚本**

  在 PowerShell 中运行 `rg -n --hidden --glob '!library/**' --glob '!temp/**' --glob '!node_modules/**' --glob '!.git/**' --glob '!.worktrees/**' "雀趣消消乐" .`，记录当前自有文件中的旧名称命中。

- [ ] **Step 2: 执行最小替换**

  仅把上述自有文件中的“雀趣消消乐”替换为“雀趣消除乐”；保留工程根目录名称和历史 Git 提交信息。

- [ ] **Step 3: 验证名称一致性**

  再次运行同一 `rg` 命令。预期：自有项目文件无旧名称命中；`package.json` 与 `GAME_TITLE` 均包含“雀趣消除乐”。

- [ ] **Step 4: 提交改名**

  ```powershell
  git add -- package.json assets/scripts/DuiDuiMahjongGame.ts docs/superpowers/specs/2026-07-18-douyin-mini-game-icons-design.md docs/superpowers/plans/2026-07-18-douyin-mini-game-icons.md
  git commit -m "feat: rename game to 雀趣消除乐"
  ```

### Task 2: 构建可复现的软著文档生成器

**Files:**
- Create: `tools/build_soft_copyright_docs.py`

**Interfaces:**
- Consumes: `assets/scripts/**/*.ts`、已确认登记信息和项目元数据。
- Produces: `build_all(output_dir: Path) -> list[Path]`，生成 Task 3 的四份 DOCX。

- [ ] **Step 1: 实现统一文档样式**

  在脚本中实现 `configure_document(doc, title, subtitle)`：Letter 纵向、四边 1 英寸、正文微软雅黑 10.5pt、1.25 倍行距、标题和表格使用 `compact_reference_guide` 的明确间距、颜色与固定 DXA 几何。

- [ ] **Step 2: 实现信息采集表生成器**

  实现 `build_application_form(out_path)`，写入已确认登记信息，并为姓名、身份证号码、手机号、邮箱和通讯地址提供空白横线；增加技术信息核对区和申请人签字区。

- [ ] **Step 3: 实现软件说明书生成器**

  实现 `build_user_manual(out_path)`，基于项目代码真实功能写入软件概述、运行环境、核心玩法、关卡/牌堆、撤回/提示/洗牌、设置、音乐音效、广告服务和异常处理。加入“正式提交前插入实际运行截图”的醒目标注和五类截图清单，不虚构界面截图。

- [ ] **Step 4: 实现源程序材料生成器**

  实现 `build_source_listing(out_path)`：按固定顺序读取五个自有 TypeScript 文件，清理空白行尾但不改写代码；使用 Consolas/等宽字体 8pt、单倍行距、每页最多 50 行、每页强制分页；页眉标注软件全称和版本，页脚标注连续页码；代码不足 60 页时提交全部并在扉页说明。

- [ ] **Step 5: 实现核对清单生成器**

  实现 `build_submission_checklist(out_path)`，按“申请前、软著提交、证书领取、抖音资质、小游戏备案”五阶段列出复选项，包含名称、著作权人/平台主体、授权书、电子证书限制、第三方素材和版号提示。

- [ ] **Step 6: 实现主入口和结构验收**

  实现 `build_all()` 和命令行入口；生成后重新打开每个 DOCX，断言文件非空、核心标题存在、个人敏感字段为空白、四个文件名齐全。

### Task 3: 生成并渲染四份 Word 材料

**Files:**
- Create: `docs/soft-copyright/01-软著申请信息采集表-雀趣消除乐V1.0.docx`
- Create: `docs/soft-copyright/02-软件说明书-雀趣消除乐V1.0.docx`
- Create: `docs/soft-copyright/03-源程序鉴别材料-雀趣消除乐V1.0.docx`
- Create: `docs/soft-copyright/04-提交前核对清单-雀趣消除乐V1.0.docx`
- Create: `docs/soft-copyright/README.md`

**Interfaces:**
- Consumes: Task 2 的 `build_all()`。
- Produces: 可打开、可打印、可继续填写的软著材料包。

- [ ] **Step 1: 运行生成器**

  使用工作区捆绑 Python 运行 `tools/build_soft_copyright_docs.py --output docs/soft-copyright`。预期输出四个 DOCX，并打印每个文件的路径与页数预估。

- [ ] **Step 2: 生成使用说明**

  创建 `README.md`，说明四个文件的用途、仍需用户填写的个人字段、说明书所需实际截图、在线申请时的上传顺序及官方参考链接。

- [ ] **Step 3: 运行结构验收**

  重新读取四个 DOCX，验证标题、软件名称、版本号、空白隐私字段、源文件清单和核对阶段完整；对项目运行 `rg` 确认没有旧名称残留。

- [ ] **Step 4: 渲染所有 DOCX**

  对四个文件分别运行文档技能的 `render_docx.py`，输出到 `tmp/soft-copyright-render/<stem>/`；预期每个目录至少产生一个 `page-*.png`，无转换错误。

- [ ] **Step 5: 逐页视觉检查**

  打开全部渲染页，检查中文字体、页眉页脚、代码分页、表格宽度、空白填写区、标题层级、裁切和重叠；发现问题后修改生成器并重新生成、重新渲染。

- [ ] **Step 6: 提交材料包**

  ```powershell
  git add -- tools/build_soft_copyright_docs.py docs/soft-copyright
  git commit -m "docs: add software copyright application package"
  ```

