# mont-forge-pipeline

**Mont Forge** —— 45 个生产级工程技能 + 9 个开发全流程工具，装一个包全都有。

> 合并自 [`addyosmani/agent-skills`](https://github.com/addyosmani/agent-skills)（25 个）与 [`mattpocock/skills`](https://github.com/mattpocock/skills)（19 个），均 MIT。归因见 [NOTICE.md](NOTICE.md)。

## 为什么合并

技能是「说明书」，工具是「工位」：

- 只有技能时，用户得记住 45 个名字，模型还得自己判断该不该加载；
- 只有工具时，`forge_skill` 取不到正文，流程有骨架没血肉。

合成一个包后，一次安装即自洽：模型用工具走流程，需要方法论细节时按名取正文。

## 九个工具

| 阶段 | 工具 | 产出 |
|------|------|------|
| 需求 → 规格 | `forge_spec` | 规格文档、验收标准、非目标、质量门槛 |
| 规格 → 计划 | `forge_plan` | 任务清单、阻塞边、关键路径、首个小切片 |
| 实现 | `forge_build` | 可运行的小切片与对应测试 |
| 验证 | `forge_verify` | 复现记录、根因、回归测试、验证证据 |
| 评审 | `forge_review` | 五轴结论、分级问题清单、必修复项 |
| 交付 | `forge_ship` | 提交历史、CI 结果、文档、监控、回滚预案 |

辅助：

- `forge_assess` — 扫描项目目录，报告技术栈、测试、CI、文档、依赖锁定与待办标记，给建议入口。开发新系统或接手陌生项目时先跑它。
- `forge_catalog` — 列出阶段、工具与已装技能，确认「现在该用哪个」。
- `forge_skill` — 按名读取某个技能的完整正文。

每个阶段工具返回「阶段目标 + 要加载的技能 + 步骤 + 产物模板 + 退出标准 + 下一步入口」，并串成一条链。

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

`mont-forge` —— 总入口。用户说「用 mont-forge 做 X」时，按内置路由表自动选 1–2 个对口子技能，不必记名字。

## 安装

### DSH

```powershell
# 从 npm
dsh plugin --profile <profile> add mont-forge-pipeline

# 从本地目录
dsh plugin --profile <profile> add "F:\path\to\mont-forge-pipeline"
```

或在 DSH「插件 → 添加插件」选择目录 / 填包名。

### 其他平台

同一份 `skills/` 通过各平台外壳声明，不复制内容：

| 平台 | 外壳 |
|------|------|
| **Pi** | `pi` key + `pi-package` keyword |
| **Claude Code** | `.claude-plugin/plugin.json` |
| **Codex** | `.codex-plugin/plugin.json` |
| **Gemini** | `.gemini/commands/*.toml` + `commands/*.toml` |
| **OpenCode** | 根 `skills/`（Agent Skills 规范自动发现） |

### 手动部署到 DSH 原生技能目录

```powershell
Copy-Item .\skills\* "$env:DSH_HOME\skills\" -Recurse -Force
```

> DSH 里**不要**同时用插件和原生目录两套，文件系统层会遮蔽插件的同名技能，导致清单显示不全。

## 目录结构

```
mont-forge-pipeline/
├── index.js         # 技能 provider + 9 个工具
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
