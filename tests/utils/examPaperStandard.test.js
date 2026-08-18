// 真题卷根治方案回归测试：蓝本库完整性 + 覆盖矩阵 + 卷面标准质检（含合格卷零误报）
import { describe, it, expect } from 'vitest';
import {
  EXAM_BLUEPRINTS,
  EXAM_PAPER_LAYOUT,
  EXAM_NEW_STANDARD,
  getExamBlueprint,
  buildExamBlueprintText,
} from '../../src/config/examPaperBlueprints.js';
import { HardRuleChecker, AISemanticReviewer } from '../../src/utils/qualityChecker.ts';

// ========== A 组：蓝本库完整性 ==========
describe('A. 蓝本库结构完整性', () => {
  const entries = Object.entries(EXAM_BLUEPRINTS);
  const ALL_STAGES = ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'];

  it('蓝本条目数 ≥ 20（全学段全学科覆盖）', () => {
    expect(entries.length).toBeGreaterThanOrEqual(20);
  });

  it('每条蓝本：sections 分值之和 === fullScore', () => {
    for (const [key, bp] of entries) {
      const sum = bp.sections.reduce((s, sec) => s + (sec.score || 0), 0);
      expect(Math.abs(sum - bp.fullScore), `蓝本 ${key} 分值不闭合: ${sum} != ${bp.fullScore}`).toBeLessThan(0.01);
    }
  });

  it('每条蓝本：结构字段完整（label/fullScore/duration/sections 非空）', () => {
    for (const [key, bp] of entries) {
      expect(bp.label, `${key} 缺 label`).toBeTruthy();
      expect(bp.fullScore, `${key} 缺 fullScore`).toBeGreaterThan(0);
      expect(bp.duration, `${key} 缺 duration`).toBeTruthy();
      expect(bp.sections.length, `${key} sections 为空`).toBeGreaterThanOrEqual(2);
      for (const sec of bp.sections) {
        expect(sec.name).toBeTruthy();
        expect(sec.score).toBeGreaterThan(0);
        expect(sec.note).toBeTruthy();
      }
    }
  });

  it('覆盖矩阵：每条蓝本均可被 getExamBlueprint 命中（含降级链与 all 通配）', () => {
    const missed = [];
    for (const [key] of entries) {
      const [s, st] = key.split('|');
      if (st === 'all') continue; // all 通配条目单独验证
      if (!getExamBlueprint(s, st)) missed.push(key);
    }
    expect(missed, `蓝本不可达: ${missed.join(', ')}`).toEqual([]);
    // 主干学科 × 全部5学段必须精确命中（不允许降级）
    for (const s of ['语文', '数学', '英语']) {
      for (const st of ALL_STAGES) {
        const bp = getExamBlueprint(s, st);
        expect(bp, `${s}|${st} 未命中`).not.toBeNull();
        expect(bp.key, `${s}|${st} 未精确命中`).toBe(`${s}|${st}`);
      }
    }
  });

  it('all 通配蓝本：信息科技任意学段均命中同一条蓝本', () => {
    for (const st of ALL_STAGES) {
      const bp = getExamBlueprint('信息科技', st);
      expect(bp, `信息科技|${st} 未命中`).not.toBeNull();
      expect(bp.key).toBe('信息科技|all');
    }
  });

  it('道德与法治小学三段全部直接命中（不降级到初中）', () => {
    for (const st of ['primary_low', 'primary_mid', 'primary_high']) {
      const bp = getExamBlueprint('道德与法治', st);
      expect(bp, `道德与法治|${st} 未命中`).not.toBeNull();
      expect(bp.key).toBe(`道德与法治|${st}`);
    }
  });

  it('合理缺失与联合别名兑底：高中无科学课→null；小学误标思想政治→兑底到道法蓝本', () => {
    expect(getExamBlueprint('科学', 'high')).toBeNull();
    const zwPrimary = getExamBlueprint('思想政治', 'primary_low');
    expect(zwPrimary).not.toBeNull();
    expect(zwPrimary.key).toBe('道德与法治|primary_low');
  });

  it('别名规范化：政治/道法→道德与法治，信息技术→信息科技', () => {
    expect(getExamBlueprint('政治', 'middle')?.subject).toBe('道德与法治');
    expect(getExamBlueprint('道法', 'middle')?.subject).toBe('道德与法治');
    expect(getExamBlueprint('思想品德', 'middle')?.subject).toBe('道德与法治');
    expect(getExamBlueprint('信息技术', 'primary_mid')?.subject).toBe('信息科技');
    expect(getExamBlueprint('科学（小学）', 'primary_low')?.subject).toBe('科学');
  });

  it('降级链与联合别名：道法高中→思想政治蓝本，信息科技→all 通配', () => {
    // 高中段道德与法治 → 联合别名转到思想政治蓝本（不得降级到初中道法蓝本）
    const djHigh = getExamBlueprint('道德与法治', 'high');
    expect(djHigh).not.toBeNull();
    expect(djHigh.key).toBe('思想政治|high');
    // 高中"政治"（教材库别名）→ 道德与法治 → 联合别名 → 思想政治|high
    expect(getExamBlueprint('政治', 'high').key).toBe('思想政治|high');
    // 信息科技任何学段均通过 all 通配命中
    const bp = getExamBlueprint('信息科技', 'high');
    expect(bp).not.toBeNull();
    expect(bp.key).toBe('信息科技|all');
  });

  it('buildExamBlueprintText：输出含四大章节且无残留占位符', () => {
    for (const [key, bpRaw] of entries) {
      const bp = { ...bpRaw, key, subject: key.split('|')[0] };
      const text = buildExamBlueprintText(bp);
      expect(text).toContain('真题卷结构蓝本');
      expect(text).toContain('卷面规范');
      expect(text).toContain('题型骨架');
      expect(text).toContain('新课标命题要求');
      expect(text).toContain('灵活性边界');
      expect(text).not.toMatch(/\{duration\}|\{fullScore\}/);
      expect(text).toContain(String(bp.fullScore));
      // 蓝本第一条大题名称必须出现在注入文本中
      expect(text).toContain(bp.sections[0].name);
    }
  });

  it('EXAM_PAPER_LAYOUT / EXAM_NEW_STANDARD 内容非空', () => {
    expect(EXAM_PAPER_LAYOUT.length).toBeGreaterThan(200);
    expect(EXAM_NEW_STANDARD.length).toBeGreaterThan(200);
  });

  it('学科命题条款全覆盖：每个蓝本学科的注入文本含对应学科条款', () => {
    const subjectMarks = {
      '语文': '习作支架', '数学': '说理设问', '英语': '语篇意识',
      '物理': '实验探究', '化学': '真实情境', '生物': '图表信息',
      '道德与法治': '情境辨析', '思想政治': '材料分析', '历史': '史料实证',
      '地理': '区域认知', '科学': '观察探究', '信息科技': '数字化情境',
      '音乐': '听辨意识', '美术': '视觉素养', '体育': '健康第一',
    };
    for (const [key, bpRaw] of entries) {
      const subject = key.split('|')[0];
      const bp = { ...bpRaw, key, subject };
      const text = buildExamBlueprintText(bp);
      // 通用条款必须注入
      expect(text).toContain('禁止照搬原题');
      expect(text).toContain('价值观引导');
      // 学科条款必须注入（每个蓝本学科都应有对应分组）
      const mark = subjectMarks[subject];
      expect(mark, `学科 ${subject} 缺少学科命题条款分组`).toBeTruthy();
      expect(text, `${key} 缺少学科条款 ${mark}`).toContain(mark);
      expect(text).toContain(`▌${subject}命题要求`);
    }
  });

  it('学段命题条款分层：小学/初中/高中注入对应学段要求（含考试对标）', () => {
    const stageExpects = {
      'primary_low': ['▌小学命题要求', '情境化适龄'],
      'primary_mid': ['▌小学命题要求', '基础为主'],
      'primary_high': ['▌小学命题要求', '小升初衔接'],
      'middle': ['▌初中（对标中考）命题要求', '对标中考结构', '区分度设计'],
      'high': ['▌高中（对标新高考）命题要求', '对标新高考结构', '无情境不成题'],
    };
    for (const [key, bpRaw] of entries) {
      const [subject, st] = key.split('|');
      const expects = stageExpects[st];
      if (!expects) continue; // 'all' 通配蓝本走 fallback，单独验证
      const bp = { ...bpRaw, key, subject };
      const text = buildExamBlueprintText(bp);
      for (const mark of expects) {
        expect(text, `${key} 缺少学段条款 ${mark}`).toContain(mark);
      }
    }
    // all 通配蓝本：无学段信息时 fallback 到初中条款
    const itBp = { ...EXAM_BLUEPRINTS['信息科技|all'], key: '信息科技|all', subject: '信息科技' };
    const itText = buildExamBlueprintText(itBp);
    expect(itText).toContain('▌初中（对标中考）命题要求');
  });
});

