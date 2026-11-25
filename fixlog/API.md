# mont-forge-pipeline 接口文档

> 最后核对：2026-11-25（基于实际代码核验，取证对象 `index.js` 共 1319 行）
>
> 本文档的「接口」指**本插件向 DSH 暴露的可调用面**：11 个工具、1 个技能 provider、若干内部函数。
> 全部接口均为**只读**；本插件不写用户文件、不发网络请求。

---

## 零、全局约定

### 0.1 统一输出信封

所有工具共用同一个 `output` 定义（`index.js:422-430`）：

```js
OUTPUT = {
  schema: { type: 'object', properties: { text: { type: 'string' } }, additionalProperties: false },
  render: (_args, value) => [{ type: 'text', text: String(value?.text ?? '') }],
}
```

| 约定 | 值 |
|---|---|
| 返回值形状 | `{ text: string }`，**恒定**，不因成功/失败改变结构 |
| `additionalProperties` | `false`（每个工具的入参都禁止多余字段） |
| 渲染 | 渲染器必须取第二个参数 `value`，取 `_args` 会拿到入参而非返回值（`index.js:428` 注释明确记录此坑） |

### 0.2 「错误」的表达方式

本插件**不抛异常**给调用方，错误一律降级为**文本**：

| 场景 | 表现 | 出处 |
|---|---|---|
| git 不可用 / 非仓库 / 超时 | 内部返回 `null`，工具改为提示「未检测到 git 仓库…」 | `index.js:509-522`、`:607` |
| 目录扫描失败 | 文本 `无法扫描 <root>：<message>` | `index.js:1197` |
| 未知 `refs` 值 | 文本 `未知 refs：<x>。可用值：…` | `index.js:709-712` |
| 技能名缺失 | 文本 `必须提供 name。…` | `index.js:1309` |
| 技能不存在 | 文本 `未找到技能：<name>。…` | `index.js:1312` |
| 技能读取抛错 | 文本 `读取技能 <name> 失败：<message>` | `index.js:1315` |

**错误码体系：本项目无数字/字符串错误码**，只有上述固定文案 + 提示下一步动作。

### 0.3 鉴权与网络

本项目**无 HTTP/RPC 接口，无鉴权，无网络请求**。

---

## 一、HTTP / RPC 接口

**本项目无此类接口。**

## 二、内部命令（CLI / 定时任务）

**本项目无此类接口。** 无 bin 入口、无定时任务；唯一的进程外调用是**出站**执行 `git`（见 4.3）。

---

## 三、工具方法（DSH 工具，共 11 个）

### 3.0 注册机制

在 `apply(ctx)` 内统一注册（`index.js:1116-1118`）：

```js
const register = (definition) => { ctx.effect(() => ctx.tools.register(definition)); };
```

六个阶段工具由 `STAGES` 循环生成（`:1120-1122`），其余 5 个为独立定义。
工具名映射见 `TOOL_FOR_STAGE`（`:477-484`）。

| # | 工具名 | 定义位置 | execute |
|---|---|---|---|
| 1 | `forge_spec` | `:725-780` 经 `stageTool('spec')` | `stageExecutor` `:491-497` |
| 2 | `forge_plan` | 同上，`stageTool('plan')` | `stageExecutor` |
| 3 | `forge_build` | 同上，`stageTool('build')` | `stageExecutor` |
| 4 | `forge_verify` | 同上，`stageTool('verify')` | `stageExecutor` |
| 5 | `forge_review` | 同上，`stageTool('review')` 专属分支 `:728-763` | `reviewExecutor` `:700-723` |
| 6 | `forge_ship` | 同上，`stageTool('ship')` | `stageExecutor` |
| 7 | `forge_standup` | `:1124-1148` | `standupExecutor` |
| 8 | `forge_incident` | `:1150-1176` | `incidentExecutor` |
| 9 | `forge_assess` | `:1177-1201` | 内联 `:1191-1200` |
| 10 | `forge_catalog` | `:1203-1289` | 内联 `:1213-1288` |
| 11 | `forge_skill` | `:1291-1318` | 内联 `:1307-1317` |

---

### 3.1 `forge_spec` / `forge_plan` / `forge_build` / `forge_verify` / `forge_ship`

五个通用阶段工具，签名完全一致。

**签名**

```ts
forge_<stage>(args: { note?: string }): { text: string }
```

**入参**

| 参数 | 类型 | 必填 | 取值范围 | 默认值 | 说明 |
|---|---|---|---|---|---|
| `note` | `string` | 否 | 任意文本 | 无 | 本次要处理的输入：需求简述、规格路径、任务名或变更范围 |

