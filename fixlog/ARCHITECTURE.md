# mont-forge-pipeline 架构文档

> 最后核对：2026-11-25（基于实际代码核验，取证对象 `index.js` 共 1319 行 / 42567 字节）

本文档回答一件事：**任一功能在哪个模块**。定位不到时以代码为准并立即修正本文档（铁律 3）。

---

## 一、系统分层

本包是 **DSH Bundle 插件**，单入口 `index.js`，不依赖框架、无编译步骤。按职责分四层：

```
┌──────────────────────────────────────────────────────────────┐
│ 接入层  package.json / cordis.patch.yml / locale / icon      │
│         作用：让 DSH 装载器发现并挂载本插件                   │
├──────────────────────────────────────────────────────────────┤
│ 能力层  index.js → apply(ctx)                                │
│         ├─ 技能供应：ctx.skills.registerProvider(provider)    │
│         └─ 工具注册：ctx.tools.register(definition) × 11     │
├──────────────────────────────────────────────────────────────┤
│ 实现层  index.js 内部函数簇（见第四节模块表）                  │
├──────────────────────────────────────────────────────────────┤
│ 数据层  skills/<name>/SKILL.md   随包技能正文（46 个目录）      │
│         references/*.md          评审方法论全文               │
│         docs/DETAIL.md           插件详情页文档               │
│         fixlog/*.md              本项目的工程文档与修复台账    │
└──────────────────────────────────────────────────────────────┘
```

---

## 二、模块职责与边界

| 层 | 模块 | 只做什么 | 明确不做什么 |
|---|---|---|---|
| 接入 | `package.json` | 声明 name/version/exports/files/engines/dsh | 不含运行逻辑 |
| 接入 | `cordis.patch.yml` | 一行 `insert` 把本包挂成 `mont-forge-pipeline` | 不配置业务参数 |
| 接入 | `locale/{en,zh}.json` | 提供 `meta.title` / `meta.description` / `meta.detail` | 不参与运行 |
| 能力 | `apply(ctx)` | 注册技能 provider 与 11 个工具，全部走 `ctx.effect` 回收 | 不直接读写用户文件 |
| 实现 | 技能扫描簇 | 扫 `skills/` 目录、解析 frontmatter、按名取正文 | 不缓存到磁盘 |
| 实现 | 阶段渲染簇 | 把 `STAGES` 表渲染成契约文本 | 不执行 git、不调外部命令 |
| 实现 | 评审采集簇 | 真实跑 git 采集变更 → 输出三通道评审契约 | 只读，不改代码 |
| 实现 | 仓库扫描簇 | 遍历仓库统计技术栈/测试/CI 等信号 | 只读，有 4000 文件预算 |
| 数据 | `skills/` | 技能正文，按名被 `provider.get()` 读取 | 不内联进提示词 |
| 数据 | `references/` | 评审方法论，被工具按需读取 | 不被 `files` 遗漏 |

---

## 三、模块依赖关系图

```
package.json ──dsh.bundle.patch──> cordis.patch.yml ──insert──> mont-forge-pipeline
                                                                      │
                                                                      ▼
                                                            index.js :: apply(ctx)
                                                                      │
                        ┌─────────────────────────┬───────────────────┴──────────────────┐
                        ▼                         ▼                                      ▼
              ctx.skills.registerProvider   ctx.tools.register                  ctx.skills.get
                        │                    (11 个工具定义)                    (供 forge_skill)
                        ▼                         │
                  provider {list,get}             ├── stageTool(id) ×6 ── STAGES / STAGE_BY_ID
                        │                         │        ├── renderStage / stageExecutor
                        ▼                         │        └── reviewExecutor ── gitRun ──► git(外部)
                  scan() ── listSkillDirs        │
                        │                         ├── forge_assess ── scanRepo ──► 文件系统(只读)
                  skills/<name>/SKILL.md          │
                                                  ├── forge_catalog ── STAGES + ctx.skills.list
                                                  └── forge_skill ── ctx.skills.get
```

调用方向是**单向**的：`apply` → 各工具定义 → 各自 execute。
工具之间互不调用；`forge_catalog` 与 `forge_skill` 只与 DSH 的 `ctx.skills` 服务交互，不与其他工具通信。

---

## 四、功能索引表（功能 → 模块 → 关键文件 → 说明）

