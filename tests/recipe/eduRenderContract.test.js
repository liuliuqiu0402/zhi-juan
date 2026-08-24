// EduRender 渲染契约 + 指令库学科模板测试
// ============================================================
// 🔴 目的：锁定"打磨成果不因分步流水线删除而丢失"——
//    - 渲染指令按 学科×类型×是否配图 三维度注入（[GRAPH]/公式/[IMAGE]）
//    - 指令库内置学科×类型模板：按学科全面完善（命题要点+排版，非仅排版行）
// ============================================================
import { describe, it, expect } from 'vitest';
import { buildRenderContract, needsImageHint, GRAPH_SUBJECTS, MATH_SUBJECTS } from '@/config/eduRenderContract.js';
import { getPromptTemplate, listPromptTemplates } from '@/config/promptLibrary.js';

describe('EduRender 渲染契约（三维度注入）', () => {
  it('图形学科（数学）注入 [GRAPH] 说明', () => {
    const out = buildRenderContract({ subject: '数学', genType: 'exam' });
    expect(out).toContain('[GRAPH]');
    expect(out).toContain('TYPE:BAR_CHART');
    expect(out).toContain('XLIM/YLIM');
  });

  it('数理化学科（数学/物理/化学）注入公式说明', () => {
    expect(MATH_SUBJECTS).toContain('数学');
    expect(MATH_SUBJECTS).toContain('物理');
    expect(buildRenderContract({ subject: '物理', genType: 'exam' })).toContain('$...$/$$...$$');
  });

  it('配图类题型注入 [IMAGE] 说明（SD/ICON 格式）', () => {
    const out = buildRenderContract({ subject: '语文', genType: 'exam', needsImage: true });
    expect(out).toContain('[IMAGE]');
    expect(out).toContain('TYPE:SD');
    expect(out).toContain('PROMPT');
    expect(out).toContain('TYPE:ICON');
    // 图与题干一致性约束（防"图片与内容不符"）
    expect(out).toContain('与题干情境严格一致');
  });

  it('无需图/公式的学科（体育）不注入渲染指令（保持指令精简）', () => {
    expect(buildRenderContract({ subject: '体育', genType: 'exam' })).toBe('');
  });

  it('needsImageHint 识别看图/写话类题型', () => {
    expect(needsImageHint('看图写话，写几句话', 'exam')).toBe(true);
    expect(needsImageHint('连一连', 'exam')).toBe(false);
  });
});

