// G1 载体形态按题面声明收口 + G2 声明↔实给判据单源（2026-09-30 用户裁定·全局根治）
// ============================================================
// G1 病根（源码级实证）：形态原先由**输入长相**决定（下划线→横线型 / 括号→括号型），于是"题干说填在括号里、
//   卷面却是一条横线"。判"该用哪种载体"的表本来就在（blueprintSchema 的括号判定），却只供展示层用——两把尺子。
// G2 病根：题面自洽①里"声明↔实给"那句**内联在题类模板**且点了 6 类实例，内容型无同口径 →
//   "声明了'选'却无可选项"一类问题漏在内容型侧。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { alignCarrierFormByDeclaration, normalizeBodyHtml } from '../../src/utils/contentCleaner.js';
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

describe('G1 载体形态按题面声明收口', () => {
  it('题块声明"把序号填在括号里" → 块内横线型空位一律收为括号型（真实源码 4 条全转）', () => {
    const out = alignCarrierFormByDeclaration(SRC_Q1);
    expect(out, '横线型应已无残留').not.toMatch(/<u\b[^>]*blank-/i);
    expect((out.match(/<span class="blank-\d">&emsp;<\/span>/g) || []).length).toBe(4);
    expect(out, '档位（N）不得变').toContain('<span class="blank-1">&emsp;</span>');
    expect(out, '档位（N）不得变').toContain('<span class="blank-4">&emsp;</span>');
    expect(out, '加点标记不得被牵连').toContain('<span class="emphasis-dot">教</span>');
  });

  it('显式"横线"声明否决：题块声明"选字填空…写在横线上" → 一律不动（防按符号词误转）', () => {
    expect(alignCarrierFormByDeclaration(SRC_Q4)).toBe(SRC_Q4);
  });

  it('题块无声明 → 不动（填空/组词/写句子等横线载体照旧）', () => {
    const s = '<h2>七、根据课文内容填空。（每空2分，共8分）</h2>\n<p class="question">29. 小蝌蚪先长出两条<u class="blank-2"> </u>腿。</p>';
    expect(alignCarrierFormByDeclaration(s)).toBe(s);
  });

  it('答案区不处理', () => {
    const s = '<h2>一、把序号填在括号里。（每题2分）</h2>\n<p class="question">1. 题<u class="blank-1"> </u></p>\n<div class="answer-section"><h1>参考答案</h1><p>1. 甲<u class="blank-1"> </u></p></div>';
    const out = alignCarrierFormByDeclaration(s);
    expect(out.slice(out.indexOf('answer-section')), '答案区内的横线型保持原样').toContain('<u class="blank-1">');
  });

  it('幂等：已是括号型再跑一次不变', () => {
    const once = alignCarrierFormByDeclaration(SRC_Q1);
    expect(alignCarrierFormByDeclaration(once)).toBe(once);
  });

  // 🔴 2026-10-06（第二批·面 10·程序链 · A3 属主裁定"块级→按空判"）：
  //   原按 h2 题块**整块**收口，与 cell"同一题内各空分别定形、可并存"、⑧"性质不同者不得整卷同形"
  //   粒度不同 ⇒ 真机上"该横线"的空位会被整块翻成括号。现按**小题段**判、大题标题声明作兜底。
  it('🆕按空判：同大题内，声明"括号"的段收口、声明"横线上"的段不动（互不牵连）', () => {
    const s = [
      '<h2>三、按要求作答。</h2>',
      '<p class="question">1. 把正确的序号填在括号里<u class="blank-1"> </u>。</p>',
      '<p class="question">2. 把词语写在横线上<u class="blank-2"> </u>。</p>',
    ].join('\n');
    const out = alignCarrierFormByDeclaration(s);
    expect(out, '声明"括号"的段 → 收为括号型').toContain('<span class="blank-1">&emsp;</span>');
    expect(out, '声明"横线上"的段 → 保持横线型（不得被整块牵连）').toContain('<u class="blank-2"> </u>');
  });

  it('🆕大题标题级声明仍生效：h2 含"括号"、段内无声明 → 其下各段一律收口', () => {
    const s = [
      '<h2>一、把序号填在括号里。（每题2分）</h2>',
      '<p class="question">1. 甲<u class="blank-1"> </u>。</p>',
      '<p class="question">2. 乙<u class="blank-1"> </u>。</p>',
    ].join('\n');
    const out = alignCarrierFormByDeclaration(s);
    expect(out, '大题级声明 → 其下各段均应收口').not.toMatch(/<u\b[^>]*blank-/i);
  });

  it('接入正文归一键（normalizeBodyHtml 链内，且只增一步、不动既有次序）', () => {
    const src = read('src/utils/contentCleaner.js');
    expect(src).toContain("['alignCarrierFormByDeclaration', alignCarrierFormByDeclaration],");
    expect(src.indexOf("['normalizeBlankMarkers'")).toBeLessThan(src.indexOf("['alignCarrierFormByDeclaration'"));
    expect(src.indexOf("['alignCarrierFormByDeclaration'")).toBeLessThan(src.indexOf("['normalizeMathCircleBlanks'"));
    expect(normalizeBodyHtml(SRC_Q1)).not.toMatch(/<u\b[^>]*blank-/i);
  });

  it('单源：符号作答声明只有一处定义，展示层推断与形态收口共用（禁两把尺子）', () => {
    const bs = read('src/config/blueprintSchema.js');
    expect((bs.match(/export const SYMBOL_ANSWER_DECL/g) || []).length, '该正则只能定义一次').toBe(1);
    expect(bs, 'inferCarriers 必须引用同一定义').toContain('if (HAS(t, SYMBOL_ANSWER_DECL)) out.add(CARRIERS.BRACKET);');
    expect((bs.match(/选择\|判断\|选字/g) || []).length, '括号关键词只能出现一次（单源）').toBe(1);
    const cc = read('src/utils/contentCleaner.js');
    expect(cc, '形态收口必须引用同一定义').toContain("import { SYMBOL_ANSWER_DECL } from '../config/blueprintSchema.js';");
    expect((cc.match(/选择\|判断\|选字/g) || []).length, 'contentCleaner 不得自写第二份括号关键词表').toBe(0);
    // 展示层口径不变：仍能判出括号载体
    expect(inferCarriers('选择', '')).toContain(CARRIERS.BRACKET);
    expect(SYMBOL_ANSWER_DECL.test('把序号填在括号里')).toBe(true);
    expect(SYMBOL_ANSWER_DECL.test('写在横线上')).toBe(false);
  });

  it('零新增提示词：形态收口不进提示词（只在程序侧判定）', () => {
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
});
