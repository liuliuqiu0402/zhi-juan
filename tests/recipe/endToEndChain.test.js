// 🔴 2026-09-29（用户裁定："不要仅仅单独测试没问题，要的是**整个生成链路**里没问题"）：
//   全链路验收——按应用真实顺序串起来跑，断言**最终产物**而不是某个函数：
//     模型原始输出(HTML) → ①正文层归一 normalizeBlankMarkers（编辑器/排版装载同入口）
//     → ②校验与兜底 auditExamPaper（补差 / 补格 / 越界剥离）→ ③导出 buildDocxFromDom(+Packer+DrawingML)
//   本文件同时把"程序侧越位点"钉在明面上（见各用例注释）：凡程序侧**代模型决定宽度/有无载体**之处，
//   都标注现状与应然——待模型侧协议生效后逐步放宽，而不是靠人记得。
//   ⚠️ 链路边界：更上游的 callAI 层 convertBlankFormat 在 useAiGenerator 内部（未导出），
//      本链路从"归一"起算；模型→归一 那一段的验收见 tests/recipe/carrierProtocolCoverage.test.js。
import { describe, it, expect } from 'vitest';
import { buildDocxFromDom } from '@/utils/docxBuilder.js';
import { injectDrawingML } from '@/utils/drawingMLShapes.js';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { normalizeBlankMarkers } from '@/utils/contentCleaner.js';
import { auditExamPaper } from '@/utils/examValidator.js';
import { blankWriteScale } from '@/config/layoutSpec.js';

const YW = { subject: '语文', stage: 'primary_low', genType: 'exam' };

/** 全链路：模型原始输出 → 归一 → 校验兜底 → 出稿 HTML */
const chain = (rawModelHtml, opts) => {
  const normalized = normalizeBlankMarkers(rawModelHtml);
  const audited = auditExamPaper(normalized, opts).html;
  return { normalized, audited };
};

/** 再往下走到 Word：出稿 HTML → document.xml（与真实导出同一条链） */
const toDocXml = async (html, stage) => {
  const container = document.createElement('div');
  container.style.fontSize = '16px';
  container.innerHTML = html;
  document.body.appendChild(container);
  const doc = buildDocxFromDom(container, stage);
  container.remove();
  const buf = await Packer.toBuffer(doc);
  const processed = await injectDrawingML(buf);
  const zip = await JSZip.loadAsync(processed);
  return zip.file('word/document.xml').async('string');
};

describe('全链路验收：写话类（模型给横线 → 链路必须给出作文格）', () => {
  const raw = '<h2>九、看图写话（共1题，共16分）</h2>'
    + '<p>35. 仔细观察图画，写一段话。（16分）</p>'
    + '<p><u class="blank-line">&emsp;</u></p><p><u class="blank-line">&emsp;</u></p>';

  it('① 归一 → ② 校验兜底：出稿 HTML 里出现作文格（程序侧保险）', () => {
    // ⚠️ 越位点（已记录）：作文格"有没有、给几格"本该由模型侧决定；此处是程序侧 2j-5 的**保险**。
    //    模型侧真协议已于本轮补上（layoutSpec compositionLine），模型给对后本保险会自然不触发。
    const { audited } = chain(raw, YW);
    expect(audited, '链路末端仍无作文格 = 写话类无作答载体').toContain('zuo-wen-ge');
  });

  it('③ 导出：作文格真的落成 Word 表格（不是只在 HTML 里）', async () => {
    const { audited } = chain(raw, YW);
    const xml = await toDocXml(audited, 'primary_low');
    expect(xml, '作文格未导出成表格').toContain('<w:tbl>');
    expect((xml.match(/<w:gridCol/g) || []).length, '作文格列数应大于 0').toBeGreaterThan(0);
  });
});

describe('全链路验收：空位宽度（程序侧只许透传，不许代模型定宽）', () => {
  it('模型给 blank-3 → 导出空格数 = N × 手写系数 × 2（与预览同源同值）', async () => {
    const { audited } = chain('<p>1. 水会变成<u class="blank-3">&emsp;</u>。</p>', YW);
    const xml = await toDocXml(audited, 'primary_low');
    // 2026-10-05（手写空间·两端同源）：宽度 = N 字位 × blankWriteScale(stage) em → NBSP(0.5em) = N×S×2。
    //    断言**从同一单源派生**（不写死数值）——若导出端与 blankWriteScale 分叉即红。
    const S = blankWriteScale('primary_low');
    expect(xml, '导出宽度未按 N × 手写系数透传').toContain('\u00A0'.repeat(3 * S * 2));
    expect(xml, '不得再额外放大一倍').not.toContain('\u00A0'.repeat(3 * S * 4));
  });

  it('模型给 blank-2 / blank-5 → 各档位各自透传（宽度随答案长度，不随题序）', async () => {
    const { audited } = chain('<p>1. 甲<u class="blank-2">&emsp;</u>。</p><p>2. 乙<u class="blank-5">&emsp;</u>。</p>', YW);
    const xml = await toDocXml(audited, 'primary_low');
    const S = blankWriteScale('primary_low');
    expect(xml).toContain('\u00A0'.repeat(2 * S * 2));   // 2 档
    expect(xml).toContain('\u00A0'.repeat(5 * S * 2));   // 5 档
  });
});

describe('全链路验收：书写格（模型给了就必须留到最后）', () => {
  it('语文低段：模型给的四线三格不被越界剥；物理卷里塞的田字格必须被剥（同一条链的两个方向）', async () => {
    const ok = chain('<p>1. 看拼音写词语：chí táng<span class="pinyin-line"></span></p>', YW).audited;
    expect(ok, '合法书写格被剥 = 写字题丢格子').toContain('pinyin-line');

    const bad = chain('<p>1. 读一读。<span class="tian-zi-ge"></span></p>', { subject: '物理', stage: 'middle', genType: 'exam' }).audited;
    expect(bad, '越界书写格未被剥').not.toContain('tian-zi-ge');
  });

  it('③ 导出：拼音格落成装饰形状（DrawingML），不是被静默丢弃', async () => {
    const { audited } = chain('<p>1. 看拼音写词语：chí táng<span class="pinyin-line"></span></p>', YW);
    const xml = await toDocXml(audited, 'primary_low');
    expect(xml.length, '导出件为空').toBeGreaterThan(500);
    expect(/w:drawing|w:tbl/.test(xml), '格子既没落成形状也没落成表格 = 导出丢载体').toBe(true);
  });
});
