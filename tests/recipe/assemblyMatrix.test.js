// 三维度整体拼装审计（常驻回归，一条不漏 · 以真实开设矩阵为口径）
// ============================================================
// 🔴 口径（2026-09）：不是 15×5 笛卡尔积抽样，而是以 SUBJECT_STAGE_EXTRAS 的 54 个合法
//   学科×学段 cells（与 STAGE_SUBJECTS 全覆盖对齐的事实源）为真实开设矩阵，
//   对每个合法科段 × 9 资料类型（54×9=486 组合）逐条拼装整体指令，按编辑者视角四方向审计：
//   方向1 编辑要素达标（编辑者角度：内容要素 CONTENT_MUST 与排版要素 LAYOUT_MUST 两栏逐条断言
//       + 信息不丢（质检规则/教辅结构/卷面结构明细非空）+ 类型不串味（内容型不泄漏题类条款）
//       + 类型内容签名逐条（9 类型各有差异词被携带，探针定锚 54/54）
//       + 蓝图逐条闭环（教学蓝图 120 学科定制 × 栏目行逐条进完整指令、定制不回退通用；
//         卷面蓝图 54 科段 × 各大题名(分值) 逐条进完整指令、不回退学段降级链））；
//   方向2 冗余/矛盾（整句逐字重复 + 外包/旧壳句黑名单直查 + 类型专属词不跨类型广播）；
//   方向3 课标锚逐条（486 组合各自原样携带本人学科×学段要点 SUBJECT_STAGE_EXTRAS cell.text，
//       防跨学科广播/防回落通用模板——学科不同→要点内容不同逐条断言）；
//   方向4 审核基准（单一事实源 A / 学段收敛 B / 去诱导 C / 模型职责 D）。
// 四问 ↔ 用例粒度（每条完整指令 = 4 库：promptLibrary 主指令 + eduRenderContract 渲染契约 +
//   validatorRules 质检规则 + (teachingBlueprints | examPaperBlueprints)）：
//   Q1 编辑要素（内容+排版）：CONTENT_MUST/LAYOUT_MUST 两栏逐条 + 类型签名 + 蓝图逐条闭环 + 空条款检测；
//   Q2 冗余/矛盾：整句重复探测 + 句级重复逐句枚举（≥16 字）+ 外包/旧壳黑名单 + 类型专属词不广播；
//   Q3 课标：科段锚（cell.text 原样）整段 + cell.text 逐句命中（486 逐条）；
//   Q4 基准：A 句级重复/单一事实源、B 类型收敛、C 黑名单去诱导、D 职责外包句、F 蓝图闭环防误删误放、G 术语逐句（考点仅 exam）。
// 注：非法科段（如"物理|小学低段"不存在于 54 cells）不进审计面——入口本不可达；
//   全笛卡尔冒烟保留为防崩溃信息，不作为审计判定。
// ============================================================
import { describe, it, expect } from 'vitest';
import { getPromptTemplate, GEN_TYPE_NAMES, SUBJECT_STAGE_EXTRAS } from '@/config/promptLibrary.js';
import { buildRenderContract, needsImageHint } from '@/config/eduRenderContract.js';
import { buildValidatorPrompt } from '@/config/validatorRules.js';
import { buildTeachingInjection, getTeachingBlueprint, TEACHING_SUBJECT_BLUEPRINTS, TEACHING_BLUEPRINTS, stripSourceMarkNote } from '@/config/teachingBlueprints.js';
import { getExamBlueprint, EXAM_BLUEPRINTS } from '@/config/examPaperBlueprints.js';
import { normalizeSubjectName } from '@/config/expertKnowledge.js';

const SUBJECTS = ['语文', '数学', '英语', '科学', '物理', '化学', '生物', '道德与法治', '思想政治', '历史', '地理', '信息科技', '音乐', '美术', '体育与健康'];
const STAGES = ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'];
const GEN_TYPES = Object.keys(GEN_TYPE_NAMES);
const STAGE_LABEL = { primary_low: '小学低段', primary_mid: '小学中段', primary_high: '小学高段', middle: '初中', high: '高中' };
const CONTENT_TYPES = ['preview', 'summary']; // 内容型：结构化呈现、无作答空间语义/题目自洽
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

/** 方向1 内容要素清单（编辑者审"内容"：质量底线/课标学段锚/创作要求/作答形态自洽/教辅与内容结构）。
 *  特征词均为拼装整体指令中真实出现的稳定条款文本；按类型分检。 */
