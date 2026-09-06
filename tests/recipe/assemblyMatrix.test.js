// 三维度整体拼装审计（常驻回归，一条不漏）
// ============================================================
// 🔴 目的（2026-09）：不是抽样，而是 15 学科 × 5 学段 × 9 类型全部组合逐条拼装整体指令
//   （复刻 GenerateModule 真实拼接顺序：模板 → 渲染契约 → 版面质检规则 → 教辅结构/卷面结构），
//   自动检查三类编辑者视角问题：
//   ① 必含要素（内容/排版/课标/底线按类型分检）；
//   ② 跨型泄漏（题类条款不得进内容型 preview/summary 等）；
//   ③ 整句逐字重复（同一拼装内 ≥24 字符长句出现 ≥2 次 = 双源重复）。
// 每次"新问题→新句"都在此矩阵暴露同型复发，杜绝靠逐卷人工试错。
// ============================================================
import { describe, it, expect } from 'vitest';
import { getPromptTemplate, GEN_TYPE_NAMES } from '@/config/promptLibrary.js';
import { buildRenderContract, needsImageHint } from '@/config/eduRenderContract.js';
import { buildValidatorPrompt } from '@/config/validatorRules.js';
import { buildTeachingInjection } from '@/config/teachingBlueprints.js';
import { getExamBlueprint } from '@/config/examPaperBlueprints.js';
import { normalizeSubjectName } from '@/config/expertKnowledge.js';

const SUBJECTS = ['语文', '数学', '英语', '科学', '物理', '化学', '生物', '道德与法治', '思想政治', '历史', '地理', '信息科技', '音乐', '美术', '体育与健康'];
const STAGES = ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'];
const GEN_TYPES = Object.keys(GEN_TYPE_NAMES);
const STAGE_LABEL = { primary_low: '小学低段', primary_mid: '小学中段', primary_high: '小学高段', middle: '初中', high: '高中' };
const CONTENT_TYPES = ['preview', 'summary']; // 内容型：结构化呈现、无作答空间语义/卷面自洽
const QUESTION_TYPES = GEN_TYPES.filter((g) => !CONTENT_TYPES.includes(g));

function assemble(subject, stage, genType) {
  const tpl = getPromptTemplate({ grade: stage, subject, genType });
  if (!tpl || !tpl.template) return null;
  let structure = '';
  if (genType === 'exam') {
    const bp = getExamBlueprint(subject, stage);
    if (bp && bp.sections) structure = bp.sections.map((s) => `${s.name}(${s.score}分)`).join('；');
  }
  const rc = buildRenderContract({ subject, genType, stage, needsImage: needsImageHint(`${GEN_TYPE_NAMES[genType]} ${structure}`, genType) });
  const vp = buildValidatorPrompt({ subject, stage, genType });
  const teaching = genType === 'exam' ? '' : (buildTeachingInjection({ genType, stage, subject }) || '');
  return { template: tpl.template, rc: rc || '', vp: vp || '', teaching, structure, full: [tpl.template, rc, vp, teaching, structure].join('\n') };
}

/** 长句切分：按行或分号分句，取 ≥24 字符的句子，统计重复（排除渲染契约示例参数行——图表示例
 *  LABELS/DATA/COLORS 等样本参数在各示例间逐字相同属契约设计，非双源冗余） */
