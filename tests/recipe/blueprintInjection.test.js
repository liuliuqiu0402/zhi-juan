// 蓝图注入 + 非 exam 输出格式 测试
// ============================================================
// 🔴 目的：锁定"格式内容对全部资料类型生效"的契约——
//    - exam：整卷生成指令尾部注入真题蓝本题型骨架（板块+分值+命题要求）
//    - 非 exam（课时练/预习/总结/默写等）：注入统一输出格式 OUTPUT_FORMAT_HINT
//    - 地区选择覆盖蓝图总分/时长/板块分值（比例缩放 + 末板块修正）
// ============================================================
import { describe, it, expect } from 'vitest';
import { getExamBlueprint, buildBlueprintInjection } from '@/config/examPaperBlueprints.js';
import { getPromptTemplate, OUTPUT_FORMAT_HINT } from '@/config/promptLibrary.js';

describe('buildBlueprintInjection（exam 蓝图精简注入块）', () => {
  it('注入大题名+分值+命题要求，中文序号，头部固定提示', () => {
    const bp = getExamBlueprint('语文', 'primary_low');
    const inject = buildBlueprintInjection(bp);
    expect(inject).toContain('【卷面结构（真题蓝本，大题与分值固定，不得增删改）】');
    expect(inject).toContain('一、识字与写字（共X题，共32分）——');
    expect(inject).toContain('二、积累与运用（共X题，共24分）——');
    expect(inject).toContain('三、阅读与鉴赏（共X题，共14分）——');
    expect(inject).toContain('四、表达与交流（共X题，共30分）——');
    // 大题命题要求（note 清洗后：激活式、无具体内容引导）被注入
    expect(inject).toContain('覆盖本单元识字与写字能力点');
    expect(inject).not.toContain('禁止连续2道以上使用完全相同的题型格式');
    // 顺序：大题序号随位置递增
    expect(inject.indexOf('一、识字与写字')).toBeLessThan(inject.indexOf('二、积累与运用'));
  });

  it('空蓝图/无 sections 返回空串', () => {
    expect(buildBlueprintInjection(null)).toBe('');
    expect(buildBlueprintInjection({ sections: [] })).toBe('');
  });

  it('注入学段/学科新课标条款（质量底线），不注入卷面规范全文', () => {
    const bp = getExamBlueprint('语文', 'primary_low');
    const inject = buildBlueprintInjection(bp);
    // 新课标条款已注入（学段 + 学科）
    expect(inject).toContain('【小学新课标命题要求】');
    expect(inject).toContain('情境化试题占比低段≥40%');
    expect(inject).toContain('【语文新课标命题要求】');
    expect(inject).toContain('禁止孤立罗列拼音');
    // 卷面规范全文不进注入指令（模板【卷面格式】承担），条款头部红字也不进
    expect(inject).not.toContain('密封线');
    expect(inject).not.toContain('▌卷面规范');
    expect(inject).not.toContain('🔴 本蓝本为新课标真题卷通行规范');
  });

  it('不再注入分值规则（分值分配回归 AI 命题常识，账目自洽由规则库 score 系列验算）', () => {
    const bp = getExamBlueprint('语文', 'middle', '江苏·南通'); // 120 → 150 缩放场景
    const inject = buildBlueprintInjection(bp);
    expect(inject).not.toContain('【分值规则】');
    expect(inject).not.toContain('小题数×每题分=大题分');
    // 结构 + 学段/学科新课标条款仍在
    expect(inject).toContain('【卷面结构（真题蓝本，大题与分值固定，不得增删改）】');
    expect(inject).toContain('新课标命题要求');
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

describe('OUTPUT_FORMAT_HINT（非 exam 统一输出格式）', () => {
  it('含结构化排版要求与正文边界要求', () => {
    expect(OUTPUT_FORMAT_HINT).toContain('【输出格式】');
    expect(OUTPUT_FORMAT_HINT).toContain('<h1>');
    expect(OUTPUT_FORMAT_HINT).toContain('<h2>');
    expect(OUTPUT_FORMAT_HINT).toContain('只输出资料正文');
    expect(OUTPUT_FORMAT_HINT).toContain('填空空位宽度与答案字数匹配');
  });

  it('含正文边界要求：答案不入正文；代码块由代码层拦截，不再要求模型', () => {
    expect(OUTPUT_FORMAT_HINT).toContain('严禁在正文中输出任何答案/解析');
    expect(OUTPUT_FORMAT_HINT).not.toContain('严禁代码块包裹输出');
  });
});

describe('非 exam 模板正文自带【输出格式】（指令库可见，无需代码拼接）', () => {
  const NON_EXAM_TYPES = ['practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review'];
  const CONTENT_TYPES = ['preview', 'summary']; // 内容型：结构化呈现，不用题号
  it('8 类非 exam 三维度模板均含【输出格式】与正文边界要求', () => {
    for (const g of NON_EXAM_TYPES) {
      const t = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: g });
      expect(t.template, `类型 ${g} 缺输出格式`).toContain('【输出格式】');
      expect(t.template).toContain('只输出资料正文');
      // 题为主类型含作答载体规则；内容型含结构化呈现规则（不用题号）
      if (CONTENT_TYPES.includes(g)) {
        expect(t.template, `类型 ${g} 缺内容组织格式`).toContain('结构化呈现');
        expect(t.template, `类型 ${g} 不应要求题号包裹`).not.toContain('以 <p class="question"> 包裹并带题号');
      } else {
        expect(t.template, `类型 ${g} 缺作答载体规则`).toContain('填空空位宽度与答案字数匹配');
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

describe('作答载体规范全模板覆盖（宽度匹配语义，不诱导微观格式）', () => {
  const ALL_TYPES = ['exam', 'practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review'];
  const CONTENT_TYPES = ['preview', 'summary'];
  it('9 类型通用模板均含宽度匹配语义与载体要求（无微观格式/诱导词）', () => {
    for (const g of ALL_TYPES) {
      const t = getPromptTemplate({ genType: g });
      if (CONTENT_TYPES.includes(g)) {
        expect(t.template, `类型 ${g} 缺内容组织格式`).toContain('结构化呈现');
      } else {
        expect(t.template, `类型 ${g} 缺宽度匹配语义`).toContain('1字≈2格');
        expect(t.template, `类型 ${g} 缺括号空位要求`).toContain('选择/判断用括号空位');
      }
      expect(t.template, `类型 ${g} 残留连线诱导词`).not.toContain('连线题');
    }
  });

  it('宽度语义按答案字数匹配（不再要求模型计算空格数；内容型无填空规则）', () => {
    for (const g of ALL_TYPES) {
      const t = getPromptTemplate({ genType: g });
      if (CONTENT_TYPES.includes(g)) {
        expect(t.template, `类型 ${g}`).not.toContain('填空空位宽度');
      } else {
        expect(t.template, `类型 ${g}`).toContain('宽度与答案字数匹配');
      }
      expect(t.template, `类型 ${g} 残留微观格式`).not.toContain('空格数=答案字数');
      expect(t.template, `类型 ${g} 残留诱导词`).not.toContain('括号与横线二选一');
    }
  });

  it('非 exam 输出格式含作答区留白（无具体行数）与田字格/四线三格标记', () => {
    const t = getPromptTemplate({ genType: 'practice' });
    expect(t.template).toContain('留足作答区');
    expect(t.template).not.toContain('不少于3行');
    expect(t.template).toContain('tian-zi-ge');
    expect(t.template).toContain('four-line-three');
  });

  it('学段特点无旧措辞 [配图说明]，统一为 [IMAGE] 标记；时长不写入学段特点（归蓝图）', () => {
    const t = getPromptTemplate({ grade: 'primary_low', genType: 'exam' });
    expect(t.template).not.toContain('[配图说明]');
    expect(t.template).toContain('[IMAGE] 标记');
    expect(t.template).toContain('认知底线');
    expect(t.template).not.toContain('40分钟'); // 时长由蓝图 duration 唯一源，学段特点不含分钟
  });
});

describe('质量底线三维度注入（类型/学科/学段各司其职，非一刀切）', () => {
  it('类型维度：各类型【要求】带专属底线（无诱导措辞）', () => {
    const practice = getPromptTemplate({ genType: 'practice' });
    expect(practice.template).toContain('任务之间不重复不雷同'); // practice 防重复（正面表述）
    const special = getPromptTemplate({ genType: 'special' });
    expect(special.template).toContain('按考点或能力点分类组织');
    expect(special.template).toContain('同板块内题目不雷同');
    const reading = getPromptTemplate({ genType: 'reading' });
    expect(reading.template).toContain('短文完整呈现（不截断）');
    const dictation = getPromptTemplate({ genType: 'dictation' });
    expect(dictation.template).toContain('严格对应教材要求');
    const review = getPromptTemplate({ genType: 'review' });
    expect(review.template).toContain('按考点分布');
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
