# mont-forge-pipeline

**mont-forge-pipeline** —— 45 个生产级工程技能 + 11 个开发全流程工具，装一个包全都有。

> 合并自 [`addyosmani/agent-skills`](https://github.com/addyosmani/agent-skills)（25 个）与 [`mattpocock/skills`](https://github.com/mattpocock/skills)（19 个），均 MIT。归因见 [NOTICE.md](NOTICE.md)。

## 快速开始

**安装**（DSH 界面最稳，不依赖命令行）：

> DSH → **插件** → **添加插件** → 填 `mont-forge-pipeline`

命令行方式（`dsh` 可用时）：

```powershell
dsh plugin --profile <profile> add mont-forge-pipeline
```

或从 GitHub：[`git clone` 后装目录](https://github.com/royrao2007/mont-forge-pipeline)。

**验证**（新开会话后）：

```
forge_catalog
```

看到六个阶段、十一个工具和 45 个技能清单，就是装好了。

**用起来**：

```
forge_assess({ "path": "<你的项目>" })   # 先体检
forge_spec                               # 然后按阶段推进
```

完整安装方式（界面 / npm / GitHub / 本地目录 / 卸载）见下方 [安装](#安装) 章节。

## 为什么合并

技能是「说明书」，工具是「工位」：

- 只有技能时，用户得记住 45 个名字，模型还得自己判断该不该加载；
- 只有工具时，`forge_skill` 取不到正文，流程有骨架没血肉。

合成一个包后，一次安装即自洽：模型用工具走流程，需要方法论细节时按名取正文。

## 十一个工具

| 阶段 | 工具 | 产出 |
|------|------|------|
| 需求 → 规格 | `forge_spec` | 规格文档、验收标准、非目标、质量门槛 |
| 规格 → 计划 | `forge_plan` | 任务清单、阻塞边、关键路径、首个小切片 |
| 实现 | `forge_build` | 可运行的小切片与对应测试 |
| 验证 | `forge_verify` | 复现记录、根因、回归测试、验证证据 |
| 评审 | `forge_review` | 三通道闸门结论：代码评审（≥80）+ 安全审查（≥8/10）+ 可选镜头，分级问题清单、必修复项 |
| 交付 | `forge_ship` | 提交历史、CI 结果、文档、监控、回滚预案 |

旁路（不在主链上，属于同一插件）：

| 工具 | 触发时机 | 产出 |
|------|----------|------|
| `forge_standup` | 准备站会、汇总最近工作 | yesterday/today/blockers 日报（真实采集 git 活动） |
| `forge_incident` | 出现告警、事故定级、写状态通报或复盘 | 分诊/通报/缓解/复盘四阶段文档（只产出文档，不改代码） |

辅助：

- `forge_assess` — 扫描项目目录，报告技术栈、测试、CI、文档、依赖锁定与待办标记，给建议入口。开发新系统或接手陌生项目时先跑它。
- `forge_catalog` — 列出阶段、**先后逻辑**、旁路能力与已装技能，确认「现在该用哪个」。
- `forge_skill` — 按名读取某个技能的完整正文。

每个阶段工具返回「阶段目标 + 要加载的技能 + 步骤 + 产物模板 + 退出标准 + 下一步入口」，并串成一条链：

```
forge_assess（可选）→ forge_spec → forge_plan → forge_build → forge_verify → forge_review → forge_ship
```

单向链，每阶段退出标准不满足就不前进；`forge_review` 只读，落手修代码的是 `forge_build`；简化只在评审干净后跑。事故是旁路：`forge_verify` 确认是事故 → `forge_incident` 通报与复盘 → 修复回到 `forge_build` → `forge_verify` → `forge_review`。

## 45 个技能

### 来自 addyosmani/agent-skills（25 个，生命周期骨架）

| 阶段 | 技能 |
|------|------|
| **定义 Define** | `interview-me`、`idea-refine`、`spec-driven-development` |
| **规划 Plan** | `planning-and-task-breakdown` |
| **构建 Build** | `incremental-implementation`、`test-driven-development`、`source-driven-development`、`doubt-driven-development`、`context-engineering`、`constraint-driven-development`、`frontend-ui-engineering`、`api-and-interface-design` |
| **验证 Verify** | `browser-testing-with-devtools`、`debugging-and-error-recovery` |
| **评审 Review** | `code-review-and-quality`、`code-simplification`、`security-and-hardening`、`performance-optimization` |
| **交付 Ship** | `git-workflow-and-versioning`、`ci-cd-and-automation`、`deprecation-and-migration`、`documentation-and-adrs`、`observability-and-instrumentation`、`shipping-and-launch` |
| **元技能 Meta** | `using-agent-skills` |

### 来自 mattpocock/skills（19 个，独有能力）

| 类别 | 技能 |
|------|------|
| **规划与拆解** | `wayfinder`、`to-tickets`、`to-spec` |
| **设计** | `codebase-design`、`domain-modeling`、`improve-codebase-architecture` |
| **执行** | `implement`、`prototype` |
| **质量** | `triage`、`retro`、`pr` |
| **协作** | `grilling`、`grill-me`、`to-questionnaire` |
| **知识** | `research`、`teach`、`writing-for-agents` |
| **配置** | `setup-matt-pocock-skills`、`wizard` |

### 本包新增（1 个，中文意图路由）

`mont-forge` **技能**（注意：这是 45 个技能里的一个名字，不是包名）—— 总入口。
用户说「用 mont-forge 做 X」时，按内置路由表自动选 1–2 个对口子技能，不必记名字。

> 包名是 `mont-forge-pipeline`；`mont-forge` 只是其中一个技能名。

## 安装

本包是标准 npm 包 + DSH bundle，三种装法按你的环境挑一个。

### 方式一：从 npm 装到 DSH（有 CLI 时最省事）

```powershell
dsh plugin --profile <profile> add mont-forge-pipeline
```

`<profile>` 常见值：`desktop`（桌面端）、`web`、`headless`。不确定就跑 `echo $env:DSH_PROFILE`。

国内网络慢可指定镜像（同步有延迟，装不到新版就等几分钟或换官方源）：

```powershell
dsh plugin --profile <profile> add mont-forge-pipeline --registry https://registry.npmmirror.com
```

> ⚠️ `dsh` 命令来自 DSH 桌面端/CLI 的**当前版本**。如果 `dsh plugin --help` 报
> `The system cannot find the path specified`，说明你的 `dsh.cmd` 还指向旧版本安装目录
> （常见于桌面端升级后），此时用下面的方式二或方式四。

### 方式二：DSH 界面安装（不依赖命令行）

1. 打开 DSH → **插件**（Plugins）
2. 点 **添加插件**
3. 填包名 `mont-forge-pipeline`（从 npm 装）
   或点选目录（从本地克隆装，见方式四）
4. 安装完成后**新开一个会话** —— 工具列表在会话启动时快照，旧会话看不到新工具

### 方式三：从 GitHub 安装

```powershell
# 1) 克隆
git clone https://github.com/royrao2007/mont-forge-pipeline.git
cd mont-forge-pipeline

# 2) 装进 DSH（有 CLI 时）
dsh plugin --profile <profile> add .

# 3) 没有 CLI 时：在 DSH「插件 → 添加插件」里选择这个克隆出来的目录
```

指定分支或 tag（例如发布版）：

```powershell
git clone --branch v0.2.0 --depth 1 https://github.com/royrao2007/mont-forge-pipeline.git
```

**装 GitHub 版而不是 npm 版的情况**：想紧跟 `main` 的最新改动、要改代码、或 npm 镜像还没同步到新版。

### 方式四：从本地目录安装（开发 / 改代码用）

```powershell
dsh plugin --profile <profile> add "F:\path\to\mont-forge-pipeline"
```

或在「插件 → 添加插件」里选这个目录。

改完代码要让 DSH 重新加载：桌面端重启一次最稳（插件的 JS 模块在首次挂载时已载入，重启才会重新 import）。

### 安装后怎么确认成功

**1. 看插件是否加载**——DSH「插件」列表里有 `mont-forge-pipeline`。

**2. 看工具是否可用**——新会话里问：

```
forge_catalog
```

应返回六个阶段（spec / plan / build / verify / review / ship）、十一个工具，以及 45 个技能的清单。

**3. 看技能是否可用**——说「用 mont-forge 评估下这个项目」，或直接：

```
forge_skill({ "name": "code-review-and-quality" })
```

应返回该技能的完整正文（约 21 KB）。

**4. 最小自检**——跑一次真实扫描：

```
forge_assess({ "path": "<你的项目目录>" })
```

应返回文件数、技术栈、测试/CI/文档/锁文件等工程信号。

### 卸载

```powershell
dsh plugin --profile <profile> remove mont-forge-pipeline
```

或在 DSH「插件」里停用/移除。

卸载后 `%DSH_HOME%\profiles\<profile>\node_modules\mont-forge-pipeline` 可能残留
（尤其是本地目录安装的 junction），手动删掉即可，不影响其他插件。

### 其他平台

同一份 `skills/` 通过各平台外壳声明，不复制内容：

| 平台 | 安装方式 |
|------|----------|
| **Pi** | `pi install npm:mont-forge-pipeline`（`pi` key + `pi-package` keyword） |
| **Claude Code** | `/plugin marketplace add royrao2007/mont-forge-pipeline`，或订阅本仓库（`.claude-plugin/plugin.json`） |
| **Codex** | 插件市场添加本仓库（`.codex-plugin/plugin.json`） |
| **Gemini** | 订阅本仓库（`.gemini/commands/*.toml` + `commands/*.toml`） |
| **OpenCode** | 订阅本仓库，自动发现根 `skills/`（Agent Skills 规范） |

### 手动部署到 DSH 原生技能目录（不用插件时）

只想拿技能、不要那 11 个工具时：

```powershell
git clone https://github.com/royrao2007/mont-forge-pipeline.git
Copy-Item .\mont-forge-pipeline\skills\* "$env:DSH_HOME\skills\" -Recurse -Force
```

卸载（只删本仓库部署的技能）：

```powershell
.\mont-forge-pipeline\scripts\uninstall-from-dsh.ps1
```

> ⚠️ DSH 里**不要**同时用插件和原生目录两套。文件系统层会遮蔽插件的同名技能，
> 导致技能清单显示不全（只显示部分），且工具里的 `forge_skill` 可能取到另一份副本。
> 二选一。

## 目录结构

```
mont-forge-pipeline/
├── index.js         # 技能 provider + 11 个工具
├── skills/          # 45 个 SKILL.md（唯一内容真源）
├── references/      # 7 个共享清单
├── overrides/       # 优化层（同步脚本永不写入）
│   └── skills/      # 19 个 mattpocock 合并技能
├── market/index.json # DSH 市场索引
├── docs/DETAIL.md   # 插件详情页
├── scripts/         # sync-upstream / build-dist / uninstall
├── .claude-plugin/ .codex-plugin/ .gemini/ commands/  # 各平台外壳
├── cordis.patch.yml # DSH 插件声明
├── LICENSE          # 上游 MIT 原文（Addy Osmani）
└── LICENSE-mattpocock # 上游 MIT 原文（Matt Pocock）
```

## 边界

- 阶段工具只返回流程契约与模板，**不自动改代码**；写文件、跑命令仍由 agent 用常规工具完成。
- `forge_assess` 只读扫描，跳过 `node_modules`、`.git`、`dist` 等，最多 4000 文件、深度 4 层。
- 阶段划分来自 `using-agent-skills` 的生命周期，未偏离原始技能内容。

## 许可证

MIT。上游内容遵循两份 MIT 许可，见 [LICENSE](LICENSE)、[LICENSE-mattpocock](LICENSE-mattpocock)、[NOTICE.md](NOTICE.md)。
