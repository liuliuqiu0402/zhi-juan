// 蓝图注入 + 非 exam 输出格式 测试
// ============================================================
// 🔴 目的：锁定"格式内容对全部资料类型生效"的契约——
//    - exam：整卷生成指令尾部注入真题蓝本题型骨架（板块+分值+命题要求）
//    - 非 exam（课时练/预习/总结/默写等）：注入统一输出格式 buildOutputFormatHint（按 genType 分 question/content 模式）
//    - 地区选择覆盖蓝图总分/时长/板块分值（比例缩放 + 末板块修正）
// ============================================================
import { describe, it, expect } from 'vitest';
import { getExamBlueprint } from '@/config/examPaperBlueprints.js';
import { getPromptTemplate, buildOutputFormatHint, buildStructureText, PAPER_OUTPUT_CONVENTIONS } from '@/config/promptLibrary.js';
import { buildCarrierInstruction } from '@/config/layoutSpec.js';

describe('buildStructureText（exam 卷面结构注入段，单一事实源）', () => {
  it('块头在指令库 EXAM_BASE（含"共X题"填写说明），明细由 buildStructureText 注入（中文序号/分值/命题要求）', () => {
    const tpl = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' });
    // 块头由指令库 EXAM_BASE 定义（含"共X题"按实际命制题数填写的说明）
    expect(tpl.template).toContain('【卷面结构】');
    expect(tpl.template).toContain('共X题');
    // 明细由 buildStructureText 注入（蓝图数据）
    const bp = getExamBlueprint('语文', 'primary_low');
    const inject = buildStructureText(bp);
    expect(inject).toContain('一、识字与写字(共X题，共32分)——');
    expect(inject).toContain('二、积累与运用(共X题，共24分)——');
    expect(inject).toContain('三、阅读与鉴赏(共X题，共14分)——');
    expect(inject).toContain('四、表达与交流(共X题，共30分)——');
    // 大题命题要求（note）被注入
    expect(inject).toContain('覆盖本单元识字与写字内容');
    // 顺序：大题序号随位置递增
    expect(inject.indexOf('一、识字与写字')).toBeLessThan(inject.indexOf('二、积累与运用'));
  });

  it('空蓝图/无 sections 返回空串', () => {
    expect(buildStructureText(null)).toBe('');
    expect(buildStructureText({ sections: [] })).toBe('');
  });

  it('课标学段/学科条款不再注入（唯一事实源在指令库【学科·学段要点】+【学段特点】）', () => {
    const bp = getExamBlueprint('语文', 'primary_low');
    const inject = buildStructureText(bp);
    // 卷面结构段不承载课标条款（指令库已带 source 注入）
    expect(inject).not.toContain('新课标命题要求');
    expect(inject).not.toContain('情境化试题占比');
    expect(inject).not.toContain('禁止孤立罗列拼音');
    // 卷面结构仍在（大题名+分值+命题要求 note）
    expect(inject).toContain('一、识字与写字(共X题，共32分)——');
  });

  it('不再注入分值规则（分值分配回归 AI 命题常识，账目自洽由规则库 score 系列验算）', () => {
    const bp = getExamBlueprint('语文', 'middle', '江苏·南通'); // 120 → 150 缩放场景
    const inject = buildStructureText(bp);
    expect(inject).not.toContain('【分值规则】');
    expect(inject).not.toContain('小题数×每题分=大题分');
    // 卷面结构仍在
    expect(inject).toContain('一、');
  });
});

describe('getExamBlueprint 学段降级正确性（防跨学段错配）', () => {
  it('初中科学命中"科学|middle"（综合理科），不降级到小学高段蓝本', () => {
    const bp = getExamBlueprint('科学', 'middle');
    expect(bp.key).toBe('科学|middle');
    expect(bp.label).toContain('初中');
    expect(bp.sections.some(s => s.note.includes('变量控制'))).toBe(true); // 初中综合理科特征
  });

  it('小学科学命中各自精确蓝本（不走 all/middle 兜底）', () => {
    expect(getExamBlueprint('科学', 'primary_low').key).toBe('科学|primary_low');
    expect(getExamBlueprint('科学', 'primary_mid').key).toBe('科学|primary_mid');
    expect(getExamBlueprint('科学', 'primary_high').key).toBe('科学|primary_high');
  });

  it('信息科技/音乐/美术/体育按学段命中各自精确蓝本（5 档，非 all 通配）', () => {
    const stages = ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'];
    for (const subj of ['信息科技', '音乐', '美术', '体育']) {
      for (const stage of stages) {
        const bp = getExamBlueprint(subj, stage);
        expect(bp.key, `${subj}|${stage}`).toBe(`${subj}|${stage}`);
        // 学段差异化：低段与高中蓝本大题结构/分值分布不同（内容按课标学段递进）
        const sum = bp.sections.reduce((a, c) => a + c.score, 0);
        expect(sum).toBe(bp.fullScore);
      }
    }
  });

  it('政治类学科按学段转换：初中道法、高中思想政治', () => {
    expect(getExamBlueprint('政治', 'middle').key).toBe('道德与法治|middle');
    expect(getExamBlueprint('政治', 'high').key).toBe('思想政治|high');
    expect(getExamBlueprint('道德与法治', 'high').key).toBe('思想政治|high'); // 联合别名
  });
});