describe('指令库内置学科×类型模板（按学科全面完善）', () => {
  it('语文 exam 三维度：含语文学科要点 + 田字格/方格纸排版 + 学段特点', () => {
    const t = getPromptTemplate({ grade: '小学低段', subject: '语文', genType: 'exam' });
    expect(t.source).toBe('builtin');
    expect(t.template).toContain('【语文学科要点】');
    expect(t.template).toContain('田字格');
    expect(t.template).toContain('方格纸');
    expect(t.template).toContain('【学段特点】');
  });

  it('数学 exam：含数学学科要点 + 竖式 + [GRAPH] 简图', () => {
    const t = getPromptTemplate({ grade: '小学中段', subject: '数学', genType: 'exam' });
    expect(t.template).toContain('【数学学科要点】');
    expect(t.template).toContain('竖式');
    expect(t.template).toContain('[GRAPH]');
  });

  it('英语 exam：含英语学科要点 + 四线三格', () => {
    const t = getPromptTemplate({ grade: '小学低段', subject: '英语', genType: 'exam' });
    expect(t.template).toContain('【英语学科要点】');
    expect(t.template).toContain('四线三格');
  });

  it('全部 9 个资料类型都有三维度模板（内容=类型骨架+学科要点+学段特点）', () => {
    const types = ['exam', 'practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review'];
    for (const g of types) {
      const t = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: g });
      expect(t.template, `类型 ${g} 三维度缺失`).toContain('【语文学科要点】');
      expect(t.template).toContain('【学段特点】');
    }
    // 类型骨架差异化：practice 三维度是课时练语料，不是试卷语料
    const p = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'practice' });
    expect(p.template).toContain('课时练');
    expect(p.template).not.toContain('满分');
  });

  it('无学段时回落通用模板；学科要点只在三维度模板中（含学段时命中）', () => {
    // 无学段：回落通用（不含学科要点）
    const t = getPromptTemplate({ subject: '生物', genType: 'exam' });
    expect(t.template).toContain('命题专家');
    expect(t.template).not.toContain('【生物学科要点】');
    // 含学段：命中三维度模板（学科要点 + 学段特点）
    const t2 = getPromptTemplate({ grade: 'middle', subject: '生物', genType: 'exam' });
    expect(t2.template).toContain('【生物学科要点】');
    expect(t2.template).toContain('【学段特点】');
  });

  it('5 学段 exam 全覆盖（学段特点模板）', () => {
    expect(getPromptTemplate({ grade: 'primary_low', genType: 'exam' }).template).toContain('【学段特点】');
    expect(getPromptTemplate({ grade: 'primary_low', genType: 'exam' }).name).toContain('小学低段');
    expect(getPromptTemplate({ grade: 'middle', genType: 'exam' }).template).toContain('对标中考');
    expect(getPromptTemplate({ grade: 'high', genType: 'exam' }).template).toContain('对标高考');
  });

  it('三维度全覆盖：学段×学科×exam 命中（学科要点 + 学段特点）', () => {
    const t = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' });
    expect(t.name).toContain('小学低段·语文');
    expect(t.template).toContain('【语文学科要点】');
    expect(t.template).toContain('【学段特点】');
    // 匹配链：三维度 > 学段×类型（初中×历史）
    const t2 = getPromptTemplate({ grade: 'middle', subject: '历史', genType: 'exam' });
    expect(t2.template).toContain('【历史学科要点】');
    expect(t2.template).toContain('【学段特点】');
  });

  it('三维度模板全量：486（54 学科组合 × 9 类型）+ 学段×类型 45', () => {
    const builtin = listPromptTemplates().filter(t => t.source === 'builtin');
    const dim3 = builtin.filter(t => t.key.split('|').length === 3);
    const dim2 = builtin.filter(t => t.key.split('|').length === 2);
    expect(dim3.length).toBe(486);
    expect(dim2.length).toBe(45);
  });

  it('政治类学科名与标准化链一致：高中=思想政治、初中=道德与法治（三维度模板可命中）', () => {
    // 高中×思想政治：三维度模板命中（学科要点存在）
    const high = getPromptTemplate({ grade: 'high', subject: '思想政治', genType: 'exam' });
    expect(high.template).toContain('【思想政治学科要点】');
    // 初中×道德与法治：三维度模板命中
    const mid = getPromptTemplate({ grade: 'middle', subject: '道德与法治', genType: 'exam' });
    expect(mid.template).toContain('【道德与法治学科要点】');
    // 初中不再生成"政治"死键模板
    const builtin = listPromptTemplates().filter(t => t.source === 'builtin');
    expect(builtin.some(t => t.key === 'middle|政治|exam')).toBe(false);
  });

  it('学段×学科合理：小学低段无物理/化学（回落学段模板），初中/高中才有', () => {
    // 小学低段×物理：无三维度模板 → 回落学段×exam
    const t = getPromptTemplate({ grade: 'primary_low', subject: '物理', genType: 'exam' });
    expect(t.template).toContain('【学段特点】');
    expect(t.template).not.toContain('【物理学科要点】');
    // 初中×物理：有三维度模板
    const t2 = getPromptTemplate({ grade: 'middle', subject: '物理', genType: 'exam' });
    expect(t2.template).toContain('【物理学科要点】');
    // 小学低段×语文：有三维度模板
    expect(getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' }).template).toContain('【语文学科要点】');
  });
});