function dupSentences(text) {
  const counts = new Map();
  const lines = String(text).split(/\n+/);
  const parts = [];
  for (const line of lines) {
    if (/^(LABELS:|DATA:|COLORS:|TITLE:|XLABEL:|YLABEL:|SHAPES:|CIRCLE:|LINE:|POINT:|POLYGON:|ANGLE:)|类别甲|#e74c3c/.test(line.trim())) continue;
    const segs = line.split('；').map((s) => s.replace(/\s+/g, '').trim()).filter((s) => s.length >= 24);
    parts.push(...segs);
  }
  for (const s of parts) counts.set(s, (counts.get(s) || 0) + 1);
  return [...counts.entries()].filter(([, n]) => n > 1).map(([s, n]) => `${n}× ${s.slice(0, 60)}…`);
}

const KEY_MUST = {
  // 全部类型都必须具备的骨架（质量底线/输出格式在各模板内）
  common: ['质量底线'],
  question: ['作答空间形态按答案类型匹配', '卷面自洽（编辑自查总纲'],
  content: ['结构化呈现', '栏目标题'],
  exam: ['卷面格式', '密封线'],
  summary: ['创作要求'],
};

describe('三维度整体拼装审计（全量枚举 15×5×9）', () => {
  const combos = [];
  for (const subject of SUBJECTS) {
    for (const stage of STAGES) {
      for (const genType of GEN_TYPES) {
        const s = normalizeSubjectName(subject, stage);
        combos.push({ subject: s, stage, genType });
      }
    }
  }

  it(`全量组合可拼装（${SUBJECTS.length}×${STAGES.length}×${GEN_TYPES.length}，有效 ${combos.filter((c) => assemble(c.subject, c.stage, c.genType)).length}）`, () => {
    const ok = combos.filter((c) => assemble(c.subject, c.stage, c.genType));
    expect(ok.length).toBeGreaterThan(SUBJECTS.length * 2); // 至少覆盖多学科；记录有效集
    console.log('有效组合数', ok.length, '/', combos.length);
  });

  it('必含要素 + 跨型泄漏（逐组合断言，一条不漏）', () => {
    const fails = [];
    for (const { subject, stage, genType } of combos) {
      const r = assemble(subject, stage, genType);
      if (!r) continue;
      const label = `${subject}|${STAGE_LABEL[stage]}|${GEN_TYPE_NAMES[genType]}`;
      const t = r.full;
      for (const k of KEY_MUST.common) if (!t.includes(k)) fails.push(`${label} 缺【${k}】`);
      if (genType === 'exam') {
        for (const k of KEY_MUST.exam) if (!t.includes(k)) fails.push(`${label} 缺【${k}】`);
        if (!t.includes('卷面自洽（编辑自查总纲')) fails.push(`${label} exam 缺卷面自洽`);
      } else if (QUESTION_TYPES.includes(genType)) {
        for (const k of KEY_MUST.question) if (!t.includes(k)) fails.push(`${label} 缺【${k}】`);
      } else {
        for (const k of KEY_MUST.content) if (!t.includes(k)) fails.push(`${label} 缺【${k}】`);
        if (t.includes('卷面自洽（编辑自查总纲')) fails.push(`${label} 内容型泄漏题类条款：卷面自洽`);
        if (t.includes('作答空间形态按答案类型匹配')) fails.push(`${label} 内容型泄漏作答空间语义`);
        if (t.includes('· 书写载体协议：')) fails.push(`${label} 内容型泄漏书写载体协议条款`);
      }
      if (genType !== 'exam' && !r.teaching) fails.push(`${label} 非 exam 缺教辅结构注入`);
    }
    expect(fails, `共 ${fails.length} 处要素/泄漏异常：\n${fails.slice(0, 40).join('\n')}${fails.length > 40 ? `…(共${fails.length})` : ''}`).toEqual([]);
  });

  it('整句逐字重复探测（双源冗余自动暴露）', () => {
    const dups = new Map(); // 重复句 → [组合…]
    for (const { subject, stage, genType } of combos) {
      const r = assemble(subject, stage, genType);
      if (!r) continue;
      const ds = dupSentences(r.full);
      for (const d of ds) {
        if (!dups.has(d)) dups.set(d, []);
        dups.get(d).push(`${subject}|${STAGE_LABEL[stage]}|${GEN_TYPE_NAMES[genType]}`);
      }
    }
    const lines = [...dups.entries()].map(([s, cs]) => `${s}\n    ↳ 出现于 ${cs.length} 组合（如 ${cs.slice(0, 3).join('、')}…）`);
    expect(lines, `共 ${dups.size} 条整句重复（≥24 字符长句同拼装内 ≥2 次）：\n${lines.slice(0, 30).join('\n')}`).toEqual([]);
  });
});