// ========== B 组：checkExamPaperStandard 检测能力 ==========
describe('B. 卷面标准校验（checkExamPaperStandard）', () => {
  const bp = getExamBlueprint('语文', 'primary_low');
  const detailTypes = (issues) => issues.map((i) => i.type);

  it('检出创意题型名（小达人/闯关等花哨命名）', () => {
    const content = '三、量词小达人（8分）\n满分100分 考试时间60分钟\n学校＿＿＿ 班级＿＿＿ 姓名＿＿＿';
    const issues = HardRuleChecker.checkExamPaperStandard(content, bp);
    expect(detailTypes(issues)).toContain('题型命名不规范');
  });

  it('检出质检报告泄漏（知识点准确性+课标对齐）', () => {
    const content = '满分100分 考试时间60分钟 姓名：＿ 班级：＿\n一、看拼音，写词语。（16分）\n\n【质检报告】\n1. 知识点准确性：覆盖本单元生字\n2. 课标对齐：符合学段要求';
    const issues = HardRuleChecker.checkExamPaperStandard(content, bp);
    expect(detailTypes(issues)).toContain('质检报告泄漏');
  });

  it('检出分值体系异常（大题分值之和 ≠ 蓝本满分）', () => {
    const content = '满分100分 考试时间60分钟 姓名：＿ 班级：＿\n一、看拼音，写词语。（16分）\n二、组词。（8分）\n三、填空。（10分）';
    const issues = HardRuleChecker.checkExamPaperStandard(content, bp);
    expect(detailTypes(issues)).toContain('分值体系异常');
  });

  it('检出卷面缺漏（缺密封线信息栏/缺卷首信息）', () => {
    const content = '一、看拼音，写词语。（16分）';
    const issues = HardRuleChecker.checkExamPaperStandard(content, bp);
    const types = detailTypes(issues);
    expect(types).toContain('卷面缺漏');
    expect(types).toContain('分值体系异常');
  });

  it('blueprint 为 null 时安全返回空数组', () => {
    const issues = HardRuleChecker.checkExamPaperStandard('任意内容', null);
    expect(issues).toEqual([]);
  });

  it('检出大题骨架不符（删题/改名但分值仍闭合）', () => {
    const content = '满分100分 考试时间60分钟 姓名：＿ 班级：＿\n一、基础练习。（8分）\n二、综合运用。（92分）';
    const issues = HardRuleChecker.checkExamPaperStandard(content, bp);
    expect(detailTypes(issues)).toContain('大题骨架不符');
  });

  it('检出满分数值与蓝本不一致', () => {
    const content = '满分120分 考试时间60分钟 姓名：＿ 班级：＿\n一、看拼音，写词语。（16分）';
    const issues = HardRuleChecker.checkExamPaperStandard(content, bp);
    expect(detailTypes(issues)).toContain('分值体系异常');
  });
});

