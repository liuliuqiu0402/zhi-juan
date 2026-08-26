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
    expect(out).toContain('XLIM:min,max');
    expect(out).toContain('YLIM:min,max');
  });

  it('数学注入 EduRender 完整骨架（数轴/函数/统计图参数）', () => {
    const out = buildRenderContract({ subject: '数学', genType: 'exam' });
    // 数轴完整参数
    expect(out).toContain('TYPE:COORDINATE');
    expect(out).toContain('NUMBER_POSITION:top');
    expect(out).toContain('TICK_DIRECTION:up');
    expect(out).toContain('ARROW_STYLE:>');
    expect(out).toContain('PADDING:0.15');
    // SHAPES 元素
    expect(out).toContain('TYPE:SHAPES');
    expect(out).toContain('FUNCTION:x**2 - 2*x - 3 | COLOR:blue | DOMAIN:-3,5');
    expect(out).toContain('POLYGON:(x1,y1),(x2,y2),(x3,y3)');
    expect(out).toContain('CIRCLE:(x,y) | RADIUS:半径');
    expect(out).toContain('LINE:(x1,y1),(x2,y2)');
    expect(out).toContain('ANGLE:(x1,y1),(顶点x,y),(x2,y2)');
    // 统计图
    expect(out).toContain('TYPE:BAR_CHART');
    expect(out).toContain('DATA:15,22,18,30,25');
    expect(out).toContain('XLABEL:科目');
  });

  it('物理注入 FORCE/CIRCUIT/OPTICS 骨架', () => {
    const out = buildRenderContract({ subject: '物理', genType: 'exam' });
    expect(out).toContain('TYPE:FORCE');
    expect(out).toContain('OBJECT:rectangle,0,0,4,2');
    expect(out).toContain('TYPE:CIRCUIT');
    expect(out).toContain('battery,0,0,right');
    expect(out).toContain('TYPE:OPTICS');
    expect(out).toContain('MIRROR:plane,0,-2,0,2');
  });

  it('化学注入 ATOM 骨架', () => {
    const out = buildRenderContract({ subject: '化学', genType: 'exam' });
    expect(out).toContain('TYPE:ATOM');
    expect(out).toContain('ELEMENT:Na');
    expect(out).toContain('SHELLS:2,8,1');
  });

  it('配图注入完整 [IMAGE] 参数（SD 含 WIDTH/HEIGHT、ICON 含 KEYWORDS）', () => {
    const out = buildRenderContract({ subject: '语文', genType: 'exam', needsImage: true });
    expect(out).toContain('TYPE:SD');
    expect(out).toContain('NEGATIVE:写实,照片,复杂背景,文字,水印');
    expect(out).toContain('WIDTH:800');
    expect(out).toContain('HEIGHT:600');
    expect(out).toContain('STYLE:line_art');
    expect(out).toContain('TYPE:ICON');
    expect(out).toContain('KEYWORDS:熊猫,竹子,卡通');
  });

  it('学段门控：数学小学低段裁剪函数/几何（仅数轴+统计图），不注入公式', () => {
    const out = buildRenderContract({ subject: '数学', genType: 'exam', stage: 'primary_low' });
    expect(out).toContain('TYPE:COORDINATE');
    expect(out).toContain('TYPE:BAR_CHART');
    expect(out).not.toContain('TYPE:SHAPES');
    expect(out).not.toContain('FUNCTION:');
    expect(out).not.toContain('\\frac');
  });

  it('学段门控：数学初中注入函数/几何与公式', () => {
    const out = buildRenderContract({ subject: '数学', genType: 'exam', stage: 'middle' });
    expect(out).toContain('TYPE:SHAPES');
    expect(out).toContain('FUNCTION:x**2 - 2*x - 3');
    expect(out).toContain('\\frac');
  });

  it('学段门控：物理仅初中及以上注入（小学无物理）', () => {
    expect(buildRenderContract({ subject: '物理', genType: 'exam', stage: 'primary_low' })).toBe('');
    const out = buildRenderContract({ subject: '物理', genType: 'exam', stage: 'middle' });
    expect(out).toContain('TYPE:FORCE');
    expect(out).toContain('TYPE:CIRCUIT');
    expect(out).toContain('TYPE:OPTICS');
  });

  it('学段门控：化学仅初中及以上注入 ATOM', () => {
    expect(buildRenderContract({ subject: '化学', genType: 'exam', stage: 'primary_low' })).toBe('');
    expect(buildRenderContract({ subject: '化学', genType: 'exam', stage: 'high' })).toContain('TYPE:ATOM');
  });

  it('数理化学科（数学/物理/化学）注入公式说明', () => {
    expect(MATH_SUBJECTS).toContain('数学');
    expect(MATH_SUBJECTS).toContain('物理');
    const out = buildRenderContract({ subject: '物理', genType: 'exam' });
    expect(out).toContain('$...$');
    expect(out).toContain('$$...$$');
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

  it('教辅类默认配图（课时练/预习/阅读/默写等）——与题型关键词无关', () => {
    // 课时练模板要求"图文并茂"，即使单元名不含配图词也应注入 [IMAGE] 契约
    expect(needsImageHint('第二单元 词语练习', 'practice')).toBe(true);
    expect(needsImageHint('第二单元 词语练习', 'preview')).toBe(true);
    expect(needsImageHint('第二单元 词语练习', 'reading')).toBe(true);
    expect(needsImageHint('第二单元 词语练习', 'special')).toBe(true);
    // 纯文字类（总结/复习/错题本）不默认配图
    expect(needsImageHint('第二单元 词语练习', 'summary')).toBe(false);
    expect(needsImageHint('第二单元 词语练习', 'review')).toBe(false);
    expect(needsImageHint('第二单元 词语练习', 'errorbook')).toBe(false);
  });
});

