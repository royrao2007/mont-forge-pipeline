import { readdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { join, extname, relative, resolve } from 'node:path';

/**
 * mont-forge-pipeline —— 工程技能包 + 开发流水线（单包）。
 *
 * 一个插件同时提供两件事：
 * 1. 技能 provider：把随包分发的 45 个 SKILL.md 注册进 DSH 技能目录；
 * 2. 流程工具：spec → plan → build → verify → review → ship 六个阶段工具，
 *    外加 assess / catalog / skill 三个辅助工具。
 *
 * 合并的动机：技能是「说明书」，工具是「工位」。分成两个包时，用户装了一个
 * 却取不到另一个的正文（forge_skill 会落空）；合并后一次安装即自洽。
 *
 * 设计取舍：
 * - 阶段工具返回「阶段契约 + 要加载的技能 + 产物模板 + 退出标准」，让模型直接照着做；
 * - 技能正文不内联（避免一次灌满上下文），需要时用 forge_skill 按名取；
 * - forge_assess 做真实仓库扫描，而不只是返回建议。
 *
 * @module mont-forge-pipeline
 */

/* ------------------------------------------------------------------ */
/* 技能 provider：随包分发的 45 个 SKILL.md                            */
/* ------------------------------------------------------------------ */

const PROVIDER_NAME = 'mont-forge-pipeline';
const SKILLS_DIR = fileURLToPath(new URL('./skills/', import.meta.url));

/** 运行时技能排名：与内置 bundled 技能同级（600）。 */
const RUNTIME_RANK = 600;

/** 来源标记：runtime 层技能（低于 project，高于 user）。 */
const SOURCE = 'runtime';

/**
 * 解析 SKILL.md 的 YAML frontmatter。
 * 只取 `name` 与 `description` 两个字段，避免引入 YAML 依赖。
 */
function parseFrontmatter(raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!match) return undefined;
  const block = match[1];
  const fields = {};
  let key;
  for (const line of block.split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (kv) {
      key = kv[1];
      let value = kv[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      fields[key] = value;
    } else if (key && /^\s+/.test(line)) {
      // 续行（多行字段）：拼接到上一个键
      const trimmed = line.trim();
      if (trimmed) fields[key] = `${fields[key]} ${trimmed}`.trim();
    }
  }
  return fields;
}

/** 技能名必须是 ASCII kebab-case。 */
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * 列出技能目录下所有含 SKILL.md 的子目录。
 * @param {string} dir
 */
async function listSkillDirs(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const dirs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = join(dir, entry.name);
    try {
      const info = await stat(join(full, 'SKILL.md'));
      if (info.isFile()) dirs.push({ dirName: entry.name, path: full });
    } catch {
      // 没有 SKILL.md 的目录不是技能目录，跳过
    }
  }
  return dirs;
}

let cache = null;
let cacheStamp = 0;

/** 技能目录的最近修改时间；变了就重新扫描，避免新增技能永远不出现。 */
async function skillsStamp() {
  try {
    const info = await stat(SKILLS_DIR);
    return info.mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * 扫描并解析技能目录，返回候选列表。
 * 结果按名称排序，保证快照稳定。
 */
async function scan() {
  const stamp = await skillsStamp();
  if (cache && stamp === cacheStamp) return cache;
  const dirs = await listSkillDirs(SKILLS_DIR);
  const candidates = [];
  for (const { path } of dirs) {
    let raw;
    try {
      raw = await readFile(join(path, 'SKILL.md'), 'utf8');
    } catch {
      continue;
    }
    const fields = parseFrontmatter(raw);
    if (!fields) continue;
    const name = fields.name;
    if (!name || !KEBAB.test(name)) continue;
    if (!fields.description) continue;
    candidates.push({
      name,
      description: fields.description,
      whenToUse: fields['when-to-use'] || undefined,
      invocation: { modelInvocable: true, userInvocable: true },
      provider: PROVIDER_NAME,
      source: SOURCE,
      resourceBase: { kind: 'directory', path },
      rank: RUNTIME_RANK,
      locator: join(path, 'SKILL.md'),
    });
  }
  candidates.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  cache = candidates;
  cacheStamp = stamp;
  return candidates;
}

const provider = {
  name: PROVIDER_NAME,
  async list() {
    return await scan();
  },
  async get(candidate) {
    const candidates = await scan();
    const found = candidates.find((item) => item.name === candidate.name);
    if (!found) return undefined;
    const content = await readFile(found.locator, 'utf8');
    return {
      name: found.name,
      description: found.description,
      whenToUse: found.whenToUse,
      invocation: found.invocation,
      provider: found.provider,
      source: found.source,
      resourceBase: found.resourceBase,
      content,
    };
  },
};

/* ------------------------------------------------------------------ */
/* 下面开始：开发流水线的九个工具                                       */
/* ------------------------------------------------------------------ */

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', 'coverage',
  '.cache', '__pycache__', 'venv', '.venv', 'target', 'vendor', '.idea', '.vscode-test',
]);

const TEXT_EXT = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.vue', '.svelte', '.py', '.go',
  '.rs', '.java', '.kt', '.cs', '.php', '.rb', '.swift', '.c', '.h', '.cpp', '.hpp',
  '.css', '.scss', '.html', '.md', '.json', '.yml', '.yaml', '.toml', '.sh', '.ps1',
]);