// ========== C 组：合格真题卷零误报 ==========
describe('C. 合格真题卷样本：0 error', () => {
  // 用蓝本动态构造一份"合格真题卷"：分值闭合、卷首齐全、密封线齐全、无花哨命名、无质检文字
  const key = '语文|primary_low';
  const bpRaw = EXAM_BLUEPRINTS[key];
  const CN = '一二三四五六七八九十';
  const sectionsText = bpRaw.sections
    .map((s, i) => `${CN[i]}、${s.name}。（${s.score}分）`)
    .join('\n');
  const goodContent = [
    `第1页　共2页`,
    `学校：＿＿＿＿　班级：＿＿＿＿　姓名：＿＿＿＿　学号：＿＿＿＿`,
    `密封线内不要答题`,
    `《第二单元 · 学业测评》`,
    `（满分${bpRaw.fullScore}分　考试时间${bpRaw.duration}）`,
    sectionsText,
    `九、看图写话补充题。`,
    `[IMAGE] 黑白线稿简笔画：春天公园里，两个小朋友在放风筝，远处有树木和亭子 [/IMAGE]`,
    `（参考答案及评分标准略）`,
  ].join('\n');

  it('合格真题卷 → checkExamPaperStandard 返回 0 个 error', () => {
    const bp = getExamBlueprint('语文', 'primary_low');
    const issues = HardRuleChecker.checkExamPaperStandard(goodContent, bp);
    const errors = issues.filter((i) => i.severity === 'error');
    if (errors.length > 0) {
      // eslint-disable-next-line no-console
      console.log('误报明细:', JSON.stringify(errors, null, 2));
    }
    expect(errors).toEqual([]);
  });

  const EXAM_TYPES = ['题型命名不规范', '卷面缺漏', '分值体系异常', '分值标注不规范', '质检报告泄漏'];
  it('check() 全链路：genType=exam + stage=小学 + grade=二年级 → 命中 primary_low 蓝本并触发卷面校验', () => {
    // 合格内容 → 不产生 exam 卷面类 error（其他检查器的干扰不在此断言范围）
    const okIssues = HardRuleChecker.check(goodContent, [], '语文', '小学', '二年级', 'exam');
    const okExamErrors = okIssues.filter((i) => EXAM_TYPES.includes(i.type));
    if (okExamErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.log('全链路合格样本卷面误报:', JSON.stringify(okExamErrors, null, 2));
    }
    expect(okExamErrors).toEqual([]);

    // 不合格内容（缺密封线 + 花哨命名）→ 必须产生卷面 error
    const badContent = '三、量词小达人（8分）';
    const badIssues = HardRuleChecker.check(badContent, [], '语文', '小学', '二年级', 'exam');
    const badTypes = badIssues.map((i) => i.type);
    expect(badTypes).toContain('题型命名不规范');
    expect(badTypes).toContain('卷面缺漏');
  });

  it('check() 全链路：非 exam 类型不受卷面校验影响', () => {
    const issues = HardRuleChecker.check('三、量词小达人（8分）', [], '语文', '小学', '二年级', 'practice');
    const examIssues = issues.filter((i) => i.type === '题型命名不规范' || i.type === '卷面缺漏' || i.type === '分值体系异常');
    expect(examIssues).toEqual([]);
  });
});

