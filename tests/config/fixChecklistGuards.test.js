// 🔴 2026-09-29（用户裁定"标准不靠提醒、要作为标准执行"）：把《修复准则·检查清单》里**能机械校验**的条目
//   落成守卫——违反即转红，避免同类问题再次靠人工提醒才被发现。
//   本文件每条守卫都对应一次**真实踩坑**（见各 it 注释）。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getMergedSpec, LAYOUT_SPEC_DEFAULTS } from '../../src/config/layoutSpec.js';
import { CARRIERS } from '../../src/config/blueprintSchema.js';       // 载体真类名枚举（面板候选值的下游真值集）
import { subjects } from '../../src/config/expertKnowledge.js';        // canonical 学科清单（面板学科候选的下游真值集）

const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('修复准则守卫：规格库为源（防"面板可调但读不到"死字段）', () => {
  // 真实踩坑：ANSWER_MAX_ROWS_BY_STAGE 进了规格库 UI，却**没进 getMergedSpec 合并白名单** →
  //   面板能调、读取端恒取内置值（getAnswerRegion 的 `spec.X || 内置`）= 死字段，白做一轮。
  it('LayoutSpecView 的每个可调 path，其顶级键必须在 getMergedSpec()（或默认快照）里真实存在', () => {
    const vue = read('src/modules/tools/views/LayoutSpecView.vue');
    const spec = getMergedSpec();
    const keys = new Set([...Object.keys(spec), ...Object.keys(LAYOUT_SPEC_DEFAULTS)]);
    const paths = [...vue.matchAll(/path:\s*'([A-Za-z0-9_]+)(?:\.[^']*)?'/g)].map((m) => m[1]);
    const missing = [...new Set(paths)].filter((k) => !keys.has(k));
    expect(missing, `可调但读不到的规格键（死字段）：${missing.join('、')}`).toEqual([]);
  });

  it('行数上限与无分值兜底必须在合并白名单内（本次踩坑点的定点钉住）', () => {
    const spec = getMergedSpec();
    expect(spec.ANSWER_MAX_ROWS_BY_STAGE, '行数上限未进 getMergedSpec').toBeTruthy();
    expect(spec.ANSWER_NO_SCORE_ROWS, '无分值兜底未进 getMergedSpec').toBeTruthy();
  });
});