describe('指令库内置学科×类型模板（按学科全面完善）', () => {
  it('语文 exam 三维度：含语文·小学低段要点 + 田字格/方格纸排版 + 学段特点', () => {
    const t = getPromptTemplate({ grade: '小学低段', subject: '语文', genType: 'exam' });
    expect(t.source).toBe('builtin');
    expect(t.template).toContain('【语文·小学低段要点】');
    expect(t.template).toContain('田字格');
    expect(t.template).toContain('方格纸');
    expect(t.template).toContain('【学段特点】');
  });

  it('数学 exam：含数学·小学中段要点 + 竖式 + 情境化', () => {
    const t = getPromptTemplate({ grade: '小学中段', subject: '数学', genType: 'exam' });
    expect(t.template).toContain('【数学·小学中段要点】');
    expect(t.template).toContain('竖式');
    expect(t.template).toContain('情境'); // 学科要点情境化表述（[GRAPH] 由渲染契约注入，不在要点）
  });

  it('英语 exam：含英语·小学低段要点 + 四线三格', () => {
    const t = getPromptTemplate({ grade: '小学低段', subject: '英语', genType: 'exam' });
    expect(t.template).toContain('【英语·小学低段要点】');
    expect(t.template).toContain('四线三格');
  });

  it('全部 9 个资料类型都有三维度模板（类型骨架 + 学科×学段要点 + 学段特点）', () => {
    const types = ['exam', 'practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review'];
    for (const g of types) {
      const t = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: g });
      expect(t.template, `类型 ${g} 缺学科×学段要点`).toContain('【语文·小学低段要点】');
      expect(t.template).toContain('【学段特点】');
    }
    // 类型骨架差异化：practice 三维度是课时练语料，不是试卷语料
    const p = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'practice' });
    expect(p.template).toContain('课时练');
    expect(p.template).not.toContain('满分');
  });

  it('无学段时回落通用模板；学科×学段要点只在三维度模板中（含学段时命中）', () => {
    // 无学段：回落通用（不含学科×学段要点）
    const t = getPromptTemplate({ subject: '生物', genType: 'exam' });
    expect(t.template).toContain('命题专家');
    expect(t.template).not.toContain('【生物·');
    // 含学段：命中三维度模板（学科×学段要点 + 学段特点）
    const t2 = getPromptTemplate({ grade: 'middle', subject: '生物', genType: 'exam' });
    expect(t2.template).toContain('【生物·初中要点】');
    expect(t2.template).toContain('【学段特点】');
  });

  it('5 学段 exam 全覆盖（学段特点模板）', () => {
    expect(getPromptTemplate({ grade: 'primary_low', genType: 'exam' }).template).toContain('【学段特点】');
    expect(getPromptTemplate({ grade: 'primary_low', genType: 'exam' }).name).toContain('小学低段');
    expect(getPromptTemplate({ grade: 'middle', genType: 'exam' }).template).toContain('对标中考');
    expect(getPromptTemplate({ grade: 'high', genType: 'exam' }).template).toContain('对标高考');
  });

  it('三维度全覆盖：学段×学科×exam 命中（学科×学段要点 + 学段特点，名称三维度中文）', () => {
    const t = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' });
    expect(t.name).toContain('小学低段');
    expect(t.name).toContain('语文');
    expect(t.name).toContain('正式考卷');
    expect(t.template).toContain('【语文·小学低段要点】');
    expect(t.template).toContain('【学段特点】');
    // 匹配链：三维度 > 学段×类型（初中×历史）
    const t2 = getPromptTemplate({ grade: 'middle', subject: '历史', genType: 'exam' });
    expect(t2.template).toContain('【历史·初中要点】');
    expect(t2.template).toContain('【学段特点】');
  });

  it('指令库按 486 三维度 cell 预生成（学段×学科×类型，一条全貌；名称三维度中文）', () => {
    const builtin = listPromptTemplates().filter(t => t.source === 'builtin');
    expect(builtin.filter(t => t.layer === 'cell').length).toBe(486);
    expect(builtin.length).toBe(486);
    // cell 直取：三维度 key 命中预生成 cell
    const t = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' });
    expect(t.template).toContain('【语文·小学低段要点】');
    expect(t.template).toContain('【学段特点】');
  });

  it('政治类学科名与标准化链一致：高中=思想政治、初中=道德与法治（三维度模板可命中）', () => {
    // 高中×思想政治：三维度模板命中（学科要点存在）
    const high = getPromptTemplate({ grade: 'high', subject: '思想政治', genType: 'exam' });
    expect(high.template).toContain('【思想政治·高中要点】');
    // 初中×道德与法治：三维度模板命中
    const mid = getPromptTemplate({ grade: 'middle', subject: '道德与法治', genType: 'exam' });
    expect(mid.template).toContain('【道德与法治·初中要点】');
    // 初中不再生成"政治"死键模板
    const builtin = listPromptTemplates().filter(t => t.source === 'builtin');
    expect(builtin.some(t => t.key === 'middle|政治|exam')).toBe(false);
  });

  it('学段×学科合理：小学低段无物理/化学（回落学段模板），初中/高中才有', () => {
    // 小学低段×物理：无三维度模板 → 回落学段×exam
    const t = getPromptTemplate({ grade: 'primary_low', subject: '物理', genType: 'exam' });
    expect(t.template).toContain('【学段特点】');
    expect(t.template).not.toContain('【物理·');
    // 初中×物理：有三维度模板
    const t2 = getPromptTemplate({ grade: 'middle', subject: '物理', genType: 'exam' });
    expect(t2.template).toContain('【物理·初中要点】');
    // 小学低段×语文：有三维度模板
    expect(getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' }).template).toContain('【语文·小学低段要点】');
  });
});