/** 技能名 → 一句话说明（中文），供阶段工具内联展示，不依赖技能服务。 */
const SKILL_NOTES = {
  'interview-me': '先问清楚用户真实想要什么，再谈方案',
  'idea-refine': '把模糊想法发散收敛成可执行概念',
  'spec-driven-development': '写规格：目标、非目标、验收标准、约束',
  'constraint-driven-development': '把质量门槛写成契约，防止 agent 悄悄降标准',
  'planning-and-task-breakdown': '把规格拆成可验证的小任务',
  'to-tickets': '拆成带阻塞边的 tracer-bullet 票',
  'incremental-implementation': '薄切片推进，每片验证后再扩展',
  'implement': '按 spec / 票执行实现',
  'test-driven-development': '红-绿-重构，先写失败测试',
  'source-driven-development': '以官方文档为准，不凭记忆写 API',
  'debugging-and-error-recovery': '复现 → 定位 → 修复 → 防回归',
  'browser-testing-with-devtools': '用 Chrome DevTools 做运行时验证',
  'code-review-and-quality': '五轴评审 + confidence ≥80 闸门（review-gates.md）',
  'code-simplification': '行为等价简化，只在评审干净后跑（先审后改）',
  'security-and-hardening': '安全变更审查：误报过滤 + 置信 ≥8/10 闸门',
  'performance-optimization': '先测量，只优化真正热点',
  'git-workflow-and-versioning': '原子提交、干净历史、语义化版本',
  'ci-cd-and-automation': '每次变更自动过质量门',
  'documentation-and-adrs': '记录「为什么」，不只是「是什么」',
  'observability-and-instrumentation': '结构化日志、RED 指标、症状告警',
  'shipping-and-launch': '上线清单、监控、回滚预案',
  'context-engineering': '按需装载正确上下文',
  'doubt-driven-development': '关键决策做对抗式复查',
  'api-and-interface-design': '稳定接口与清晰契约',
  'frontend-ui-engineering': '可访问、响应式的生产级 UI',
  'codebase-design': '深模块设计词汇',
  'domain-modeling': '领域术语与模型',
  'prototype': '一次性原型验证设计问题',
  'retro': '会话复盘',
  'pr': '写 PR 描述',
  'triage': 'issue 分诊状态机',
  'wayfinder': '跨多会话的大规模工作地图',
  'research': '查一手资料并落成文档',
  'teach': '在项目内教学',
  'writing-for-agents': '给 agent 写文档/技能',
  'wizard': '生成交互式安装向导',
  'to-questionnaire': '把答不了的决策转成问卷',
  'to-spec': '把对话转成规格',
  'grilling': '连环拷问方案',
  'grill-me': 'grilling 的别名',
  'improve-codebase-architecture': '扫描架构深化机会',
  'setup-matt-pocock-skills': '初始化 issue tracker / 术语表布局',
  'using-agent-skills': '元技能：技能发现与调用',
  'deprecation-and-migration': '停用与迁移',
  'incremental': '增量交付',
};

/** 阶段定义：流程的单一真源。 */
const STAGES = [
  {
    id: 'spec',
    title: '① 需求 → 规格（spec）',
    goal: '把模糊需求变成可验收、可反驳的规格，先对齐再动手。',
    skills: ['interview-me', 'idea-refine', 'spec-driven-development', 'constraint-driven-development'],
    steps: [
      '用 interview-me 的提问法，一次只问一个关键问题，直到能复述用户目标。',
      '把目标写成「用户/场景/期望结果」，列出非目标（明确不做什么）。',
      '每条验收标准必须可测：给定输入 → 期望输出 / 可观察行为。',
      '写下约束：技术栈、兼容性、性能、安全、时间。',
      '用 constraint-driven-development 把质量门槛量化（如测试覆盖、延迟上限）。',
    ],
    deliverables: ['规格文档', '验收标准清单', '非目标清单', '质量门槛'],
    exit: ['每条验收标准都能写成一个测试', '非目标已写明', '质量门槛有数字'],
    template: `# 规格：<名称>

## 目标
- 用户/场景：
- 期望结果：

## 非目标（明确不做）
-

## 验收标准
- [ ] 给定 …，当 …，则 …

## 约束
- 技术：
- 兼容：
- 性能：
- 安全：

## 质量门槛
- 测试：
- 延迟：
- 其他：

## 风险与未知
-
`,
    next: 'plan',
  },
  {
    id: 'plan',
    title: '② 规格 → 计划（plan）',
    goal: '把规格拆成可独立验证、可并行的薄任务，标出阻塞边。',
    skills: ['planning-and-task-breakdown', 'to-tickets', 'wayfinder'],
    steps: [
      '按「一个任务一次可验证」切分，不按技术层切。',
      '每任务写清：输入、产出、验收标准、依赖（阻塞边）。',
      '找出关键路径，先做能验证假设的 tracer bullet。',
      '标出哪些任务可并行、哪些必须串行。',
    ],
    deliverables: ['任务清单', '依赖图/阻塞边', '关键路径', '首个小切片'],
    exit: ['每个任务半天到两天可完成', '每个任务都有验收标准', '阻塞边无环'],
    template: `# 计划：<名称>

| # | 任务 | 输入 | 产出 | 验收标准 | 依赖 |
|---|------|------|------|----------|------|
| 1 |      |      |      |          | -    |

## 关键路径
1.

## 首个小切片（tracer bullet）
-

## 风险
-
`,
    next: 'build',
  },
  {
    id: 'build',
    title: '③ 实现（build）',
    goal: '按计划做薄切片，每片带测试，验证通过再扩展。',
    skills: ['incremental-implementation', 'test-driven-development', 'implement', 'source-driven-development', 'doubt-driven-development'],
    steps: [
      '一次只做一个切片；先写失败测试，再写最小实现让它通过。',
      '对外 API / 关键决策先查官方文档，不凭记忆。',
      '每片完成后跑测试与构建，失败就停，不叠加新改动。',
      '非平凡决策做一次对抗式自检：反例、边界、并发、失败路径。',
      '不在本切片范围的代码不动。',
    ],
    deliverables: ['可运行的小切片', '对应的测试', '每片验证记录'],
    exit: ['本片测试全绿', '构建通过', '没有顺手改无关代码'],
    template: `## 切片记录：<任务>

- 行为（一句话）：
- 测试（先失败）：
- 实现（最小改动）：
- 验证命令：
- 结果：
`,
    next: 'verify',
  },
  {
    id: 'verify',
    title: '④ 验证（verify）',
    goal: '用证据证明行为正确，而不是「看起来对」。',
    skills: ['debugging-and-error-recovery', 'browser-testing-with-devtools', 'test-driven-development'],
    steps: [
      '有失败先复现：固定输入、固定环境、最小化。',
      '沿调用链定位，不猜；一次只改一个变量。',
      '修完补一个能复现原 bug 的回归测试。',
      '涉及 UI 的用真实浏览器验证，不只看单测。',
      '记录证据：命令输出、截图、日志。',
    ],
    deliverables: ['复现记录', '根因说明', '回归测试', '验证证据'],
    exit: ['原问题不再复现', '回归测试在旧代码上会失败、新代码上通过', '证据可复核'],
    template: `## 验证记录：<问题>

- 复现步骤：
- 根因：
- 修复：
- 回归测试：
- 证据（命令/输出/截图）：
`,
    next: 'review',
  },
  {
    id: 'review',
    title: '⑤ 评审（review）',
    goal: '合并前三通道闸门评审：代码评审（confidence ≥80）+ 安全变更审查（≥8/10）+ 可选专项镜头，全部只读、只报过闸发现。',
    skills: ['code-review-and-quality', 'code-simplification', 'security-and-hardening', 'performance-optimization'],
    steps: [
      '通道 1（代码评审）：五轴独立过一遍（正确性、可维护性、可读性、测试、风险），每条发现按 0–100 评分，只报 ≥80 的；评分锚点与硬排除见 references/review-gates.md。',
      '通道 2（安全）：只看本变更新引入的安全影响；候选逐条过误报过滤（references/security-false-positive-filtering.md），只报置信 ≥8/10 的。',
      '通道 3（可选镜头）：comments / tests / errors / types，按 references/review-lenses/ 对应文件执行，镜头结论按自身分级，不冒充主闸门。',
      '所有通道只读：修复建议写进报告，不落手改代码；报告按 P0/P1/P2 分级。',
      '评审干净（P0 清零）之后才允许简化：用 code-simplification 做行为等价改写，先审后改的接力顺序不可跳。',
      '性能：先测量再优化，确认瓶颈而不是猜。',
    ],
    deliverables: ['评审结论（过闸发现）', '问题清单（Critical 90-100 / Important 80-89 分级）', '必须修复项', '各通道查了什么'],
    exit: ['Critical 清零', '每条发现都有证据引用与修复建议', '低于 80 分的候选已丢弃并说明查了什么', '测试证据齐全'],
    template: `## 评审：<变更>

| 级别 | 通道 | 置信度 | 文件:行 | 问题 | 建议 |
|------|------|--------|---------|------|------|
| Critical | code | 92 | | | |
| Important | security | 8/10 | | | |

- 各通道查了什么：
- 被丢弃的候选（低于闸门）：
- 正确性：
- 可维护性：
- 可读性：
- 测试：
- 安全：
- 性能：
`,
    next: 'ship',
  },
  {
    id: 'ship',
    title: '⑥ 交付（ship）',
    goal: '安全发布：清晰提交、自动门禁、可观测、可回滚。',
    skills: ['git-workflow-and-versioning', 'ci-cd-and-automation', 'documentation-and-adrs', 'observability-and-instrumentation', 'shipping-and-launch'],
    steps: [
      '提交按原子变更拆分，信息写清「为什么」。',
      'CI 必须跑：测试、lint、构建、安全扫描。',
      '关键决策记 ADR；用户可见变更更新文档。',
      '补日志/指标/告警，定义「什么算异常」。',
      '写发布清单与回滚步骤。',
    ],
    deliverables: ['提交历史', 'CI 结果', '文档/ADR', '监控项', '回滚预案'],
    exit: ['CI 全绿', '回滚步骤可执行', '告警能触发并被验证'],
    template: `## 发布清单：<版本>

- [ ] 测试 / lint / 构建通过
- [ ] 安全扫描无高危
- [ ] 变更日志
- [ ] 文档 / ADR
- [ ] 监控指标与告警
- [ ] 回滚命令：

## 风险
-
`,
    next: null,
  },
];

