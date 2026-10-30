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
import { buildDiagramSvg } from '../../src/utils/diagrams/index.js';

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

  // 🔴 2026-10-22（属主："为啥还有字会在框外呢？我们不是自适应了吗？"）：
  //   自适应靠"注入实测 measurer"——必须证明**它真的进到版式里**：量得越宽，图也越宽。
  //   量得不生效时，这条会红（此前只修了思维导图，其它图种的实测没传字重也会出框）。
  it('实测 measurer 真的决定版式：同一内容量得越宽，出图越宽', () => {
    const box = '<div class="k-diagram" data-type="mindmap">{"title":"函数","children":[{"title":"定义域"}]}</div>';
    const widthOf = (html) => Number((html.match(/<svg[^>]*\bwidth="(\d+)"/) || [])[1]);
    const narrow = widthOf(renderDiagramBlocks(box, { measurer: (t, f) => String(t).length * f * 0.5 }).html);
    const wide = widthOf(renderDiagramBlocks(box, { measurer: (t, f) => String(t).length * f * 1.5 }).html);
    expect(narrow).toBeGreaterThan(0);
    expect(wide).toBeGreaterThan(narrow);
  });

  it('括号图/流程图同样吃实测 measurer（它们的字重不同，不得按常规字重量窄）', () => {
    const brace = '<div class="k-diagram" data-type="brace">{"title":"整数与它的分类","children":[{"title":"正整数与零"},{"title":"负整数"}]}</div>';
    // 流程图有"最小框宽"，短标签会被 minBoxWidth 兜住看不出差异 ⇒ 用长标签越过它
    const flow = '<div class="k-diagram" data-type="flow">{"steps":[{"text":"先读题并圈出已知条件","kind":"start"},{"text":"再列式计算并检查","kind":"process"}]}</div>';
    const widthOf = (html) => Number((html.match(/<svg[^>]*\bwidth="(\d+)"/) || [])[1]);
    for (const b of [brace, flow]) {
      const a = widthOf(renderDiagramBlocks(b, { measurer: (t, f) => String(t).length * f * 0.6 }).html);
      const c = widthOf(renderDiagramBlocks(b, { measurer: (t, f) => String(t).length * f * 1.6 }).html);
      expect(c, `实测加宽后图应变宽：${b.slice(0, 40)}`).toBeGreaterThan(a);
    }
  });

  // 🔴 2026-10-22（属主定：A4 版心取 643，且要"按 A4 排版"而不是事后整体缩放）：
  //   超宽时应收窄折行宽度**重排**（字号不变），图宽落回版心内。
  // 🔴 2026-10-30（默认 layout 改为 right）：显式给 raw 指定 balanced——balanced 左右分布会更宽，
  //   这样 fitted（带 fitWidth 版心约束）重排后才会明显收窄、有对比效果。
  it('按 A4 版心（643）重排：宽了收窄折行重排，图宽落回版心内', () => {
    const deep = {
      type: 'mindmap',
      title: '知识梳理',
      children: [{
        title: '一级要点内容',
        children: [{
          title: '二级要点内容',
          children: [{ title: '三级要点内容', children: [{ title: '四级要点内容' }] }],
        }],
      }],
    };
    const raw = buildDiagramSvg(deep, { maxLabelWidth: 150, layout: 'balanced' });
    const fitted = buildDiagramSvg(deep, { maxLabelWidth: 150, fitWidth: PRINT_SAFE_WIDTH });
    expect(fitted.width, '不得超出版心').toBeLessThanOrEqual(PRINT_SAFE_WIDTH);
    expect(fitted.width, '确实发生了重排（不是没生效）').toBeLessThan(raw.width);
    expect(fitted.svg, '仍是完整 SVG').toContain('</svg>');
  });

  // 🔴 2026-10-23（属主真机："真实产出的，有的根本不需要换行而换行了…看着很乱很长"·根因）：
  //   折行宽不是"这一行放不下"，而是**全图一个数**——由"整幅 ≤ 643"二分得出。左右分布把宽度按两侧
  //   各算一次，深一点的树必然把折行宽一路压到 56 ⇒ 自然宽 100–170 的标签被折成 2–5 行。
  //   口径：版式交模型（按内容定）；模型没写时程序按**折行更少**自动选；内容一行放得下就不许折。
  /** 实测口径的近似：汉字 1em、数字/字母 0.55em（浏览器里走 canvas 实测，此处只要单调可比） */
  const m = (t, f) => [...String(t)].reduce((s, ch) => s + (ch.codePointAt(0) > 0x2e80 ? f : f * 0.55), 0);
  const MINDMAP = () => ({
    type: 'mindmap',
    root: {
      title: '分数的意义与性质',
      children: [
        { title: '分数的意义', children: [
          { title: '把单位“1”平均分成若干份，表示这样一份或几份的数' },
          { title: '分数单位' },
          { title: '分数与除法的关系' },
        ] },
        { title: '真分数与假分数', children: [
          { title: '真分数：分子比分母小' },
          { title: '假分数：分子大于或等于分母' },
          { title: '带分数' },
        ] },
        { title: '分数的基本性质', children: [
          { title: '分子分母同乘同除相同的数' },
          { title: '约分' },
          { title: '通分' },
        ] },
      ],
    },
  });

  it('内容一行放得下就不折行：自动改取"折行更少"的版式，且仍不超版心', () => {
    const r = buildDiagramSvg(MINDMAP(), { measurer: m, fitWidth: PRINT_SAFE_WIDTH });
    expect(r.width, '不得超出版心').toBeLessThanOrEqual(PRINT_SAFE_WIDTH);
    // 折行宽本身有上限（版心×0.38 ≈ 244：单个框不占半页）——超过这个宽的长句折行是**有意的**，不算"多折"。
    const CAP = Math.round(PRINT_SAFE_WIDTH * 0.38);
    const wrapped = r.nodes
      .filter((n) => n.lines.length > 1 && m(n.title, n.fs) <= CAP)
      .map((n) => `${n.title}(${n.lines.length}行，自然宽${Math.round(m(n.title, n.fs))})`);
    expect(wrapped, '一行放得下的标签不得被折行').toEqual([]);
  });

  // 🔴 2026-10-23（属主："版式交由模型按内容定"）：模型写了版式就**照办**——折行宽仍按版心自动算，
  //   但版式不因"另一种也许更宽"而被改掉；只有把一行压到不足 ~7 个字（<100px）才兜底换。
  it('版式交模型定：指定 right 就按 right 出图（不在没必要时改观感）', () => {
    const r = buildDiagramSvg({ ...MINDMAP(), layout: 'right' }, { measurer: m, fitWidth: PRINT_SAFE_WIDTH });
    expect(r.layout, '按模型指定的版式').toBe('right');
    expect(r.width).toBeLessThanOrEqual(PRINT_SAFE_WIDTH);
  });

  it('可读性兜底：指定 balanced 会把一行压到 <100px 时才换版式', () => {
    const r = buildDiagramSvg({ ...MINDMAP(), layout: 'balanced' }, { measurer: m, fitWidth: PRINT_SAFE_WIDTH });
    expect(r.layout, '压成窄柱 ⇒ 兜底换向右生长').toBe('right');
    expect(r.width).toBeLessThanOrEqual(PRINT_SAFE_WIDTH);
  });

  it('折行与版式解耦：同一版式下，宽够就不折、宽不够才折（内容决定）', () => {
    const wide = buildDiagramSvg({ ...MINDMAP(), layout: 'right' }, { measurer: m, fitWidth: PRINT_SAFE_WIDTH });
    const tiny = buildDiagramSvg({ ...MINDMAP(), layout: 'right' }, { measurer: m, fitWidth: 320 });
    const count = (r) => r.nodes.reduce((s, n) => s + n.lines.length, 0);
    expect(count(tiny), '版心窄 ⇒ 折行更多').toBeGreaterThan(count(wide));
    expect(wide.layout, '版式不因版心变窄而改').toBe('right');
  });
});
