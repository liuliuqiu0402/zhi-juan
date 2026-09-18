// 🔴 2026-09-18 用户裁定（例题答案回填进原作答位）——跨端守卫
// ============================================================
// 用户原话链：
//  ① "例题是正常的一个题目吗？…原来完整题目中的书写载体要保留的吧？只是把答案填进了对应位置啊"；
//  ② "例题答案被下划线画起来填进去，这才是正确的吧？要不然学生怎么知道例题主要考查什么的呢？"
//  ③ "不要诱导和引导模型给例题都是横线作为书写载体，书写载体该是什么就是什么，不要强引导"；
//  ④ "非纯题类资料（知识总结、预习等），最后附上的自测题等题目，这些需要书写载体" +
//     "内容型不是一定要有自测，修复时不要造成指向性很强、也不要诱导模型出自测题"。
//
// 由此确定的三端口径（本文件逐一守卫）：
//  · 模型侧：例题＝一道完整的题（保留其原有作答形态），答案**回填在它自己的作答位上**；
//            形态随该题需要（不得为例题统一套某一种载体）；内容型的题作答位按条件式给载体。
//  · 清洁侧：载体内含**答案**是合法形态（不再一律判"误包"）——判据改为结构性
//            （包住块级内容/整句才拆）；历史误包形态守卫强度不降。
//  · 渲染侧：载体内含答案文字 → 渲染成"带下划线的答案"/"（）里装着答案"，**不得只按宽度画线把答案丢掉**。
import { describe, it, expect } from 'vitest';
import { unwrapMalformedBlankCarriers, normalizeBlankMarkers } from '../../src/utils/contentCleaner.js';
import { buildDocxFromDom } from '@/utils/docxBuilder.js';
import { injectDrawingML } from '@/utils/drawingMLShapes.js';
import { getPromptTemplate, buildOutputFormatHint } from '../../src/config/promptLibrary.js';
import { Packer } from 'docx';
import JSZip from 'jszip';

const getDocumentXml = async (html) => {
  const container = document.createElement('div');
  container.style.fontSize = '16px';
  container.innerHTML = html;
  document.body.appendChild(container);
  const doc = buildDocxFromDom(container);
  container.remove();
  const buf = await Packer.toBuffer(doc);
  const processed = await injectDrawingML(buf);
  const zip = await JSZip.loadAsync(processed);
  return zip.file('word/document.xml').async('string');
};