// ========== D 组：答案泄露检测（组词题/看拼音写词语） ==========
describe('D. 答案泄露检测', () => {
  it('检出组词题题干出现答案组词', () => {
    const content = [
      '<h2>一、比一比，再组词。（8分）</h2>',
      '<p class="question">园（公园）　圆（圆桌）</p>',
      '<div class="answer-section"><h3>一、比一比，再组词</h3>园（公园）　圆（圆桌）</div>',
    ].join('\n');
    const issues = HardRuleChecker.check(content, [], '语文', '小学', '二年级', 'exam');
    expect(issues.map((i) => i.type)).toContain('答案泄露');
  });

  it('检出看拼音写词语题干直接写出目标词', () => {
    const content = [
      '<h2>一、看拼音，写词语。（16分）</h2>',
      '<p class="question">春天来了，桃花开了。</p>',
      '<div class="answer-section"><h3>一、看拼音，写词语</h3>1. 春天　2. 桃花</div>',
    ].join('\n');
    const issues = HardRuleChecker.check(content, [], '语文', '小学', '二年级', 'exam');
    expect(issues.map((i) => i.type)).toContain('答案泄露');
  });

  it('正常挖空试卷不误报', () => {
    const content = [
      '<h2>一、比一比，再组词。（8分）</h2>',
      '<p class="question">园　　圆</p>',
      '<h2>二、看拼音，写词语。（16分）</h2>',
      '<p class="question">chūn tiān（＿＿）来了，táo huā（＿＿）开了。</p>',
      '<div class="answer-section"><h3>一、比一比，再组词</h3>园（公园）　圆（圆桌）</div><div><h3>二、看拼音，写词语</h3>1. 春天　2. 桃花</div>',
    ].join('\n');
    const issues = HardRuleChecker.check(content, [], '语文', '小学', '二年级', 'exam');
    expect(issues.map((i) => i.type)).not.toContain('答案泄露');
  });
});

