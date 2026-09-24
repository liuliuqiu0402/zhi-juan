/**
 * 🧩 导图块单测
 * ============================================================
 * 这一层的风险不在几何（已在 diagrams 各图种单测里守住），而在**接入安全**：
 * 模型不按约定输出时，绝不能把内容弄丢 —— 所以这里重点测"失败必须原样保留"。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  renderDiagramBlocks, parseDiagramBlock, toResponsiveSvg, DIAGRAM_BLOCK_CLASS,
  printReadabilityWarning, PRINT_WARN_WIDTH, PRINT_SAFE_WIDTH, PRINT_MIN_SCALE,
} from '../../src/utils/diagramBlock.js';

const OK_BLOCK = '<div class="k-diagram" data-type="mindmap" data-layout="balanced">'
  + '{"title":"函数的概念","children":[{"title":"定义域"},{"title":"值域"}]}'
  + '</div>';

describe('diagramBlock · 标记块渲染', () => {
  it('没有导图块时，HTML 一字不改', () => {
    const html = '<p>正文</p><ul><li>要点</li></ul>';
    const r = renderDiagramBlocks(html);
    expect(r.count).toBe(0);
    expect(r.failures).toEqual([]);
    expect(r.html).toBe(html);
  });

  it('合法块 → 内联 SVG，且原标记块被替换掉', () => {
    const r = renderDiagramBlocks(`<p>知识梳理：</p>${OK_BLOCK}<p>接续正文</p>`);
    expect(r.count).toBe(1);
    expect(r.failures).toEqual([]);
    expect(r.html).toContain('<svg');
    expect(r.html).toContain('函数的概念');
    expect(r.html).not.toContain(`class="${DIAGRAM_BLOCK_CLASS}"`);   // 原标记块已消失（新壳是 k-diagram-figure）
    expect(r.html).toContain('k-diagram-figure');
    // 前后正文必须还在
    expect(r.html).toContain('知识梳理：');
    expect(r.html).toContain('接续正文');
  });

  it('SVG 被加上自适应样式（矢量缩放，A4 版心内不撑破）', () => {
    const r = renderDiagramBlocks(OK_BLOCK);
    expect(r.html).toContain('max-width:100%');
    expect(toResponsiveSvg('<svg width="10" height="10"/>')).toContain('style="max-width:100%;height:auto"');
  });

  it('包在 ```json 围栏里的内容也能解析（模型常这么写）', () => {
    const block = `<div class="k-diagram" data-type="fishbone">\n\`\`\`json\n`
      + '{"effect":"误差偏大","categories":[{"name":"人","causes":["读数不规范"]}]}'
      + '\n```\n</div>';
    const r = renderDiagramBlocks(block);
    expect(r.count).toBe(1);
    expect(r.html).toContain('误差偏大');
  });

  it('JSON 坏了 → **原块原样保留**并记 failure（绝不删内容）', () => {
    const bad = '<div class="k-diagram" data-type="mindmap">{不是合法JSON}</div>';
    const r = renderDiagramBlocks(bad);
    expect(r.count).toBe(0);
    expect(r.failures.length).toBe(1);
    expect(r.failures[0]).toContain('JSON');
    expect(r.html).toContain(DIAGRAM_BLOCK_CLASS);
    expect(r.html).toContain('{不是合法JSON}');
  });

  it('未知图种 → 保留原块 + failure（不误判成思维导图）', () => {
    const r = renderDiagramBlocks('<div class="k-diagram" data-type="radar">{"a":1}</div>');
    expect(r.count).toBe(0);
    expect(r.failures[0]).toContain('radar');
    expect(r.html).toContain('k-diagram');
  });

  it('data-layout 生效（两种思维导图版式出图尺寸不同）', () => {
    const tree = '{"title":"根","children":[{"title":"一"},{"title":"二"},{"title":"三"},{"title":"四"}]}';
    const a = renderDiagramBlocks(`<div class="k-diagram" data-type="mindmap" data-layout="balanced">${tree}</div>`);
    const b = renderDiagramBlocks(`<div class="k-diagram" data-type="mindmap" data-layout="right">${tree}</div>`);
    const wh = (h) => (h.match(/viewBox="0 0 (\d+) (\d+)"/) || []).slice(1).join('x');
    expect(wh(a.html)).not.toBe(wh(b.html));
  });

  it('多个块一次全渲染', () => {
    const two = OK_BLOCK + '<p>中间</p>' + '<div class="k-diagram" data-type="timeline">'
      + '{"items":[{"when":"1919年","text":"五四运动"}]}</div>';
    const r = renderDiagramBlocks(two);
    expect(r.count).toBe(2);
    expect(r.html).toContain('中间');
    expect(r.html.match(/<svg/g).length).toBe(2);
  });

  it('parseDiagramBlock 直接可用：默认图种与空内容兜底', () => {
    expect(parseDiagramBlock('{"title":"x"}').type).toBe('mindmap');
    expect(parseDiagramBlock('', {}).error).toContain('空');
    expect(parseDiagramBlock('{"title":"x"}', { type: 'timeline' }).spec.type).toBe('timeline');
  });

  it('印刷可读性告警按**缩放比**判定：只超版心几个像素不算问题，缩得太狠才报', () => {
    // ① 判据边界（纯函数直接断言，不必去凑恰好临界宽度的图）
    //    🔴 实证回归：真实生成的一张思维导图宽 764px（仅超版心 4px）→ 缩到 0.99 倍、字约 9.7pt，
    //    完全能印，旧阈值（宽 > 760 即报）却报了"印出来可能偏小"，属噪音。
    expect(PRINT_WARN_WIDTH).toBe(Math.round(PRINT_SAFE_WIDTH / PRINT_MIN_SCALE)); // 950
    expect(printReadabilityWarning(764, '思维导图')).toBe('');                        // 实证误报用例：不该报
    expect(printReadabilityWarning(PRINT_SAFE_WIDTH, '思维导图')).toBe('');          // 恰在版心
    expect(printReadabilityWarning(PRINT_WARN_WIDTH, '思维导图')).toBe('');          // 恰在告警线
    const warn = printReadabilityWarning(PRINT_WARN_WIDTH + 1, '时间轴');
    expect(warn).toContain('时间轴');
    expect(warn).toContain('版心');
    expect(warn).toContain('倍');                                                    // 必须给出"缩到几倍"

    // ② 端到端：真出一张超宽图 → 有告警；窄图不告警
    const items = Array.from({ length: 16 }, (_, i) => `{"when":"19${i}年","text":"事件${i}"}`).join(',');
    const wide = renderDiagramBlocks(`<div class="k-diagram" data-type="timeline">{"items":[${items}]}</div>`);
    expect(wide.count).toBe(1);
    expect(wide.warnings.length).toBe(1);
    expect(wide.warnings[0]).toContain('时间轴');
    expect(wide.warnings[0]).toContain('版心');

    const narrow = renderDiagramBlocks(OK_BLOCK);
    expect(narrow.warnings).toEqual([]);
  });

  // 🔴 核验脚本（scripts/verify-diagram-export.mjs）为了能裸 node 跑而**不 import 项目模块**，
  //    阈值只能各写一份 → 天然会漂移。这里比对两处常量：改一边忘另一边立刻红
  //    （曾真实发生：修好本模块的 760→950 判据后，脚本里仍是"超 760 即报"，会对同一张图给出相反结论）。
  it('核验脚本的印刷阈值与本模块同源（防两套口径漂移）', () => {
    const src = readFileSync(path.join(process.cwd(), 'scripts', 'verify-diagram-export.mjs'), 'utf8');
    expect(src).toContain(`const PRINT_SAFE_WIDTH = ${PRINT_SAFE_WIDTH};`);
    expect(src).toContain(`const PRINT_MIN_SCALE = ${PRINT_MIN_SCALE};`);
    expect(src).toContain('const PRINT_WARN_WIDTH = Math.round(PRINT_SAFE_WIDTH / PRINT_MIN_SCALE);');
  });
});
