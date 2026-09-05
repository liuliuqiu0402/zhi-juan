// 列表导出回归测试：自动编号转纯文本（数字/字母/罗马数字/符号形式）
// 背景：旧实现 prefix 里 itemIndex++ 后又自增 → 数字编号 1,3,5 跳号；且不支持字母编号 type
import { describe, it, expect } from 'vitest';
import { buildDocxFromDom } from '@/utils/docxBuilder.js';
import { Packer } from 'docx';
import JSZip from 'jszip';

const extractText = async (buf) => {
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('word/document.xml').async('string');
  // 提取所有 <w:t> 文本
  return [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('');
};

const buildText = async (html) => {
  const container = document.createElement('div');
  container.style.fontSize = '16px';
  container.innerHTML = html;
  document.body.appendChild(container);
  const doc = buildDocxFromDom(container);
  container.remove();
  return extractText(await Packer.toBuffer(doc));
};

describe('列表导出：自动编号转纯文本', () => {
  it('ol 数字编号连续不跳号（1. 2. 3.）', async () => {
    const t = await buildText('<ol><li>甲</li><li>乙</li><li>丙</li></ol>');
    expect(t).toContain('1. 甲');
    expect(t).toContain('2. 乙');
    expect(t).toContain('3. 丙');
  });

  it('ol start=3 从 3 开始编号', async () => {
    const t = await buildText('<ol start="3"><li>甲</li><li>乙</li></ol>');
    expect(t).toContain('3. 甲');
    expect(t).toContain('4. 乙');
    expect(t).not.toContain('1. 甲');
  });

  it('ol type="a" 字母编号（a. b. c.）', async () => {
    const t = await buildText('<ol type="a"><li>甲</li><li>乙</li><li>丙</li></ol>');
    expect(t).toContain('a. 甲');
    expect(t).toContain('b. 乙');
    expect(t).toContain('c. 丙');
  });

  it('ol type="A" 大写字母编号（A. B.）', async () => {
    const t = await buildText('<ol type="A"><li>甲</li><li>乙</li></ol>');
    expect(t).toContain('A. 甲');
    expect(t).toContain('B. 乙');
  });

  it('ol type="i" 罗马数字编号（i. ii.）', async () => {
    const t = await buildText('<ol type="i"><li>甲</li><li>乙</li></ol>');
    expect(t).toContain('i. 甲');
    expect(t).toContain('ii. 乙');
  });

  it('ol type="I" 大写罗马数字编号（I. II.）', async () => {
    const t = await buildText('<ol type="I"><li>甲</li><li>乙</li></ol>');
    expect(t).toContain('I. 甲');
    expect(t).toContain('II. 乙');
  });

  it('li 已含文本序号时不重复加前缀（双编号去重）', async () => {
    const t = await buildText('<ol><li>1. 甲</li><li>2. 乙</li></ol>');
    expect(t).toContain('1. 甲');
    expect(t).toContain('2. 乙');
    expect(t).not.toContain('1. 1. 甲');
  });

  it('li 已含字母序号时不重复加前缀', async () => {
    const t = await buildText('<ol type="a"><li>a. 甲</li><li>b. 乙</li></ol>');
    expect(t).toContain('a. 甲');
    expect(t).not.toContain('a. a. 甲');
  });

  it('ul 默认圆点符号', async () => {
    const t = await buildText('<ul><li>甲</li><li>乙</li></ul>');
    expect(t).toContain('• 甲');
    expect(t).toContain('• 乙');
  });

  it('ul type="circle" 空心圆、type="square" 方块', async () => {
    const t = await buildText('<ul type="circle"><li>甲</li></ul><ul type="square"><li>乙</li></ul>');
    expect(t).toContain('○ 甲');
    expect(t).toContain('▪ 乙');
  });

  it('编号前缀字号与正文一致（不缩小）', async () => {
    const container = document.createElement('div');
    container.style.fontSize = '16px';
    container.innerHTML = '<ol><li>甲</li></ol><ul><li>乙</li></ul>';
    document.body.appendChild(container);
    const doc = buildDocxFromDom(container);
    container.remove();
    const buf = await Packer.toBuffer(doc);
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file('word/document.xml').async('string');
    // 前缀 run 的 w:sz 应为 24（16px = 12pt = 24 half-points，与正文一致），旧实现未传 size 落到默认 11pt（22）
    // 注意：逐个 run 匹配（不允许跨 run），避免误匹配相邻 run 的字号
    const prefixRuns = [...xml.matchAll(/<w:r\b(?:(?!<w:r\b)[\s\S])*?<w:t[^>]*>(?:1\. |• )<\/w:t><\/w:r>/g)];
    expect(prefixRuns.length).toBeGreaterThanOrEqual(2);
    for (const m of prefixRuns) {
      const sz = m[0].match(/<w:sz w:val="(\d+)"\/>/);
      expect(sz && sz[1]).toBe('24');
    }
  });
});

describe('列表转文本层级：块级 margin-left → Word 段落左缩进', () => {
  const buildXml = async (html) => {
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

  it('带内联 margin-left 的段落导出为 w:ind w:left（em 按字号换算，折行跟随层级）', async () => {
    const xml = await buildXml('<p style="margin-left:2em">① 意义</p><p style="margin-left:4em">② 细节</p>');
    // 2em@16px = 32px × 15twip = 480；4em = 64px × 15 = 960
    expect(xml).toContain('<w:ind w:left="480"');
    expect(xml).toContain('<w:ind w:left="960"');
  });

  it('无 margin 的普通段落不被赋予 2em 左缩进', async () => {
    const xml = await buildXml('<p>这是普通段落原样不动</p>');
    expect(xml).not.toContain('w:left="480"');
    expect(xml).not.toContain('w:left="960"');
  });

  it('列表转换项：左缩进与正文首行缩进叠加而非二选一（与预览同语义）', async () => {
    // 模拟排版主题：所有 p 都带 text-indent:2em（themeConfig p{text-indent:2em}）。
    // 预览里：父项首行 = 0 + 2em = 2em；子项首行 = 2em(margin) + 2em(text-indent) = 4em → 层级差可见。
    // 导出若把子项 firstLine 丢弃（只留 left 2em），会与父项 firstLine 2em 撞线 → Word 看似无层级。
    const xml = await buildXml(
      '<p style="margin-left:0em; text-indent:2em">• 小数乘法</p>' +
      '<p style="margin-left:2em; text-indent:2em">① 小数乘法的意义</p>'
    );
    // 子项：left 与 firstLine 并存（首行 = 4em 起点，与预览一致）
    const oi = xml.indexOf('① 小数乘法的意义');
    const childPpr = xml.slice(xml.lastIndexOf('<w:p>', oi), oi);
    expect(childPpr).toContain('w:left="480"');
    expect(childPpr).toContain('w:firstLine="480"');
    // 父项：仅正文首行缩进，无左缩进
    const topIdx = xml.indexOf('• 小数乘法');
    const topPpr = xml.slice(xml.lastIndexOf('<w:p>', topIdx), topIdx);
    expect(topPpr).toContain('w:firstLine="480"');
    expect(topPpr).not.toContain('w:left=');
  });
});
