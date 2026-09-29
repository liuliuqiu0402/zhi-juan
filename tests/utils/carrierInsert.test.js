/**
 * 书写载体·手动插入：单一源与形态契约守卫
 *
 * 为什么有这条（2026-09-29 实错）：
 *   两个插入模块（zuoWenGrid / carrierInsert）此前**只被"点按钮时动态加载"**，
 *   测试路径走不到 → 其中 `getMergedSpec` 导入路径写错（写成 './specAccess'）**全量测试仍全绿**，
 *   直到另一处改成静态 import 才暴露。本文件以**静态 import + 形态契约断言**把这个洞堵上。
 *
 * 断言口径：
 *   · 不写死规格库数值（格数/档位一律从运行时规格库读取后校验**关系**）；
 *   · 形态按取证结果断言 class 与标签结构（改了形态即转红，防"插了不显示/导出丢"）。
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { buildZuoWenGridHtml, zuowenCellsForStage, hasZuoWenGrid } from '../../src/utils/zuoWenGrid';
import { CARRIER_INSERTS, CARRIER_INSERT_IDS, buildCarrierHtml, hasCarrierClass } from '../../src/utils/carrierInsert';
import { getMergedSpec } from '../../src/config/layoutSpec.js';

const sr = (p) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');

describe('模块可达性：插入模块必须能被静态加载（防"动态加载坏掉不红"）', () => {
  it('两个模块均可 import 且导出齐备', () => {
    expect(typeof buildZuoWenGridHtml).toBe('function');
    expect(typeof buildCarrierHtml).toBe('function');
    expect(CARRIER_INSERT_IDS.length).toBeGreaterThanOrEqual(7);
  });

  it('编辑器工具栏确实引用了这两个单一源（防接线被移除/改回）', () => {
    const src = sr('src/components/RichTextEditor.vue');
    expect(src, '编辑器应引用 zuoWenGrid 单一源').toContain("utils/zuoWenGrid");
    expect(src, '编辑器应引用 carrierInsert 单一源').toContain("utils/carrierInsert");
    expect(src, '应有作文格插入入口').toContain('insertZuoWenGrid');
    expect(src, '应有书写载体插入入口').toContain('insertCarrier');
  });
});

describe('形态契约：插入的 HTML 必须与渲染/导出端认的形态一致', () => {
  it('整行横线 = <p><span class="blank-line">…</span></p>（不是 p.blank-line）', () => {
    const h = buildCarrierHtml('blank-line', 2);
    expect(h).toContain('<p><span class="blank-line">');
    expect((h.match(/blank-line/g) || []).length).toBe(2);
  });

  it('留白行 = <p class="blank-area" style="height:Xmm">（导出侧认它）', () => {
    const h = buildCarrierHtml('blank-area', 10);
    expect(h).toContain('class="blank-area"');
    expect(h).toContain('height:10mm');
  });

  it('空位 = <u class="blank-N">&emsp;</u>', () => {
    const h = buildCarrierHtml('blank', 5);
    expect(h).toMatch(/^<u class="blank-\d+">&emsp;<\/u>$/);
  });

  it('格类 = <div class="X"><span>&emsp;</span>×N</div>（按 span 计格）', () => {
    for (const id of ['tian-zi-ge', 'mi-zi-ge', 'four-line-three', 'sixian-ge']) {
      const h = buildCarrierHtml(id, 3);
      expect(h, id).toContain(`class="${id}"`);
      expect((h.match(/<span>&emsp;<\/span>/g) || []).length, id).toBe(3);
    }
  });

  it('作文格 = <div class="zuo-wen-ge">…</div>，且与 hasZuoWenGrid 判据自洽', () => {
    const h = buildZuoWenGridHtml({ cells: 4 });
    expect(h).toContain('class="zuo-wen-ge"');
    expect(hasZuoWenGrid(h)).toBe(true);
    expect((h.match(/<span>&emsp;<\/span>/g) || []).length).toBe(4);
  });

  it('拼音格 = 行内单格 <span class="pinyin-line">×N（非 div 包 span）', () => {
    const h = buildCarrierHtml('pinyin-line', 3);
    expect(h).not.toContain('<div');
    expect((h.match(/<span class="pinyin-line">&emsp;<\/span>/g) || []).length).toBe(3);
  });

  it('english-line 不得作为可插入载体（遗留字体类·不画格线）', () => {
    expect(CARRIER_INSERT_IDS, '插入目录不得含 english-line').not.toContain('english-line');
  });

  it('空盒类必须是空 div（draw-area 保留 style 高度）', () => {
    const d = buildCarrierHtml('draw-area', 30);
    expect(d).toContain('class="draw-area"');
    expect(d).toContain('min-height:30mm');
    expect(d.replace(/<[^>]+>/g, '').trim(), '空盒不得含文本').toBe('');
  });
});

describe('长度口径：一律读规格库（不写死数值，只校验关系）', () => {
  it('空位档位受 BLANK.minBlank / maxBlank 约束', () => {
    const spec = getMergedSpec() || {};
    const lo = Number((spec.BLANK || {}).minBlank) || 1;
    const cap = Number((spec.BLANK || {}).maxBlank) || 8;
    expect(buildCarrierHtml('blank', 0)).toMatch(new RegExp(`blank-${lo}"`));
    expect(buildCarrierHtml('blank', 999)).toMatch(new RegExp(`blank-${cap}"`));
  });

  it('作文格格数 = max(规格库兜底, 分值×每分格数[学段])', () => {
    const spec = getMergedSpec() || {};
    const base = Number(spec.ZUOWEN_FILL_CELLS) || 160;
    const perLow = (spec.ZUOWEN_CELLS_PER_SCORE || {}).primary_low || 10;
    expect(zuowenCellsForStage('', 0)).toBe(base);
    expect(zuowenCellsForStage('primary_low', 10)).toBe(Math.max(base, 10 * perLow));
  });

  it('同类载体判据可用于"防重复 / 同类择一"', () => {
    expect(hasCarrierClass('<p><span class="blank-line">　</span></p>', 'blank-line')).toBe(true);
    expect(hasCarrierClass('<div class="zuo-wen-ge"></div>', 'blank-line')).toBe(false);
    expect(hasCarrierClass('<u class="blank-6">&emsp;</u>', 'blank')).toBe(true);
  });
});
