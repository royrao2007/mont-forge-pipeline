# mont-forge-pipeline

把 mont-forge 的 45 个工程技能编排成覆盖开发全流程的 **9 个可调用工具**。

技能是「说明书」，本插件是「流水线工位」：模型在每个阶段直接调用对应工具，拿到阶段目标、要加载的技能、步骤、产物模板与退出标准，不必记住 45 个技能名。

## 工具

| 阶段 | 工具 | 产出 |
|------|------|------|
| 需求 → 规格 | `forge_spec` | 规格文档、验收标准、非目标、质量门槛 |
| 规格 → 计划 | `forge_plan` | 任务清单、阻塞边、关键路径、首个小切片 |
| 实现 | `forge_build` | 可运行的小切片与对应测试 |
| 验证 | `forge_verify` | 复现记录、根因、回归测试、验证证据 |
| 评审 | `forge_review` | 五轴结论、分级问题清单、必修复项 |
| 交付 | `forge_ship` | 提交历史、CI 结果、文档、监控、回滚预案 |

辅助工具：

- `forge_assess` — 扫描项目目录，报告技术栈、测试、CI、文档、依赖锁定与待办标记，并给建议入口。
- `forge_catalog` — 列出阶段、工具与已装技能，确认「现在该用哪个」。
- `forge_skill` — 按名读取某个技能的完整正文。

## 安装

```powershell
# 从 npm（官方 registry）
dsh plugin --profile <profile> add mont-forge-pipeline

# 从本地目录
dsh plugin --profile <profile> add "F:\path\to\mont-forge-pipeline"
```

或在 DSH「插件 → 添加插件」选择该目录 / 填包名。

国内网络可走镜像安装：`--registry=https://registry.npmmirror.com`（镜像同步有延迟）。

## 依赖

技能正文由 [mont-forge](https://www.npmjs.com/package/mont-forge) 提供；本插件只做流程编排。未安装 mont-forge 时，阶段工具仍可用，`forge_skill` 取不到正文。

## 边界

- 阶段工具只返回流程契约与模板，**不自动改代码**；写文件、跑命令仍由 agent 用常规工具完成。
- `forge_assess` 只读扫描，跳过 `node_modules`、`.git`、`dist` 等目录，最多 4000 个文件、深度 4 层。
- 阶段划分来自 mont-forge 的 `using-agent-skills` 生命周期，未偏离原始技能内容。

## 许可证

MIT。上游技能内容遵循 mont-forge 内的两份 MIT 许可（Addy Osmani、Matt Pocock）。
