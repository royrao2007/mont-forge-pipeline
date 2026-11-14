# Changelog

## 0.5.0

- Release: 吸收 touchstone 的最后两项独有能力（站会日报、事故响应），做成带真实执行行为的插件工具。

### 新增 forge_standup（站会日报）

- 真实采集 git 事实：最近提交（`--since` + `--no-merges`）、改动热点文件统计（`--log --name-only` 计数）、当前工作树状态（`status --porcelain`）。
- 产出 yesterday / today / blockers 三段日报契约，含「不编造工单号」「每条一行」「无阻塞也要写这一段」等硬规则。
- 参数：`path`（仓库根）、`days`（回看窗口，默认 1，最大 30）、`refs`（只返回方法论全文）。
- 非 git 目录时退化为 standalone 模式（按用户口述整理）。

### 新增 forge_incident（事故响应）

- 四阶段契约：分诊（SEV1–4 分级与响应时限、角色分配）→ 通报（状态更新、对外沟通、通报节奏）→ 缓解（动作记录、时间线、确认恢复）→ 复盘（无责复盘、5 Whys、行动项带责任人与优先级）。
- 明确只产出文档、不改代码不改配置；未证实的根因不写，未知就写未知。
- 参数：`mode`（new / update / postmortem）、`description`、`refs`。
- 明确与流水线的衔接：事故是旁路——`forge_verify` 确认是事故 → 本工具负责通报与复盘 → 修复回到 `forge_build` → `forge_verify` → `forge_review`。

### forge_catalog 显式呈现先后逻辑

- 新增「六阶段的先后逻辑」段：单向链示意（assess → spec → plan → build → verify → review → ship）、每阶段退出标准不满足不前进的纪律、`forge_review` 只读而落手修代码的是 `forge_build`、简化只在评审干净后跑、ship 之后建议 retro。
- 新增「旁路能力」段：standup 与 incident 的触发时机、产出、以及事故回流主链的路径。
- 辅助工具从一行罗列改为分段说明。

### 新增 references

- `standup.md` — 站会日报方法论（只读边界、两种模式、输出模板、六条规则）
- `incident-response.md` — 事故响应方法论（四阶段、SEV 分级表、状态更新与复盘模板、四条硬规则）

### 其他

- 工具总数 9 → 11。
- 版本 0.5.0，CHANGELOG/locale/market/DETAIL 同步。

来源与许可：standup 与 incident-response 移植自 touchstone（royrao2007/touchstone，Apache-2.0，源自 anthropics/knowledge-work-plugins）。

## 0.4.0

- Release: forge_review 从「返回静态建议」升级为「真实采集 + 三通道闸门评审」。

### forge_review 真实化

`forge_review` 不再只渲染一段流程文案，而是先真实干活：

- 用 `git` 采集评审目标：工作树状态（`status --porcelain`）、未提交 diff、本分支领先基线的提交 diff（`merge-base` + `rev-list` + `diff ...HEAD`）、`--numstat` 增删行统计；非 git 目录或 git 失败时契约退化为「请粘贴 diff」。
- 新增参数 `path`（仓库根，默认 cwd）、`diff`（显式 unified diff，跳过 git 采集）、`focus`（只跑指定通道）、`refs`（按名返回方法论全文）。
- 输出头部带真实摘要：分支、变更文件数、+/- 行数、对比基线、工作树状态。

### 三通道闸门评审（融合 touchstone 的审查纪律）

评审从「五轴过一遍」升级为三通道、带 confidence 闸门的流程，只报过闸发现：

1. **代码评审**（必跑）：五轴独立过一遍，每条候选按 0–100 评分，**只报 ≥80**；评分锚点（0/25/50/75/100）与硬排除清单见 `references/review-gates.md`。
2. **安全变更审查**（默认跑）：只看本变更新引入的安全影响，候选逐条过误报过滤，**只报置信 ≥8/10**；方法论见 `references/security-change-review.md` + `security-false-positive-filtering.md` + `security-vulnerability-taxonomy.md`。
3. **专项镜头**（可选）：comments / tests / errors / types 四镜头，正文 `references/review-lenses/*-lens.md`，镜头结论按自身分级，不冒充主闸门。

### 先审后改接力

明确 write boundary：评审只读 → 用户确认修复发现 → 才允许 `code-simplification` 做行为等价简化。评审通道永不落手改代码，修复建议只写进报告。

### 新增 references

- `review-gates.md` — 评分闸门、硬排除、独立通道、先审后改顺序
- `security-change-review.md` — 安全变更审查通道 + 提示注入信任边界
- `security-false-positive-filtering.md` — 安全误报过滤全文（移植自 touchstone）
- `security-vulnerability-taxonomy.md` — 漏洞分类法（移植自 touchstone）
- `review-lenses/{comment,test,error,type}-lens.md` — 四镜头（移植自 touchstone）

### 其他

- `forge_review` 参数 schema 扩展（path/diff/focus/refs），其余阶段工具不变。
- review 阶段的 deliverables/exit/template 对齐闸门化语义（Critical 90–100 / Important 80–89）。

来源与许可：闸门与安全通道纪律移植自 touchstone（royrao2007/touchstone，Apache-2.0/MIT，源自 Anthropic 官方插件）。