const STAGE_BY_ID = new Map(STAGES.map((s) => [s.id, s]));

function textBlock(value) {
  return [{ type: 'text', text: String(value?.text ?? '') }];
}

const OUTPUT = {
  schema: {
    type: 'object',
    properties: { text: { type: 'string' } },
    additionalProperties: false,
  },
  // 渲染器收到的是 (args, value)；必须显式取第二个参数，否则拿到的是入参而不是返回值。
  render: (_args, value) => textBlock(value),
};

function skillLine(name) {
  const note = SKILL_NOTES[name];
  return note ? `- \`${name}\` — ${note}` : `- \`${name}\``;
}

function renderStage(stage, extra) {
  const parts = [];
  parts.push(`# ${stage.title}`);
  parts.push('');
  parts.push(`**阶段目标**：${stage.goal}`);
  if (extra) {
    parts.push('');
    parts.push(extra);
  }
  parts.push('');
  parts.push('## 要加载的技能');
  parts.push(stage.skills.map(skillLine).join('\n'));
  parts.push('');
  parts.push('> 需要完整技能正文时调用 `forge_skill({ name: "<技能名>" })`。');
  parts.push('');
  parts.push('## 步骤');
  parts.push(stage.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'));
  parts.push('');
  parts.push('## 本阶段必须产出');
  parts.push(stage.deliverables.map((d) => `- ${d}`).join('\n'));
  parts.push('');
  parts.push('## 退出标准（不满足不进入下一阶段）');
  parts.push(stage.exit.map((e) => `- [ ] ${e}`).join('\n'));
  if (stage.template) {
    parts.push('');
    parts.push('## 产出模板');
    parts.push('```markdown');
    parts.push(stage.template.trimEnd());
    parts.push('```');
  }
  parts.push('');
  if (stage.next) {
    const next = STAGE_BY_ID.get(stage.next);
    parts.push(`**下一步**：\`${toolNameFor(stage.next)}\` — ${next.title}`);
  } else {
    parts.push('**流程结束**。交付后建议跑 `retro` 复盘，并把可复用经验写进项目文档。');
  }
  return parts.join('\n');
}

const TOOL_FOR_STAGE = {
  spec: 'forge_spec',
  plan: 'forge_plan',
  build: 'forge_build',
  verify: 'forge_verify',
  review: 'forge_review',
  ship: 'forge_ship',
};

function toolNameFor(stageId) {
  return TOOL_FOR_STAGE[stageId] ?? stageId;
}

/** 给单阶段工具生成通用的 execute。 */
function stageExecutor(stageId) {
  const stage = STAGE_BY_ID.get(stageId);
  return async (args) => {
    const extra = args?.note ? `**本次输入**：${String(args.note)}` : undefined;
    return { text: renderStage(stage, extra) };
  };
}

/* ------------------------------------------------------------------ */
/* forge_review：真实变更采集 + 三通道闸门契约                            */
/*                                                                     */
/* 不是"返回建议"：工具先用 git 真实采集当前变更（status/diff/stat），   */
/* 再输出带 confidence 闸门的三通道评审契约。通道方法论全文在           */
/* references/ 下（review-gates / security-change-review / lenses），   */
/* 模型按契约执行，报告必须过闸门。                                     */
/* ------------------------------------------------------------------ */

/** promisified execFile，带超时与缓冲上限；git 不可用时返回 null 而不是抛出。 */
function gitRun(repoRoot, gitArgs, timeoutMs = 10_000) {
  return new Promise((resolvePromise) => {
    const child = execFile(
      'git',
      ['-C', repoRoot, ...gitArgs],
      { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
      (error, stdout) => {
        if (error && !stdout) return resolvePromise(null);
        resolvePromise(String(stdout ?? ''));
      },
    );
    child.on('error', () => resolvePromise(null));
  });
}

/** 解析 `git diff --numstat` 行 → [{add, del, path}]；二进制行的 - 显示为 null。 */
function parseNumstat(numstat) {
  const out = [];
  for (const line of String(numstat ?? '').split('\n')) {
    if (!line.trim()) continue;
    const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line);
    if (!m) continue;
    out.push({
      add: m[1] === '-' ? null : Number(m[1]),
      del: m[2] === '-' ? null : Number(m[2]),
      path: m[3],
    });
  }
  return out;
}

const REVIEW_REF_BASE = new URL('./references/', import.meta.url);

/** 读取随包 references 文件；失败时返回占位说明而不是让工具崩掉。 */
async function reviewReference(fileName) {
  try {
    const body = await readFile(fileURLToPath(new URL(fileName, REVIEW_REF_BASE)), 'utf8');
    return body;
  } catch {
    return `(随包参考文件缺失：references/${fileName})`;
  }
}

/**
 * 采集评审目标。优先级：调用方显式给的 diff > git 工作树（未提交 + 未推送提交）。
 * 非 git 目录或 git 失败时返回 { available: false }，契约退化为"请粘贴 diff"。
 */
async function collectReviewTarget(repoRoot, explicitDiff) {
  if (explicitDiff && String(explicitDiff).trim()) {
    const diff = String(explicitDiff);
    return {
      available: true,
      source: 'pasted diff',
      diff,
      numstat: [],
      status: [],
      branch: null,
      base: null,
    };
  }
  const branchOut = await gitRun(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branchOut === null) return { available: false };
  const branch = branchOut.trim() || null;
  const statusOut = await gitRun(repoRoot, ['status', '--porcelain']);
  const status = String(statusOut ?? '')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter(Boolean);
  // 未提交改动（含 untracked）+ 本分支领先基线的提交，拼成一份待审 diff。
  const headDiff = await gitRun(repoRoot, ['diff', 'HEAD', '--no-color']);
  const untracked = status.filter((l) => l.startsWith('??')).map((l) => l.slice(3));
  const numstatOut = await gitRun(repoRoot, ['diff', 'HEAD', '--numstat']);
  const numstat = parseNumstat(numstatOut);
  // merge-base 之后本分支自己的提交（origin/HEAD 或 upstream 不存在时跳过）
  let base = null;
  let baseDiff = '';
  for (const candidate of ['@{upstream}', 'origin/main', 'origin/master', 'main', 'master']) {
    const mergeBase = await gitRun(repoRoot, ['merge-base', 'HEAD', candidate]);
    if (mergeBase) {
      base = mergeBase.trim();
      const ahead = await gitRun(repoRoot, ['rev-list', '--count', `${base}..HEAD`]);
      if (ahead && Number(ahead.trim()) > 0) {
        baseDiff = (await gitRun(repoRoot, ['diff', `${base}...HEAD`, '--no-color'])) ?? '';
        const baseNumstat = parseNumstat(await gitRun(repoRoot, ['diff', `${base}...HEAD`, '--numstat']));
        numstat.push(...baseNumstat);
      }
      break;
    }
  }
  const diff = [headDiff, baseDiff].filter(Boolean).join('\n');
  if (!diff.trim() && status.length === 0) {
    return { available: true, source: 'git', diff: '', numstat, status, branch, base, empty: true };
  }
  return { available: true, source: 'git', diff, numstat, status, branch, base, untracked, empty: false };
}

/** 摘要行：分支、变更文件数、增删行合计、未跟踪文件。 */
function summarizeTarget(target) {
  if (!target.available) return '> ⚠️ 未检测到 git 仓库，且未粘贴 diff。请粘贴 unified diff 后重试，或给出要评审的文件路径。';
  if (target.empty) return '> ✅ 当前分支无待评审变更（工作树干净，且没有领先基线的提交）。';
  const adds = target.numstat.reduce((sum, f) => sum + (f.add ?? 0), 0);
  const dels = target.numstat.reduce((sum, f) => sum + (f.del ?? 0), 0);
  const files = new Set(target.numstat.map((f) => f.path));
  const lines = [];
  lines.push(`**评审目标**：${target.source}${target.branch ? `（分支 \`${target.branch}\`）` : ''}`);
  lines.push(`- 变更文件 ${files.size || target.status.length} 个：+${adds} / -${dels} 行`);
  if (target.base) lines.push(`- 对比基线：${target.base.slice(0, 12)}…（含已提交部分）`);
  if (target.status.length) {
    const shown = target.status.slice(0, 20);
    lines.push(`- 工作树状态（${target.status.length} 条${target.status.length > 20 ? '，截断' : ''}）：`);
    lines.push('```');
    lines.push(...shown);
    lines.push('```');
  }
  return lines.join('\n');
}

