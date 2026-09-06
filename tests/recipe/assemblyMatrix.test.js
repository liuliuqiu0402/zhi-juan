// 三维度整体拼装审计（常驻回归，一条不漏 · 以真实开设矩阵为口径）
// ============================================================
// 🔴 口径（2026-09）：不是 15×5 笛卡尔积抽样，而是以 SUBJECT_STAGE_EXTRAS 的 54 个合法
//   学科×学段 cells（与 STAGE_SUBJECTS 全覆盖对齐的事实源）为真实开设矩阵，
//   对每个合法科段 × 9 资料类型（54×9=486 组合）逐条拼装整体指令，按编辑者视角四方向审计：
//   方向1 编辑要素达标（内容+排版清单逐条，见 EDITOR_MUST）；
//   方向2 冗余/矛盾（整句逐字重复 + 外包/旧壳句黑名单直查）；
//   方向3 课标（54 cells 非空 = 学科×学段要点无缺失；课标锚点每组合含）；
//   方向4 审核基准（单一事实源 A / 学段收敛 B / 去诱导 C / 模型职责 D）。
// 注：非法科段（如"物理|小学低段"不存在于 54 cells）不进审计面——入口本不可达；
//   全笛卡尔冒烟保留为防崩溃信息，不作为审计判定。
// ============================================================
import { describe, it, expect } from 'vitest';
import { getPromptTemplate, GEN_TYPE_NAMES, SUBJECT_STAGE_EXTRAS } from '@/config/promptLibrary.js';
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

/** 合法开设矩阵：SUBJECT_STAGE_EXTRAS 的 cells（subject|stage，54 组合，事实源） */
const LEGAL_CELLS = Object.keys(SUBJECT_STAGE_EXTRAS);
const LEGAL_COMBOS = [];
for (const cell of LEGAL_CELLS) {
  const [subject, stage] = cell.split('|');
  for (const genType of GEN_TYPES) LEGAL_COMBOS.push({ subject, stage, genType });
}

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

/** 方向1 编辑要素清单（内容要素 + 排版要素，按类型分检；特征词均为拼装整体指令中真实出现的稳定文本） */
const EDITOR_MUST = {
  common: ['质量底线', '课标', '学段'],
  question: ['【创作要求】', '【输出格式】', '作答空间形态按答案类型匹配', '卷面自洽（编辑自查总纲', '教辅结构'],
  content: ['【创作要求】', '【输出格式】', '结构化呈现', '教辅结构'],
  exam: ['【创作要求】', '【卷面结构】', '密封线', '卷面自洽（编辑自查总纲'],
};
const KEY_MUST = EDITOR_MUST;

/** 方向2/4 黑名单：职责外包句（模型该输出的内容外包给程序——违反基准 D）、旧空泛壳句复活 */
const FORBIDDEN_SNIPPETS = [
  '由排版层补足', '排版层按分值', '渲染层负责', '由程序自动补', '程序会自动',
  '按书写惯例输出对应作答书写载体', // 旧空泛壳句（曾致载体乱象），复活即红
  '书写空间按照答案的长度倒推',     // 旧换算外包句（曾与作答空间语义双轨）
];

