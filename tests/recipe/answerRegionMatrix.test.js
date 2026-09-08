// 作答载体矩阵验证（15 学科 × 5 学段 × 9 资料类型 × 语义/程序双端衔接）
// ============================================================
// 🔴 目的（2026-09 卷面实证对齐）：把"各学科各学段该用什么作答形态"固化为矩阵契约——
//    生成端（buildAnswerSpaceInstruction 注入语义）与程序端（getAnswerRegion 补差 /
//    buildCarrierInstruction 格子协议）必须同源一致，防任何一端单方漂移。
// 调研结论（真实中高考答题卡/学业质量监测实证，2026-09）：
//    line（整行书写横线）学科×学段：英语全学段（写作横线 17cm/行距1cm 实证）、
//      科学全学段（简答/记录横线）、语文低中段（写话/句子练习惯例）；
//    blank-area（无线留白）其余一切（数学等理科、理化生、史地政、道法、素养类，
//      及语文 middle/high 阅读/论述/简答——中高考答题卡空白作答区实证）；
//    数学算式填空位（□/○→方框/圆圈）仅数学注入；特殊格子（田字格/四线三格/方格纸）
//    仅对应 学科×学段 注入（buildCarrierInstruction），其余学科必须为空（防越界）。
// ============================================================
import { describe, it, expect } from 'vitest';
import { buildAnswerSpaceInstruction, buildCarrierInstruction, getAnswerRegion, getCarrierAllowlist, SQUARE_GRID } from '@/config/layoutSpec.js';
import { getPromptTemplate } from '@/config/promptLibrary.js';

const SUBJECTS = ['语文', '数学', '英语', '科学', '物理', '化学', '生物', '道德与法治', '思想政治', '历史', '地理', '信息科技', '音乐', '美术', '体育与健康'];
const STAGES = ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'];

// 调研实证的 line 学科×学段（其余一律 blank-area）
const LINE_STAGES = {
  语文: ['primary_low', 'primary_mid', 'primary_high'],
  英语: STAGES,
  科学: STAGES,
};

describe('矩阵：15 学科 × 5 学段 → 程序补差 carrier（getAnswerRegion）', () => {
  for (const subject of SUBJECTS) {
    for (const stage of STAGES) {
      const expected = (LINE_STAGES[subject] || []).includes(stage) ? 'line' : 'blank-area';
      it(`${subject}·${stage} → ${expected}`, () => {
        expect(getAnswerRegion(subject, stage).carrier).toBe(expected);
      });
    }
  }
});

describe('矩阵：生成端语义与程序端补差同源（buildAnswerSpaceInstruction == getAnswerRegion）', () => {
  for (const subject of SUBJECTS) {
    for (const stage of STAGES) {
      it(`${subject}·${stage}：语义分支方向与 carrier 一致、不含另一分支形态`, () => {
        const s = buildAnswerSpaceInstruction(subject, stage);
        const carrier = getAnswerRegion(subject, stage).carrier;
        if (carrier === 'line') {
          expect(s, `${subject}·${stage} 应引导整行书写横线`).toContain('整行书写横线');
          expect(s, `${subject}·${stage} 不应引导无线空白`).not.toContain('无线空白');
        } else {
          expect(s, `${subject}·${stage} 应引导无线空白`).toContain('无线空白');
          expect(s, `${subject}·${stage} 不应引导整行书写横线`).not.toContain('整行书写横线');
        }
      });
    }
  }
});

describe('矩阵：算式填空位（方框/圆圈）仅数学注入', () => {
  for (const subject of SUBJECTS) {
    for (const stage of STAGES) {
      const s = buildAnswerSpaceInstruction(subject, stage);
      if (subject === '数学') {
        it(`数学·${stage} 注入算式填空位条款`, () => {
          expect(s).toContain('缺数/填数算式填空位』（如 3＋□＝8、□×□＝12 里待填的数）用方框或圆圈呈现，不用下划线空位');
          expect(s).toContain('等号后的得数结果位』（口算直接写得数/计算题答案位）一律在等号后直接留白书写，不使用方框、不用圆圈、不用括号');
        });
      } else {
        it(`${subject}·${stage} 不注入算式填空位条款（防跨学科广播）`, () => {
          expect(s).not.toContain('算式中的填空位');
        });
      }
    }
  }
});

