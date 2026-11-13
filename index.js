import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname, relative, resolve } from 'node:path';

/**
 * Mont Forge 开发流水线。
 *
 * 把 mont-forge 的 44 个工程技能编排成覆盖软件开发生命周期的阶段工具：
 * spec → plan → build → verify → review → ship，另有 assess / catalog / skill 三个辅助工具。
 *
 * 设计取舍：
 * - 阶段工具返回「阶段契约 + 要加载的技能 + 产物模板 + 退出标准」，让模型直接照着做；
 * - 技能正文不内联（避免一次灌满上下文），需要时用 forge_skill 按名取；
 * - forge_assess 做真实仓库扫描，而不只是返回建议。
 *
 * @module mont-forge-pipeline
 */

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
  'code-review-and-quality': '五轴评审：正确性/可维护/可读/测试/风险',
  'code-simplification': '在行为不变的前提下降低复杂度',
  'security-and-hardening': '输入校验、鉴权、密钥、依赖安全',
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
    goal: '合并前按五个轴检查，并做简化、安全、性能专项。',
    skills: ['code-review-and-quality', 'code-simplification', 'security-and-hardening', 'performance-optimization'],
    steps: [
      '五轴过一遍：正确性、可维护性、可读性、测试、风险。',
      '能简化就简化，但行为不变。',
      '安全：所有外部输入是否校验、鉴权是否覆盖、密钥是否外泄、依赖是否有已知漏洞。',
      '性能：先测量再优化，确认瓶颈而不是猜。',
      '输出问题清单，按 P0/P1/P2 分级并给修复建议。',
    ],
    deliverables: ['评审结论', '问题清单（分级）', '必须修复项'],
    exit: ['P0 清零', '每个问题都有定位与建议', '测试证据齐全'],
    template: `## 评审：<变更>

| 级别 | 文件:行 | 问题 | 建议 |
|------|---------|------|------|
| P0   |         |      |      |

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

function stageTool(stageId) {
  const stage = STAGE_BY_ID.get(stageId);
  return {
    name: toolNameFor(stageId),
    description: `Mont Forge 流水线·${stage.title}：${stage.goal} 产出 ${stage.deliverables.join('、')}；满足退出标准后进入下一阶段。`,
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
/* 插件导出                                                            */
/* ------------------------------------------------------------------ */

export const name = 'mont-forge-pipeline';
export const inject = ['tools', 'skills'];

export function apply(ctx) {
  const register = (definition) => {
    ctx.effect(() => ctx.tools.register(definition));
  };

  for (const stage of STAGES) {
    register(stageTool(stage.id));
  }

  register({
    name: 'forge_assess',
    description:
      'Mont Forge 项目评估：扫描指定目录，报告技术栈、测试、CI、文档、依赖锁定与待办标记，并给出建议的流水线入口。开发新系统或接手陌生项目时先调用它。',
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
      '列出 Mont Forge 流水线的六个阶段、每阶段要加载的技能，以及已安装的 mont-forge 技能清单。想确认「现在该用哪个工具」时调用。',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    output: OUTPUT,
    async execute() {
      const lines = [];
      lines.push('# Mont Forge 流水线目录');
      lines.push('');
      lines.push('| 阶段 | 工具 | 目标 |');
      lines.push('|------|------|------|');
      for (const s of STAGES) {
        lines.push(`| ${s.title.replace(/^[①-⑥]\s*/, '')} | \`${toolNameFor(s.id)}\` | ${s.goal} |`);
      }
      lines.push('');
      lines.push('辅助工具：`forge_assess`（项目扫描）、`forge_catalog`（本目录）、`forge_skill`（取技能正文）。');
      lines.push('');

      try {
        const all = await ctx.skills.list({});
        const owned = all.filter((s) => s.provider === 'mont-forge');
        const shadowed = all.filter((s) => s.provider !== 'mont-forge');
        if (all.length) {
          lines.push(`## 已装技能（${all.length} 个）`);
          lines.push('');
          if (owned.length) {
            lines.push(`### mont-forge 插件提供（${owned.length}）`);
            lines.push('');
            lines.push(owned.map((s) => `- \`${s.name}\` — ${s.description}`).join('\n'));
            lines.push('');
          }
          if (shadowed.length) {
            lines.push(`### 其他来源提供（${shadowed.length}）`);
            lines.push('');
            lines.push(shadowed.map((s) => `- \`${s.name}\`（${s.provider}/${s.source}）`).join('\n'));
            lines.push('');
          }
        } else {
          lines.push('## 已安装技能');
          lines.push('');
          lines.push('未发现技能。请先安装 mont-forge 插件。');
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
      '读取 mont-forge 某个技能的完整正文（SKILL.md）。阶段工具只给流程与模板，需要具体方法论细节时用它按名取。',
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