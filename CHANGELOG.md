# Changelog

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
