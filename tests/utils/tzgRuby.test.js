// 田字格 + 注音（ruby-char）嵌套导出回归测试
// 背景：ruby-char 包田字格时旧逻辑直接 return，田字格丢失只剩注音字；
//      修复后拼音画进田字格群组（格内带字，拼音浮在格内字上方），无空格子
import { describe, it, expect } from 'vitest';
import { buildDocxFromDom } from '@/utils/docxBuilder.js';
import { normalizeRubyTags } from '@/utils/rubyNormalizer.js';
import { injectDrawingML } from '@/utils/drawingMLShapes.js';
import { Packer } from 'docx';
import JSZip from 'jszip';

const extractXml = async (buf) => {
  const zip = await JSZip.loadAsync(buf);
  return await zip.file('word/document.xml').async('string');
};

const buildDoc = async (html) => {
  const container = document.createElement('div');
  container.style.fontSize = '16px';
  container.innerHTML = normalizeRubyTags(html); // 生产链路导出前必跑 normalize
  document.body.appendChild(container);
  const doc = buildDocxFromDom(container);
  container.remove();
  return extractXml(await Packer.toBuffer(doc));
};

const countOccur = (s, sub) => s.split(sub).length - 1;

describe('田字格+注音嵌套导出（田字格不丢，拼音进格子）', () => {
  it('B: ruby-char 包田字格 → 注音田字格 marker（无 RUBY、无空格子）', async () => {
    const xml = await buildDoc('<p><span class="ruby-char" data-pinyin="kē"><span class="tian-zi-ge">蝌</span></span></p>');
    expect(xml).toContain('__TZGP_');
    expect(xml).not.toContain('__RUBY_');
    expect(xml).not.toContain('__TZG_ ');
  });

  it('A: 田字格包 ruby-char → 注音田字格 marker', async () => {
    const xml = await buildDoc('<p><span class="tian-zi-ge"><span class="ruby-char" data-pinyin="kē">蝌</span></span></p>');
    expect(xml).toContain('__TZGP_');
    expect(xml).not.toContain('__RUBY_');
  });

  it('C: 原生 ruby 包田字格（normalize 后）→ 注音田字格 marker', async () => {
    const xml = await buildDoc('<p><ruby><span class="tian-zi-ge">蝌</span><rt>kē</rt></ruby></p>');
    expect(xml).toContain('__TZGP_');
    expect(xml).not.toContain('__RUBY_');
  });

  it('ruby-char 包 2 个田字格 → 2 个注音田字格，拼音逐字对应', async () => {
    const xml = await buildDoc('<p><span class="ruby-char" data-pinyin="kē dǒu"><span class="tian-zi-ge">蝌</span><span class="tian-zi-ge">蚪</span></span></p>');
    expect(countOccur(xml, '__TZGP_')).toBe(2);
    expect(xml).toContain('__TZGP_蝌_kē_');
    expect(xml).toContain('__TZGP_蚪_dǒu_');
  });

  it('表格内 ruby-char 包田字格 → 注音田字格 marker', async () => {
    const xml = await buildDoc('<table><tr><td><span class="ruby-char" data-pinyin="kē"><span class="tian-zi-ge">蝌</span></span></td><td>（部首：虫）</td></tr></table>');
    expect(xml).toContain('__TZGP_');
    expect(xml).not.toContain('__RUBY_');
  });

  it('块级：田字格包 ruby-char → 注音田字格段落', async () => {
    const xml = await buildDoc('<div><span class="tian-zi-ge"><span class="ruby-char" data-pinyin="kē">蝌</span></span></div>');
    expect(xml).toContain('__TZGP_');
    expect(xml).not.toContain('__RUBY_');
  });

  it('普通注音（无田字格）不受影响：仅 RUBY marker', async () => {
    const xml = await buildDoc('<p>今天学习<span class="ruby-char" data-pinyin="xí">习</span>字</p>');
    expect(xml).toContain('__RUBY_');
    expect(xml).not.toContain('__TZGP_');
  });

  it('普通田字格（无注音）不受影响：格内带字 TZG marker', async () => {
    const xml = await buildDoc('<p>今天学习<span class="tian-zi-ge">田</span>这个字</p>');
    expect(xml).toContain('__TZG_田_');
    expect(xml).not.toContain('__TZGP_');
    expect(xml).not.toContain('__RUBY_');
  });

  it('注入后：拼音 textbox 在格子群组内，格内带字，无残留 marker', async () => {
    const container = document.createElement('div');
    container.style.fontSize = '16px';
    container.innerHTML = normalizeRubyTags('<p><span class="ruby-char" data-pinyin="kē"><span class="tian-zi-ge">蝌</span></span></p>');
    document.body.appendChild(container);
    const doc = buildDocxFromDom(container);
    container.remove();
    const injected = await injectDrawingML(await Packer.toBuffer(doc));
    const xml = await extractXml(injected);
    expect(xml).toContain('TZG-Pinyin'); // 拼音 textbox
    expect(xml).toContain('kē'); // 拼音文本
    expect(xml).toContain('TZG-Char'); // 格内字 textbox
    expect(xml).not.toContain('<w:ruby>'); // 不再走 w:ruby 注音单元
    expect(xml).not.toContain('__TZGP_'); // marker 已全部替换
  });

  it('块级注入后：拼音 textbox 在格子群组内，无残留 marker', async () => {
    const container = document.createElement('div');
    container.style.fontSize = '16px';
    container.innerHTML = normalizeRubyTags('<div><span class="tian-zi-ge"><span class="ruby-char" data-pinyin="kē">蝌</span></span></div>');
    document.body.appendChild(container);
    const doc = buildDocxFromDom(container);
    container.remove();
    const injected = await injectDrawingML(await Packer.toBuffer(doc));
    const xml = await extractXml(injected);
    expect(xml).toContain('TZG-Pinyin');
    expect(xml).toContain('kē');
    expect(xml).toContain('TZG-Char');
    expect(xml).not.toContain('__TZGP_');
  });
});

describe('rubyNormalizer：含元素子节点不拆分', () => {
  it('ruby-char 包 2 个田字格 span → 保持整体不逐字拆分（田字格结构不丢）', () => {
    const html = normalizeRubyTags('<span class="ruby-char" data-pinyin="kē dǒu"><span class="tian-zi-ge">蝌</span><span class="tian-zi-ge">蚪</span></span>');
    expect(html).toContain('tian-zi-ge');
    expect(countOccur(html, 'tian-zi-ge')).toBe(2);
  });

  it('纯文本多字 ruby-char 仍逐字拆分（原功能不回归）', () => {
    const html = normalizeRubyTags('<span class="ruby-char" data-pinyin="chūn tiān">春 天</span>');
    expect(countOccur(html, 'ruby-char')).toBe(2);
  });
});
