/**
 * 田字格·多格导出（防"原有格子后面/下一行新插入的格子导出丢失"）
 *
 * 背景（2026-10-31 属主实证）：原有 3 个田字格后面再插 3 个，预览是 6 个，
 *   导出 Word 只剩原有 3 个；只有文末空白处插入的能导出。
 * 口径：预览与导出一致——同一段落内并列、相邻段落各一组，都须按格数逐一输出 marker。
 */
import { describe, it, expect } from 'vitest';
import { buildDocxFromDom } from '@/utils/docxBuilder.js';
import { Packer } from 'docx';
import JSZip from 'jszip';

const xmlOf = async (html) => {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  const doc = buildDocxFromDom(container);
  container.remove();
  const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
  return zip.file('word/document.xml').async('string');
};

const countMarkers = (xml) => (xml.match(/__TZG_/g) || []).length;
const grid = (txt = '&emsp;') => `<span class="tian-zi-ge">${txt}</span>`;

describe('田字格·多格导出：预览格数 = 导出格数', () => {
  it('同一段落 6 格（原有 3 + 插入 3）→ 6 个 marker', async () => {
    const xml = await xmlOf(`<p>${grid().repeat(6)}</p>`);
    expect(countMarkers(xml)).toBe(6);
  });

  it('3 格一段 + 下一行再 3 格 → 6 个 marker', async () => {
    const xml = await xmlOf(`<p>${grid().repeat(3)}</p><p>${grid().repeat(3)}</p>`);
    expect(countMarkers(xml)).toBe(6);
  });

  it('格内有字时同样不丢（3 + 3 同段）', async () => {
    const xml = await xmlOf(`<p>写字：${grid('字').repeat(3)}${grid('字').repeat(3)}</p>`);
    expect(countMarkers(xml)).toBe(6);
  });
});
