// 卷面规范落地回归测试（A1 答案区独立分节另起编号 / A3 "本试卷共＿页" SECTIONPAGES 域）
// - A1：docx 导出 .answer-section 拆分为独立 Word 分节（<w:pgNumType w:start="1"/>），
//       答案页页码从 1 重新开始、不计入正文页数；正文页脚"共X页"只计正文（SECTIONPAGES）
// - A3：注意事项"3．本试卷共＿页。"中的"＿页"替换为 SECTIONPAGES 域（Word 自动填正文分节页数，与页脚联动）
import { describe, it, expect } from 'vitest';
import { buildDocxFromDom } from '@/utils/docxBuilder.js';
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
  const zip = await JSZip.loadAsync(buf);
  return zip.file('word/document.xml').async('string');
};

describe('卷面规范 A1：答案区独立分节（另起一页、页码从1重编号）', () => {
  it('.answer-section 拆分为独立分节：正文/答案两个 sectPr，答案节 pgNumType start=1', async () => {
    const xml = await getDocumentXml(
      '<h2>一、选择题（每题2分，共20分）</h2><p>1. 题目一</p><div class="answer-section"><p>参考答案与评分标准</p></div>'
    );
    const sectPrCount = (xml.match(/<w:sectPr/g) || []).length;
    expect(sectPrCount).toBe(2); // 正文分节 + 答案分节
    expect(xml).toContain('<w:pgNumType w:start="1"/>'); // 答案页独立编号从 1 起
    expect(xml).toContain('参考答案与评分标准');
  });

  it('无答案区（学生版）不产生分节、不重排页码', async () => {
    const xml = await getDocumentXml('<h2>一、选择题</h2><p>1. 题目一</p>');
    const sectPrCount = (xml.match(/<w:sectPr/g) || []).length;
    expect(sectPrCount).toBe(1);
    expect(xml).not.toContain('<w:pgNumType w:start="1"/>');
  });

  it('密封线试卷（sealed-wrapper 嵌套）答案区同样拆分为独立分节', async () => {
    const xml = await getDocumentXml(
      '<div class="sealed-wrapper"><div class="seal-zone"><div class="seal-note">密封线内不要答题</div><div class="seal-info">学校：＿＿＿</div><div class="seal-line"></div><div class="seal-char s-top">线</div><div class="seal-char s-bot">密</div></div><div class="sealed-content"><h2>一、选择题（每题2分，共20分）</h2><p>1. 题目一</p><div class="answer-section"><p>参考答案与评分标准</p></div></div></div>'
    );
    const sectPrCount = (xml.match(/<w:sectPr/g) || []).length;
    expect(sectPrCount).toBe(2);
    expect(xml).toContain('<w:pgNumType w:start="1"/>');
    expect(xml).toContain('参考答案与评分标准');
  });
});

describe('卷面规范 A3："本试卷共＿页" → SECTIONPAGES 域（正文页数，不含答案页）', () => {
  it('注意事项"3．本试卷共＿页。"输出本试卷共 + SECTIONPAGES 域 + 页', async () => {
    const xml = await getDocumentXml('<p class="notice-item">3．本试卷共＿页。</p>');
    expect(xml).toContain('本试卷共');
    expect(xml).toContain('SECTIONPAGES'); // Word 正文分节页数字段（不含答案页）
    expect(xml).not.toContain('NUMPAGES'); // 不再用全文档总页数（会把答案页计入）
    // 不再输出静态"＿页"占位（由域自动填充）
    expect(xml).not.toContain('本试卷共＿页');
  });

  it('普通正文不含该占位时不受影响', async () => {
    const xml = await getDocumentXml('<p>本试卷共 4 页。</p>');
    expect(xml).toContain('本试卷共 4 页');
  });
});