describe('getExamBlueprint 地区覆盖（总分/时长/板块分值）', () => {
  it('未选地区：全国通行默认（中考语文 120/120）', () => {
    const bp = getExamBlueprint('语文', 'middle');
    expect(bp.fullScore).toBe(120);
    expect(bp.duration).toBe('120分钟');
    expect(bp.sections.reduce((s, x) => s + x.score, 0)).toBe(120);
  });

  it('江苏·南通覆盖语文总分150/时长150，板块按比例缩放且总和=新总分', () => {
    const bp = getExamBlueprint('语文', 'middle', '江苏·南通');
    expect(bp.fullScore).toBe(150);
    expect(bp.duration).toBe('150分钟');
    const sum = bp.sections.reduce((s, x) => s + x.score, 0);
    expect(sum).toBe(150); // 末大题修正：大题之和精确=新总分
  });

  it('江苏·南通初中语数英均 150 分（覆盖生效）', () => {
    expect(getExamBlueprint('数学', 'middle', '江苏·南通').fullScore).toBe(150);
    expect(getExamBlueprint('数学', 'middle', '江苏·南通').duration).toBe('120分钟');
    expect(getExamBlueprint('英语', 'middle', '江苏·南通').fullScore).toBe(150);
    // 板块和 = 新总分（末大题修正闭合）
    for (const subj of ['数学', '英语']) {
      const bp = getExamBlueprint(subj, 'middle', '江苏·南通');
      expect(bp.sections.reduce((s, x) => s + x.score, 0)).toBe(150);
    }
    // 未选省市 → 全国通行默认 120
    expect(getExamBlueprint('数学', 'middle').fullScore).toBe(120);
  });

  it('未列出的省市回退蓝本默认', () => {
    const bp = getExamBlueprint('语文', 'middle', '西藏');
    expect(bp.fullScore).toBe(120);
    expect(bp.duration).toBe('120分钟');
  });
});

describe('buildOutputFormatHint（非 exam 统一输出格式）', () => {
  const hint = buildOutputFormatHint({});
  it('含结构化排版要求与正文边界要求', () => {
    expect(hint).toContain('【输出格式】');
    expect(hint).toContain('<h1>');
    expect(hint).toContain('<h2>');
    expect(hint).toContain('题目区严禁混入');
    expect(hint).toContain('书写空间按照答案的长度倒推');
  });

  it('含正文边界要求：答案仅出现在独立答案区；代码块由代码层拦截，不再要求模型', () => {
    expect(hint).toContain('答案/解析/评分标准仅出现在独立答案区');
    // 通用（无学科）不广播"听力原文"（听力原文仅英语学科答案页涉及）
    expect(hint).not.toContain('听力原文');
    expect(hint).not.toContain('严禁代码块包裹输出');
  });

  it('buildOutputFormatHint 兜底路径：按 学科×学段 注入载体条款，通用兜底不含具体示例', () => {
    const chineseLow = buildOutputFormatHint({ subject: '语文', stage: 'primary_low' });
    // 载体示例为空格子（格内不填字，与"格子为空格子"规则一致，不诱导输出已填内容的格子）
    expect(chineseLow).toContain('写汉字类题必须真实输出田字格（示例：<span class="tian-zi-ge"></span>）');
    expect(chineseLow).not.toContain('>字</span>');
    const generic = buildOutputFormatHint({});
    expect(generic).not.toContain('tian-zi-ge');
    expect(generic).not.toContain('four-line-three');
  });

  it('内容型（preview/summary）走结构化格式，不注入作答载体条款', () => {
    const preview = buildOutputFormatHint({ subject: '语文', stage: 'primary_low', genType: 'preview' });
    expect(preview).toContain('栏目标题');
    expect(preview).not.toContain('写汉字类题必须真实输出田字格');
    expect(preview).not.toContain('书写空间按照答案的长度倒推');
    const summary = buildOutputFormatHint({ genType: 'summary' });
    expect(summary).toContain('知识框架');
  });
});