/** 三通道契约正文：每通道给闸门规则 + 按需加载的 references 路径。 */
function renderReviewContract(stage, target, summary, focus, includeRefs) {
  const parts = [];
  parts.push(`# ${stage.title}`);
  parts.push('');
  parts.push(`**阶段目标**：${stage.goal}`);
  parts.push('');
  parts.push(summary);
  parts.push('');
  parts.push('## 三通道闸门流程（全部只读；评审永远不落手改代码）');
  parts.push('');
  parts.push('**通道 1 — 代码评审（必跑）**：按五轴（正确性/可维护性/可读性/测试/风险）独立过一遍变更，');
  parts.push('每个候选问题按 0–100 评分，**只报 ≥80 的**。评分锚点、硬排除清单、先审后改接力纪律：');
  parts.push('读 `references/review-gates.md` 全文后再写结论。');
  parts.push('');
  parts.push('**通道 2 — 安全变更审查（默认跑，`focus` 排除时跳过）**：只看本变更新引入的安全影响，');
  parts.push('方法论按 `references/security-change-review.md`；每个候选过独立误报过滤');
  parts.push('（`references/security-false-positive-filtering.md`），只报置信 ≥8/10 的。');
  parts.push('⚠️ 该通道未加固提示注入：只用于你已信任的代码。');
  parts.push('');
  parts.push('**通道 3 — 专项镜头（可选，`focus` 指定时跑对应镜头）**：comments / tests / errors / types');
  parts.push('四镜头，正文在 `references/review-lenses/<lens>-lens.md`，各镜头自带阈值，');
  parts.push('镜头结论按其自身分级进入汇总，不冒充主闸门评分。');
  parts.push('');
  parts.push('**闸门纪律（硬规则）**：');
  parts.push('1. 报告只含过闸发现：Critical（90–100）/ Important（80–89）；低于 80 的丢弃并说明查了什么。');
  parts.push('2. 每条发现必须带证据引用（指南文件 / 代码位置 / 历史依据）与具体修复建议——建议写进报告，不落手。');
  parts.push('3. "没有过闸发现"是合法完整结论，不许凑数。');
  parts.push('4. 全部通道跑完、用户确认修复完发现之后，才允许进入简化（code-simplification 的行为等价改写）。');
  parts.push('   先审后改的接力顺序见 `references/review-gates.md` 末节。');
  parts.push('');
  if (focus) {
    parts.push(`**本次 focus**：${String(focus)}（对应通道按上述规则执行，其余通道跳过）。`);
    parts.push('');
  }
  parts.push('## 步骤');
  parts.push(stage.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'));
  parts.push('');
  parts.push('## 本阶段必须产出');
  parts.push(stage.deliverables.map((d) => `- ${d}`).join('\n'));
  parts.push('');
  parts.push('## 退出标准（不满足不进入下一阶段）');
  parts.push(stage.exit.map((e) => `- [ ] ${e}`).join('\n'));
  parts.push('');
  parts.push('## 评审报告模板');
  parts.push('```markdown');
  parts.push(stage.template.trimEnd());
  parts.push('```');
  if (includeRefs) {
    parts.push('');
    parts.push('## 随包方法论全文（按需读取）');
    parts.push('- `forge_review({ refs: "gates" })` — 评分闸门与接力顺序（review-gates.md）');
    parts.push('- `forge_review({ refs: "security" })` — 安全通道方法论（security-change-review.md）');
    parts.push('- `forge_review({ refs: "security-filter" })` — 安全误报过滤全文');
    parts.push('- `forge_review({ refs: "lens:errors" })` 等 — 四镜头全文（comment/test/error/type）');
  }
  parts.push('');
  if (stage.next) {
    const next = STAGE_BY_ID.get(stage.next);
    parts.push(`**下一步**：\`${toolNameFor(stage.next)}\` — ${next.title}`);
  } else {
    parts.push('**流程结束**。交付后建议跑 `retro` 复盘，并把可复用经验写进项目文档。');
  }
  return parts.join('\n');
}

/** forge_review 的 execute：真实采集 + 契约渲染；refs 模式直接返回方法论全文。 */
const REVIEW_STAGE = STAGE_BY_ID.get('review');
async function reviewExecutor(args) {
  // refs 模式：按名返回随包方法论全文（省得模型猜路径再读盘）。
  const refs = args?.refs ? String(args.refs).trim() : undefined;
  if (refs) {
    const refMap = {
      gates: 'review-gates.md',
      security: 'security-change-review.md',
      'security-filter': 'security-false-positive-filtering.md',
      'lens:comment': 'review-lenses/comment-lens.md',
      'lens:test': 'review-lenses/test-lens.md',
      'lens:errors': 'review-lenses/error-lens.md',
      'lens:type': 'review-lenses/type-lens.md',
    };
    const file = refMap[refs];
    if (!file) {
      return {
        text: `未知 refs：${refs}。可用值：${Object.keys(refMap).join(', ')}。`,
      };
    }
    return { text: await reviewReference(file) };
  }

  const root = resolve(args?.path ? String(args.path) : process.cwd());
  const explicitDiff = args?.diff ? String(args.diff) : undefined;
  const target = await collectReviewTarget(root, explicitDiff);
  const summary = summarizeTarget(target);
  const focus = args?.focus ? String(args.focus) : undefined;
  const text = renderReviewContract(REVIEW_STAGE, target, summary, focus, true);
  return { text };
}

function stageTool(stageId) {
  const stage = STAGE_BY_ID.get(stageId);
  // forge_review 有专属 execute（真实 git 采集 + 三通道闸门契约），不走通用渲染。
  if (stageId === 'review') {
    return {
      name: toolNameFor(stageId),
      description: `mont-forge-pipeline 流水线·${stage.title}：${stage.goal} 产出 ${stage.deliverables.join('、')}；真实采集当前 git 变更并输出三通道评审契约（代码评审 80 分闸门 + 安全变更审查 8/10 闸门 + 可选专项镜头），满足退出标准后进入下一阶段。`,
      parameters: {
        type: 'object',
        properties: {
          note: {
            type: 'string',
            description: '本次要处理的输入：需求简述、规格路径、任务名或变更范围。可选。',
          },
          path: {
            type: 'string',
            description: '要评审的仓库根目录绝对路径。省略时用当前进程工作目录。',
          },
          diff: {
            type: 'string',
            description: '显式提供的 unified diff。提供时跳过 git 采集，直接评审这份 diff。',
          },
          focus: {
            type: 'string',
            description:
              '只跑指定通道：code（代码评审）/ security（安全审查）/ lens:comment、lens:test、lens:errors、lens:type（专项镜头）。省略时跑通道 1+2。',
          },
          refs: {
            type: 'string',
            description:
              '返回某份随包方法论全文而不执行评审：gates / security / security-filter / lens:comment / lens:test / lens:errors / lens:type。',
          },
        },
        additionalProperties: false,
      },
      output: OUTPUT,
      execute: reviewExecutor,
    };
  }
  return {
    name: toolNameFor(stageId),
    description: `mont-forge-pipeline 流水线·${stage.title}：${stage.goal} 产出 ${stage.deliverables.join('、')}；满足退出标准后进入下一阶段。`,
    parameters: {
      type: 'object',
      properties: {
        note: {
          type: 'string',
          description: '本次要处理的输入：需求简述、规格路径、任务名或变更范围。可选。',
        },
      },
      additionalProperties: false,
    },
    output: OUTPUT,
    execute: stageExecutor(stageId),
  };
}

/* ------------------------------------------------------------------ */
/* forge_assess：真实仓库扫描                                          */
/* ------------------------------------------------------------------ */

async function scanRepo(root) {
  const files = [];
  const dirs = new Set();
  let budget = 4000;

  async function walk(dir, depth) {
    if (depth > 4 || budget <= 0) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (budget <= 0) return;
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        dirs.add(entry.name);
        await walk(full, depth + 1);
      } else if (entry.isFile()) {
        files.push(full);
        budget -= 1;
      }
    }
  }

  await walk(root, 0);

  const byExt = new Map();
  for (const f of files) {
    const ext = extname(f).toLowerCase();
    byExt.set(ext, (byExt.get(ext) ?? 0) + 1);
  }

  const has = (name) => files.some((f) => f === join(root, name));
  const hasDir = (name) => dirs.has(name);

  let pkg = null;
  try {
    pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  } catch {
    pkg = null;
  }

  let todoCount = 0;
  let todoFiles = 0;
  let readBudget = 250;
  for (const f of files) {
    if (readBudget <= 0) break;
    if (!TEXT_EXT.has(extname(f).toLowerCase())) continue;
    let info;
    try {
      info = await stat(f);
    } catch {
      continue;
    }
    if (info.size > 256 * 1024) continue;
    let body;
    try {
      body = await readFile(f, 'utf8');
    } catch {
      continue;
    }
    readBudget -= 1;
    const hits = body.match(/\b(TODO|FIXME|HACK|XXX)\b/g);
    if (hits) {
      todoCount += hits.length;
      todoFiles += 1;
    }
  }

  return { root, files, byExt, has, hasDir, pkg, todoCount, todoFiles };
}