describe('① 清洁侧：载体内答案不许被当"畸形误包"拆掉', () => {
  it('短答案回填（<u class="blank-3">was</u>）→ 载体原样保留', () => {
    const html = '<p>Long ago, there <u class="blank-3">was</u> a snail in a garden.</p>';
    expect(unwrapMalformedBlankCarriers(html)).toBe(html);
  });

  it('多词短语答案（无句末标点）→ 仍保留载体（旧判据 ≥6 字会把这类拆掉）', () => {
    const html = '<p>He <u class="blank-3">is going to play</u> football tomorrow.</p>';
    expect(unwrapMalformedBlankCarriers(html)).toBe(html);
    expect(normalizeBlankMarkers(html)).toContain('is going to play');
    expect(normalizeBlankMarkers(html)).toMatch(/class=["']blank-3["']/);
  });

  it('括号载体回填（span.blank-N 内是答案）→ 保留', () => {
    const html = '<p>判断：The snail was fast. <span class="blank-2">×</span></p>';
    expect(unwrapMalformedBlankCarriers(html)).toBe(html);
  });

  // —— 反向护栏：历史实证的"误包"必须仍被拆（守卫强度不降）——
  it('整句被包（含句末标点）→ 仍拆壳（长句不再被画成横线）', () => {
    const html = '<p><u class="blank-4">（2）I like P  best. I can run and play on the sports ground.</u></p>';
    const out = unwrapMalformedBlankCarriers(html);
    expect(out).not.toContain('<u class="blank-4">');
    expect(out).toContain('I like P  best. I can run');
  });

  it('英文长句被包（以句点收尾）→ 仍拆壳', () => {
    const html = '<p>It <u class="blank-3"> (see) a bird at the top of the tree.</u></p>';
    const out = unwrapMalformedBlankCarriers(html);
    expect(out).not.toContain('at the top of the tree.</u>');
    expect(out).toContain('(see) a bird at the top of the tree.');
  });

  it('载体包住块级内容（答案/解析整块）→ 仍拆壳、块级归位', () => {
    const html = '<p>Long ago, there <u class="blank-3"> (be) a snail in a garden.</u></p>'
      + '<u class="blank-3">\n<p><strong>答案：</strong>was</p>\n<p><strong>解析：</strong>用一般过去时。</p>\n</u>';
    const out = unwrapMalformedBlankCarriers(html);
    expect(out).not.toContain('blank-3');
    expect(out).toContain('<p><strong>答案：</strong>was</p>');
  });

  it('远超答案长度的超长内容（无标点）→ 仍按误包拆壳', () => {
    const long = 'thechildrenplayedgamesinthegardenandthensangasongtogether';
    const out = unwrapMalformedBlankCarriers(`<p><u class="blank-3">${long}</u></p>`);
    expect(out).not.toContain('blank-3');
    expect(out).toContain(long);
  });
});

describe('② 渲染侧：载体内含答案 → 导出成"下划线答案"/"括号答案"，不得丢字', () => {
  it('u.blank-N 内含答案 → Word 导出保留答案文字 + 下划线（旧逻辑只按宽度画线丢答案）', async () => {
    const xml = await getDocumentXml('<p>Long ago, there <u class="blank-3">was</u> a snail in a garden.</p>');
    expect(xml).toContain('>was</w:t>');
    expect(xml).toContain('<w:u w:val="single"');
    expect(xml).not.toContain('<w:ptab');
  });

  it('u.blank-N 内含多词答案 → 文字完整保留', async () => {
    const xml = await getDocumentXml('<p>He <u class="blank-4">is going to play</u> football.</p>');
    expect(xml).toContain('>is going to play</w:t>');
    expect(xml).toContain('<w:u w:val="single"');
  });

  it('span.blank-N 内含答案 → 导出"（）里装着答案"', async () => {
    const xml = await getDocumentXml('<p>判断：The snail was fast. <span class="blank-2">×</span></p>');
    expect(xml).toContain('(×)');
  });

  // —— 反向护栏：空载体行为一字不变（未回填时仍按空位宽度画线/括号）——
  it('空载位（未回填）→ 仍按空位宽度渲染，不因本改动变形', async () => {
    const xmlU = await getDocumentXml('<p>光合作用的场所是<u class="blank-2">&emsp;</u>。</p>');
    expect(xmlU).not.toContain('<w:ptab');
    expect(xmlU).toContain('<w:u w:val="single"');
    expect(xmlU).toContain('>。</w:t>');

    const xmlSpan = await getDocumentXml('<p>下列哪项是正确的<span class="blank-3">&emsp;</span></p>');
    expect(xmlSpan).not.toContain('<w:ptab');
    expect(xmlSpan).toMatch(/>\(/);
  });
});

describe('③ 模型侧：例题条款已反转（载体保留 + 答案回填），且不指定载体形态', () => {
  const TPL = (genType) => getPromptTemplate({ grade: '六年级', subject: '英语', genType }).template;

  it('知识总结例题＝完整题＋保留原作答形态＋答案回填（不再要求"不出现任何作答载体"）', () => {
    const s = TPL('summary');
    expect(s).toContain('例题就是一道**完整的题**');
    expect(s).toContain('作答形态（作答载体）**原样保留**');
    expect(s).toContain('答案已回填进它自己的作答位上');
    // 旧措辞（让示范失去考点提示）必须消失
    expect(s).not.toContain('不出现任何作答载体');
    expect(s, '不得回退为"待填处直接写出答案"的完整句写法').not.toContain('例题按**完整句**给出');
    // 防"正文被画成横线"的排版事故禁令仍在
    expect(s).toContain('严禁用载体把整句或整段内容包起来');
  });

  it('例题条款不得强引导载体形态（该是什么就是什么）', () => {
    const s = TPL('summary');
    expect(s).toContain('该用什么形态就用什么形态');
    expect(s, '不得把例题一律指定为横线/下划线').not.toMatch(/一律用横线|统一用横线|都必须用横线|一律用下划线|统一用下划线|一律写成横线|统一写成横线/);
  });

  it('三处答案纪律例外同步为"答案回填在例题自身作答位上"', () => {
    for (const t of ['exam', 'practice', 'summary']) {
      const s = TPL(t);
      expect(s, `${t} 未同步`).toContain('答案即回填在例题自身的作答位上');
      expect(s, `${t} 仍留旧措辞`).not.toContain('不设作答空间');
    }
  });
});

describe('④ 模型侧：内容型"内部题的作答位"为条件式、不诱导出题', () => {
  const TPL = (genType) => getPromptTemplate({ grade: '六年级', subject: '英语', genType }).template;

  it('内容型模板含条件式作答位条款（若含…则同一规则给显式载体）', () => {
    for (const t of ['summary', 'preview']) {
      const s = TPL(t);
      expect(s, `${t} 缺作答位条款`).toContain('本资料若含需学生自行作答的题');
      expect(s).toContain('不因本资料以梳理为主而省略作答位');
      expect(s).toContain('不得以空格串充当作答位');
    }
  });

  it('内容型不得出现诱导出题的措辞（不指向"应当有自测题"）', () => {
    for (const t of ['summary', 'preview']) {
      const s = TPL(t);
      expect(s, `${t} 出现诱导出题措辞`).not.toMatch(/(必须|务必|应当|需要)(包含|安排|设置|补充|增加)(自测|练习)题?|请(补充|增加|添加)(自测|练习)/);
    }
  });

  it('内容型不注入题类格式块（载体协议只作条件式补充，不广播题目自洽总纲）', () => {
    const c = buildOutputFormatHint({ subject: '英语', stage: 'primary_high', genType: 'summary' });
    expect(c).not.toContain('题目自洽');
    expect(c).toContain('本资料若含需学生自行作答的题');
  });
});