describe('非 exam 模板正文自带【输出格式】（指令库可见，无需代码拼接）', () => {
  const NON_EXAM_TYPES = ['practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review'];
  const CONTENT_TYPES = ['preview', 'summary']; // 内容型：结构化呈现，不用题号
  it('8 类非 exam 三维度模板均含【输出格式】与正文边界要求', () => {
    for (const g of NON_EXAM_TYPES) {
      const t = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: g });
      expect(t.template, `类型 ${g} 缺输出格式`).toContain('【输出格式】');
      expect(t.template).toContain('题目区严禁混入');
      // 题为主类型含作答载体规则；内容型含结构化呈现规则（不用题号）
      if (CONTENT_TYPES.includes(g)) {
        expect(t.template, `类型 ${g} 缺内容组织格式`).toContain('结构化呈现');
        expect(t.template, `类型 ${g} 不应要求题号包裹`).not.toContain('以 <p class="question"> 包裹并带题号');
      } else {
        expect(t.template, `类型 ${g} 缺作答载体规则`).toContain('书写空间按照答案的长度倒推');
        expect(t.template).toContain('以 <p class="question"> 包裹并带题号');
      }
    }
  });

  it('非 exam 学段×类型模板（无学科）同样自带', () => {
    for (const g of NON_EXAM_TYPES) {
      const t = getPromptTemplate({ grade: 'middle', genType: g });
      expect(t.template, `类型 ${g}`).toContain('【输出格式】');
    }
  });

  it('exam 三维度模板自带完整卷面格式（不依赖统一块）', () => {
    const t = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' });
    expect(t.template).toContain('【卷面格式】');
    expect(t.template).toContain('密封线');
    expect(t.template).toContain('【输出格式】');
  });
});