const CONTENT_MUST = {
  common: ['质量底线', '课标', '学段'],
  question: ['【创作要求】', '作答空间形态按答案类型匹配', '题目自洽（编辑自查总纲', '教辅结构'],
  content: ['【创作要求】', '结构化呈现', '教辅结构'],
  exam: ['【创作要求】', '题目自洽（编辑自查总纲'],
};

/** 方向1 排版要素清单（编辑者审"排版"：输出格式条款/卷面结构/密封线；结构明细与版面质检规则以非空断言补足）。 */
const LAYOUT_MUST = {
  question: ['【输出格式】'],
  content: ['【输出格式】'],
  exam: ['【卷面结构】', '密封线'],
};

/** 方向1 内容要素分支：content 型另有"不串味"负向断言（不泄漏题类条款），排版面由 LAYOUT_MUST + 非空断言覆盖 */
const branchOf = (genType) => (genType === 'exam' ? 'exam' : QUESTION_TYPES.includes(genType) ? 'question' : 'content');

/** 方向2/4 黑名单：职责外包句（模型该输出的内容外包给程序——违反基准 D）、旧空泛壳句复活 */
const FORBIDDEN_SNIPPETS = [
  '由排版层补足', '排版层按分值', '渲染层负责', '由程序自动补', '程序会自动',
  '按书写惯例输出对应作答书写载体', // 旧空泛壳句（曾致载体乱象），复活即红
  '书写空间按照答案的长度倒推',     // 旧换算外包句（曾与作答空间语义双轨）
];

