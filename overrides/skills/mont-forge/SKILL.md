---
name: mont-forge
description: mont-forge 工程技能包总入口：44 个工程技能的统一调度器。当用户说"用 mont-forge 评估项目""mont-forge 帮我看下这个项目""用 mont-forge 审查代码/做安全加固/优化性能/准备发布""mont-forge 怎么做 X"，或提出软件工程任务但没有指定具体技能时，加载本技能，由内置路由表自动选用合适的子技能并编排成流程。覆盖：项目评估、代码评审、架构设计、需求澄清、写规格、拆任务、编码实现、测试、调试、安全加固、性能优化、CI/CD、发布上线、复盘、调研、教学。
---

# mont-forge 总入口

用户不需要记住 44 个技能名。**你（agent）只需要记住一件事：用户说"用 mont-forge 做某事"时，先读本文件的路由表，再加载 1–2 个真正对口的子技能。**

## 一、用户会怎么说 → 你做什么

| 用户说 | 你的动作 |
|---|---|
| "用 mont-forge 评估下这个项目" / "体检一下" / "看看这项目怎么样" | 走 **剧本 A：项目评估** |
| "帮我审下代码" / "代码质量怎么样" | 加载 `code-review-and-quality` |
| "报错了" / "修不好" / "有 bug" | 加载 `debugging-and-error-recovery` |
| "加个测试" / "测试怎么写" | 加载 `test-driven-development` |
| "安全吗" / "有漏洞吗" / "加固一下" | 加载 `security-and-hardening` |
| "太慢了" / "性能优化" | 加载 `performance-optimization` |
| "架构怎么设计" / "模块怎么拆" / "重构" | 加载 `codebase-design` + `improve-codebase-architecture` |
| "API 怎么设计" / "接口怎么定" | 加载 `api-and-interface-design` |
| "写前端" / "做个页面" / "UI" | 加载 `frontend-ui-engineering` |
| "要上线" / "发布" / "部署" | 走 **剧本 B：从想法到上线**（或直接 `shipping-and-launch`） |
| "提交" / "commit" / "开分支" / "写 PR" | 加载 `git-workflow-and-versioning`（写 PR 描述用 `pr`） |
| "写文档" / "记个决策" / "ADR" | 加载 `documentation-and-adrs` |
| "需求不清楚" / "帮我问清楚" | 加载 `interview-me` |
| "想法还很模糊" / "帮我理清" | 加载 `idea-refine` |
| "写个规格" / "需求文档" | 加载 `spec-driven-development` |
| "拆任务" / "排期" / "分几步做" | 加载 `planning-and-task-breakdown` |
| "开始实现" / "按 spec 做" / "动手吧" | 加载 `implement` 或 `incremental-implementation` |
| "做个原型试试" | 加载 `prototype` |
| "复盘" / "回顾这次会话" | 加载 `retro` |
| "拷问我" / "压力测试这个方案" | 加载 `grilling`（`grill-me` 是同一技能的触发别名） |
| "调研" / "查一手资料" | 加载 `research` |
| "教我" / "讲讲这个技术" | 加载 `teach` |
| "写技能" / "给 agent 写文档" | 加载 `writing-for-agents` |
| "大工程" / "跨多会话规划" | 加载 `wayfinder` |
| "拆票" / "建 issue" | 加载 `to-tickets`（或 `to-spec`） |
| "issue 分诊" / "这个 issue 该怎么处理" | 加载 `triage` |
| "初始化项目技能配置" | 加载 `setup-matt-pocock-skills` |
| "生成安装向导" | 加载 `wizard` |
| "做问卷" / "问问别人" | 加载 `to-questionnaire` |
| "质量门槛" / "别偷偷降低标准" | 加载 `constraint-driven-development` |
| "上下文太乱" / "配置 context" | 加载 `context-engineering` |
| "代码太复杂" / "简化一下" | 加载 `code-simplification` |
| "按旧文档写的" / "核实文档" | 加载 `source-driven-development` |
| "关键决策要对抗审查" | 加载 `doubt-driven-development` |
| "停用旧系统" / "迁移" | 加载 `deprecation-and-migration` |
| "加日志" / "监控" / "告警" | 加载 `observability-and-instrumentation` |
| "CI/CD" / "流水线" | 加载 `ci-cd-and-automation` |
| "浏览器测试" / "DevTools" | 加载 `browser-testing-with-devtools` |
| "领域术语" / "术语表" | 加载 `domain-modeling` |

## 二、组合剧本

### 剧本 A：项目评估（用户最高频）

用户意图：整体判断一个项目"能不能用、值不值得托付、哪里最该修"。

1. `code-review-and-quality` —— 代码质量五轴（正确性/可维护性/可读性/测试/风险）
2. `improve-codebase-architecture` —— 架构深化机会扫描
3. `security-and-hardening` —— 安全面（输入校验、鉴权、依赖、密钥）
4. `performance-optimization` —— 性能热点与明显浪费
5. 汇总成**一份评估报告**：分维度打分 → 优先修复清单（P0/P1/P2）→ 每条给出可执行的下一步

> 只加载 1–2 个：先 1，评估完再 2/3/4 按需补。不要把四个技能一次性全读进来。

### 剧本 B：从想法到上线

`interview-me` → `idea-refine` → `spec-driven-development` → `planning-and-task-breakdown` → `incremental-implementation` → `test-driven-development` → `code-review-and-quality` → `git-workflow-and-versioning` → `shipping-and-launch`

不是每个都要走：用户已有清晰 spec 就从 `planning-and-task-breakdown` 起；只改 bug 就走**剧本 C**。

### 剧本 C：修 bug

`debugging-and-error-recovery` → `test-driven-development`（补回归测试）→ `code-review-and-quality`

### 剧本 D：安全体检

`security-and-hardening` →（按需）`performance-optimization`

## 三、调度规则

1. **一次只加载 1–2 个子技能。** 技能正文很长，全量加载会挤爆上下文。
2. **用户点名技能时直接加载那个**，不要绕道路由表。
3. **意图跨多个阶段时，按剧本顺序推进**，每完成一步给一个可交付物再进下一步。
4. **拿不准时先问一句**（"你是想整体评估，还是只审某个模块？"），或按剧本 A 起手。
5. **子技能是流程，不是建议**：按它的步骤顺序走，验证步骤不能跳。

## 四、本包内的通用行为准则

以下来自 `using-agent-skills`，在任何子技能里都生效：

- 动手前**显式列出假设**，让用户纠正。
- 遇到矛盾/歧义**停下来问**，不要猜着往下做。
- 方案有明显问题时**直接指出并给替代方案**，不做 yes-machine。
- **追求简单**：100 行能解决的不要写 1000 行。
- **只改该改的**：不做顺手重构、不删看不懂的注释。
- **验证而非假设**：任务完成的标准是有证据（测试通过、构建输出、运行数据），不是"看起来对"。