describe('修复准则守卫：文档"事实源"指向必须真实存在', () => {
  // 真实踩坑：《书写载体矩阵》把 `.blank-area` 的事实源指成 carrierCss.js —— 该文件根本没有这条规则；
  //   把尺寸指成 WRITING_CARRIER —— 那只是允许名单、不含尺寸。文档指向不存在/不对应 = 误导后续维护。
  const docs = ['docs/design/书写载体矩阵.md', 'docs/design/修复准则-检查清单.md'];
  const resolveCandidate = (p) => [
    path.join(ROOT, p),
    path.join(ROOT, 'src', p),
  ].find((abs) => fs.existsSync(abs));

  for (const doc of docs) {
    it(`${doc} 中被反引号引用的文件路径都必须存在`, () => {
      const text = read(doc);
      const files = [...text.matchAll(/`([^`\s]+\.(?:js|vue|md|css))`/g)].map((m) => m[1]);
      const bad = [...new Set(files)].filter((f) => !resolveCandidate(f));
      expect(bad, `文档指向不存在的文件：${bad.join('、')}`).toEqual([]);
    });
  }
});

describe('修复准则守卫：一刀切防线（学段×学科门控）', () => {
  // 真实踩坑：我加的"同题不重复给作答位"无学科门控，与数学"竖式过程区"相抵 → 竖式题无处书写。
  it('载体允许表必须是 学科→学段 二维（不得退化为单一列表）', async () => {
    const { WRITING_CARRIER } = await import('../../src/config/layoutSpec.js');
    const stages = new Set(['primary_low', 'primary_mid', 'primary_high', 'middle', 'high']);
    for (const [subject, row] of Object.entries(WRITING_CARRIER)) {
      expect(Array.isArray(row), `${subject} 应为 学段→载体 映射，而非单一列表`).toBe(false);
      for (const s of stages) expect(Array.isArray(row[s]), `${subject}.${s} 缺学段键`).toBe(true);
    }
  });
});

// 🔴 2026-09-29（准则第 6 条"不得有第二副本静默漂移"）：渲染/导出端的**静态尺寸**确有副本
//   （同一事实在多处各写一份字面量）。按准则：**确有副本就必须加等值守卫钉住**——本组即该守卫。
//   说明：本轮只加守卫、**不改渲染代码**（改渲染影响导出/预览观感，按准则第 3 条后置到真机验证）；
//   守卫的作用是"改一处必须全改"，否则转红。
describe('修复准则守卫：渲染静态尺寸等值守卫（第二副本不得静默漂移）', () => {
  it('四线三格/拼音格行高 --flt-h：carrierCss / themeConfig / TypesetModule 三处同值', () => {
    const grab = (src, re, label) => {
      const m = src.match(re);
      expect(m, `${label} 未取到行高值（副本被改名/删掉 → 守卫失效，须同步更新本守卫）`).toBeTruthy();
      return m[1];
    };
    const cc = grab(read('src/styles/carrierCss.js'), /var\(--flt-h,\s*([\d.]+em)\)/, 'carrierCss');
    const tc = grab(read('src/themeConfig.js'), /const FLT_H_EM = '([\d.]+em)'/, 'themeConfig');
    const ts = grab(read('src/modules/TypesetModule.vue'), /'--flt-h':\s*'([\d.]+em)'/, 'TypesetModule');
    expect([cc, tc, ts], '三处行高必须等值：不等则预览/编辑器/导出三端格子高矮不一').toEqual([cc, cc, cc]);
  });

  it('空位档位上限兜底：规格库 BLANK.maxBlank 与两处兜底字面量同值', () => {
    const src = read('src/config/layoutSpec.js').match(/maxBlank:\s*(\d+)/);
    expect(src, '规格库 BLANK.maxBlank 未取到').toBeTruthy();
    const val = src[1];
    for (const [label, file] of [['carrierCss', 'src/styles/carrierCss.js'], ['useAiGenerator', 'src/composables/useAiGenerator.js']]) {
      expect(read(file), `${label} 的档位兜底须与规格库同值（否则面板调 maxBlank 时该层不跟随）`).toContain(`: ${val};`);
    }
  });

  // 🔴 2026-09-29（用户指正："作答载体空间是指令给到模型——程序侧怎么可能知道答案长度？"）：
  //    宽度只能由模型按答案长度给出，程序侧**不得代它决定**（放大/加地板）。导出端原写 `N*4` 个 NBSP
  //    （NBSP=0.5em → 2N em，比预览 N em 宽一倍）并设 8 NBSP 地板 → 短答横线一律偏长、与答案长度无关。
  it('导出端空位宽度**逐档透传**（程序侧不得代模型放大宽度）', () => {
    const db = read('src/utils/docxBuilder.js');
    expect(db, '不得再乘 4（=2N em，比预览宽一倍）').not.toMatch(/effectiveN \* 4/);
    expect(db, '不得再设"8 个 NBSP"的宽地板').not.toContain('Math.max(8, effectiveN');
    expect(db, '应按 N 档透传：N em = 2N 个 NBSP').toContain('effectiveN * 2');
    expect(db, 'NBSP=0.5em 的口径须与透传系数同源（改其一必改其二）').toContain("ch === '\\u00A0'");
  });

  // 🔴 2026-09-29（用户裁定·③④ 零风险化）：
  //  ③ 补差应退化为"保险"——不改逻辑，但**必须可观测**：auditExamPaper 返回 fixed 计数（出稿报告用）。
  //  ④ 宽度档位的**上下限必须面板可调**（BLANK.minBlank/maxBlank 在合并白名单内）——数值属口径，不由代码定。
  it('③ 补差可观测：auditExamPaper 返回 fixed 计数（供出稿报告显示"本次补差 N 处"）', async () => {
    const { auditExamPaper } = await import('../../src/utils/examValidator.js');
    const r = auditExamPaper('<h2>一、解答（共1题，共6分）</h2><p>1. 说说你的想法。</p>', { subject: '数学', stage: 'middle', genType: 'exam' });
    expect(typeof r.fixed, '须返回 fixed 计数（否则无法看"补差是否已退化为保险"）').toBe('number');
  });

  it('④ 宽度档位上下限面板可调：BLANK.minBlank/maxBlank 在合并白名单内', () => {
    const spec = getMergedSpec();
    expect(spec.BLANK, 'BLANK 未进 getMergedSpec').toBeTruthy();
    expect(Number.isFinite(spec.BLANK.maxBlank), 'maxBlank 应可调（面板值必须能被读取端拿到）').toBe(true);
    expect(Number.isFinite(spec.BLANK.minBlank), 'minBlank 应可调（1 字位被抬到 2 档这一越位点靠它调）').toBe(true);
  });
});

// 🔴 2026-10-14（批 C-6）：面板**候选值**本身也必须是"下游认得的真值" —— 上一组守卫只钉"path 的顶级键
//   在合并白名单内"（防死字段），但**不钉候选值**：`GRID_OPTIONS` 曾用 `square`（`CARRIERS.SQUARE` 自注
//   "类名前缀、匹配 square-grid"、全库无消费方）**冒充**方格纸 → 面板选它即 ①注入 `<span class="square">`
//   （渲染端不认＝C-5 契约要防的暗伤）②写进允许表则真类名 `square-grid` 反被判越界剥掉。学科候选同理：
//   `carrierMustParts` 按 `r.subject !== subject` **原样比较**（不做归一）→ 用旧别名（道法/政治/信息）则该条
//   **永不命中**（静默失效）。本组把"候选值 ⊆ 下游真值集"钉住（改名/删项即转红，防回潮）。
describe('修复准则守卫：面板候选值必须是下游真值（学科用 canonical、载体用真类名）', () => {
  const vueOf = () => read('src/modules/tools/views/LayoutSpecView.vue');
  const arrValues = (src, name) => {
    const m = src.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
    expect(m, `${name} 未取到（改名/删除 → 守卫失效，须同步更新本守卫）`).toBeTruthy();
    return [...m[1].matchAll(/value:\s*'([^']+)'/g)].map((x) => x[1]);
  };

  it('载体候选（GRID_OPTIONS／CARRIER_OPTIONS）只含真类名，且不得再用前缀常量 square', () => {
    const vue = vueOf();
    const real = new Set(Object.values(CARRIERS));
    for (const name of ['GRID_OPTIONS', 'CARRIER_OPTIONS']) {
      const vals = arrValues(vue, name);
      expect(vals, `${name} 须含真类名 square-grid（否则面板无法表达作图方格纸）`).toContain('square-grid');
      expect(vals, `${name} 不得再含前缀常量 square（非渲染/剥离端认的 class）`).not.toContain('square');
      const bad = vals.filter((v) => !real.has(v));
      expect(bad, `${name} 含非载体类名：${bad.join('、')}（下游渲染/剥离只会认 CARRIERS 枚举值）`).toEqual([]);
    }
  });

  it('学科候选（SUBJECT_OPTIONS）只含 canonical 名（用旧别名 = must 规则永不命中）', () => {
    const vue = vueOf();
    const m = vue.match(/const SUBJECT_OPTIONS = \[([\s\S]*?)\];/);
    expect(m, 'SUBJECT_OPTIONS 未取到（改名/删除 → 守卫失效）').toBeTruthy();
    const vals = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    const canon = new Set(subjects);
    const bad = vals.filter((v) => !canon.has(v));
    expect(bad, `非 canonical 学科名：${bad.join('、')}（carrierMustParts 原样比较 r.subject !== subject，不会归一）`).toEqual([]);
  });
});