`additionalProperties: false` —— 传其他字段会被拒绝。

**返回值**

`{ text }`，内容由 `renderStage(stage, extra)` 生成（`:495`），含：

- 阶段标题与目标（`STAGES[i].title` / `.goal`，`:232-414`）
- 要加载的技能清单（`.skills`）与逐条步骤（`.steps`）
- 产物模板（`.template`）
- 退出标准（`.exit`）
- 若传了 `note`，首行插入 `**本次输入**：<note>`（`:494`）
- 若有下一阶段，追加 `**下一步**：\`forge_<next>\` — <title>`（`:470`、`:685`）

**错误码及触发条件**

无。本组工具不访问文件系统、不调用外部命令，恒返回成功文本。

**调用方**：模型（按 `forge_catalog` 给出的阶段链自行推进）。

---

### 3.2 `forge_review`

专属实现：真实采集 git 变更 + 三通道闸门契约。

**签名**

```ts
forge_review(args: {
  note?: string; path?: string; diff?: string; focus?: string; refs?: string
}): { text: string }
```

**入参**

| 参数 | 类型 | 必填 | 取值范围 | 默认值 | 说明 |
|---|---|---|---|---|---|
| `note` | `string` | 否 | 任意文本 | 无 | 评审范围说明 |
| `path` | `string` | 否 | 绝对路径 | `process.cwd()` | 仓库根目录（`:716`） |
| `diff` | `string` | 否 | unified diff | 无 | 提供时**跳过 git 采集**，直接评审此 diff（`:717-718`） |
| `focus` | `string` | 否 | `code` / `security` / `lens:comment` / `lens:test` / `lens:errors` / `lens:type` | 通道 1+2 | 只跑指定通道 |
| `refs` | `string` | 否 | `gates` / `security` / `security-filter` / `lens:comment` / `lens:test` / `lens:errors` / `lens:type` | 无 | **只返回方法论全文，不执行评审** |

`refs` → 文件映射（`:698-706`）：

| refs | 读取文件 |
|---|---|
| `gates` | `references/review-gates.md` |
| `security` | `references/security-change-review.md` |
| `security-filter` | `references/security-false-positive-filtering.md` |
| `lens:comment` | `references/review-lenses/comment-lens.md` |
| `lens:test` | `references/review-lenses/test-lens.md` |
| `lens:errors` | `references/review-lenses/error-lens.md` |
| `lens:type` | `references/review-lenses/type-lens.md` |

**返回值**

`{ text }`，取决于分支：

| 分支 | 触发条件 | 文本内容 |
|---|---|---|
| 方法论全文 | 传了合法 `refs` | 对应 `references/*.md` 原文（`:713`） |
| 未知 refs | `refs` 不在映射表 | `未知 refs：<x>。可用值：…`（`:709-711`） |
| 评审契约 | 其余情况 | 采集摘要 + 三通道闸门契约（`:718-722`） |

采集摘要的三种形态（`summarizeTarget` `:606-620`）：

| target 状态 | 输出 |
|---|---|
| `available: false` | `> ⚠️ 未检测到 git 仓库，且未粘贴 diff。请粘贴 unified diff 后重试，或给出要评审的文件路径。` |
| `empty: true` | `> ✅ 当前分支无待评审变更（工作树干净，且没有领先基线的提交）。` |
| 有变更 | 分支名、变更文件数、`+add/-del` 行数、基线 SHA 前 12 位、工作树状态前 20 条（超出标「截断」） |

**错误码及触发条件**

| 条件 | 表现 |
|---|---|
| 非 git 仓库且未给 `diff` | 不报错，返回 `available:false` 提示文本 |
| `git` 可执行文件缺失 | 同上（`gitRun` 静默返回 `null`） |
| `git` 超时（>10s） | 同上 |
| `refs` 拼写错误 | 返回可用值清单 |

**调用方**：模型。方法论文件读取经 `reviewReference`（`:540-546`）。

---

### 3.3 `forge_standup`

**签名**

```ts
forge_standup(args: { path?: string; days?: number; refs?: boolean }): { text: string }
```

**入参**

| 参数 | 类型 | 必填 | 取值范围 | 默认值 | 说明 |
|---|---|---|---|---|---|
| `path` | `string` | 否 | 绝对路径 | `process.cwd()` | 项目根目录 |
| `days` | `number` | 否 | 1–30 | `1` | 回看窗口天数 |
| `refs` | `boolean` | 否 | `true` / `false` | `false` | `true` 时**只回方法论全文**（`references/standup.md`），不采集 |

**返回值**

