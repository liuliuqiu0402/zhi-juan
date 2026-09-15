// 指令库测试：三维度匹配 + 注入指令组装（拼接格式与顺序）
// ============================================================
// 🔴 目的：锁定"所有注入指令都来自指令库"的契约——
//    - 三维度（年级×学科×资料类型）匹配，用户自定义优先，内置兜底
//    - 注入指令拼接顺序固定：【任务】定位行 → 模板正文（占位符替换）→ 【用户附加要求】
//    - 持久化：保存后用户模板自动更新（下次匹配优先返回用户版）
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPromptTemplate, savePromptTemplate, deletePromptTemplate,
  buildInjectionInstruction, buildStructureText, PAPER_OUTPUT_CONVENTIONS,
  applyMaterialChannel, GEN_TYPE_NAMES, SUBJECT_STAGE_EXTRAS,
  listPromptTemplates, canonicalizeMaterialPlaceholders,
} from '@/config/promptLibrary.js';
import { setLibToggle } from '@/utils/libToggles.js';

const TEST_LIB_KEY = 'test_lib';

beforeEach(() => {
  try { localStorage.removeItem('wisdom_prompt_library_v1'); } catch {}
});

describe('指令库三维度匹配', () => {
  it('无用户自定义时：三维度匹配回退内置模板（exam 类型兜底）', () => {
    const tpl = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' });
    expect(tpl.source).toBe('builtin');
    expect(tpl.template).toContain('命题专家');
    expect(tpl.template).toContain('{structure}'); // 模板保留占位符，渲染时替换
    // 未注册类型也兜底（默认 exam 模板）
    const unknown = getPromptTemplate({ grade: 'middle', subject: '未知学科', genType: 'unknown_type' });
    expect(unknown.source).toBe('builtin');
  });

  it('语文低段学段要点：课标转述（口语交际敢说会听、写话写想说的话），不点单具体题型', () => {
    const tpl = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' });
    expect(tpl.template).toContain('口语交际敢说会听、乐于表达');
    expect(tpl.template).toContain('写自己想说的话与想象中的事物');
    // 2026-09 裁决：课标要点段只保留课标原文转述，不保留"给情境与词语支架/听要求选答"等无原文依据的命题形态
    expect(tpl.template).not.toContain('给情境与词语支架');
  });

  it('用户保存后匹配优先返回用户版（持久化自动更新）', () => {
    savePromptTemplate(`${TEST_LIB_KEY}`, { name: '测试模板', template: '你是测试专家。{subject}{grade}{structure}' });
    const tpl = getPromptTemplate({ grade: '', subject: '', genType: TEST_LIB_KEY });
    expect(tpl.source).toBe('user');
    expect(tpl.template).toContain('测试专家');
  });

  it('三维度精确 > 学科×类型 > 类型（用户覆盖优先级）', () => {
    savePromptTemplate('语文|exam', { name: '学科级', template: '学科级模板' });
    savePromptTemplate('primary_low|语文|exam', { name: '三维度', template: '三维度模板' });
    // 三维度精确命中
    expect(getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' }).template).toBe('三维度模板');
    // 其他年级命中学科级
    expect(getPromptTemplate({ grade: 'middle', subject: '语文', genType: 'exam' }).template).toBe('学科级模板');
    // 删除三维度后回退学科级
    deletePromptTemplate('primary_low|语文|exam');
    expect(getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' }).template).toBe('学科级模板');
  });

  it('删除用户模板后回退内置', () => {
    savePromptTemplate('exam', { name: 'x', template: '用户版' });
    expect(getPromptTemplate({ grade: '', subject: '', genType: 'exam' }).source).toBe('user');
    deletePromptTemplate('exam');
    expect(getPromptTemplate({ grade: '', subject: '', genType: 'exam' }).source).toBe('builtin');
  });
});

describe('注入指令组装（拼接格式与顺序）', () => {
  it('任务定位行固定最前 + 模板正文 + 用户附加最后', () => {
    const tpl = '你是命题专家。{subject}{grade}：{structure}。满分{fullScore}分，时长{duration}。';
    const out = buildInjectionInstruction({
      template: tpl, grade: '小学低段·二年级', subject: '语文', unit: '第二单元识字测评',
      genTypeLabel: '正式考卷', structure: '一、识字与写字（32分）', fullScore: '100', duration: '60分钟',
      extra: '多出几道情境题',
    });
    const lines = out.split('\n');
    // 任务行在最前
    expect(lines[0]).toContain('【任务】');
    expect(lines[0]).toContain('正式考卷');
    expect(lines[0]).toContain('语文');
    expect(lines[0]).toContain('第二单元识字测评');
    expect(lines[0]).toContain('满分100分');
    // 模板正文（占位符已替换）
    expect(out).toContain('你是命题专家。语文小学低段·二年级：一、识字与写字（32分）。满分100分，时长60分钟。');
    // 用户附加最后
    expect(out).toContain('【用户附加要求】');
    expect(out.indexOf('【用户附加要求】')).toBeGreaterThan(out.indexOf('你是命题专家'));
    expect(out).toContain('多出几道情境题');
  });

  it('{material} 占位符渲染为素材来源说明（2026-09-11 定稿：原文以【压缩原文】随委托注入）', () => {
    const out = buildInjectionInstruction({ template: '素材：{material}', subject: '语文' });
    expect(out).toContain('【压缩原文】随本委托注入'); // 素材=整章原文压缩后随委托注入
    expect(out).toContain('本次要练到的内容见开头所列'); // 范围声明（2026-09-15 去对账语言：不再写"下限"）
    expect(out).not.toContain('清单为**下限**');         // 对账语言不得回潮
    expect(out).toContain('【素材使用约定】');         // 使用与引用约束口径
    expect(out).not.toContain('研读');                 // 研读链已整体移除
    expect(out).not.toContain('browse');               // browse 机制已整体移除
    expect(out).not.toContain('【教材原文】\n');       // 素材块不进注入框
  });

  // 📚 A18（2026-09-14 素材通道）：素材段渲染按通道分流——锚清单注入通道不留"假指针"
  it('A18 素材段：full 通道段头【教材原文…】指向【压缩原文】；anchor 通道段头改【教材依据…】且无假指针', () => {
    // 🔴 2026-09-14：段头括注里的"引用教材内容须与原文一致"整条已删（措辞诱导复述教材），
    //    故此处用去该句后的段头形态作为夹具
    const tplText = '【教材原文（仅供理解：题型结构与知识梯度、要点核对）】\n{material}';

    const full = buildInjectionInstruction({ template: tplText, subject: '语文' });
    expect(full).toContain('【教材原文（仅供理解');
    expect(full).toContain('教材原文以【压缩原文】随本委托注入');

    const anchor = buildInjectionInstruction({ template: tplText, subject: '语文', materialChannel: 'anchor' });
    expect(anchor).toContain('【教材依据（仅供理解');
    expect(anchor).not.toContain('【教材原文');
    // 假指针必须消失：锚清单通道不注入【压缩原文】，不得声称"原文随委托注入"
    expect(anchor).not.toContain('教材原文以【压缩原文】随本委托注入');
    expect(anchor).not.toContain('【压缩原文】');
    // 🔴 语义保留（与"有没有注入原文"无关，两通道都在）：版本口径不得凭记忆断言
    //    （原"准确性：引用教材内容须与原文一致"句 2026-09-14 整条删除，准确性改由【质量底线】单源承载）
    expect(anchor).not.toContain('引用教材内容须与原文一致');
    expect(anchor).toContain('不得凭记忆断言');
    expect(anchor).toContain('【素材使用约定】');
  });

  it('A18 双向归一：通道来回切换可逆，且幂等（同一文本重复归一不变）', () => {
    const tplText = '【{materialHead}（仅供理解：题型结构与知识梯度）】\n{material}';
    const full = buildInjectionInstruction({ template: tplText, subject: '语文' });
    const anchor = buildInjectionInstruction({ template: tplText, subject: '语文', materialChannel: 'anchor' });
    expect(anchor).not.toBe(full);

    // anchor → full：段头与说明都还原（双向，不只单向改写）
    const backToFull = applyMaterialChannel(anchor, 'full');
    expect(backToFull).toBe(full);
    // full → anchor 再归一 = 原 anchor（可逆）
    expect(applyMaterialChannel(backToFull, 'anchor')).toBe(anchor);
    // 幂等：同一目标通道重复归一不变
    expect(applyMaterialChannel(anchor, 'anchor')).toBe(anchor);
    expect(applyMaterialChannel(full, 'full')).toBe(full);
    // 空通道 = 按 full 兜底（与既有默认行为一致），不产生第三态
    expect(applyMaterialChannel(full, '')).toBe(full);
  });

  it('A18 模板不得硬写素材段段头（否则指令库编辑器显示与真实注入不符）', () => {
    const genTypes = Object.keys(GEN_TYPE_NAMES);
    const cells = Object.keys(SUBJECT_STAGE_EXTRAS);
    const bad = [];
    for (const cell of cells) {
      const [subject, stage] = cell.split('|');
      for (const genType of genTypes) {
        const t = getPromptTemplate({ grade: stage, subject, genType })?.template || '';
        if (!t.includes('{materialHead}')) bad.push(`${cell}|${genType} 缺 {materialHead}`);
        if (t.includes('【教材原文')) bad.push(`${cell}|${genType} 硬写【教材原文`);
      }
    }
    expect(bad, bad.slice(0, 5).join('；')).toEqual([]);
  });

  it('A18 保存/导入入口规范化：硬写段头与说明句入库前换成占位符（库=注入口径同构，不留歧义字面）', () => {
    const hardcoded = '【教材原文（仅供理解：题型结构与知识梯度）】\n'
      + '（教材原文以【压缩原文】随本委托注入；本次要练到的内容见开头所列；补充/整合与使用引用约束见【素材使用约定】，以该处为准）';
    // 规范化：段头与整句说明都换占位符
    expect(canonicalizeMaterialPlaceholders(hardcoded))
      .toBe('【{materialHead}（仅供理解：题型结构与知识梯度）】\n{material}');
    // 已是占位符 → 幂等；空串安全
    expect(canonicalizeMaterialPlaceholders('【{materialHead}】\n{material}')).toBe('【{materialHead}】\n{material}');
    expect(canonicalizeMaterialPlaceholders('')).toBe('');

    // 保存入口自动规范化（库内不再存硬写段头）
    const key = '语文|primary_high|exam';
    expect(savePromptTemplate(key, { name: '自定义', template: hardcoded })).toBe(true);
    const saved = listPromptTemplates().find((t) => t.key === key)?.template || '';
    expect(saved).toContain('{materialHead}');
    expect(saved).not.toContain('【教材原文');
    // 渲染两通道仍正确
    expect(buildInjectionInstruction({ template: saved, subject: '语文' })).toContain('【教材原文（仅供理解');
    expect(buildInjectionInstruction({ template: saved, subject: '语文', materialChannel: 'anchor' })).toContain('【教材依据（仅供理解');
  });

  it('无用户附加时不输出附加块', () => {
    const out = buildInjectionInstruction({ template: '你是专家。{subject}', subject: '语文' });
    expect(out).not.toContain('用户附加');
  });
  it('{label} 占位符替换为标题类型名（名称样式轮换池注入）', () => {
    const out = buildInjectionInstruction({
      template: '标题格式"{grade}{subject}{scope}{label}"', grade: '小学低段', subject: '语文', unit: '第二单元', label: '综合检测',
    });
    expect(out).toContain('标题格式"小学低段语文第二单元综合检测"');
    // 未传 label 时兜底 genTypeLabel
    const out2 = buildInjectionInstruction({ template: '{label}', genTypeLabel: '正式考卷' });
    expect(out2).toContain('正式考卷');
  });
});

describe('卷面结构文本', () => {
  it('从蓝图生成人话结构（板块+分值）', () => {
    const bp = {
      sections: [
        { name: '识字与写字', score: 32 },
        { name: '积累与运用', score: 24 },
      ],
    };
    const text = buildStructureText(bp);
    expect(text).toContain('一、识字与写字(共X题，共32分)');
    expect(text).toContain('二、积累与运用(共X题，共24分)');
  });

  it('无蓝图返回空串', () => {
    expect(buildStructureText({})).toBe('');
  });
});

describe('指令库条目停用（工具库开关）', () => {
  it('停用内置 cell → 落回 学段×类型 模板（不含学科定制要点）', () => {
    const cellId = 'primary_low|语文|exam';
    setLibToggle('instruction', cellId, false);
    const t = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' });
    expect(t.source).toBe('builtin');
    expect(t.id).toBe('primary_low|exam'); // 落回 5) 学段×类型
    setLibToggle('instruction', cellId, true);
    expect(getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' }).id).toBe(cellId);
  });

  it('停用用户自定义 → 落回内置模板', () => {
    savePromptTemplate('语文|exam', { name: '自定义', template: '用户版专属内容' });
    expect(getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' }).template).toContain('用户版专属内容');
    setLibToggle('instruction', '语文|exam', false);
    const t = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' });
    expect(t.template).not.toContain('用户版专属内容');
    setLibToggle('instruction', '语文|exam', true);
    deletePromptTemplate('语文|exam');
  });
});

// 📐 答案区题号体系（2026-09-13 用户实证）：答案区必须"逐题以与正文相同的题号起头"——
//    曾出现答案区只用「一、」+「(1)(2)」而丢掉阿拉伯题号层 → 与正文无法逐题对应，程序计数对不上（真缺陷）。
describe('答案区题号体系：逐题沿用正文题号（禁括号序号代替题号）', () => {
  it('once（题类）：明确"每题以与正文相同的阿拉伯题号起头"并禁括号序号代替', () => {
    const once = PAPER_OUTPUT_CONVENTIONS.once('英语', false);
    expect(once).toContain('每题以与正文完全相同的阿拉伯题号起头');
    expect(once).toContain('严禁省略题号层或用括号序号代替题号');
  });

  it('once（自包含教辅）：同样要求逐题沿用正文题号', () => {
    const onceSelf = PAPER_OUTPUT_CONVENTIONS.once('语文', true);
    expect(onceSelf).toContain('每题以与正文相同的题号起头');
    expect(onceSelf).toContain('严禁省略题号层或用括号序号代替题号');
  });

  it('split：正文不输出答案，故不携带答案区题号条款（不误注入）', () => {
    const split = PAPER_OUTPUT_CONVENTIONS.split('英语', false);
    expect(split).not.toContain('答案区');
  });
});
