/**
 * 🧩 导图在后半段链路上的存活保证
 * ============================================================
 * 导图是**内联 SVG**：前半段（AI 输出 → 导图块 → SVG）已由 diagrams/diagramBlock 单测守住，
 * 但正文之后还要过**内容清洗**（contentCleaner：XSS 剥离、符号归一、AI 围栏剥离）和
 * **校验**（examValidator：`tpl.innerHTML = html` → DOM 操作 → `out = tpl.innerHTML` 的往返序列化）。
 * 这两段是本项目里唯一可能"吃掉"未知元素/属性的地方，所以在此锁死不变量：
 *   过完清洗与 DOM 往返之后，<svg> / viewBox / figure 壳必须原样还在，正文也不许丢。
 * 一旦有人往清洗链路里加了"标签白名单"之类的规则，这里立刻报红。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import { stripXss, normalizeTypographicSymbols, stripAiCodeFence, cleanSectionHtml, wrapBareBlankRuns, normalizeMathCircleBlanks, normalizeLeadingMarkers, ensureCarrierContent, normalizeWhitespaceCarriers, normalizeIndents, normalizeBlankMarkers } from '../../src/utils/contentCleaner.js';
import { normalizeRubyTags } from '../../src/utils/rubyNormalizer.js';
import { buildDiagramSvg } from '../../src/utils/diagrams/index.js';
import { toResponsiveSvg } from '../../src/utils/diagramBlock.js';

const svg = toResponsiveSvg(buildDiagramSvg({
  type: 'mindmap',
  root: { title: '函数的概念与性质', children: [{ title: '定义域' }, { title: '值域' }] },
}).svg);

const FIG = `<figure class="k-diagram-figure" style="margin:12px 0;text-align:center;">${svg}</figure>`;
const DOC = `<h2>知识梳理</h2><p>本节要点如下。</p>${FIG}<p>接续正文。</p>`;

/** 清洗后被重写字符串的各种返回形态（string / { html } / { content }）都兼容 */
const asHtml = (v) => (typeof v === 'string' ? v : (v?.html ?? v?.content ?? ''));

const stillIntact = (out, label) => {
  expect(out, `${label}：导图 svg 丢了`).toContain('<svg');
  expect(out, `${label}：viewBox 丢了（图会被当成空白）`).toContain('viewBox');
  expect(out, `${label}：自适应样式丢了（宽图会撑破 A4 版心）`).toContain('max-width:100%');
  expect(out, `${label}：figure 壳丢了（丢了就不再享受 page-break-inside:avoid）`).toContain('k-diagram-figure');
  expect(out, `${label}：正文丢了`).toContain('接续正文');
};

describe('导图 · 内容清洗链路存活', () => {
  it('stripXss 不误伤导图（它只剥 script/iframe 之类）', () => {
    stillIntact(stripXss(DOC), 'stripXss');
  });

  it('符号归一不误伤导图', () => {
    stillIntact(normalizeTypographicSymbols(DOC), 'normalizeTypographicSymbols');
  });

  it('AI 围栏剥离不误伤导图', () => {
    stillIntact(stripAiCodeFence(DOC), 'stripAiCodeFence');
  });

  it('章节清洗（含 DOM 重写的那一段）不误伤导图', () => {
    stillIntact(asHtml(cleanSectionHtml(DOC)), 'cleanSectionHtml');
  });

  it('DOM 往返序列化（examValidator 的做法：innerHTML → 操作 → innerHTML）不破坏导图', () => {
    const tpl = document.createElement('div');
    tpl.innerHTML = DOC;
    const roundTripped = tpl.innerHTML;
    stillIntact(roundTripped, 'DOM 往返');
    // 属性值必须仍带引号（无引号的属性在部分导出路径上会被截断）
    expect(roundTripped).toMatch(/viewBox="0 0 \d+ \d+"/);
  });

  it('导图块（未渲染的原文）在清洗后也仍在，不会被当成垃圾删掉', () => {
    const raw = '<div class="k-diagram" data-type="mindmap">{"title":"根"}</div>';
    const out = asHtml(cleanSectionHtml(`<p>前</p>${raw}<p>后</p>`));
    expect(out).toContain('k-diagram');
    expect(out).toContain('{"title":"根"}');
  });

  it('排版编辑器载入前预处理链（按 prepareHtmlForLoad 的真实顺序复刻）不误伤导图', () => {
    // RichTextEditor.prepareHtmlForLoad 的同一批归一化，顺序按该函数由内到外。
    // 注：其中"短十六进制色/class→内联样式/双编号列表"三个归一化未对外导出，无法在此直调，
    //     由本文件上面的 DOM 往返用例 + tiptapDiagramFigure 的真编辑器往返用例共同覆盖。
    const chain = [
      normalizeWhitespaceCarriers, normalizeMathCircleBlanks, normalizeLeadingMarkers,
      normalizeRubyTags, ensureCarrierContent, wrapBareBlankRuns,
      normalizeIndents, normalizeBlankMarkers, stripXss,
    ];
    let out = DOC;
    for (const fn of chain) {
      const r = fn(out);
      if (typeof r === 'string') out = r;   // 返回非字符串（对象/undefined）时按"未改动"处理
    }
    stillIntact(out, '载入前预处理链');
  });
});
