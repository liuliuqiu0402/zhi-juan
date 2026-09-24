/**
 * 📐 `[GRAPH]` 指令块 → 本图 SVG 单测
 * ============================================================
 * 这一层是"收回 EduRender Studio"的关键接缝：模型早就按 `[GRAPH]` 契约输出（格式见
 * config/eduRenderContract.js），本项目只是从"复制出去出图"改成"就地出图"。
 * 所以测试的重点是**接缝**：真格式能解析、能出图、且**不认识/坏数据必须原样保留**（绝不丢内容）。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { parseGraphDirective, graphDirectiveToSpec, renderGraphBlocks } from '../../src/utils/graphBlock.js';
import { GRAPH_RENDER_ENABLED } from '../../src/config/graphRenderPolicy.js';
import { createDiagramFigureNode } from '../../src/utils/tiptapDiagramFigure.js';
import { SPEC_ATTR, FIGURE_CLASS } from '../../src/utils/diagramBlock.js';

// 取 config/eduRenderContract.js 里的真实骨架写法
const COORD = `[GRAPH]
TYPE:COORDINATE
XLIM:-6,6
YLIM:-1,1
GRID:FALSE
TICK_STEP:1
SERIES:
  sin(x) | COLOR:blue
  x/3 | COLOR:red
[/GRAPH]`;

const SHAPES = `[GRAPH]
TYPE:SHAPES
XLIM:-3,5
YLIM:-5,6
GRID:TRUE
TITLE:二次函数图像
SHAPES:
  FUNCTION:x**2 - 2*x - 3 | COLOR:blue | DOMAIN:-3,5
  POINT:(1,-4) | LABEL:顶点 | COLOR:red
[/GRAPH]`;

const BAR = `[GRAPH]
TYPE:BAR_CHART
DATA:15,22,18,30,25
LABELS:类别甲,类别乙,类别丙,类别丁,类别戊
TITLE:各组数据分布
XLABEL:类别
YLABEL:数量
[/GRAPH]`;

const doc = (block) => `<p>题干</p><p>${block.replace(/\n/g, '<br>')}</p><p>后文</p>`;
/** 指令块在正文里可能被 <br> 切断，这里还原成换行后交给渲染（与线上一致）。
 *  🔴 必须显式传策略：分级开关**默认全关**（未通过对照验收的类型不就地渲染），
 *     不传就会走"原样保留指令文本"的分支，测不出出图能力。 */
const render = (block) => renderGraphBlocks(`<p>题干</p>${block}<p>后文</p>`, { renderPolicy: { enabled: true } });