| 功能 | 模块 | 关键文件 : 行号 | 说明 |
|---|---|---|---|
| 插件装载入口 | 接入 | `package.json:39-44`（`dsh.bundle`） | `patch` 指向 `cordis.patch.yml` |
| 挂载行声明 | 接入 | `cordis.patch.yml:1-4` | `id: mont-forge-pipeline` |
| 显示元数据 | 接入 | `locale/en.json`、`locale/zh.json` | `meta.detail` 指向 `docs/DETAIL.md` |
| 插件激活 | 能力 | `index.js:1111` `apply(ctx)` | 注册 provider 与工具 |
| 技能目录供应 | 实现 | `index.js:144-165` `provider` | `list()` 全量、`get()` 按名取正文 |
| 技能扫描与 frontmatter 解析 | 实现 | `index.js:109-142` `scan()` | 结果按名排序，带 stamp 缓存 |
| 技能目录列举 | 实现 | `index.js:53-103` `listSkillDirs` / `skillsStamp` | 目录变化的戳记用于缓存失效 |
| 阶段定义表 | 实现 | `index.js:232-414` `STAGES` | 6 阶段：id/title/goal/skills/steps/deliverables/exit/template/next |
| 阶段查表 | 实现 | `index.js:416` `STAGE_BY_ID` | `Map<id, stage>` |
| 阶段→工具名映射 | 实现 | `index.js:477-488` `TOOL_FOR_STAGE` / `toolNameFor` | spec→`forge_spec` … ship→`forge_ship` |
| 阶段契约渲染 | 实现 | `index.js:491-497` `stageExecutor` | 通用 execute，仅回渲染文本 |
| 阶段工具定义工厂 | 实现 | `index.js:725-780` `stageTool` | review 走专属 execute，其余走通用 |
| 评审契约渲染 | 实现 | `index.js:600-723` `renderReviewContract` / `reviewExecutor` | 三通道闸门契约 |
| git 变更真实采集 | 实现 | `index.js:509-538` `gitRun` / `parseNumstat` | `execFile('git', ['-C', root, ...])`，10s 超时，失败返 null |
| 随包方法论读取 | 实现 | `index.js:540-546` `REVIEW_REF_BASE` + `readFile` | 读 `references/` |
| 仓库技术栈扫描 | 实现 | `index.js:786-860` `scanRepo` | 深度 ≤4，4000 文件预算 |
| 评估报告产出 | 实现 | `index.js:1177-1203` 定义 + `forge_assess` execute | 只读扫描 |
| 阶段清单产出 | 实现 | `index.js:1204-1290` `forge_catalog` | 列出 6 阶段与技能归属 |
| 技能正文取用 | 实现 | `index.js:1292-1318` `forge_skill` | 调 `ctx.skills.get()` |
| 站会日报 | 实现 | `index.js:1124-1150` `forge_standup` | `refs:true` 只回方法论 |
| 事故响应 | 实现 | `index.js:1151-1176` `forge_incident` | `new/update/postmortem` |
| 文档即地图约束 | 数据 | `skills/doc-as-map/SKILL.md` | 本项目工程约束，五条铁律 |
| 架构地图（本文） | 数据 | `fixlog/ARCHITECTURE.md` | 功能定位 |
| 接口地图 | 数据 | `fixlog/API.md` | 11 个工具契约 |
| 修复台账 | 数据 | `fixlog/缺陷修复记录.md` | 唯一台账 |

---

## 五、数据流与状态流向

### 5.1 装载流

```
DSH 加载器读 package.json → 发现 dsh.bundle.patch
  → 应用 cordis.patch.yml 的 insert 行（id=mont-forge-pipeline）
  → import('./index.js') → 调用 apply(ctx)
  → ctx.skills.registerProvider(() => provider)   技能进入 DSH 技能目录
  → for (STAGES) register(stageTool(id))          六阶段工具就位
  → register(forge_standup/incident/assess/catalog/skill)
  → 全部包在 ctx.effect(...) 内，插件卸载时自动注销
```

### 5.2 阶段推进状态机

```
spec ──next──> plan ──next──> build ──next──> verify ──next──> review ──next──> ship ──next──> null
 forge_spec    forge_plan      forge_build      forge_verify      forge_review      forge_ship
```

- 推进不是强制的，由模型按契约自行决定；`next: null` 表示 `ship` 为终点（`index.js:412`）。
- 每个阶段工具只产出**契约文本**（契约 + 待加载技能 + 产物模板 + 退出标准），不写文件。

### 5.3 技能取用流

```
forge_catalog ──读 STAGES + ctx.skills.list()──> 返回 6 阶段与技能归属清单
forge_skill(name) ──ctx.skills.get(name)──> provider.get() ──读 skills/<name>/SKILL.md──> 返回正文
```

技能正文**不内联**进提示词，避免一次性占满上下文（`index.js:19` 的设计取舍）。

---

## 六、外部依赖及作用

| 依赖 | 类型 | 作用 | 约束 |
|---|---|---|---|
| `node:fs/promises` | Node 内置 | 读技能与技术栈文件 | 无 |
| `node:child_process` `execFile` | Node 内置 | 调 `git` 采集变更 | 超时 10s，缓冲上限 8 MiB，失败返 `null` 不抛错 |
| `node:path` / `node:url` | Node 内置 | 路径与 `import.meta.url` 定位 references | 无 |
| `git`（外部可执行） | 系统命令 | `forge_review` / `forge_standup` 采集变更 | **缺失时降级为 null，工具仍可返回契约** |
| `@deepseek-ai/cordis` | peer | 提供 `ctx.tools` / `ctx.skills` / `ctx.effect` | `>=4.1.0 <5.0.0`（`package.json`） |
| DSH 运行时 | 宿主 | 装载 bundle、解析 `engines.dsh` | `>=0.2.2-rc.1 <0.3.0-0` |

> 无网络请求、无远程 API、无数据库。

---

## 七、启动与配置入口

| 项 | 位置 | 说明 |
|---|---|---|
| 包入口 | `package.json:16` `main` | `index.js` |
| 导出面 | `package.json:17-22` | `.` / `package.json` / `locale/*.json` / `icon` |
| 装载清单 | `package.json:24-39` `files` | 决定 `npm pack` 收录范围 |
| Bundle patch | `package.json:39-44` + `cordis.patch.yml` | 唯一挂载方式 |
| 运行时要求 | `package.json:19-22` `engines` | `node >=22.5.0`、`dsh >=0.2.2-rc.1 <0.3.0-0` |
| 插件配置 | `cordis.patch.yml` `config: {}` | **当前无任何可配置项** |
| 环境变量 | 无 | 本插件不读任何环境变量 |

---

## 八、已知边界

1. **无状态持久化**：`scan()` 的缓存在进程内（`cache` / `cacheStamp`），重启即失效，按 stamp 自动重建。
2. **无写操作**：全部工具为只读；本插件不会修改用户仓库。
3. **`git` 缺失不影响可用性**：`gitRun` 失败返回 `null`，评审工具改为基于显式 `diff` 或提示无变更。
4. **技能数量以 `skills/` 目录为准**：文档不写死数字，用 `forge_catalog` 实时查询。