`{ text }`：

| 分支 | 内容 |
|---|---|
| `refs: true` | `references/standup.md` 全文（`:978`） |
| 常规 | yesterday / today / blockers 三段日报契约，含真实采集的提交、热点文件、工作树状态（`:1046`） |

**错误码及触发条件**

| 条件 | 表现 |
|---|---|
| 非 git 目录 | 降级为 standalone 模式（按用户口述整理），不报错 |
| `days` 越界 | 钳制到 1–30 |
| git 不可用 | 采集段为空，契约照常返回 |

**调用方**：模型（准备站会时）。

---

### 3.4 `forge_incident`

**签名**

```ts
forge_incident(args: { mode?: 'new'|'update'|'postmortem'; description?: string; refs?: boolean }): { text: string }
```

**入参**

| 参数 | 类型 | 必填 | 取值范围 | 默认值 | 说明 |
|---|---|---|---|---|---|
| `mode` | `string` | 否 | `new` / `update` / `postmortem` | 按 `description` 自动判断 | 新建事件 / 状态更新 / 复盘 |
| `description` | `string` | 否 | 任意文本 | 无 | 事件描述或当前状态 |
| `refs` | `boolean` | 否 | `true` / `false` | `false` | `true` 时只回 `references/incident-response.md` 全文 |

**返回值**

`{ text }`：四阶段契约（分诊→通报→缓解→复盘）或方法论全文（`:1052`、`:1101`）。**只产出文档，不改代码**。

**错误码及触发条件**：无显式错误；未知 `mode` 走自动判断分支。

**调用方**：模型（出现告警、需要定级或写复盘时）。

---

### 3.5 `forge_assess`

**签名**

```ts
forge_assess(args: { path?: string }): { text: string }
```

**入参**

| 参数 | 类型 | 必填 | 取值范围 | 默认值 | 说明 |
|---|---|---|---|---|---|
| `path` | `string` | 否 | 绝对路径 | `process.cwd()` | 要评估的项目根目录（`:1192`） |

**返回值**

`{ text }` = `buildAssessment(report)`（`:1199`），覆盖技术栈、测试、CI、文档、依赖锁定、待办标记，并给建议的流水线入口。

**扫描预算**（`scanRepo` `:786-860`）

| 限制 | 值 |
|---|---|
| 最大深度 | 4 层 |
| 文件预算 | 4000 |
| 跳过目录 | `node_modules` `.git` `dist` `build` `out` `.next` `.nuxt` `coverage` `.cache` `__pycache__` `venv` `.venv` `target` `vendor` `.idea` `.vscode-test`（`:171-174`） |
| 视为文本的扩展名 | `.js .mjs .cjs .ts .tsx .jsx .vue .svelte .py .go .rs .java .kt .cs .php .rb .swift .c .h .cpp .hpp .css .scss .html .md .json .yml .yaml .toml .sh .ps1`（`:176-180`） |

**错误码及触发条件**

| 条件 | 表现 |
|---|---|
| 路径不存在 / 无读权限 | `无法扫描 <root>：<message>`（`:1197`） |
| 子目录不可读 | 静默跳过该目录，继续扫描（`:794-798`） |

**调用方**：模型（接手陌生项目时先调）。

---

### 3.6 `forge_catalog`

**签名**

```ts
forge_catalog(args: {}): { text: string }
```

**入参**：无参数字段（`properties: {}`，`:1209`）。传任何字段都会被 `additionalProperties: false` 拒绝。

**返回值**

`{ text }`，Markdown 文档，依次含（`:1214-1288`）：

1. `# mont-forge-pipeline 目录` 标题
2. 阶段表（`| 阶段 | 工具 | 目标 |`）
3. `## 六阶段的先后逻辑`（单向链示意 + 每阶段退出标准纪律）
4. 旁路能力段（standup / incident 的触发时机与产出）
5. `## 已安装技能`：本插件拥有的技能 + 被遮蔽的同名技能（`owned` / `shadowed`，`:1261-1276`）

**错误码及触发条件**

| 条件 | 表现 |
|---|---|
| `ctx.skills.list()` 抛错 | 追加一行 `技能清单读取失败：<message>`（`:1284`），阶段部分照常输出 |
| 无任何技能 | 输出 `未发现技能。`（`:1281`） |

**调用方**：模型（不确定该用哪个工具时）。

---

### 3.7 `forge_skill`

**签名**

```ts
forge_skill(args: { name: string }): { text: string }
```

**入参**

