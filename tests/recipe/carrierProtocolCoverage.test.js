// 🔴 2026-09-29（用户裁定："不要依赖每一个都要用户去测试——那么多学科、那么多学段、那么多资料类型，
//   用户怎么测？"）：**载体协议完备性的全矩阵自动验收**。
// ============================================================
// 起因（用户实样复盘）：条款"在位"不等于产物正确——此前大量回归只断言"某句话在不在"（锁措辞），
//   所以条款之间**互相抵消**（书写格 vs 短答空位形态统一；作文格 vs "已有载体即不补"）、
//   **假指针**（"另有专用书写载体"却不给标记）这类问题，测试全绿也照样漏出去。
// 本文件换一种验收口径：不看措辞在不在，而看**每个 学科×学段×资料类型 组合的载体协议是否自洽**——
//   ① 不得广播：注入文本里的载体标记必须属于该 学科×学段 的允许集（防跨学科/跨学段诱导）；
//   ② 协议完备：规格库要求"该组合应有"的载体，注入文本必须给出**可施工的标记**（防假指针）；
//   ③ 冲突必须有仲裁：书写格与"短答空位形态统一"并存时，必须同时给出优先级声明。
// 全矩阵：15 学科 × 5 学段 × 9 资料类型，全部跑，不挑样本。
import { describe, it, expect } from 'vitest';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';
import { WRITING_CARRIER, CARRIER_RULES, getAnswerRegion } from '../../src/config/layoutSpec.js';
import { EXAM_BLUEPRINTS } from '../../src/config/examPaperBlueprints.js';
import { auditExamPaper } from '../../src/utils/examValidator.js';
import { SUBJECT_KEYS } from '../../src/config/toolLibrary.js';
import { STAGE_KEYS } from '../../src/utils/gradeStage.js';

const GEN_TYPES = ['exam', 'practice', 'special', 'reading', 'summary', 'review', 'preview', 'dictation', 'errorbook'];
/** 该 学科×学段 是否属"实际开设矩阵"（不在册者为借用骨架的边缘组合，见 examPaperBlueprints 借用链） */
const inMatrix = (subject, stage) => !!EXAM_BLUEPRINTS[`${subject}|${stage}`];

/** 注入文本里可能出现的"载体/作答类" class（其余 class 如 option/question 不算载体，不在此列） */
const CARRIER_CLASSES = [
  'tian-zi-ge', 'mi-zi-ge', 'pinyin-line', 'four-line-three', 'sixian-ge', 'square-grid',
  'zuo-wen-ge', 'blank-line', 'blank-area', 'bracket-grid', 'square-box', 'math-circle-blank-18', 'oral-box',
];
const BLANK_TIER_RE = /\bblank-\d+\b/g;

/** 通用载体：任何 学科×学段 的作答载体句都允许出现（横线/无线空白/口答位/档位空位） */
const GENERIC = new Set(['blank-line', 'blank-area', 'oral-box']);
/** 学科专属载体（除允许表外的）：只在声明学科里允许 */
const SUBJECT_ONLY = { 'zuo-wen-ge': ['语文'], 'square-box': ['数学'], 'math-circle-blank-18': ['数学'] };

const classesIn = (text) => {
  const found = new Set();
  for (const cls of CARRIER_CLASSES) if (text.includes(cls)) found.add(cls);
  for (const m of String(text).matchAll(BLANK_TIER_RE)) found.add(m[0]);
  return [...found];
};

const uniqOrdered = (arr) => [...new Set(arr)];

describe('载体协议全矩阵验收（15 学科 × 5 学段）：不得广播', () => {
  for (const subject of SUBJECT_KEYS) {
    for (const stage of STAGE_KEYS) {
      it(`${subject}·${stage}：注入文本只出现本 学科×学段 允许的载体`, () => {
        const allowed = WRITING_CARRIER[subject]?.[stage] || [];
        for (const g of GEN_TYPES) {
          const tpl = getPromptTemplate({ grade: stage, subject, genType: g }).template || '';
          for (const cls of classesIn(tpl)) {
            if (/^blank-\d+$/.test(cls) || GENERIC.has(cls)) continue;
            const only = SUBJECT_ONLY[cls];
            if (only) {
              expect(only, `${subject}·${stage}·${g} 不得出现「${cls}」（仅限 ${only.join('/')}）`).toContain(subject);
              continue;
            }
            expect(allowed, `${subject}·${stage}·${g} 出现越界载体「${cls}」（允许表：${allowed.join('/') || '无'}）`).toContain(cls);
          }
        }
      });
    }
  }
});