describe('作答载体规范全模板覆盖（宽度换算口径随 BLANK 注入，不诱导形态）', () => {
  const ALL_TYPES = ['exam', 'practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review'];
  const CONTENT_TYPES = ['preview', 'summary'];
  it('9 类型通用模板均含宽度匹配语义与载体要求（无微观格式/诱导词）', () => {
    for (const g of ALL_TYPES) {
      const t = getPromptTemplate({ genType: g });
      if (CONTENT_TYPES.includes(g)) {
        expect(t.template, `类型 ${g} 缺内容组织格式`).toContain('结构化呈现');
      } else {
        expect(t.template, `类型 ${g} 缺换算口径`).toContain('书写空间按照答案的长度倒推');
        // 🔧 客观题留白/空位位置属模型既有能力，模板不得再注入引导句（审核基准：不引导、不冗余）
        expect(t.template, `类型 ${g} 残留客观题引导句`).not.toContain('不再额外整行留白');
        expect(t.template, `类型 ${g} 残留空位位置引导句`).not.toContain('随所属题目输出');
      }
      expect(t.template, `类型 ${g} 残留连线诱导词`).not.toContain('连线题');
    }
  });

  it('题为主 7 类模板换算句整行逐字完整（不漏一字：前缀+按书写惯例+主句+换算括号）', () => {
    // "按这样，不能漏一个字"：整行 = 前缀 '· 作答书写载体：' + buildBlankWidthInstruction 默认句，逐字完整投递
    const FULL_LINE =
      '· 作答书写载体：按书写惯例输出对应作答书写载体，不得遗漏；书写空间按照答案的长度倒推，每一长度对应一个字位；并按此换算' +
      '（1 个全角空格≈1 个字位≈1 em 书写宽）';
    const QUESTION_TYPES = ['exam', 'practice', 'special', 'reading', 'dictation', 'errorbook', 'review'];
    for (const g of QUESTION_TYPES) {
      const t = getPromptTemplate({ genType: g });
      expect(t.template, `类型 ${g} 换算句被截断/漏字`).toContain(FULL_LINE);
    }
    // 已移除"单处上限/超长改用整行书写位"（曾使模型对句末短答倾向独立整行书写位，2026-09 用户定稿）
    expect(FULL_LINE).not.toContain('单处上限');
    expect(FULL_LINE).not.toContain('超长改用整行书写位');
  });

  it('宽度语义按答案长度匹配（换算口径随 BLANK 动态注入；内容型无填空规则）', () => {
    for (const g of ALL_TYPES) {
      const t = getPromptTemplate({ genType: g });
      if (CONTENT_TYPES.includes(g)) {
        expect(t.template, `类型 ${g}`).not.toContain('作答书写载体');
        expect(t.template, `类型 ${g} 内容型不得注入换算口径`).not.toContain('书写空间按照答案的长度倒推');
      } else {
        // 🔧 换算口径随 BLANK 动态注入（空格数→字位→em），只讲宽度、无形态词（审核基准 2.4）
        expect(t.template, `类型 ${g} 缺换算口径`).toContain('书写空间按照答案的长度倒推');
        expect(t.template, `类型 ${g} 换算口径含形态诱导词`).not.toMatch(/括号|横线|下划线|＿|blank-\d/);
      }
      expect(t.template, `类型 ${g} 残留诱导词`).not.toContain('括号与横线二选一');
      expect(t.template, `类型 ${g} 残留形态诱导词`).not.toContain('留白书写位');
      expect(t.template, `类型 ${g} 残留形态诱导词`).not.toContain('书写空间形态');
    }
  });

  it('书写载体条款按 学科×学段 精确注入（排版规格库唯一事实源，不广播跨学科示例）', () => {
    // 通用模板（无学科/学段）：只留通用句，不含任何具体格子示例（旧版全学科广播已移除）
    const generic = getPromptTemplate({ genType: 'practice' });
    expect(generic.template).toContain('书写空间按照答案的长度倒推');
    expect(generic.template).not.toContain('不少于3行');
    expect(generic.template).not.toContain('tian-zi-ge');
    expect(generic.template).not.toContain('four-line-three');
    // 语文低段：田字格 + 拼音格（必须真实输出条款，示例为空格子）
    const chineseLow = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'practice' });
    expect(chineseLow.template).toContain('写汉字类题必须真实输出田字格（示例：<span class="tian-zi-ge"></span>）');
    expect(chineseLow.template).toContain('写拼音类题必须真实输出拼音格（示例：<span class="pinyin-line"></span>）');
    expect(chineseLow.template).not.toContain('four-line-three');
    // 语文中段：横线惯例不注入具体格子示例
    const chineseMid = getPromptTemplate({ grade: 'primary_mid', subject: '语文', genType: 'practice' });
    expect(chineseMid.template).not.toContain('<span class="tian-zi-ge">');
    // 英语：中段才注入四线三格示例，低段无（低段以听说认读为主）
    const enMid = getPromptTemplate({ grade: 'primary_mid', subject: '英语', genType: 'practice' });
    expect(enMid.template).toContain('字母/单词抄写类题必须真实输出四线三格（示例：<span class="four-line-three"></span>）');
    const enLow = getPromptTemplate({ grade: 'primary_low', subject: '英语', genType: 'practice' });
    expect(enLow.template).not.toContain('four-line-three');
    // 数学小学段：作图方格纸（作图题）
    const mathPri = getPromptTemplate({ grade: 'primary_mid', subject: '数学', genType: 'practice' });
    expect(mathPri.template).toContain('作图类题用方格纸');
    // 数学中/高学段：由考试答题纸自带网格，不注入"方格纸"诱导（SQUARE_GRID middle/high=null）
    const mathMid = getPromptTemplate({ grade: 'middle', subject: '数学', genType: 'practice' });
    expect(mathMid.template).not.toContain('方格纸');
    // 无格子学科（物理）：不注入任何载体示例 span
    const physics = getPromptTemplate({ grade: 'middle', subject: '物理', genType: 'practice' });
    expect(physics.template).not.toContain('<span class=');
  });

  it('学段特点无旧措辞 [配图说明]，统一为 [IMAGE] 标记；时长不写入学段特点（归蓝图）', () => {
    const t = getPromptTemplate({ grade: 'primary_low', genType: 'exam' });
    expect(t.template).not.toContain('[配图说明]');
    expect(t.template).toContain('[IMAGE] 标记');
    expect(t.template).toContain('认知底线');
    expect(t.template).not.toContain('40分钟'); // 时长由蓝图 duration 唯一源，学段特点不含分钟
  });

  it('作答载体条款按学科三维度：写作/表达硬约束仅语英，不广播到非语英学科', () => {
    // 数学卷：不出现任何写作/写话/作文词（写作/表达硬约束仅语英）
    const math = getPromptTemplate({ grade: 'middle', subject: '数学', genType: 'exam' });
    expect(math.template).not.toContain('写作/表达类题须完整呈现题目要求');
    expect(math.template).not.toContain('写话/作文题');
    // 语文/英语：写作/表达硬约束出现
    const chinese = getPromptTemplate({ grade: 'middle', subject: '语文', genType: 'exam' });
    expect(chinese.template).toContain('写作/表达类题须完整呈现题目要求');
    const english = getPromptTemplate({ grade: 'middle', subject: '英语', genType: 'exam' });
    expect(english.template).toContain('写作/表达类题须完整呈现题目要求');
    // 通用模板（无学科）：同样不含（无学科不注入表达约束）
    const generic = getPromptTemplate({ genType: 'practice' });
    expect(generic.template).not.toContain('写作/表达类题须完整呈现题目要求');
    expect(generic.template).not.toContain('写话/作文题');
  });
});