/** 逐句切分：按行再按 。；！？ 切；空行与渲染契约示例参数行（设计内重复）剔除；规范化（去空白） */
function sentencesOf(text) {
  const out = [];
  for (const line of String(text).split(/\n+/)) {
    const l = line.trim();
    if (!l) continue;
    if (/^(LABELS:|DATA:|COLORS:|TITLE:|XLABEL:|YLABEL:|SHAPES:|CIRCLE:|LINE:|POINT:|POLYGON:|ANGLE:)|类别甲|#e74c3c/.test(l)) continue;
    for (const chunk of l.split(/(?<=[。；！？])/)) {
      const s = chunk.trim().replace(/\s+/g, '');
      if (s) out.push(s);
    }
  }
  return out;
}

/** 方向1 类型内容签名：各资料类型的差异化内容词（探针实测：本类型 54 科段组合全覆盖 54/54）。
 *  类型不同→内容不同：practice/reading/dictation 等 9 类型各有自己的内容语义，须逐条断言被携带。 */
const TYPE_SIGNATURE = {
  exam: ['密封线', '考试'],
  practice: ['课时'],
  special: ['专项'],
  preview: ['预习'],
  reading: ['短文', '阅读'],
  summary: ['总结'],
  dictation: ['默写'],
  errorbook: ['错题'],
  review: ['复习'],
};

/** 审核基准 B（类型维度收敛）：实测他型 0 命中（432/432 不泄漏）的专属词——跨类型广播即红；
 *  practice/课时、dictation/默写 存在合法他型提及（课时进预习/默写积累语境），只做正向签名，不进本表。 */
const TYPE_EXCLUSIVE = {
  exam: ['密封线', '考试'],
  special: ['专项'],
  preview: ['预习', '课前'],
  reading: ['短文'],
  summary: ['总结'],
  errorbook: ['错题'],
  review: ['复习'],
};

describe('三维度完整指令逐句审计（真实开设矩阵 54 科段 × 9 类型 = 486，一条不漏 · 四问）', () => {
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

  it('方向1 编辑要素两栏逐条：内容要素 CONTENT_MUST + 排版要素 LAYOUT_MUST + 信息不丢 + 类型不串味（合法 486 组合，一条不漏）', () => {
    const fails = [];
    for (const { subject, stage, genType } of LEGAL_COMBOS) {
      const r = assemble(subject, stage, genType);
      if (!r) continue;
      const label = `${subject}|${STAGE_LABEL[stage]}|${GEN_TYPE_NAMES[genType]}`;
      const t = r.full;
      const branch = branchOf(genType);
      for (const k of CONTENT_MUST.common) if (!t.includes(k)) fails.push(`${label} 内容要素缺【${k}】`);
      for (const k of CONTENT_MUST[branch]) if (!t.includes(k)) fails.push(`${label} 内容要素缺【${k}】`);
      for (const k of LAYOUT_MUST[branch]) if (!t.includes(k)) fails.push(`${label} 排版要素缺【${k}】`);
      if (genType === 'exam') {
        if (!r.vp) fails.push(`${label} 排版要素缺版面质检规则`);
        if (!r.structure) fails.push(`${label} 排版要素缺卷面结构明细`);
      } else if (QUESTION_TYPES.includes(genType)) {
        if (!r.vp) fails.push(`${label} 排版要素缺版面质检规则`);
        if (!r.teaching) fails.push(`${label} 内容要素缺教辅结构注入`);
      } else {
        if (t.includes('题目自洽（编辑自查总纲')) fails.push(`${label} 内容型串味：泄漏题类条款"题目自洽"`);
        if (t.includes('作答空间形态按答案类型匹配')) fails.push(`${label} 内容型串味：泄漏作答空间语义`);
        if (t.includes('· 书写载体协议：')) fails.push(`${label} 内容型串味：泄漏书写载体协议条款`);
        if (!r.teaching) fails.push(`${label} 内容要素缺教辅结构注入`);
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

  it('方向1 类型签名逐条：9 资料类型各自携带本类型内容差异词（类型不同→内容不同，486 组合一条不漏）', () => {
    const miss = [];
    for (const { subject, stage, genType } of LEGAL_COMBOS) {
      const r = assemble(subject, stage, genType);
      if (!r) continue;
      const label = `${subject}|${STAGE_LABEL[stage]}|${GEN_TYPE_NAMES[genType]}`;
      for (const sig of TYPE_SIGNATURE[genType] || []) {
        if (!r.full.includes(sig)) miss.push(`${label} 类型内容签名缺失【${sig}】`);
      }
    }
    expect(miss, `共 ${miss.length} 处类型签名缺失（须为 0）：\n${miss.slice(0, 40).join('\n')}${miss.length > 40 ? `…(共${miss.length})` : ''}`).toEqual([]);
  });

  it('方向2/基准B 类型专属词不跨类型广播：他型命中即红（防题型模板张冠李戴，486 组合）', () => {
    const hits = [];
    for (const { subject, stage, genType } of LEGAL_COMBOS) {
      const r = assemble(subject, stage, genType);
      if (!r) continue;
      const label = `${subject}|${STAGE_LABEL[stage]}|${GEN_TYPE_NAMES[genType]}`;
      for (const [owner, words] of Object.entries(TYPE_EXCLUSIVE)) {
        if (owner === genType) continue;
        for (const w of words) {
          if (r.full.includes(w)) hits.push(`${label} 泄漏他型专属词【${w}】（属 ${GEN_TYPE_NAMES[owner]}）`);
        }
      }
    }
    expect(hits, `共 ${hits.length} 处类型专属词广播（须为 0）：\n${hits.slice(0, 40).join('\n')}${hits.length > 40 ? `…(共${hits.length})` : ''}`).toEqual([]);
  });

  it('方向3 课标锚逐条：486 组合各自携带本人学科×学段要点（SUBJECT_STAGE_EXTRAS cell.text 原样命中，防跨学科广播/防回落通用模板）', () => {
    const miss = [];
    for (const { subject, stage, genType } of LEGAL_COMBOS) {
      const r = assemble(subject, stage, genType);
      if (!r) { miss.push(`${subject}|${STAGE_LABEL[stage]}|${GEN_TYPE_NAMES[genType]} 拼装失败`); continue; }
      const cell = SUBJECT_STAGE_EXTRAS[`${subject}|${stage}`];
      if (!cell) miss.push(`${subject}|${STAGE_LABEL[stage]}|${GEN_TYPE_NAMES[genType]} 科段失配（SUBJECT_STAGE_EXTRAS 缺 key）`);
      else if (!r.full.includes(cell.text)) miss.push(`${subject}|${STAGE_LABEL[stage]}|${GEN_TYPE_NAMES[genType]} 缺本人学科×学段要点（疑似回落通用模板/跨学科广播）`);
    }
    expect(miss, `共 ${miss.length} 处科段锚缺失（须为 0）：\n${miss.slice(0, 40).join('\n')}${miss.length > 40 ? `…(共${miss.length})` : ''}`).toEqual([]);
  });

  it('方向1 蓝图闭环·教学蓝图：120 条学科定制（15科×8类型）逐组合携带全部栏目行——每条内容进到它该进的完整指令（栏目不缺失/定制不回退通用/注入不丢）', () => {
    const fails = [];
    for (const { subject, stage, genType } of LEGAL_COMBOS) {
      if (genType === 'exam') continue; // 教学蓝图只注入非卷类型（432 组合）
      const r = assemble(subject, stage, genType);
      if (!r) continue;
      const label = `${subject}|${STAGE_LABEL[stage]}|${GEN_TYPE_NAMES[genType]}`;
      const bp = getTeachingBlueprint({ genType, stage, subject });
      if (!bp) { fails.push(`${label} 无教学蓝图解析（注入缺失源）`); continue; }
      const cellCustom = TEACHING_SUBJECT_BLUEPRINTS[subject]?.[genType];
      const expected = cellCustom || TEACHING_BLUEPRINTS[genType];
      const expectCustom = Boolean(cellCustom);
      if (bp.custom !== expectCustom) fails.push(`${label} 定制回退错位：期望${expectCustom ? '学科定制' : '通用'}，实得${bp.custom ? '定制' : '通用'}`);
      if (!r.teaching) { fails.push(`${label} 教学蓝图注入为空`); continue; }
      if (!r.full.includes(r.teaching)) fails.push(`${label} 教学蓝图注入未进完整指令`);
      for (const s of expected?.sections || []) {
        const row = `· ${s.name}——${stripSourceMarkNote(s.note)}`;
        if (!r.teaching.includes(row)) fails.push(`${label} 教学蓝图栏目行缺失：${s.name}`);
      }
    }
    expect(fails, `共 ${fails.length} 处教学蓝图闭环异常（须为 0）：\n${fails.slice(0, 40).join('\n')}${fails.length > 40 ? `…(共${fails.length})` : ''}`).toEqual([]);
  });

  it('方向1 蓝图闭环·卷面蓝图：54 科段 exam 组合逐条携带本人蓝本各大题（题名/分值进整条指令、不回退学段降级链）', () => {
    const fails = [];
    for (const { subject, stage, genType } of LEGAL_COMBOS) {
      if (genType !== 'exam') continue; // 卷面蓝图只注入卷类型（54 组合）
      const r = assemble(subject, stage, genType);
      if (!r) continue;
      const label = `${subject}|${STAGE_LABEL[stage]}|${GEN_TYPE_NAMES[genType]}`;
      const direct = EXAM_BLUEPRINTS[`${subject}|${stage}`];
      const bp = getExamBlueprint(subject, stage);
      if (!direct) { fails.push(`${label} 卷面蓝本缺 key（54 科段失配）`); continue; }
      if (!bp) { fails.push(`${label} 卷面蓝图解析为空`); continue; }
      if (bp.key !== `${subject}|${stage}`) fails.push(`${label} 卷面蓝图回退降级：实际 ${bp.key}（期望本人 ${subject}|${stage}）`);
      if (!r.structure) { fails.push(`${label} 卷面结构明细为空`); continue; }
      if (!r.full.includes(r.structure)) fails.push(`${label} 卷面结构明细未进完整指令`);
      for (const s of direct.sections) {
        if (!r.full.includes(`${s.name}(${s.score}分)`)) fails.push(`${label} 卷面大题缺失：${s.name}(${s.score}分)`);
      }
    }
    expect(fails, `共 ${fails.length} 处卷面蓝图闭环异常（须为 0）：\n${fails.slice(0, 40).join('\n')}${fails.length > 40 ? `…(共${fails.length})` : ''}`).toEqual([]);
  });

  it('方向2 句级重复逐句枚举：同指令内 ≥16 字同句 ≥2 次即红（486 组合 × 每句；渲染契约示例参数行豁免）', () => {
    const hits = [];
    let totalSent = 0;
    for (const { subject, stage, genType } of LEGAL_COMBOS) {
      const r = assemble(subject, stage, genType);
      if (!r) continue;
      const label = `${subject}|${STAGE_LABEL[stage]}|${GEN_TYPE_NAMES[genType]}`;
      const seen = new Map();
      for (const s of sentencesOf(r.full)) {
        totalSent += 1;
        if (s.length < 16) continue;
        seen.set(s, (seen.get(s) || 0) + 1);
      }
      for (const [s, n] of seen) if (n > 1) hits.push(`${label} 句级重复 ${n}×：${s.slice(0, 40)}…`);
    }
    console.log('逐句枚举 总句数', totalSent, '/ 486 组合');
    expect(hits, `共 ${hits.length} 处句级重复（≥16 字同句 ≥2 次）：\n${hits.slice(0, 40).join('\n')}${hits.length > 40 ? `…(共${hits.length})` : ''}`).toEqual([]);
  });

  it('基准G 术语逐句：非卷组合指令任何句子不得含"考点"（exam 卷面条款除外；486 组合 × 每句枚举）', () => {
    const hits = [];
    for (const { subject, stage, genType } of LEGAL_COMBOS) {
      if (genType === 'exam') continue;
      const r = assemble(subject, stage, genType);
      if (!r) continue;
      const label = `${subject}|${STAGE_LABEL[stage]}|${GEN_TYPE_NAMES[genType]}`;
      for (const s of sentencesOf(r.full)) {
        if (s.includes('考点')) hits.push(`${label} 含"考点"句：${s.slice(0, 40)}…`);
      }
    }
    expect(hits, `共 ${hits.length} 处"考点"残留（须为 0，非卷指令面已统一核心知识/知识层级）：\n${hits.slice(0, 40).join('\n')}${hits.length > 40 ? `…(共${hits.length})` : ''}`).toEqual([]);
  });

  it('护栏：模型注入面（整条拼装指令）不含"建议题型/suggested"字样——✅ A1-5（2026-09-12）该字段已彻底下线，防回潮（486 组合）', () => {
    const fails = [];
    for (const { subject, stage, genType } of LEGAL_COMBOS) {
      const r = assemble(subject, stage, genType);
      if (!r) continue;
      const label = `${GEN_TYPE_NAMES[genType]}|${subject}|${stage}`;
      if (r.full.includes('建议题型') || r.full.includes('suggested')) fails.push(`${label} 注入面含建议题型`);
    }
    expect(fails, `注入面出现建议题型：\n${fails.slice(0, 20).join('\n')}`).toEqual([]);
  });

  it('Q1 编辑要素逐句·空条款检测：纯标题行（【…】独占一行）后必须紧跟内容句，不得只有标题无条款（486 完整指令）', () => {
    const fails = [];
    for (const { subject, stage, genType } of LEGAL_COMBOS) {
      const r = assemble(subject, stage, genType);
      if (!r) continue;
      const label = `${subject}|${STAGE_LABEL[stage]}|${GEN_TYPE_NAMES[genType]}`;
      const lines = r.full.split(/\n+/);
      for (let i = 0; i < lines.length; i++) {
        const h = lines[i].trim();
        if (!/^【[^】]+】$/.test(h)) continue;
        let body = null;
        for (let j = i + 1; j < lines.length; j++) {
          const c = lines[j].trim();
          if (!c) continue;
          if (/^【[^】]+】$/.test(c)) break;
          body = c;
          break;
        }
        if (!body) fails.push(`${label} 空条款：${h} 后无内容句`);
      }
    }
    expect(fails, `共 ${fails.length} 处空条款（标题行后无内容句）：\n${fails.slice(0, 40).join('\n')}${fails.length > 40 ? `…(共${fails.length})` : ''}`).toEqual([]);
  });

  it('Q3 课标逐句：本人学科×学段要点 cell.text 的每一句逐句命中完整指令（54 科段 × 9 类型，486 逐条）', () => {
    const fails = [];
    for (const { subject, stage, genType } of LEGAL_COMBOS) {
      const r = assemble(subject, stage, genType);
      if (!r) continue;
      const cell = SUBJECT_STAGE_EXTRAS[`${subject}|${stage}`];
      if (!cell) continue;
      const label = `${subject}|${STAGE_LABEL[stage]}|${GEN_TYPE_NAMES[genType]}`;
      const normFull = r.full.replace(/\s+/g, '');
      for (const s of sentencesOf(cell.text)) {
        if (!normFull.includes(s)) fails.push(`${label} 本人课标要点句缺失：${s.slice(0, 40)}…`);
      }
    }
    expect(fails, `共 ${fails.length} 处课标要点句缺失（须为 0）：\n${fails.slice(0, 40).join('\n')}${fails.length > 40 ? `…(共${fails.length})` : ''}`).toEqual([]);
  });
});
