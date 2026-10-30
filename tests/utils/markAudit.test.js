/**
 * 🏷 标记对账 · 逐题判 + 清洗不变量
 * ============================================================
 * 两条教训各对应一组用例：
 *   ① 旧口径是"全文计数"（markCount === 0 才报）⇒ 卷里一处有标记，其余缺标记的题全部漏报；
 *   ② 旧清洗会把"裸 `<u>整句。</u>`"（模型写画线的常见形态）**拆壳清掉** ⇒ 用户看到"要求画线却没有画线"。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import { auditMarkBlocks, countMarkInHtml, MARK_RULES } from '../../src/config/markRegistry.js';
import { normalizeBlankMarkers, upgradeBareMarksByClaim } from '../../src/utils/contentCleaner.js';
import { buildDocxFromDom } from '../../src/utils/docxBuilder.js';
import { Packer } from 'docx';
import JSZip from 'jszip';

const dotRule = MARK_RULES.find((r) => r.id === 'emphasis-dot');
const ulRule = MARK_RULES.find((r) => r.id === 'underline-sentence');

describe('标记对账 · 逐题块（不再全文计数）', () => {
  it('一题有标记、另一题缺 ⇒ 只报缺的那题（旧口径会因"全文有一个"整卷放过）', () => {
    const html = `
<p class="question">1. 给加点的字注音。</p>
<p><span class="emphasis-dot">蒙</span>古包</p>
<p class="question">2. 给加点的字注音。</p>
<p>勉强</p>`;
    const miss = auditMarkBlocks(html, { subject: '语文' });
    expect(miss.length, '只有第 2 题缺标记').toBe(1);
    expect(miss[0].id).toBe('emphasis-dot');
    expect(miss[0].excerpt).toContain('2.');
  });

  it('该题块内有对应载体 ⇒ 不报（不误伤正常题）', () => {
    const html = `<p class="question">1. 用横线画出中心句。</p>
<p><u class="underline-sentence">春天来了，燕子从南方飞回来了。</u></p>`;
    expect(auditMarkBlocks(html, { subject: '语文' })).toEqual([]);
  });

  it('答案区里的"加点"不算题面要求（不误报）', () => {
    const html = `<p class="question">1. 读句子。</p><p>树上的果子熟了。</p>
<div class="answer-section"><p>1. 加点字读音：méng</p></div>`;
    expect(auditMarkBlocks(html, { subject: '语文' }).some((m) => m.id === 'emphasis-dot')).toBe(false);
  });

  it('非语文/英语学科不参与标记对账（不跨学科误报）', () => {
    const html = '<p class="question">1. 用横线画出正确答案。</p><p>3+2=5</p>';
    expect(auditMarkBlocks(html, { subject: '数学' })).toEqual([]);
  });
});

describe('清洗不变量：模型写的画线不得被清洗掉', () => {
  it('题干要求画线时，裸 <u>整句。</u> 会被升级成 underline-sentence（而不是拆壳删掉）', () => {
    const src = '<p class="question">1. 用横线画出文中的中心句。</p>'
      + '<p><u>春天来了，燕子从南方飞回来了，柳树也发芽了。</u></p>';
    const out = normalizeBlankMarkers(src);
    expect(out, '画线载体被清掉了').toContain('underline-sentence');
    expect(countMarkInHtml(out, ulRule), '画线数量不得减少').toBeGreaterThanOrEqual(1);
  });

  it('题干没要求画线时，裸 <u> 整句仍按旧口径拆壳（不制造"整卷画线"）', () => {
    const src = '<p class="question">1. 读一读。</p>'
      + '<p><u>春天来了，燕子从南方飞回来了，柳树也发芽了。</u></p>';
    const out = normalizeBlankMarkers(src);
    expect(out.includes('underline-sentence')).toBe(false);
  });

  it('切点之外的标记不受影响（加点、圈出、划去在清洗后仍在）', () => {
    const src = '<p class="question">1. 读句子。</p>'
      + '<p><span class="emphasis-dot">蒙</span>古包 <span class="circle-mark">错字</span> <span class="strike-mark">划去的字</span></p>';
    const out = normalizeBlankMarkers(src);
    for (const rule of ['emphasis-dot', 'circle-mark', 'strike-mark'].map((id) => MARK_RULES.find((r) => r.id === id))) {
      expect(countMarkInHtml(out, rule), `${rule.cls} 被清洗掉了`).toBeGreaterThanOrEqual(1);
    }
  });
});

// 🏷 存量归一（老资料不必重新生成）：只升级"已标但形态不对"的裸 <u>，不新增语义
describe('存量标记归一 · upgradeBareMarksByClaim', () => {
  it('题干要求画线 → 该题块裸 <u> 升级为 underline-sentence（别题不受影响）', () => {
    const src = '<p class="question">1. 用横线画出中心句。</p><p><u>春天来了。</u></p>'
      + '<p class="question">2. 填空。</p><p><u>4</u> 是偶数。</p>';
    const out = upgradeBareMarksByClaim(src);
    expect(out).toContain('<u class="underline-sentence">春天来了。</u>');
    expect(out, '没要求画线的题块不得被升级').toContain('<p><u>4</u> 是偶数。</p>');
  });

  it('题干含"加点" → 该题块裸 <u>汉字</u> 升级为 emphasis-dot', () => {
    const src = '<p class="question">3. 给加点的字注音。</p><p><u>蒙</u>古包</p>';
    const out = upgradeBareMarksByClaim(src);
    expect(out).toContain('<span class="emphasis-dot">蒙</span>');
  });

  it('幂等：已带 class 的载体、空白横线都不动', () => {
    const src = '<p class="question">1. 用横线画出中心句。</p>'
      + '<p><u class="underline-sentence">春天来了。</u> <u class="blank-4">&emsp;</u> <u>＿＿</u></p>';
    const once = upgradeBareMarksByClaim(src);
    expect(upgradeBareMarksByClaim(once)).toBe(once);
    expect(once).toContain('<u class="blank-4">');
  });
});

// 🏷 Word 导出：6 种标记必须各自映射到 Word 的原生格式，不能"预览有、导出丢"
describe('标记导出 · Word 映射', () => {
  const getXml = async (html) => {
    const container = document.createElement('div');
    container.style.fontSize = '16px';
    container.innerHTML = html;
    document.body.appendChild(container);
    const doc = buildDocxFromDom(container);
    container.remove();
    const buf = await Packer.toBuffer(doc);
    const zip = await JSZip.loadAsync(buf);
    return zip.file('word/document.xml').async('string');
  };

  it('加点/圈出 → 着重号（dot / circle）；画线/波浪线/双线 → 对应下划线；划去 → 删除线', async () => {
    const html = '<p>'
      + '<span class="emphasis-dot">蒙</span>'
      + '<span class="circle-mark">拔</span>'
      + '<u class="underline-sentence">春天来了</u>'
      + '<span class="wavy-underline">柳枝</span>'
      + '<span class="double-line">校园</span>'
      + '<span class="strike-mark">多余</span>'
      + '</p>';
    const xml = await getXml(html);
    expect(xml, '加点未导出着重号').toContain('<w:em w:val="dot"/>');
    expect(xml, '圈出未导出圈号').toContain('<w:em w:val="circle"/>');
    expect(xml, '画线未导出下划线').toMatch(/<w:u w:val="single"/);
    expect(xml, '波浪线未导出波浪下划线').toMatch(/<w:u w:val="wave"/);
    expect(xml, '双线未导出双下划线').toMatch(/<w:u w:val="double"/);
    expect(xml, '划去未导出删除线').toContain('<w:strike/>');
  });
});