describe('质量底线三维度注入（类型/学科/学段各司其职，非一刀切）', () => {
  it('类型维度：各类型【要求】带专属底线（无诱导措辞）', () => {
    const practice = getPromptTemplate({ genType: 'practice' });
    expect(practice.template).toContain('板块间不重复不雷同'); // 防重复语义由质量底线承载（单一事实源）
    const special = getPromptTemplate({ genType: 'special' });
    expect(special.template).toContain('板块划分与题量按生成时注入的【教辅结构】执行');
    const reading = getPromptTemplate({ genType: 'reading' });
    expect(reading.template).toContain('短文无语病'); // 选文规范由教辅结构蓝本承载（单一事实源）
    const dictation = getPromptTemplate({ genType: 'dictation' });
    expect(dictation.template).toContain('严格对应教材要求');
    const review = getPromptTemplate({ genType: 'review' });
    expect(review.template).toContain('栏目以注入的【教辅结构】为准');
  });

  it('学科维度：三维度模板携带学科要点（学段化，正面表述）', () => {
    const chinese = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'practice' });
    expect(chinese.template).toContain('语境句'); // 语文低段：字词在语境句中
    const math = getPromptTemplate({ grade: 'middle', subject: '数学', genType: 'practice' });
    expect(math.template).toContain('推理链'); // 数学初中：解答过程完整
    const english = getPromptTemplate({ grade: 'middle', subject: '英语', genType: 'practice' });
    expect(english.template).toContain('无中式英语'); // 英语语篇底线
  });

  it('学段维度：三维度模板携带认知底线（不超学段）', () => {
    const low = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'practice' });
    expect(low.template).toContain('认知底线');
    expect(low.template).toContain('不出现未学概念与抽象符号'); // 低段：只考已学
    const high = getPromptTemplate({ grade: 'high', subject: '数学', genType: 'practice' });
    expect(high.template).toContain('不超学业质量要求'); // 高段：符合课标
    // 三维度模板同时携带 学科要点 + 学段认知底线（组合验证）
    expect(low.template).toContain('语境句');
    expect(low.template).toContain('认知底线');
  });

  it('允许课外拓展：无"禁止教材外概念"类限死措辞', () => {
    const t = getPromptTemplate({ genType: 'practice' });
    expect(t.template).not.toContain('禁止教材外概念');
    expect(t.template).not.toContain('不得超出教材');
  });
});

describe('载体允许表学科键归一化（道法/政治/信息 → canonical，越界剥离防线对 3 科恢复生效）', () => {
  it('旧别名与 canonical 名均命中同一显式空数组（剥离防线不再静默关闭）', () => {
    // 无格子学科：旧别名/规范名均返回显式空数组（非 null），指令不注入任何载体示例
    for (const subject of ['道法', '政治', '道德与法治', '思想政治', '信息', '信息科技', '历史', '体育']) {
      const clause = buildCarrierInstruction(subject, 'middle');
      expect(clause, `学科 ${subject} 不应注入载体条款`).toBe('');
    }
    // 高中政治类归一化到"思想政治"，初中政治类归一化到"道德与法治"（同样空数组）
    expect(buildCarrierInstruction('政治', 'high')).toBe('');
    expect(buildCarrierInstruction('道法', 'primary_low')).toBe('');
  });

  it('有载体学科不受影响：语文低段/英语中段/数学小学段仍精确注入', () => {
    expect(buildCarrierInstruction('语文', 'primary_low')).toContain('tian-zi-ge');
    expect(buildCarrierInstruction('英语', 'primary_mid')).toContain('four-line-three');
    expect(buildCarrierInstruction('数学', 'primary_mid')).toContain('方格纸');
  });

  it('数学中/高段不注入方格纸（归靠考试答题纸网格）', () => {
    expect(buildCarrierInstruction('数学', 'middle')).toBe('');
    expect(buildCarrierInstruction('数学', 'high')).toBe('');
  });
});

