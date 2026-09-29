/**
 * 书写载体·手动插入：单一源与形态契约守卫
 *
 * 为什么有这条：
 *   ① 两个插入模块曾因"只被点按钮时动态加载"而躲过测试（`getMergedSpec` 路径写错仍全绿）；
 *   ② 手动产物**走在生成链路之外**，不受 2j-5 系列（相邻性/位置）保护 → 形态错就是错了，
 *      实测教训：格类写成 `<div>` → 不能混排、导出成独立行居中。故此处按**行内/块级**分别钉死。
 *
 * 断言口径：不写死规格库数值（只校验关系）；形态按取证结果断言标签与结构。
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { buildZuoWenGridHtml, zuowenCellsForStage, hasZuoWenGrid } from '../../src/utils/zuoWenGrid';
import { CARRIER_INSERTS, CARRIER_INSERT_IDS, buildCarrierHtml, hasCarrierClass } from '../../src/utils/carrierInsert';
import { getMergedSpec } from '../../src/config/layoutSpec.js';

const sr = (p) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');

/** 行内载体：可混排（不得用块级容器） */
const INLINE_IDS = ['tian-zi-ge', 'mi-zi-ge', 'four-line-three', 'sixian-ge', 'pinyin-line',
  'blank-underline', 'blank-paren', 'square-box', 'math-circle-blank', 'oral-box'];
/** 块级作答区：本身独占空间，不是书写格 */
const BLOCK_IDS = ['blank-line', 'blank-area', 'bracket-grid', 'square-grid', 'draw-area'];

