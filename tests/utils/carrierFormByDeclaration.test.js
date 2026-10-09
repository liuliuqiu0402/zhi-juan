// G1 载体形态「按题面声明收口」已按属主裁定改**乙案**（2026-10-09）：**程序不再改形态**，改为**只报不改**检出
// ============================================================
// 沿革：2026-09-30（G1）原为**改写**——题面声明符号作答（选择/判断/填序号…）而卷面空位是横线型时，把该处
//   横线**收成括号型**；2026-10-06（A3）把粒度从"h2 题块"收到"小题段"，**但仍保留"段内无声明时用 h2 大题
//   标题当大题级声明"** ⇒ 与 cell 判据"同一题内各空按各自实际所填**分别定形、可并存**"**相抵**：一个大题
//   标题含"选择/括号"就把该大题所有横线翻成括号（真机实测：**该横线的空位也变括号**）。
//   ⇒ 属主裁定**乙案**：**程序不改形态**（形态由模型按所填内容定），只**检出**"声明与实际不符"交人工核对
//     （纪律同〔285〕：有歧义的形态判据→只报不改）；**并去掉"h2 大题标题兜底"**（那正是相抵源）。
// G2 声明↔实给判据单源（不变）。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { detectCarrierFormMismatch, normalizeBodyHtml } from '../../src/utils/contentCleaner.js';
import { SYMBOL_ANSWER_DECL, inferCarriers, CARRIERS } from '../../src/config/blueprintSchema.js';
import { getPromptTemplate, DECLARATION_TRUTH_CLAUSE } from '../../src/config/promptLibrary.js';

const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** 真实源码片段（用户 2026-09-30 提供的那份"源码"里的第一题／第四题） */
const SRC_Q1 = [
  '<h2>一、读句子，给加点的字选择正确的读音，把序号填在括号里。（每题2分，共8分）</h2>',
  '<p class="question">1. 老师在教<span class="emphasis-dot">教</span>室里<u class="blank-1"> </u>书，同学们听得很认真。　　①jiāo　②jiào　</p>',
  '<p class="question">2. 小蝌蚪的尾<span class="emphasis-dot">长</span>得<u class="blank-2"> </u>了，就快变成青蛙了。　　①cháng　②zhǎng　</p>',
  '<p class="question">3. 苍耳妈妈给孩子穿上带刺的铠甲，孩子们就能去田野、山洼<span class="emphasis-dot">落</span>户安家<u class="blank-3"> </u>。　　①luò　②là　</p>',
  '<p class="question">4. 植物妈妈的办法真多，我们得<span class="emphasis-dot">得</span>仔细观<u class="blank-4"> </u>察才能发现。　　①de　②dé　③děi　</p>',
].join('\n');
const SRC_Q4 = [
  '<h2>四、选字填空，把正确的字写在横线上。（每空2分，共12分）</h2>',
  '<p class="question">15. 小蝌蚪甩着长长的尾巴，在池塘里快活地游来游去。它看见鲤鱼妈妈在教小鲤鱼捕食，就<u class="blank-2"> </u>上去问：“鲤鱼阿姨，我们的妈妈在哪里？”</p>',
  '<p class="question">16. 鲤鱼妈妈说：“你们的妈妈四条腿，<u class="blank-2"> </u>嘴巴。你们到那边去找吧！”</p>',
].join('\n');

