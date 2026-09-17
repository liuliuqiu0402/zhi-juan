import { describe, it, expect } from 'vitest';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';
import { buildMaterialUsageBlock } from '../../src/utils/injectionManifest.js';

/**
 * 教材口径（2026-09-13 定版·双向开放；2026-09-14 二次修订）：
 *  - 教材与课外**等权**：来源不作指定——**不写正向钉死**（"须出自原文/须以原文表述"），
 *    **也不写反向钉死**（"一律自拟/禁止沿用原文连续字面"）；
 *  - 🔴 2026-09-14（用户裁定）：模板侧原"凡引用教材内容须与原文一致、不错引、不改写原意"**整条删除**——
 *    措辞会诱导"复述教材"（实测产物：整句照录教材语篇，照搬守门命中 10 词连续重合）；
 *    其准确性诉求由【质量底线】"教材版本口径"句单源承载（涉本套教材的说法须与实际一致、不凭记忆断言）；
 *  - 生成端侧（【素材使用约定】单源）：开放口径（来源不限、不作指定）+ **禁照搬（通道无关）**。
 */
// 钉死措辞（正反两向）——任何题类模板都不应再出现
const BIND_KEYS = ['须出自原文', '须以原文表述', '一律自拟，禁止沿用原文连续字面'];
// 准确性单源（质量底线·教材版本口径）与开放口径单源（素材使用约定）
const ACCURACY_KEY = '须与所选教材实际一致';
const REMOVED_KEY = '引用教材内容须与原文一致';
// 🔒 2026-09-15 去诱导：原 OPEN_KEYS 含"不是素材来源限制"——那是否定定义（"X 不是 Y"要读懂
//    必须先建立 X↔Y 的映射），已撤除；来源开放的功能由正向句承载（下方 OPEN_KEYS 单源）。
const OPEN_KEYS = ['来源不限、不作指定', '可取自教材，也可取自课外真实生活'];
const COPY_BAN = '不得照搬教材原题';

const tpl = (subject, stage, genType) => getPromptTemplate({ grade: stage, subject, genType })?.template || '';

describe('教材口径·双向开放（不钉死来源）', () => {
  it('语言学科（语文/英语）课时练/专项/试卷：无钉死来源措辞，准确性由质量底线单源承载', () => {
    const cases = [
      ['语文', 'primary_high', 'practice'],
      ['英语', 'middle', 'practice'],
      ['英语', 'middle', 'special'],
      ['英语', 'primary_high', 'exam'],
    ];
    for (const [s, st, t] of cases) {
      const text = tpl(s, st, t);
      for (const k of BIND_KEYS) {
        expect(text, `${s}/${t} 不应出现钉死措辞：${k}`).not.toContain(k);
      }
      expect(text, `${s}/${t} 的"引用教材内容须与原文一致"应已整条删除`).not.toContain(REMOVED_KEY);
      expect(text, `${s}/${t} 准确性应由质量底线单源承载`).toContain(ACCURACY_KEY);
    }
  });

  it('非语言学科（数学/物理）课时练与试卷：同样无钉死、准确性单源承载', () => {
    for (const [s, st] of [['数学', 'primary_high'], ['物理', 'middle']]) {
      const text = tpl(s, st, 'practice');
      for (const k of BIND_KEYS) {
        expect(text, `${s} 不应出现钉死措辞：${k}`).not.toContain(k);
      }
      expect(text, `${s} 不应再出现已删除的引用句`).not.toContain(REMOVED_KEY);
      expect(text, `${s} 应含准确性单源`).toContain(ACCURACY_KEY);
    }
    const ex = tpl('数学', 'middle', 'exam');
    expect(ex, '数学/exam 应含准确性单源').toContain(ACCURACY_KEY);
    for (const k of BIND_KEYS) {
      expect(ex, `数学/exam 不应出现钉死措辞：${k}`).not.toContain(k);
    }
  });

  it('全库不再出现正/反钉死（含阅读训练/错题本/知识型等其余题类）', () => {
    const cases = [
      ['语文', 'primary_high', 'reading'],
      ['英语', 'middle', 'reading'],
      ['语文', 'primary_high', 'errorbook'],
      ['数学', 'primary_high', 'summary'],
      ['英语', 'middle', 'review'],
      ['语文', 'primary_high', 'preview'],
      ['英语', 'middle', 'dictation'],
      ['数学', 'middle', 'exam'],
    ];
    for (const [s, st, t] of cases) {
      const text = tpl(s, st, t);
      // 🔴 2026-09-14（用户定版）：错题本原写"错题题干/变式的数据、情境、句式**一律自拟**，
      //    禁止沿用原文连续字面"——属反向钉死（与"双向开放"自相矛盾），已改为指向【素材使用约定】；
      //    本用例把正/反两类钉死一起锁死（此前只锁正向，"一律自拟"漏网）。
      for (const k of BIND_KEYS) {
        expect(text, `${s}/${t} 不应出现钉死措辞：${k}`).not.toContain(k);
      }
      expect(text, `${s}/${t} 不得再出现"须出自原文"`).not.toContain('须出自原文');
    }
  });

  it('图依赖题：注入"必须输出 [IMAGE] 块、不得用文字描述替代"的硬要求', () => {
    const t = tpl('英语', 'primary_high', 'practice');
    expect(t).toContain('必须在题干后按注入的【渲染指令】紧跟输出');
    expect(t).toContain('严禁');
    expect(t).toContain('文字描述替代图块');
  });

  it('阅读训练：阅读材料须为课外材料、不得沿用教材原文（课标课外阅读量刚需，非"限死来源"）', () => {
    for (const [s, st] of [['语文', 'primary_high'], ['英语', 'middle']]) {
      const t = tpl(s, st, 'reading');
      expect(t, `${s}/reading 应要求课外材料`).toContain('课外材料');
      expect(t, `${s}/reading 不得沿用教材原文`).toContain('不得沿用教材原文');
      // 课标刚需：允许"选编/改编自课外读物"这条路（不把 AI 原创当唯一路径）
      expect(t, `${s}/reading 应允许改编课外读物`).toContain('选编/改编自课外读物');
    }
  });
});