function buildAssessment(report) {
  const { root, files, byExt, has, hasDir, pkg } = report;
  const lines = [];

  const topExts = [...byExt.entries()]
    .filter(([ext]) => TEXT_EXT.has(ext))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  lines.push(`# 项目评估：${resolve(root)}`);
  lines.push('');
  lines.push(`扫描到 ${files.length} 个文件。`);
  if (topExts.length) {
    lines.push('');
    lines.push(`**主要文件类型**：${topExts.map(([e, n]) => `${e || '(无扩展名)'}×${n}`).join('，')}`);
  }

  lines.push('');
  lines.push('## 工程信号');
  const signals = [];

  if (pkg) {
    const depCount = Object.keys(pkg.dependencies ?? {}).length;
    const devCount = Object.keys(pkg.devDependencies ?? {}).length;
    signals.push(`- package.json：${pkg.name ?? '(未命名)'} ${pkg.version ?? ''}，依赖 ${depCount}，开发依赖 ${devCount}`);
    const scripts = Object.keys(pkg.scripts ?? {});
    if (scripts.length) signals.push(`- 可用脚本：${scripts.join(', ')}`);
    const testScript = pkg.scripts?.test;
    signals.push(testScript ? `- ✅ 有 test 脚本：\`${testScript}\`` : '- ⚠️ 没有 test 脚本');
  } else {
    signals.push('- ⚠️ 没有 package.json（可能不是 Node 项目，或根目录不对）');
  }

  const lock = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lockb'].find(has);
  signals.push(lock ? `- ✅ 依赖锁定：${lock}` : '- ⚠️ 没有依赖锁文件');

  const tsconfig = has('tsconfig.json');
  signals.push(tsconfig ? '- ✅ TypeScript 配置存在' : '- ℹ️ 无 tsconfig.json');

  const ci = hasDir('.github') || hasDir('.gitlab-ci.yml') || files.some((f) => f.includes('.github/workflows'));
  signals.push(ci ? '- ✅ 检测到 CI 配置' : '- ⚠️ 没有检测到 CI 配置');

  const tests = files.filter((f) => /(^|[\\/])(__tests__|tests?|spec)[\\/]/i.test(f) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(f));
  signals.push(tests.length ? `- ✅ 测试文件 ${tests.length} 个` : '- ⚠️ 没有检测到测试文件');

  const docs = files.filter((f) => /\.(md|mdx)$/i.test(f));
  signals.push(docs.length ? `- ✅ 文档 ${docs.length} 篇` : '- ⚠️ 几乎没有文档');

  const envCommitted = files.some((f) => /(^|[\\/])\.env$/.test(f));
  if (envCommitted) signals.push('- 🔴 发现提交的 .env，需确认是否含密钥');

  signals.push(`- 待办标记：${report.todoCount} 处，分布在 ${report.todoFiles} 个文件`);

  lines.push(signals.join('\n'));

  lines.push('');
  lines.push('## 建议流程');
  const flow = [];
  if (!tests.length) flow.push('1. `forge_verify` 之前先补测试骨架（TDD 从最关键行为开始）');
  if (!ci) flow.push(`${flow.length + 1}. \`forge_ship\` 阶段补 CI 门禁`);
  if (!lock) flow.push(`${flow.length + 1}. \`forge_ship\` 前锁定依赖版本`);
  if (envCommitted) flow.push(`${flow.length + 1}. 立即跑 \`forge_review({ focus: "security" })\``);
  flow.push(`${flow.length + 1}. 整体走一遍 \`forge_spec → forge_plan → forge_build → forge_verify → forge_review → forge_ship\``);
  lines.push(flow.join('\n'));

  lines.push('');
  lines.push('## 各阶段入口');
  lines.push(STAGES.map((s) => `- \`${toolNameFor(s.id)}\` — ${s.title.replace(/^[①-⑥]\s*/, '')}`).join('\n'));

  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* forge_standup / forge_incident：节奏与事件能力                          */
/*                                                                     */
/* 这两个不是开发阶段，而是「节律」与「事件」两类旁路能力：            */
/* - forge_standup：把流水线产出的结果汇成一份日报（只读）；            */
/* - forge_incident：事故分诊 + 通报 + 复盘（只产出文档，不改代码）。    */
/* 方法论全文在 references/standup.md 与 references/incident-response.md。*/
/* ------------------------------------------------------------------ */

/** 取最近 N 天的提交（作者 + 主题 + 变更文件数），用于日报的真实事实。 */
async function recentCommits(repoRoot, days) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const out = await gitRun(repoRoot, ['log', `--since=${since}`, '--no-merges', '--pretty=format:%h|%an|%s']);
  if (!out) return [];
  const commits = [];
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    const [sha, author, ...rest] = line.split('|');
    if (!sha) continue;
    commits.push({ sha, author, subject: rest.join('|') });
    if (commits.length >= 40) break;
  }
  return commits;
}