describe('矩阵：特殊格子载体协议边界（buildCarrierInstruction 防越界）', () => {
  // 只允许表内 学科×学段 输出条款；其余学科/学段必须为空串（"其余学科显式空数组 = 禁止任何格子"）
  const ALLOWED_NONEMPTY = [
    ['语文', 'primary_low'], // 田字格/拼音格
    ['英语', 'primary_mid'], // 四线三格
    ['数学', 'primary_low'], ['数学', 'primary_mid'], ['数学', 'primary_high'], // 作图方格纸（小学）
  ];
  for (const subject of SUBJECTS) {
    for (const stage of STAGES) {
      const allowed = ALLOWED_NONEMPTY.some(([sub, st]) => sub === subject && st === stage);
      it(`${subject}·${stage} → ${allowed ? '有条款' : '空串（不广播格子）'}`, () => {
        const c = buildCarrierInstruction(subject, stage);
        if (allowed) expect(c).not.toBe('');
        else expect(c).toBe('');
      });
    }
  }
});

describe('矩阵：作图方格纸仅小学（中学作图走空白区，实证对齐）', () => {
  // 真实中高考答题卡：作图在按题号分割的空白作答区内用 2B 铅笔自画（省考试院规范），不预印方格纸。
  // 四层闭环契约：规格(SQUARE_GRID null) → 允许表(WRITING_CARRIER []) → 生成端(buildCarrierInstruction '')
  //   → 语义(buildAnswerSpaceInstruction 无线空白、无"方格纸"诱导)；任一层被放开都会让方格纸回到中学卷，此处钉死。
  it('SQUARE_GRID 仅 primary 有渲染参数，middle/high 为 null', () => {
    expect(SQUARE_GRID.primary).not.toBeNull();
    expect(SQUARE_GRID.middle).toBeNull();
    expect(SQUARE_GRID.high).toBeNull();
  });

  it('WRITING_CARRIER：数学小学允许 square-grid；middle/high 显式空数组（越界剥离防线）', () => {
    for (const st of ['primary_low', 'primary_mid', 'primary_high']) {
      expect(getCarrierAllowlist('数学', st)).toContain('square-grid');
    }
    expect(getCarrierAllowlist('数学', 'middle')).toEqual([]);
    expect(getCarrierAllowlist('数学', 'high')).toEqual([]);
  });

  it('生成端：数学 middle/high 无方格纸条款、长答语义为无线空白（作图题落空白区）', () => {
    for (const st of ['middle', 'high']) {
      expect(buildCarrierInstruction('数学', st)).toBe('');
      const s = buildAnswerSpaceInstruction('数学', st);
      expect(s).not.toContain('方格纸');
      expect(s).toContain('无线空白');
    }
  });
});

describe('矩阵：9 资料类型注入面（question 7 类带作答空间语义；content 2 类不带）', () => {
  const QUESTION_TYPES = ['exam', 'practice', 'special', 'reading', 'dictation', 'errorbook', 'review'];
  const CONTENT_TYPES = ['preview', 'summary'];
  for (const g of QUESTION_TYPES) {
    it(`question 型 ${g}：通用模板含作答空间语义与禁占位句`, () => {
      const t = getPromptTemplate({ genType: g });
      expect(t.template).toContain('作答空间形态按答案类型匹配');
      expect(t.template).toContain('严禁用"答：""作答区"等文字充当或预置作答空间');
    });
  }
  for (const g of CONTENT_TYPES) {
    it(`content 型 ${g}：不带作答空间语义（结构化呈现）`, () => {
      const t = getPromptTemplate({ genType: g });
      expect(t.template).not.toContain('作答空间形态按答案类型匹配');
    });
  }
});