| 参数 | 类型 | 必填 | 取值范围 | 默认值 | 说明 |
|---|---|---|---|---|---|
| `name` | `string` | **是** | kebab-case 技能名，如 `code-review-and-quality` | 无 | 去首尾空格后使用（`:1308`） |

**返回值**

`{ text }`：

| 分支 | 内容 |
|---|---|
| 成功 | 该技能 `SKILL.md` 全文（`:1313`，优先取 `skill.content`） |
| 未传入 | `必须提供 name。先调用 forge_catalog 查看可用技能名。` |
| 未找到 | `未找到技能：<name>。调用 forge_catalog 查看可用技能名。` |
| 读取失败 | `读取技能 <name> 失败：<message>` |

**错误码及触发条件**：见上表四种文案。

**调用方**：模型（阶段工具只给流程，需要方法论细节时按名取正文）。

---

## 四、事件与回调

### 4.1 插件生命周期回调

| 回调 | 签名 | 说明 |
|---|---|---|
| `apply(ctx)` | `(ctx) => void` | 唯一入口，导出为具名函数（`index.js:1111`） |

**模块级导出**（`index.js:1108-1111`）

| 导出 | 值 | 作用 |
|---|---|---|
| `name` | `'mont-forge-pipeline'` | 插件名 |
| `inject` | `['tools', 'skills']` | 声明依赖的宿主服务 |
| `apply` | `function` | 激活函数 |

无默认导出，无 service class，不同时使用多种导出形态。

### 4.2 资源注册与回收

| 注册 | 回收方式 |
|---|---|
| `ctx.skills.registerProvider(() => provider)` | 随插件卸载自动注销 |
| `ctx.tools.register(definition)` ×11 | 每个都包在 `ctx.effect()` 内，卸载时自动注销（`:1117`） |

### 4.3 出站进程调用

**`gitRun(repoRoot, gitArgs, timeoutMs = 10000)`** → `Promise<string | null>`（`:509-522`）

| 项 | 值 |
|---|---|
| 命令 | `git -C <repoRoot> <...gitArgs>` |
| 超时 | 10000 ms（默认） |
| 输出缓冲上限 | 8 MiB |
| `windowsHide` | `true` |
| 失败语义 | **返回 `null` 而非抛错**（`:516`、`:520`） |

被 `forge_review`、`forge_standup` 使用。

### 4.4 事件

**本项目不订阅任何 DSH 事件，不发射事件。**

---

## 五、内部函数（非工具，供维护参考）

| 函数 | 签名 | 位置 | 用途 |
|---|---|---|---|
| `scan()` | `() => Promise<Candidate[]>` | `:109-142` | 扫描技能目录，带 stamp 缓存 |
| `listSkillDirs(dir)` | `(string) => Promise<{path}[]>` | `:53-80` | 列举技能目录 |
| `skillsStamp()` | `() => Promise<number>` | `:85-103` | 目录变化戳记，失败返 0 |
| `parseFrontmatter(raw)` | `(string) => object \| null` | 见 `:121` 调用 | 解析 SKILL.md frontmatter |
| `provider.list()` | `() => Promise<Candidate[]>` | `:146-148` | 全量技能 |
| `provider.get(candidate)` | `({name}) => Promise<Skill \| undefined>` | `:149-164` | 按名取正文，未找到返 `undefined` |
| `stageTool(stageId)` | `(string) => ToolDefinition` | `:725-780` | 生成阶段工具定义 |
| `stageExecutor(stageId)` | `(string) => (args) => {text}` | `:491-497` | 通用阶段 execute |
| `toolNameFor(stageId)` | `(string) => string` | `:486-488` | 阶段 id → 工具名 |
| `renderStage(stage, extra)` | `(stage, string?) => string` | 见 `:495` 调用 | 渲染阶段契约 |
| `gitRun()` / `parseNumstat()` | 见 4.3 | `:509-538` | git 采集与解析 |
| `collectReviewTarget(root, diff)` | `(string, string?) => Target` | `:560-603` | 汇总评审目标 |
| `summarizeTarget(target)` | `(Target) => string` | `:606-620` | 采集摘要 |
| `renderReviewContract()` | `(stage, target, summary, focus, on) => string` | `:620-698` | 三通道闸门契约 |
| `reviewReference(file)` | `(string) => Promise<string>` | `:540-546` | 读 `references/` |
| `scanRepo(root)` | `(string) => Promise<Report>` | `:786-860` | 仓库技术栈扫描 |
| `buildAssessment(report)` | `(Report) => string` | 见 `:1199` 调用 | 生成评估报告 |

---

## 六、变更记录

本文件的任何修改都必须在 `fixlog/缺陷修复记录.md` 留痕（铁律 2）。