describe('三维度整体拼装审计（真实开设矩阵 54 科段 × 9 类型 = 486，一条不漏）', () => {
  it(`合法开设矩阵 ${LEGAL_COMBOS.length} 组合全部可拼装（${LEGAL_CELLS.length} 科段 × ${GEN_TYPES.length} 类型，逐条断言不跳过）`, () => {
    const missing = [];
    for (const { subject, stage, genType } of LEGAL_COMBOS) {
      if (!assemble(subject, stage, genType)) missing.push(`${subject}|${STAGE_LABEL[stage]}|${GEN_TYPE_NAMES[genType]}`);
    }
    console.log('合法组合 拼装成功', LEGAL_COMBOS.length - missing.length, '/', LEGAL_COMBOS.length);
    expect(missing, `存在 ${missing.length} 个合法组合拼装失败（须为 0）：\n${missing.slice(0, 30).join('\n')}`).toEqual([]);
  });

  it('防崩溃冒烟（全笛卡尔 15×5×9 含非法科段入口：仅断言不抛错，不作为审计判定）', () => {
    let ok = 0;
    for (const subject of SUBJECTS) {
      for (const stage of STAGES) {
        for (const genType of GEN_TYPES) {
          const r = assemble(normalizeSubjectName(subject, stage), stage, genType);
          if (r) ok += 1;
        }
      }
    }
    console.log('笛卡尔冒烟 有效', ok, '/', SUBJECTS.length * STAGES.length * GEN_TYPES.length);
    expect(ok).toBeGreaterThan(0);
  });

  it('方向1 编辑要素逐条齐全 + 信息不丢 + 方向3 课标锚（合法 486 组合逐条断言，一条不漏）', () => {
    const fails = [];
    for (const { subject, stage, genType } of LEGAL_COMBOS) {
      const r = assemble(subject, stage, genType);
      if (!r) continue;
      const label = `${subject}|${STAGE_LABEL[stage]}|${GEN_TYPE_NAMES[genType]}`;
      const t = r.full;
      for (const k of KEY_MUST.common) if (!t.includes(k)) fails.push(`${label} 缺【${k}】`);
      if (genType === 'exam') {
        for (const k of KEY_MUST.exam) if (!t.includes(k)) fails.push(`${label} 缺【${k}】`);
        if (!r.vp) fails.push(`${label} exam 缺版面质检规则`);
        if (!r.structure) fails.push(`${label} exam 缺卷面结构明细`);
      } else if (QUESTION_TYPES.includes(genType)) {
        for (const k of KEY_MUST.question) if (!t.includes(k)) fails.push(`${label} 缺【${k}】`);
        if (!r.vp) fails.push(`${label} question 缺版面质检规则`);
        if (!r.teaching) fails.push(`${label} 非 exam 缺教辅结构注入`);
      } else {
        for (const k of KEY_MUST.content) if (!t.includes(k)) fails.push(`${label} 缺【${k}】`);
        if (t.includes('卷面自洽（编辑自查总纲')) fails.push(`${label} 内容型泄漏题类条款：卷面自洽`);
        if (t.includes('作答空间形态按答案类型匹配')) fails.push(`${label} 内容型泄漏作答空间语义`);
        if (t.includes('· 书写载体协议：')) fails.push(`${label} 内容型泄漏书写载体协议条款`);
        if (!r.teaching) fails.push(`${label} 内容型缺教辅结构注入`);
      }
    }
    expect(fails, `共 ${fails.length} 处方向1/方向3 异常：\n${fails.slice(0, 40).join('\n')}${fails.length > 40 ? `…(共${fails.length})` : ''}`).toEqual([]);
  });

  it('方向2/方向4 黑名单：职责外包句与旧空泛壳句不得在拼装中出现（合法 486 组合）', () => {
    const hits = [];
    for (const { subject, stage, genType } of LEGAL_COMBOS) {
      const r = assemble(subject, stage, genType);
      if (!r) continue;
      const label = `${subject}|${STAGE_LABEL[stage]}|${GEN_TYPE_NAMES[genType]}`;
      for (const bad of FORBIDDEN_SNIPPETS) {
        if (r.full.includes(bad)) hits.push(`${label} 含外包/旧壳句：${bad}`);
      }
    }
    expect(hits, `共 ${hits.length} 处外包/旧壳句残留：\n${hits.slice(0, 20).join('\n')}`).toEqual([]);
  });

  it('方向2 整句逐字重复探测（双源冗余自动暴露，合法 486 组合）', () => {
    const dups = new Map(); // 重复句 → [组合…]
    for (const { subject, stage, genType } of LEGAL_COMBOS) {
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