describe('回归：写字/抄写硬约束仅语英、载体示例空格子、听力原文仅英语', () => {
  it('数学（有方格纸载体）不注入"写字/抄写"词（防跨学科诱导）', () => {
    const mathLow = getPromptTemplate({ grade: 'primary_low', subject: '数学', genType: 'exam' });
    expect(mathLow.template).toContain('作图类题用方格纸'); // 载体条款仍在
    expect(mathLow.template).not.toContain('写字/抄写类题');
    expect(mathLow.template).not.toContain('抄写类题');
    const mathMid = getPromptTemplate({ grade: 'primary_mid', subject: '数学', genType: 'practice' });
    expect(mathMid.template).not.toContain('写字/抄写类题');
  });

  it('语文载体条款按 学科×学段 收敛（载体输出要求随允许表注入，不广播无载体学段）', () => {
    // 低段：田字格/拼音格载体条款（buildCarrierInstruction 按 must 注入）+ 写作/表达通用要求
    const low = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' });
    expect(low.template).toContain('写汉字类题必须真实输出田字格');
    expect(low.template).toContain('写拼音类题必须真实输出拼音格');
    expect(low.template).toContain('写作/表达类题须完整呈现题目要求');
    // 中段：无格子载体（WRITING_CARRIER 中段=line），不注入任何"写字/抄写→格"条款（曾全学段广播田字格诱导，已删）
    const mid = getPromptTemplate({ grade: 'primary_mid', subject: '语文', genType: 'exam' });
    expect(mid.template).not.toContain('写字/抄写类题须真实输出对应书写载体');
    expect(mid.template).not.toContain('tian-zi-ge');
    expect(mid.template).not.toContain('pinyin-line');
    expect(mid.template).toContain('写作/表达类题须完整呈现题目要求'); // hasEx 通用写作要求仍在
  });

  it('英语中段保留四线三格载体条款（must 单一事实源），低段无载体条款', () => {
    const enMid = getPromptTemplate({ grade: 'primary_mid', subject: '英语', genType: 'exam' });
    expect(enMid.template).toContain('字母/单词抄写类题必须真实输出四线三格');
    const enLow = getPromptTemplate({ grade: 'primary_low', subject: '英语', genType: 'exam' });
    expect(enLow.template).not.toContain('four-line-three');
    expect(enLow.template).not.toContain('写字/抄写类题须真实输出对应书写载体');
  });

  it('载体示例为空格子（示例内不填字/拼音/字母，与"格子为空格子"一致）', () => {
    expect(buildCarrierInstruction('语文', 'primary_low')).toContain('<span class="tian-zi-ge"></span>');
    expect(buildCarrierInstruction('语文', 'primary_low')).toContain('<span class="pinyin-line"></span>');
    expect(buildCarrierInstruction('英语', 'primary_mid')).toContain('<span class="four-line-three"></span>');
    expect(buildCarrierInstruction('语文', 'primary_low')).not.toContain('>字</span>');
    expect(buildCarrierInstruction('英语', 'primary_mid')).not.toContain('>a</span>');
  });

  it('PAPER_OUTPUT_CONVENTIONS 听力原文仅英语（once/split 均按学科门控）', () => {
    expect(PAPER_OUTPUT_CONVENTIONS.once('英语')).toContain('听力题附完整听力原文');
    expect(PAPER_OUTPUT_CONVENTIONS.once('数学')).not.toContain('听力原文');
    expect(PAPER_OUTPUT_CONVENTIONS.once('')).not.toContain('听力原文');
    expect(PAPER_OUTPUT_CONVENTIONS.split('英语')).toContain('听力原文');
    expect(PAPER_OUTPUT_CONVENTIONS.split('数学')).not.toContain('听力原文');
    expect(PAPER_OUTPUT_CONVENTIONS.split('')).not.toContain('听力原文');
  });

  it('非英语学科 exam 模板【输出格式】不广播"听力原文"（答案归属行按学科门控）', () => {
    const mathExam = getPromptTemplate({ grade: 'middle', subject: '数学', genType: 'exam' });
    expect(mathExam.template).not.toContain('听力原文');
    const enExam = getPromptTemplate({ grade: 'middle', subject: '英语', genType: 'exam' });
    expect(enExam.template).toContain('听力原文');
  });
});