describe('模块可达性：插入模块必须能被静态加载（防"动态加载坏掉不红"）', () => {
  it('两个模块均可 import 且导出齐备', () => {
    expect(typeof buildZuoWenGridHtml).toBe('function');
    expect(typeof buildCarrierHtml).toBe('function');
    expect(CARRIER_INSERT_IDS.length).toBeGreaterThanOrEqual(14);
  });

  it('编辑器工具栏确实引用了这两个单一源（防接线被移除/改回）', () => {
    const src = sr('src/components/RichTextEditor.vue');
    expect(src, '编辑器应引用 zuoWenGrid 单一源').toContain('utils/zuoWenGrid');
    expect(src, '编辑器应引用 carrierInsert 单一源').toContain('utils/carrierInsert');
    expect(src, '应有作文格插入入口').toContain('insertZuoWenGrid');
    expect(src, '应有书写载体插入入口').toContain('insertCarrier');
  });

  it('不得使用 window.prompt / window.alert（Electron 运行时不支持）', () => {
    const src = sr('src/components/RichTextEditor.vue');
    expect(src, 'prompt 在 Electron 不受支持').not.toMatch(/window\.prompt\s*\(/);
    expect(src, 'alert 同源风险，改用内联面板').not.toMatch(/window\.alert\s*\(/);
    expect(src, '长度输入必须走内联面板').toContain('carrierPanel');
  });
});

describe('形态契约·行内类：必须能混排（不得出现块级容器）', () => {
  it('格类 = 行内单格 <span class="X">&emsp;</span>，一格一元素', () => {
    for (const id of ['tian-zi-ge', 'mi-zi-ge', 'four-line-three', 'sixian-ge', 'pinyin-line']) {
      const h = buildCarrierHtml(id, 3);
      expect(h, `${id} 不得块级（会不能混排、导出独立行居中）`).not.toContain('<div');
      expect(h, `${id} 应为行内单格`).toBe(`<span class="${id}">&emsp;</span>`.repeat(3));
    }
  });

  it('横线空位 = <u class="blank-N">；括号空位 = <span class="blank-N">（同 class 不同标签）', () => {
    const u = buildCarrierHtml('blank-underline', 5);
    const p = buildCarrierHtml('blank-paren', 5);
    expect(u).toMatch(/^<u class="blank-\d+">&emsp;<\/u>$/);
    expect(p).toMatch(/^<span class="blank-\d+">&emsp;<\/span>$/);
    expect(hasCarrierClass(u, 'blank-underline')).toBe(true);
    expect(hasCarrierClass(p, 'blank-paren')).toBe(true);
  });

  it('数学方框 / 填空圈 = 行内 1.8em 等边容器', () => {
    expect(buildCarrierHtml('square-box', 2)).toBe('<span class="square-box">　</span>'.repeat(2));
    expect(buildCarrierHtml('math-circle-blank', 1)).toContain('class="math-circle-blank-18"');
  });

  it('目录内**所有**行内载体均不得含块级容器', () => {
    for (const id of INLINE_IDS) {
      expect(buildCarrierHtml(id, 2), `${id} 应为行内`).not.toMatch(/<(div|p)\b/);
    }
  });
});

describe('形态契约·块级类：整块作答区应当独占空间', () => {
  it('整行横线 = <p><span class="blank-line">…</span></p>（不是 p.blank-line）', () => {
    const h = buildCarrierHtml('blank-line', 2);
    expect(h).toContain('<p><span class="blank-line">');
    expect((h.match(/blank-line/g) || []).length).toBe(2);
  });

  it('留白行带 height:Xmm；空盒类为空格+class（draw-area 必须保留 style 高度）', () => {
    expect(buildCarrierHtml('blank-area', 10)).toContain('class="blank-area"');
    expect(buildCarrierHtml('blank-area', 10)).toContain('height:10mm');
    const d = buildCarrierHtml('draw-area', 30);
    expect(d).toContain('min-height:30mm');
    expect(d.replace(/<[^>]+>/g, '').trim(), '空盒不得含文本').toBe('');
  });

  it('块级清单与 inline 标记一致（防形态与标记漂移）', () => {
    for (const id of BLOCK_IDS) expect(CARRIER_INSERTS[id].inline, id).toBe(false);
    for (const id of INLINE_IDS) expect(CARRIER_INSERTS[id].inline, id).toBe(true);
  });
});

describe('长度口径：一律读规格库（只校验关系）', () => {
  it('空位档位受 BLANK.minBlank / maxBlank 约束（两端口径同源）', () => {
    const b = (getMergedSpec() || {}).BLANK || {};
    const lo = Number(b.minBlank) || 1;
    const cap = Number(b.maxBlank) || 8;
    expect(buildCarrierHtml('blank-underline', 0)).toMatch(new RegExp(`blank-${lo}"`));
    expect(buildCarrierHtml('blank-paren', 999)).toMatch(new RegExp(`blank-${cap}"`));
  });

  it('作文格格数 = max(规格库兜底, 分值×每分格数[学段])', () => {
    const spec = getMergedSpec() || {};
    const base = Number(spec.ZUOWEN_FILL_CELLS) || 160;
    const perLow = (spec.ZUOWEN_CELLS_PER_SCORE || {}).primary_low || 10;
    expect(zuowenCellsForStage('', 0)).toBe(base);
    expect(zuowenCellsForStage('primary_low', 10)).toBe(Math.max(base, 10 * perLow));
  });

  it('作文格形态与判据自洽', () => {
    const h = buildZuoWenGridHtml({ cells: 4 });
    expect(h).toContain('class="zuo-wen-ge"');
    expect(hasZuoWenGrid(h)).toBe(true);
    expect((h.match(/<span>&emsp;<\/span>/g) || []).length).toBe(4);
  });
});

describe('连线题与遗留类：按取证口径处理', () => {
  it('match-question 不列入插入目录（需项内容，空壳无意义）——改由"打乱右列"手动操作支持', () => {
    for (const id of ['match-question', 'match-item']) {
      expect(CARRIER_INSERT_IDS, `${id} 不插入：需项内容，空壳在编辑器中无意义`).not.toContain(id);
    }
  });

  it('english-line 不列入（遗留字体类·不画格线，独立格线用 four-line-three/sixian-ge）', () => {
    expect(CARRIER_INSERT_IDS).not.toContain('english-line');
  });
});