// ========== E 组：测量科学检测（答案分布/绝对化选项） ==========
describe('E. 测量科学检测', () => {
  const makeExam = (ansList) => {
    const ansHtml = ansList.map((a, i) => `${i + 1}. ${a}`).join('\n');
    return [
      '<h2>一、选择题。（30分）</h2>',
      '<p class="question">1. 题目……（选项）</p>'.repeat(ansList.length),
      `<div class="answer-section">${ansHtml}</div>`,
    ].join('\n');
  };

  it('检出某选项从未出现', () => {
    const ans = ['A', 'B', 'C', 'A', 'B', 'C', 'A', 'B', 'C', 'A'];
    const issues = HardRuleChecker.check(makeExam(ans), [], '数学', '初中', '七年级', 'exam');
    expect(issues.map((i) => i.type)).toContain('答案分布异常');
  });

  it('检出连续相同答案超过3个', () => {
    const ans = ['A', 'A', 'A', 'A', 'B', 'C', 'D', 'A', 'B', 'C'];
    const issues = HardRuleChecker.check(makeExam(ans), [], '数学', '初中', '七年级', 'exam');
    expect(issues.map((i) => i.type)).toContain('答案分布异常');
  });

  it('检出绝对化选项滥用', () => {
    const content = [
      '<h2>一、选择题。（30分）</h2>',
      '<p>1. A.xx B.xx C.以上都对 D.以上都不对</p>',
      '<p>2. A.xx B.xx C.以上都对 D.xx</p>',
      '<div class="answer-section">1. C 2. C</div>',
    ].join('\n');
    const issues = HardRuleChecker.check(content, [], '数学', '初中', '七年级', 'exam');
    expect(issues.map((i) => i.type)).toContain('绝对化选项滥用');
  });

  it('均匀分布不误报', () => {
    const ans = ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A', 'B'];
    const issues = HardRuleChecker.check(makeExam(ans), [], '数学', '初中', '七年级', 'exam');
    expect(issues.map((i) => i.type)).not.toContain('答案分布异常');
  });
});