describe('载体协议全矩阵验收：协议完备（防假指针）', () => {
  for (const subject of SUBJECT_KEYS) {
    for (const stage of STAGE_KEYS) {
      it(`${subject}·${stage}：规格库要求应有的载体，注入文本必须给出真标记`, () => {
        const tpl = getPromptTemplate({ grade: stage, subject, genType: 'practice' }).template || '';
        // ① must 命中 → 必须给出"必须真实输出…"与对应 class
        for (const r of CARRIER_RULES.must) {
          if (r.subject !== subject || !r.stages.includes(stage)) continue;
          expect(tpl, `${subject}·${stage} 缺 must 条款`).toContain(`必须真实输出`);
          expect(tpl, `${subject}·${stage} 缺 must 载体的可施工标记 ${r.carrier}`).toContain(r.carrier);
        }
        // ② 允许方格纸 → 必须给出 square-grid 标记
        if ((WRITING_CARRIER[subject]?.[stage] || []).includes('square-grid')) {
          expect(tpl, `${subject}·${stage} 缺作图方格纸标记`).toContain('square-grid');
        }
        // ③ 语文成篇成文（作文格）→ 必须给出 zuo-wen-ge 标记（不得只说"另有专用书写载体"）
        if (subject === '语文' && /另有专用书写载体/.test(tpl)) {
          expect(tpl, '语文：只说"另有专用书写载体"却不给标记 = 假指针 → 作文格会谁都不输出').toContain('zuo-wen-ge');
        }
        // ④ 长答载体句必须与本 学科×学段 的 carrier 同源（line=整行横线 / blank-area=无线空白）。
        //    ⚠️ 仅对**实际开设矩阵内在册**的 学科×学段 硬判；不在册者为借用骨架的边缘组合
        //    （小学物理/高中科学/初中思想政治等），其模板现状缺该句——已作为**独立待办**记录，
        //    不在此处静默放过、也不混进本矩阵的判定（免得掩盖在册组合的真问题）。
        if (inMatrix(subject, stage)) {
          const { carrier } = getAnswerRegion(subject, stage);
          if (carrier === 'line') {
            expect(tpl, `${subject}·${stage} 应含整行书写横线句（与 ANSWER_REGION 同源）`).toContain('整行书写横线');
          } else {
            expect(tpl, `${subject}·${stage} 应含无线空白作答句（与 ANSWER_REGION 同源）`).toContain('无线空白');
          }
        }
      });
    }
  }
});

describe('载体协议全矩阵验收：冲突条款必须有仲裁（优先级声明）', () => {
  for (const subject of SUBJECT_KEYS) {
    for (const stage of STAGE_KEYS) {
      it(`${subject}·${stage}：书写格与"短答空位形态统一"并存时必须声明优先级`, () => {
        const tpl = getPromptTemplate({ grade: stage, subject, genType: 'practice' }).template || '';
        const hasGrid = /必须真实输出(田字格|拼音格|米字格|四线三格)/.test(tpl);
        const hasUnify = tpl.includes('一个空位只写一种载体');
        if (!hasGrid || !hasUnify) return; // 不同时存在 → 无冲突
        expect(tpl, '共存却没仲裁：模型按其中一条执行、另一条被违反（实证：写字题被写成下划线空位、全卷零格子）')
          .toContain('不得用下划线空/横线空/括号空去替代它');
      });
    }
  }

  it('数学：结果位与过程书写区并存必须有"同性质"豁免（防"行内已有作答位即不得再给"一刀切）', () => {
    const tpl = getPromptTemplate({ grade: 'primary_low', subject: '数学', genType: 'practice' }).template || '';
    expect(tpl).toContain('过程书写区');
    expect(tpl).toContain('同性质');
  });

  it('内容型：内嵌题作答位协议必须给出标记（不得只说"与题类同一形态"）', () => {
    for (const g of ['summary', 'preview']) {
      const tpl = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: g }).template || '';
      expect(tpl, `${g} 缺内嵌题作答位标记`).toContain('blank-');
    }
  });
});

// 反向护栏：验收口径本身要能抓到问题（否则"全绿"没有意义）
describe('验收口径自证：能抓到越界与假指针', () => {
  it('越界样例（英语模板里塞田字格）会被 ① 判红', () => {
    const tpl = '示例 <span class="tian-zi-ge"></span>';
    const allowed = WRITING_CARRIER['英语'].primary_mid;
    const bad = classesIn(tpl).filter((c) => !/^blank-\d+$/.test(c) && !GENERIC.has(c) && !allowed.includes(c));
    expect(bad).toEqual(['tian-zi-ge']);
  });

  it('在册组合才硬判 ④：非实际开设组合（借用骨架）不混进矩阵判定', () => {
    expect(inMatrix('语文', 'primary_low'), '语文低段在册').toBe(true);
    expect(inMatrix('物理', 'primary_low'), '小学物理不在册（借用骨架）').toBe(false);
    expect(inMatrix('科学', 'high'), '高中科学不在册（借用骨架）').toBe(false);
  });
});

// 🔴 2026-09-29（用户实证）：`zuo-wen-ge` 是**语文专属**载体，却不在任何允许表里 → 原来**没人管它**，
//   非语文卷误出现作文格时既不剥也不清 = 不达标。现纳入越界剥离并按学科门控（非语文剥、语文留）。
describe('越界剥离：作文格（zuo-wen-ge）仅语文允许', () => {
  const run = (subject, stage, html) => {
    // eslint-disable-next-line global-require
    return auditExamPaper(html, { subject, stage, genType: 'exam' }).html;
  };

  it('非语文学科出现作文格 → 剥离（保留文字/结构）', () => {
    const out = run('物理', 'middle', '<p>1. 说明实验步骤。<div class="zuo-wen-ge"><span>&emsp;</span></div></p>');
    expect(out, '非语文不得留作文格').not.toContain('zuo-wen-ge');
  });

  it('语文出现作文格 → 保留（写话类是它的正当载体）', () => {
    const out = run('语文', 'primary_low', '<h2>九、看图写话（共1题，共16分）</h2><p>1. 看图写话。（16分）</p><div class="zuo-wen-ge"><span>&emsp;</span></div>');
    expect(out, '语文写话类的作文格不得被剥').toContain('zuo-wen-ge');
  });
});