describe('G1 载体形态：程序不再改形态（乙案），只报不改', () => {
  it('🔴 题面声明"把序号填在括号里"+该段为横线型 → 形态**不被改写** ＋ 检出命中', () => {
    const out = normalizeBodyHtml(SRC_Q1);
    expect(out, '乙案：横线型形态不得被程序改写').toMatch(/<u\b[^>]*\bblank-1\b/i);
    expect(out, '也不得被翻成括号型（span.blank-N）').not.toMatch(/<span\b[^>]*class="[^"]*blank-\d/i);
    expect(detectCarrierFormMismatch(SRC_Q1).length, '声明与实际不符须检出').toBeGreaterThan(0);
  });

  it('段内显式"横线"声明 → 否决（不检出）', () => {
    expect(detectCarrierFormMismatch(SRC_Q4)).toEqual([]);
  });

  it('段内无声明 → 不检出、形态不改写', () => {
    const s = '<h2>七、根据课文内容填空。（每空2分，共8分）</h2>\n<p class="question">29. 小蝌蚪先长出两条<u class="blank-2"> </u>腿。</p>';
    expect(detectCarrierFormMismatch(s)).toEqual([]);
    expect(normalizeBodyHtml(s)).toMatch(/<u\b[^>]*\bblank-2\b/i);
  });

  it('答案区不处理（不检出）', () => {
    // 失配只在**答案区**（正文无声明、答案区标题声明"括号"却是横线）→ 不检（答案区不重现状）
    const s = '<h2>一、积累与运用</h2>\n<p class="question">1. 题<u class="blank-1"> </u></p>\n<div class="answer-section"><h1>参考答案</h1><h2>把序号填在括号里</h2><p>1. 甲<u class="blank-1"> </u></p></div>';
    expect(detectCarrierFormMismatch(s)).toEqual([]);
  });

  // 🔴 相抵根治（乙案核心）：**形态不再被程序改**（无论声明源是段还是标题）；**检出**只认"形态词"、不认题型词。
  it('🔴 大题标题声明"填在括号里" → 命中（报告）但**形态不改**（乙案核心：只报不改）', () => {
    const s = [
      '<h2>一、把序号填在括号里。（每题2分）</h2>',
      '<p class="question">1. 看拼音写词语：<u class="blank-1"> </u>。</p>',
    ].join('\n');
    expect(detectCarrierFormMismatch(s).length, '声明↔实给不符应报').toBeGreaterThan(0);
    expect(normalizeBodyHtml(s), '形态不得被改写（相抵根治）').toMatch(/<u\b[^>]*\bblank-1\b/i);
  });

  it('🔴 大题标题只含**题型词**（"选择题"）、无形态声明 → 不检出（防题型词牵连）', () => {
    const s = [
      '<h2>二、选择题</h2>',
      '<p class="question">1. 看拼音写词语：<u class="blank-1"> </u>。</p>',
    ].join('\n');
    expect(detectCarrierFormMismatch(s)).toEqual([]);
    expect(normalizeBodyHtml(s)).toMatch(/<u\b[^>]*\bblank-1\b/i);
  });

  it('同大题内互不牵连：声明"括号"的段命中、声明"横线上"的段不命中；两段形态都不被改', () => {
    const s = [
      '<h2>三、按要求作答。</h2>',
      '<p class="question">1. 把正确的序号填在括号里<u class="blank-1"> </u>。</p>',
      '<p class="question">2. 把词语写在横线上<u class="blank-2"> </u>。</p>',
    ].join('\n');
    expect(detectCarrierFormMismatch(s).length).toBe(1);
    const out = normalizeBodyHtml(s);
    expect(out).toMatch(/<u\b[^>]*\bblank-1\b/i);
    expect(out).toMatch(/<u\b[^>]*\bblank-2\b/i);
  });

  it('归一键已**撤出**该步（程序不再改形态）', () => {
    const src = read('src/utils/contentCleaner.js');
    expect(src, '收口函数应已删除（不再定义）').not.toContain('export function alignCarrierFormByDeclaration');
    expect(src, '链内不得再出现该步').not.toContain("['alignCarrierFormByDeclaration'");
    expect(normalizeBodyHtml(SRC_Q1), '链归一后横线仍在').toMatch(/<u\b[^>]*blank-/i);
  });

  it('单源：符号作答声明只有一处定义，展示层推断与**检出**共用（禁两把尺子）', () => {
    const bs = read('src/config/blueprintSchema.js');
    expect((bs.match(/export const SYMBOL_ANSWER_DECL/g) || []).length, '该正则只能定义一次').toBe(1);
    expect(bs, 'inferCarriers 必须引用同一定义').toContain('if (HAS(t, SYMBOL_ANSWER_DECL)) out.add(CARRIERS.BRACKET);');
    expect((bs.match(/选择\|判断\|选字/g) || []).length, '括号关键词只能出现一次（单源）').toBe(1);
    const cc = read('src/utils/contentCleaner.js');
    expect(cc, '检出必须引用同一定义').toContain("import { SYMBOL_ANSWER_DECL } from '../config/blueprintSchema.js';");
    expect((cc.match(/选择\|判断\|选字/g) || []).length, 'contentCleaner 不得自写第二份括号关键词表').toBe(0);
    // 展示层口径不变：仍能判出括号载体
    expect(inferCarriers('选择', '')).toContain(CARRIERS.BRACKET);
    expect(SYMBOL_ANSWER_DECL.test('把序号填在括号里')).toBe(true);
    expect(SYMBOL_ANSWER_DECL.test('写在横线上')).toBe(false);
  });

  it('零新增提示词：该判定不进提示词（只在程序侧判定）', () => {
    const tpl = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' }).template;
    expect(tpl, '提示词不得出现该判定的字样').not.toContain('SYMBOL_ANSWER_DECL');
    expect((tpl.match(/填序号|序号填在/g) || []).length, '该判定措辞不得进提示词').toBe(0);
  });
});