describe('素材使用约定（生成端单源）：来源开放 + 禁照搬（通道无关）', () => {
  it('两通道都给出"来源不限、不作指定"（双向开放，不钉死来源）', () => {
    for (const ch of ['full', 'anchor']) {
      const t = buildMaterialUsageBlock({ genType: 'practice', materialChannel: ch });
      for (const k of OPEN_KEYS) expect(t, `${ch} 缺开放口径：${k}`).toContain(k);
    }
  });

  // 🔴 2026-09-14（用户裁定·实测产物）：禁照搬原句挂在【压缩原文】上 → 锚清单通道整句被跳过 →
  //    该通道下没有任何禁止照搬的约束，模型整段沿用教材语篇（照搬守门命中 10 词连续重合）。
  //    现锁死：命题型禁照搬**通道无关**；且明确清单里的语篇类条目不作题目载体。
  it('命题型禁照搬通道无关（两通道都在），并声明材料类条目的作用边界', () => {
    for (const ch of ['full', 'anchor']) {
      const t = buildMaterialUsageBlock({ genType: 'practice', materialChannel: ch });
      expect(t, `${ch} 命题型应含禁照搬`).toContain(COPY_BAN);
      expect(t, `${ch} 应界定材料类条目的作用`).toContain('标◇的材料用于把握难度与理解语境，不必为其单独设题');
      expect(t, `${ch} 应含"题目内容自行组织"的原创性要求`).toContain('不得直接复用所选教材原有语篇的情节、篇目结构与人物设定');
      expect(t, `${ch} 应给出可判定的照搬判据`).toContain('连续重合即属照搬');
      // 🔴 用词红线："载体"在本项目专指作答载体/书写载体，不得用来表示题目素材（防模型混用）
      expect(t, `${ch} 不得用"载体"表示题目素材`).not.toContain('题目载体');
      expect(t, `${ch} 不得用"载体"表示题目素材`).not.toContain('命题载体');
    }
    // 归纳型：不复述"不得照搬原题"（其"不得整段照录"另给，单一事实源）
    const sum = buildMaterialUsageBlock({ genType: 'summary', materialChannel: 'full' });
    expect(sum).not.toContain(COPY_BAN);
    expect(sum).toContain('不得整段照录');
  });
});

describe('质量底线不再贬抑基础题型 + 课时练任务化非唯一', () => {
  it('质量底线：无"避免死记硬背、机械刷题式作答"，改为正向"不重复堆砌"', () => {
    const t = tpl('数学', 'primary_high', 'practice');
    expect(t).not.toContain('机械刷题式作答');
    expect(t).not.toContain('避免死记硬背');
    expect(t).toContain('不重复堆砌');
  });

  it('同步练习：组织方式口径归课标（任务式仍非唯一形态）', () => {
    const t = tpl('英语', 'middle', 'practice');
    // 🔒 2026-09-15 用户裁定·组织口径归课标：原"优先以学习任务组织（含真实情境+活动+成果）"
    //    属产品自造表述，改为课标口径——依据 2022义教课程方案「素养导向、联系学生经验与生活」+
    //    学科实践/学习活动观（课标原文为"倡导"性质，不夸大为"要求"）。
    expect(t).toContain('按课标倡导的学习方式组织');
    expect(t).toContain('在真实情境中开展学习活动、形成可见成果');
    expect(t).not.toContain('1. 以学习任务组织，任务含真实情境+活动+成果');
    expect(t, '产品自造表述不得回潮').not.toContain('优先以学习任务组织');
    // 🔒 2026-09-16 用户裁定（少约束）：自造形式词不得回潮。
    //    判据=是否课标原词：课标口径是"学习任务群（语文）/主题活动·项目学习（数学）/学科实践（课程方案）"；
    //    "知识板块 / 技能环节 / 题组"是产品自造，且会把内容颗粒读成题组骨架。
    for (const w of ['知识板块', '技能环节', '题组']) {
      expect(t, `产品自造形式词「${w}」不得回潮`).not.toContain(w);
    }
  });
});