/** 统计一段时间内改动最频繁的文件。 */
async function hotFiles(repoRoot, days) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const out = await gitRun(repoRoot, ['log', `--since=${since}`, '--name-only', '--pretty=format:']);
  if (!out) return [];
  const counts = new Map();
  for (const line of out.split('\n')) {
    const f = line.trim();
    if (!f) continue;
    counts.set(f, (counts.get(f) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
}

const STANDUP_REF = 'standup.md';
const INCIDENT_REF = 'incident-response.md';

/** forge_standup 的 execute：真实采集 git 事实 + 日报契约。 */
async function standupExecutor(args) {
  if (args?.refs) {
    return { text: await reviewReference(STANDUP_REF) };
  }
  const root = resolve(args?.path ? String(args.path) : process.cwd());
  const days = Number.isFinite(Number(args?.days)) ? Math.max(1, Math.min(30, Number(args.days))) : 1;
  const isRepo = (await gitRun(root, ['rev-parse', '--git-dir'])) !== null;

  const lines = [];
  lines.push('# 站会日报生成');
  lines.push('');
  if (!isRepo) {
    lines.push('> ⚠️ 该目录不是 git 仓库，无法自动采集。按「standalone」模式执行：把用户口述的工作整理成下面三段。');
  } else {
    const branch = (await gitRun(root, ['rev-parse', '--abbrev-ref', 'HEAD']))?.trim();
    const commits = await recentCommits(root, days);
    const hot = await hotFiles(root, days);
    const statusOut = await gitRun(root, ['status', '--porcelain']);
    const status = String(statusOut ?? '').split('\n').map((l) => l.trimEnd()).filter(Boolean);

    lines.push(`**采集自**：${root}`);
    lines.push(`**分支**：${branch ?? '未知'}　**窗口**：最近 ${days} 天`);
    lines.push('');
    lines.push(`## 真实活动（${commits.length} 次提交）`);
    lines.push('');
    if (commits.length === 0) {
      lines.push('- 该窗口内没有新提交。');
    } else {
      for (const c of commits.slice(0, 15)) {
        lines.push(`- \`${c.sha}\` ${c.subject}　— ${c.author}`);
      }
      if (commits.length > 15) lines.push(`- …另有 ${commits.length - 15} 次提交`);
    }
    if (hot.length) {
      lines.push('');
      lines.push('## 改动热点');
      lines.push('');
      for (const [file, n] of hot) lines.push(`- ${file}（${n} 次）`);
    }
    if (status.length) {
      lines.push('');
      lines.push(`## 未提交改动（${status.length} 条）`);
      lines.push('');
      lines.push('```');
      lines.push(...status.slice(0, 15));
      lines.push('```');
    }
  }
  lines.push('');
  lines.push('## 生成规则（方法论全文：`forge_standup({ refs: true })`）');
  lines.push('');
  lines.push('1. 把上面的真实活动翻译成「昨天 / 今天 / 阻塞」三段；提交主题要改写成业务语言，不要直接贴 commit subject。');
  lines.push('2. 每段每条一行；没有阻塞就写「Blockers: none」，不要省掉这一段。');
  lines.push('3. 没有接工单系统就不写工单号——绝不编造引用。');
  lines.push('4. 输出用下面的模板：');
  lines.push('');
  lines.push('```markdown');
  lines.push('## Standup — [Date]');
  lines.push('');
  lines.push('### Yesterday');
  lines.push('- [完成的事]');
  lines.push('');
  lines.push('### Today');
  lines.push('- [计划的事]');
  lines.push('');
  lines.push('### Blockers');
  lines.push('- [阻塞点 + 需要谁协助]');
  lines.push('```');
  lines.push('');
  lines.push('> 只读：不改任何文件、不提交代码。日报不卡流水线——它汇报结果，不挡下一阶段。');
  return { text: lines.join('\n') };
}

/** forge_incident 的 execute：分诊/通报/复盘契约（不自动改代码）。 */
async function incidentExecutor(args) {
  if (args?.refs) {
    return { text: await reviewReference(INCIDENT_REF) };
  }
  const mode = args?.mode ? String(args.mode).trim() : undefined;
  const lines = [];
  lines.push('# 事故响应');
  lines.push('');
  lines.push('**模式**：' + (mode ?? '未指定（请确认处于哪个阶段：new / update / postmortem）'));
  if (args?.description) {
    lines.push('');
    lines.push('**事件描述**：');
    lines.push(String(args.description));
  }
  lines.push('');
  lines.push('## 流程（方法论全文：`forge_incident({ refs: true })`）');
  lines.push('');
  lines.push('**阶段 1 · 分诊（TRIAGE）**');
  lines.push('- 判定严重级别（SEV1 服务全挂 / SEV2 主要功能降级 / SEV3 局部影响 / SEV4 轻微），按级别定响应时限（立即 / 15 分钟 / 1 小时 / 次工作日）。');
  lines.push('- 明确受影响的系统与用户范围。');
  lines.push('- 分配角色：指挥（IC）、沟通（comms）、处置（responders）。');
  lines.push('');
  lines.push('**阶段 2 · 通报（COMMUNICATE）**');
  lines.push('- 起草内部状态更新（模板见 references）。');
  lines.push('- 需要时起草对外沟通。');
  lines.push('- 定下作战室与通报节奏。');
  lines.push('');
  lines.push('**阶段 3 · 缓解（MITIGATE）**');
  lines.push('- 记录已采取的缓解动作。');
  lines.push('- 维护事件时间线。');
  lines.push('- 确认恢复。');
  lines.push('');
  lines.push('**阶段 4 · 复盘（POSTMORTEM）**');
  lines.push('- 无责复盘文档（5 Whys 根因、时间线重建）。');
  lines.push('- 行动项带责任人与优先级（P0/P1/P2）。');
  lines.push('');
  lines.push('## 硬性纪律');
  lines.push('');
  lines.push('1. **只产出文档，不改代码、不改配置**——修复动作交回代码所有者。');
  lines.push('2. **通报只写事实**：发生了什么、谁受影响、我们在做什么、下次更新何时；未证实的根因不写。');
  lines.push('3. **立即开写**：信息不全时先写已知部分，边查边更新，不等齐再动笔。');
  lines.push('4. **复盘无责**：只谈系统与流程，不谈个人。');
  lines.push('5. 未知就写未知：「根因待确认」是合法的时间线条目，猜测不是。');
  lines.push('');
  lines.push('## 与流水线的衔接');
  lines.push('');
  lines.push('事故是流水线的旁路，不是某个阶段：');
  lines.push('');
  lines.push('- `forge_verify` 里确认是事故 → 交由本流程负责通报与复盘文档；');
  lines.push('- 真正的代码修复回到 `forge_build` → `forge_verify` → `forge_review`；');
  lines.push('- 复盘的行动项就是回流流水线的入口。');
  return { text: lines.join('\n') };
}

/* ------------------------------------------------------------------ */
/* 插件导出                                                            */
/* ------------------------------------------------------------------ */

export const name = 'mont-forge-pipeline';
export const inject = ['tools', 'skills'];

export function apply(ctx) {
  // 1) 注册技能提供方：随包分发的 45 个 SKILL.md 进入技能目录。
  ctx.skills.registerProvider(() => provider);

  // 2) 注册九个工具。
  const register = (definition) => {
    ctx.effect(() => ctx.tools.register(definition));
  };

  for (const stage of STAGES) {
    register(stageTool(stage.id));
  }

  register({
    name: 'forge_standup',
    description:
      'mont-forge-pipeline 站会日报：真实采集最近提交、改动热点与未提交改动，产出 yesterday/today/blockers 三段日报（只读）。准备站会、汇总昨天工作或整理工作进展时调用。',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '项目根目录绝对路径。省略时用当前进程工作目录。',
        },
        days: {
          type: 'number',
          description: '回看窗口天数，默认 1（昨天），最大 30。',
        },
        refs: {
          type: 'boolean',
          description: '为 true 时只返回方法论全文（standup.md），不执行采集。',
        },
      },
      additionalProperties: false,
    },
    output: OUTPUT,
    execute: standupExecutor,
  });

  register({
    name: 'forge_incident',
    description:
      'mont-forge-pipeline 事故响应：按分诊→通报→缓解→复盘四阶段产出事故文档（严重级别、状态更新模板、无责复盘）。出现告警、需要事故定级、写状态通报或写复盘时调用；只产出文档，不改代码。',
    parameters: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          description: 'new（新建事件）/ update（状态更新）/ postmortem（复盘）。省略时按描述自动判断。',
        },
        description: {
          type: 'string',
          description: '事件描述或当前状态。',
        },
        refs: {
          type: 'boolean',
          description: '为 true 时只返回方法论全文（incident-response.md），不产出流程。',
        },
      },
      additionalProperties: false,
    },
    output: OUTPUT,
    execute: incidentExecutor,
  });

  register({
    name: 'forge_assess',
    description:
      'mont-forge-pipeline 项目评估：扫描指定目录，报告技术栈、测试、CI、文档、依赖锁定与待办标记，并给出建议的流水线入口。开发新系统或接手陌生项目时先调用它。',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '要评估的项目根目录绝对路径。省略时用当前进程工作目录。',
        },
      },
      additionalProperties: false,
    },
    output: OUTPUT,
    async execute(args) {
      const root = resolve(args?.path ? String(args.path) : process.cwd());
      let report;
      try {
        report = await scanRepo(root);
      } catch (error) {
        return { text: `无法扫描 ${root}：${error?.message ?? error}` };
      }
      return { text: buildAssessment(report) };
    },
  });

  register({
    name: 'forge_catalog',
    description:
      '列出 mont-forge-pipeline 的六个阶段、每阶段要加载的技能，以及已安装的技能清单。想确认「现在该用哪个工具」时调用。',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    output: OUTPUT,
    async execute() {
      const lines = [];
      lines.push('# mont-forge-pipeline 目录');
      lines.push('');
      lines.push('| 阶段 | 工具 | 目标 |');
      lines.push('|------|------|------|');
      for (const s of STAGES) {
        lines.push(`| ${s.title.replace(/^[①-⑥]\s*/, '')} | \`${toolNameFor(s.id)}\` | ${s.goal} |`);
      }
      lines.push('');
      lines.push('## 六阶段的先后逻辑');
      lines.push('');
      lines.push('阶段是一条单向链，每个阶段有退出标准，不满足就不进下一阶段：');
      lines.push('');
      lines.push('```');
      lines.push('forge_assess（先摸清现状，可选）');
      lines.push('   → forge_spec（规格：目标/非目标/验收标准/质量门槛）');
      lines.push('      → forge_plan（计划：任务清单/阻塞边/关键路径/首个小切片）');
      lines.push('         → forge_build（实现：薄切片 + 测试，逐片验证）');
      lines.push('            → forge_verify（验证：复现→根因→回归测试→证据）');
      lines.push('               → forge_review（评审：三通道闸门，只读，只报过闸发现）');
      lines.push('                  → forge_ship（交付：提交/CI/ADR/监控/回滚）');
      lines.push('```');
      lines.push('');
      lines.push('**关键纪律**：');
      lines.push('');
      lines.push('- `forge_review` 只读，修复建议写进报告；真正落手修代码的是 `forge_build`。');
      lines.push('- 简化（code-simplification）只在 `forge_review` 干净后跑——先审后改。');
      lines.push('- `forge_ship` 之后建议 `retro` 复盘。');
      lines.push('');
      lines.push('## 旁路能力（不在主链上，但属于同一插件）');
      lines.push('');
      lines.push('| 工具 | 触发时机 | 产出 |');
      lines.push('|------|----------|------|');
      lines.push('| `forge_standup` | 准备站会、汇总最近工作 | yesterday/today/blockers 日报（真实采集 git 活动） |');
      lines.push('| `forge_incident` | 出现告警、事故定级、写状态通报或复盘 | 分诊/通报/缓解/复盘四阶段文档（只产出文档，不改代码） |');
      lines.push('');
      lines.push('事故是旁路：`forge_verify` 里确认是事故 → `forge_incident` 负责通报与复盘 → 修复回到 `forge_build` → `forge_verify` → `forge_review`。');
      lines.push('');
      lines.push('## 辅助工具');
      lines.push('');
      lines.push('- `forge_assess` — 扫描项目目录，给出工程信号与建议的流水线入口。');
      lines.push('- `forge_catalog` — 本目录（阶段、先后逻辑、旁路能力、已装技能）。');
      lines.push('- `forge_skill` — 按名读取某个技能的完整正文。');
      lines.push('');

      try {
        const all = await ctx.skills.list({});
        const owned = all.filter((s) => s.provider === 'mont-forge-pipeline');
        const shadowed = all.filter((s) => s.provider !== 'mont-forge-pipeline');
        if (all.length) {
          lines.push(`## 已装技能（${all.length} 个）`);
          lines.push('');
          if (owned.length) {
            lines.push(`### 本包提供（${owned.length}）`);
            lines.push('');
            lines.push(owned.map((s) => `- \`${s.name}\` — ${s.description}`).join('\n'));
            lines.push('');
          }
          if (shadowed.length) {
            lines.push(`### 其他来源（${shadowed.length}）`);
            lines.push('');
            lines.push(shadowed.map((s) => `- \`${s.name}\`（${s.provider}/${s.source}）`).join('\n'));
            lines.push('');
          }
        } else {
          lines.push('## 已安装技能');
          lines.push('');
          lines.push('未发现技能。');
        }
      } catch (error) {
        lines.push(`技能清单读取失败：${error?.message ?? error}`);
      }

      return { text: lines.join('\n') };
    },
  });

  register({
    name: 'forge_skill',
    description:
      '读取某个技能的完整正文（SKILL.md）。阶段工具只给流程与模板，需要具体方法论细节时用它按名取。',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '技能名（kebab-case），例如 code-review-and-quality。',
        },
      },
      required: ['name'],
      additionalProperties: false,
    },
    output: OUTPUT,
    async execute(args) {
      const skillName = String(args?.name ?? '').trim();
      if (!skillName) return { text: '必须提供 name。先调用 forge_catalog 查看可用技能名。' };
      try {
        const skill = await ctx.skills.get(skillName, {});
        if (!skill) return { text: `未找到技能：${skillName}。调用 forge_catalog 查看可用技能名。` };
        return { text: skill.content };
      } catch (error) {
        return { text: `读取技能 ${skillName} 失败：${error?.message ?? error}` };
      }
    },
  });
}