describe('G2 声明↔实给判据单源', () => {
  it('单源句：题类①与内容型 CONTENT_FORMAT 引用同一常量（两次消费、各自一次）', () => {
    const lib = read('src/config/promptLibrary.js');
    expect((lib.match(/export const DECLARATION_TRUTH_CLAUSE/g) || []).length).toBe(1);
    expect((lib.match(/DECLARATION_TRUTH_CLAUSE/g) || []).length, '定义 1 次 + 消费 2 次').toBe(3);
    for (const g of ['exam', 'practice', 'preview', 'summary']) {
      const t = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: g }).template;
      expect(t, `${g} 应携带该句`).toContain(DECLARATION_TRUTH_CLAUSE);
    }
  });

  it('旧句（点 6 类实例的枚举式）已按"不覆盖"原则回补——实例不得丢、只加"待选项"', () => {
    const lib = read('src/config/promptLibrary.js');
    expect(DECLARATION_TRUTH_CLAUSE, '原有 6 类实例必须保留').toContain('拼音、首字母、提示词、图、表、数据、待选项');
    expect(lib, '回补后的完整句须在库内（单源）').toContain(DECLARATION_TRUTH_CLAUSE);
  });

  it('零诱导：该句不点题型名、不枚举实例、不给做法', () => {
    expect(DECLARATION_TRUTH_CLAUSE).not.toMatch(/选择|判断|填空|连线|选字|选词|看图|仿写|作文|朗读/);
    expect(DECLARATION_TRUTH_CLAUSE).not.toMatch(/例如|如“|比如/);
    expect(DECLARATION_TRUTH_CLAUSE).toContain('待选项');
  });

  it('判据含"判定法"（不止给方向）：按其声明的量与指代逐一对上', () => {
    // 2026-10-09 面 1：原句只给方向（"实给与题面所指相符"）→ 无客观判法、可自圆其说。
    // 现须给判定法：声明几项就有几项＝量、声明指哪处就真在那一处＝指代（与标记侧"按题干要求判"同款）。
    expect(DECLARATION_TRUTH_CLAUSE, '须给判定法而非只给方向').toContain('按其声明的量与指代逐一对上');
    expect(DECLARATION_TRUTH_CLAUSE, '真实/足量两要件须在').toMatch(/真实.*足量/);
  });
});
