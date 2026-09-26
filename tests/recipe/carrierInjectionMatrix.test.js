/**
 * 书写载体注入矩阵（9 类）：**能否输出合格载体**以"模型侧条款是否到位"为准
 * ============================================================
 * 口径（2026-09-27 用户定）：
 *   · 载体**以模型输出为主**，程序兜底为辅 → 首要保障是**注入条款到位**（模型侧知道该给什么载体）；
 *   · 判据按调研（学科×学段的卷面惯例，见 layoutSpec），不在此处枚举题型。
 * 本文件只锁"条款到位"这一件事；程序侧兜底与探针的覆盖见《书写载体矩阵》文档。
 */
import { describe, it, expect } from 'vitest';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';

const QUESTION_TYPES = ['exam', 'practice', 'special', 'reading', 'dictation', 'errorbook', 'review'];
const CONTENT_TYPES = ['summary', 'preview'];
const tplOf = (g, subject = '语文', grade = 'primary_low') =>
  getPromptTemplate({ grade, subject, genType: g }).template || '';

describe('书写载体注入矩阵：题类 6 类', () => {
  it('每类都注入"作答空位形态"条款（含带选项题定死圆括号、短答→横线、符号→括号）', () => {
    for (const g of QUESTION_TYPES) {
      const t = tplOf(g);
      expect(t, `${g} 缺【作答空位形态】总句`).toContain('作答空位形态与所填内容相称');
      expect(t, `${g} 缺"带选项题作答位"硬约束`).toContain('其作答位**形态一律圆括号空位**');
      expect(t, `${g} 缺"所填符号→圆括号/短答→横线"分流`).toContain('下划线空对应填词/句/数等短答');
      expect(t, `${g} 缺空位宽度换算锚`).toContain('短答空位宽度按"恰好容纳该空答案"换算');
    }
  });

  it('每类都注入"书写载体协议"（学科×学段：语文低段=拼音格等，非空才注入）', () => {
    for (const g of QUESTION_TYPES) {
      expect(tplOf(g), `${g} 缺【书写载体协议】`).toContain('书写载体协议');
    }
    // 学科×学段差异：数学中段无该协议（规格库返回空 → 不注入，属预期）
    expect(tplOf('exam', '数学', 'middle')).not.toContain('书写载体协议');
  });

  it('每类都注入"作答空位显式载体化 / 严禁裸空格"（题类总纲⑦）', () => {
    for (const g of QUESTION_TYPES) {
      const t = tplOf(g);
      expect(t, `${g} 缺"作答空位显式载体化"`).toContain('作答空位显式载体化');
      expect(t, `${g} 缺"严禁用裸空格或全角空格串充当空位"`).toContain('严禁用裸空格或全角空格串充当空位');
    }
  });
});

describe('书写载体注入矩阵：内容型（summary / preview，2 类）', () => {
  it('每类都注入"内嵌题作答位"条款（横线/括号 + 不得用裸 <u> 或空格串）', () => {
    for (const g of CONTENT_TYPES) {
      const t = tplOf(g);
      expect(t, `${g} 缺"本资料若含需学生自行作答的题"内嵌题条款`).toContain('本资料若含需学生自行作答的题');
      expect(t, `${g} 缺"不得用无 class 的裸 <u>"警示`).toContain('不得用无 class 的裸');
      expect(t, `${g} 缺"作答位必须真实输出"`).toContain('作答位必须真实输出');
    }
  });

  it('内容型**不得**注入题类总纲（判据不同，避免噪音）', () => {
    for (const g of CONTENT_TYPES) {
      expect(tplOf(g), `${g} 不应含题类自洽总纲`).not.toContain('题目自洽（编辑自查总纲');
    }
  });
});