// ========== F 组：三重硬核扫描（查重/查错/查规范） ==========
describe('F. 三重硬核扫描', () => {
  it('查错·检出未闭合标点', () => {
    const content = '<p>《只有一个地球（节选）</p><div class="answer-section">1. A</div>';
    const issues = HardRuleChecker.check(content, [], '语文', '小学', '五年级', 'exam');
    expect(issues.map((i) => i.type)).toContain('标点配对异常');
  });

  it('查重·检出题干高度相似的题目', () => {
    const content = [
      '<p class="question">小明有5个苹果，吃掉2个，还剩几个？</p>',
      '<p class="question">小明有5个苹果，吃掉2个，又买了3个，还剩几个？</p>',
      '<div class="answer-section">1. 3个 2. 6个</div>',
    ].join('\n');
    const issues = HardRuleChecker.check(content, [], '数学', '小学', '一年级', 'exam');
    expect(issues.map((i) => i.type)).toContain('疑似相似题');
  });

  it('查错·检出读音题拼音未标调', () => {
    const content = [
      '<h2>一、给加点字选择正确的读音。（8分）</h2>',
      '<p>1. 知了（zhi liao）　2. 操场（cao chang）</p>',
      '<div class="answer-section">1. zhī 2. cāo</div>',
    ].join('\n');
    const issues = HardRuleChecker.check(content, [], '语文', '小学', '二年级', 'exam');
    expect(issues.map((i) => i.type)).toContain('拼音未标调');
  });

  it('tripleScan 将结果按查重/查错/查规范三维归类', () => {
    const content = [
      '<p class="question">小明有5个苹果，吃掉2个，还剩几个？</p>',
      '<p class="question">小明有5个苹果，吃掉2个，还剩几个？</p>',
      '<p>《只有一个地球（节选）</p>',
      '<div class="answer-section">1. 3个 2. 3个</div>',
    ].join('\n');
    const result = HardRuleChecker.tripleScan(content, [], '语文', '小学', '五年级', 'exam');
    // 查重：完全相同题（存在重复题目）+ 前20字相同（疑似相似题）
    expect(result.duplication.map((i) => i.type)).toContain('存在重复题目');
    expect(result.duplication.map((i) => i.type)).toContain('疑似相似题');
    // 查错：未闭合标点
    expect(result.error.map((i) => i.type)).toContain('标点配对异常');
    // 查规范：缺卷首/页码/得分栏等（至少含卷面类）
    expect(result.standard.map((i) => i.type)).toContain('卷面缺漏');
    expect(result.standard.map((i) => i.type)).toContain('缺少页码');
  });

  it('全类型适用·课时练组词题答案泄露同样检出', () => {
    const content = [
      '<h3>一、比一比，再组词。</h3>',
      '<p>1. 园（公园）　圆（　　）</p>',
      '<div class="answer-section">1. 园（公园）　圆（圆桌）</div>',
    ].join('\n');
    const issues = HardRuleChecker.check(content, [], '语文', '小学', '二年级', 'practice');
    expect(issues.map((i) => i.type)).toContain('答案泄露');
  });

  it('全类型适用·阅读资料重复题同样检出', () => {
    const content = [
      '<p class="question">读了短文，你有什么感想？请写下来。</p>',
      '<p class="question">读了短文，你有什么感想？请写下来。</p>',
    ].join('\n');
    const issues = HardRuleChecker.check(content, [], '语文', '小学', '三年级', 'reading');
    expect(issues.map((i) => i.type)).toContain('存在重复题目');
    expect(issues.map((i) => i.type)).toContain('疑似相似题');
  });

  it('全类型适用·试卷专属检测不误报非试卷类型', () => {
    const content = '<h3>一、基础巩固</h3><p class="question">1. 35×7＝</p><div class="answer-section">1. 245</div>';
    const issues = HardRuleChecker.check(content, [], '数学', '小学', '三年级', 'practice');
    const types = issues.map((i) => i.type);
    // 试卷专属项不应出现在课时练中
    expect(types).not.toContain('缺少页码');
    expect(types).not.toContain('缺少得分栏');
    expect(types).not.toContain('卷面缺漏');
  });

  it('语义审查·题目质量专项覆盖所有含题目类型，试卷专项仅 exam', () => {
    const practicePrompt = AISemanticReviewer.buildReviewPrompt('<p>题目</p>', { genType: 'practice', genTypeLabel: '课时练' });
    // 课时练：含题目质量专项，不含试卷专属项
    expect(practicePrompt).toContain('题目质量专项');
    expect(practicePrompt).toContain('干扰项科学性');
    expect(practicePrompt).not.toContain('真题卷结构蓝本');

    const examPrompt = AISemanticReviewer.buildReviewPrompt('<p>题目</p>', { genType: 'exam', genTypeLabel: '试卷' });
    // 试卷：两组专项都有
    expect(examPrompt).toContain('正式考试专项');
    expect(examPrompt).toContain('题目质量专项');

    const summaryPrompt = AISemanticReviewer.buildReviewPrompt('<p>总结</p>', { genType: 'summary', genTypeLabel: '知识点总结' });
    // 纯知识类：两组专项都不含
    expect(summaryPrompt).not.toContain('正式考试专项');
    expect(summaryPrompt).not.toContain('题目质量专项');
  });
});
