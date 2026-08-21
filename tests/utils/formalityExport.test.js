// 卷面规范落地回归测试（A1 答案另起一页 / A3 "本试卷共＿页" NUMPAGES 域）
// - A1：docx 导出 .answer-section 前强制分页（<w:br w:type="page"/>），答案与正文不同页
// - A3：注意事项"3．本试卷共＿页。"中的"＿页"替换为 NUMPAGES 域（Word 自动填实际总页数，与页脚联动）
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

describe('卷面规范 A1：答案区另起一页（docx 强制分页）', () => {
  it('.answer-section 前输出分页符，答案不与正文同页', async () => {
    const xml = await getDocumentXml(
      '<h2>一、选择题（每题2分，共20分）</h2><p>1. 题目一</p><div class="answer-section"><p>参考答案与评分标准</p></div>'
    );
    expect(xml).toContain('<w:br w:type="page"/>'); // 分页符
    expect(xml).toContain('参考答案与评分标准');
  });

  it('无答案区（学生版）不产生多余分页符', async () => {
    const xml = await getDocumentXml('<h2>一、选择题</h2><p>1. 题目一</p>');
    expect(xml).not.toContain('<w:br w:type="page"/>');
  });
});

describe('卷面规范 A3："本试卷共＿页" → NUMPAGES 域', () => {
  it('注意事项"3．本试卷共＿页。"输出本试卷共 + NUMPAGES 域 + 页', async () => {
    const xml = await getDocumentXml('<p class="notice-item">3．本试卷共＿页。</p>');
    expect(xml).toContain('本试卷共');
    expect(xml).toContain('NUMPAGES'); // Word 总页数字段
    // 不再输出静态"＿页"占位（由域自动填充）
    expect(xml).not.toContain('本试卷共＿页');
  });

  it('普通正文不含该占位时不受影响', async () => {
    const xml = await getDocumentXml('<p>本试卷共 4 页。</p>');
    expect(xml).toContain('本试卷共 4 页');
  });
});