describe('graphBlock · 指令解析', () => {
  it('键值 + 列表（SHAPES:/SERIES:）解析正确', () => {
    const kv = parseGraphDirective(SHAPES.split('\n').slice(1, -1).join('\n'));
    expect(kv.TYPE).toBe('SHAPES');
    expect(kv.XLIM).toBe('-3,5');
    expect(kv.GRID).toBe('TRUE');
    expect(Array.isArray(kv.SHAPES)).toBe(true);
    expect(kv.SHAPES).toHaveLength(2);
    expect(kv.TITLE).toBe('二次函数图像');
  });

  it('SHAPES → spec：函数/点各自成形，颜色名转十六进制', () => {
    const spec = graphDirectiveToSpec(SHAPES.split('\n').slice(1, -1).join('\n'));
    expect(spec.type).toBe('shapes');
    expect(spec.xlim).toEqual([-3, 5]);
    expect(spec.elements[0]).toMatchObject({ kind: 'function', expr: 'x**2 - 2*x - 3' });
    expect(spec.elements[0].color).toMatch(/^#/);
    expect(spec.elements[1]).toMatchObject({ kind: 'point', x: 1, y: -4, label: '顶点' });
  });

  it('三种统计图各自映射到对应图种', () => {
    const body = BAR.split('\n').slice(1, -1).join('\n');
    expect(graphDirectiveToSpec(body)).toMatchObject({ type: 'barChart', data: [15, 22, 18, 30, 25] });
    expect(graphDirectiveToSpec(body.replace('BAR_CHART', 'LINE_CHART')).type).toBe('lineChart');
    expect(graphDirectiveToSpec(body.replace('BAR_CHART', 'PIE_CHART')).type).toBe('pieChart');
  });

  it('不支持的学科示意图（FORCE/CIRCUIT/…）返回 null（交由调用方原样保留）', () => {
    expect(graphDirectiveToSpec('TYPE:FORCE\nFORCES:\n  a | b')).toBeNull();
  });
});

describe('graphBlock · 就地出图', () => {
  it('坐标系/函数图象：出图且指令文本消失，前后正文保留', () => {
    const r = render(COORD);
    expect(r.count).toBe(1);
    expect(r.failures).toEqual([]);
    expect(r.html).toContain('<svg');
    expect(r.html).not.toContain('[GRAPH]');
    expect(r.html).toContain('题干');
    expect(r.html).toContain('后文');
  });

  it('几何与函数图：出图，且带规格属性（可重画、排版页不丢）', () => {
    const r = render(SHAPES);
    expect(r.count).toBe(1);
    expect(r.html).toContain(SPEC_ATTR);
    expect(r.html).toContain(FIGURE_CLASS);
    expect(r.html).toContain('二次函数图像');
  });

  it('柱状图：出图且分类标签都在', () => {
    const r = render(BAR);
    expect(r.count).toBe(1);
    for (const lb of ['类别甲', '类别丁']) expect(r.html).toContain(lb);
  });

  it('不支持的 TYPE → **原样保留指令文本**并记 failure（绝不丢内容）', () => {
    const force = '[GRAPH]\nTYPE:FORCE\nFORCES:\n  G | 10N\n[/GRAPH]';
    const r = render(force);
    expect(r.count).toBe(0);
    expect(r.failures.length).toBe(1);
    expect(r.failures[0]).toContain('FORCE');
    expect(r.html).toContain('[GRAPH]');
    expect(r.html).toContain('FORCES');
  });

  it('字段不全（统计图无 DATA）→ 原样保留 + failure', () => {
    const r = render('[GRAPH]\nTYPE:PIE_CHART\nLABELS:甲,乙\n[/GRAPH]');
    expect(r.count).toBe(0);
    expect(r.failures.length).toBe(1);
    expect(r.html).toContain('TYPE:PIE_CHART');
  });

  it('没有 [GRAPH] 时一字不改', () => {
    const html = '<p>纯正文</p>';
    const r = renderGraphBlocks(html);
    expect(r.count).toBe(0);
    expect(r.html).toBe(html);
  });

  it('确定性：同输入两次一致', () => {
    expect(render(SHAPES).html).toBe(render(SHAPES).html);
  });

  it('出图字符串里没有 NaN/undefined', () => {
    for (const b of [COORD, SHAPES, BAR]) {
      const { html } = render(b);
      expect(/NaN|undefined/.test(html), `${b.split('\n')[1]} 出图异常`).toBe(false);
    }
  });

  it('接缝闭环：图形指令出的图，进富文本编辑器（排版页）也不丢', () => {
    const html = render(SHAPES).html;
    const ed = new Editor({
      element: document.createElement('div'),
      extensions: [StarterKit, createDiagramFigureNode()],
      content: html,
    });
    const back = ed.getHTML();
    expect(back).toContain('<svg');
    expect(back).toContain(SPEC_ATTR);
    expect(back).toContain('后文');
    ed.destroy();
  });
});

describe('graphBlock · 分级开关（默认全关，验收通过一类开一类）', () => {
  it('默认策略：一律不就地渲染，指令文本原样保留（与从前行为完全一致）', () => {
    expect(GRAPH_RENDER_ENABLED).toBe(false);
    for (const block of [COORD, SHAPES, BAR]) {
      const r = renderGraphBlocks(`<p>题干</p>${block}<p>后文</p>`);   // 不传 policy = 用默认配置
      expect(r.count).toBe(0);
      expect(r.skipped).toBe(1);
      expect(r.failures).toEqual([]);
      expect(r.html).toContain('[GRAPH]');       // 仍可"复制该条"去 EduRender Studio 出图
      expect(r.html).not.toContain('<svg');
    }
  });

  it('只放开某一类：该类出图，其它类型仍原样保留', () => {
    const html = `<p>a</p>${BAR}<p>b</p>${COORD}<p>c</p>`;
    const r = renderGraphBlocks(html, { renderPolicy: { enabled: true, types: ['barChart'] } });
    expect(r.count).toBe(1);
    expect(r.skipped).toBe(1);
    expect(r.html).toContain('<svg');
    expect(r.html).toContain('[GRAPH]');          // 坐标系那条没放开 → 指令仍在
    expect((r.html.match(/\[GRAPH\]/g) || []).length).toBe(1);
  });

  it('未识别的类型（FORCE 等）仍记 failure，与开关无关', () => {
    const r = renderGraphBlocks('<p>[GRAPH]\nTYPE:FORCE\n[/GRAPH]</p>', { renderPolicy: { enabled: true } });
    expect(r.failures.length).toBe(1);
    expect(r.skipped).toBe(0);
  });
});
