/**
 * 🧭 思维导图分页单测（2026-10-31 属主："一张 A4 纸放不下怎么办？如何分页显示？"）
 * ============================================================
 * 守三件事：
 *   ① 矮图不分页（不无谓拆图）；
 *   ② 每页高度都 ≤ 单页可容纳高度（Word 行内图片不能跨页，超一点都不行）；
 *   ③ 拆分点只在**分支之间** —— 每一页的一级分支都是完整子树，绝不在框/连线中间切断。
 * 另加一条"无 NaN"巡检：分页会重复走版式计算，任何一次把坐标算坏都立刻现形。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import { buildDiagramSvg, paginateMindmapSpec, PRINT_RASTER_SCALE } from '../../src/utils/diagrams/index.js';
import { paginateDiagramsInHtml } from '../../src/utils/diagramBlock.js';
import { contentWidthPx, diagramPageMaxHeightPx } from '../../src/config/paperPresets.js';

const branch = (i, kids = 3) => ({
  title: `分支${i}：一个需要折行的较长考查点名称`,
  children: Array.from({ length: kids }, (_, k) => ({
    title: `要点${i}-${k}：具体内容与示例说明文字`,
  })),
});

/** 12 条一级分支，体量足够撑满两页以上 */
const TALL = {
  type: 'mindmap',
  root: { title: '单元知识梳理', children: Array.from({ length: 12 }, (_, i) => branch(i)) },
};

const OPTS = { fitWidth: 643, maxHeightPx: 300 };

describe('paginateMindmapSpec · 按一级分支分页', () => {
  it('矮图不分页：返回原规格本身', () => {
    const small = {
      type: 'mindmap',
      root: { title: '小图', children: [{ title: '甲' }, { title: '乙' }] },
    };
    expect(paginateMindmapSpec(small, OPTS)).toEqual([small]);
  });

  it('超高图分成多页，且每页高度都不超过单页上限', () => {
    const pages = paginateMindmapSpec(TALL, OPTS);
    expect(pages.length).toBeGreaterThan(1);
    for (const p of pages) {
      const built = buildDiagramSvg(p, { fitWidth: OPTS.fitWidth });
      expect(built.height, `页高 ${built.height} 超过上限 ${OPTS.maxHeightPx}`).toBeLessThanOrEqual(OPTS.maxHeightPx);
      expect(/NaN/.test(built.svg)).toBe(false);
    }
  });

  it('每页都保留根节点，且一级分支是**完整子树**（不在框/连线中间切断）', () => {
    const pages = paginateMindmapSpec(TALL, OPTS);
    const titles = TALL.root.children.map((c) => c.title);
    const seen = [];
    for (const p of pages) {
      expect(p.root.title).toBe(TALL.root.title);
      expect(p.root.children.length).toBeGreaterThan(0);
      for (const c of p.root.children) {
        const src = TALL.root.children.find((s) => s.title === c.title);
        expect(src, `出现了原图里没有的分支：${c.title}`).toBeTruthy();
        // 整支原样搬过去（子级数量/标题一致）
        expect((c.children || []).map((k) => k.title)).toEqual((src.children || []).map((k) => k.title));
        seen.push(c.title);
      }
    }
    // 全部一级分支都被分到（且各出现一次）
    expect(seen.sort()).toEqual([...titles].sort());
  });

  it('单支自己就超高时下钻拆分，页面的第一级仍是原根、拆分点落到更深一层', () => {
    const huge = branch(0, 14);
    const spec = {
      type: 'mindmap',
      root: { title: '根', children: [huge, { title: '矮支' }] },
    };
    const pages = paginateMindmapSpec(spec, { fitWidth: 643, maxHeightPx: 260 });
    expect(pages.length).toBeGreaterThan(1);
    for (const p of pages) {
      const built = buildDiagramSvg(p, { fitWidth: 643 });
      expect(built.height).toBeLessThanOrEqual(260);
    }
    // 拆分到更深一层：至少有一页的 root.children = [huge]，其 children 只是原 14 个要点的一部分
    const deep = pages.filter((p) => p.root.children.length === 1 && p.root.children[0].title === huge.title);
    expect(deep.length).toBeGreaterThan(0);
    expect((deep[0].root.children[0].children || []).length).toBeLessThan(huge.children.length);
    // 矮支整支落在某一页
    expect(pages.some((p) => p.root.children.some((c) => c.title === '矮支'))).toBe(true);
  });
});

describe('paginateDiagramsInHtml · 导出 HTML 的页间分页符', () => {
  it('超高导图被拆成多个 figure，页间插入分页符；矮图原样不动', () => {
    const tallSvg = buildDiagramSvg(TALL, { fitWidth: 643 }).svg;
    const html = `<figure class="k-diagram-figure" data-k-spec='${JSON.stringify(TALL)}'>${tallSvg}</figure>`;
    const out = paginateDiagramsInHtml(html, OPTS);
    const figCount = (out.match(/<figure/g) || []).length;
    const breakCount = (out.match(/data-page-break/g) || []).length;
    expect(figCount).toBeGreaterThan(1);
    expect(breakCount).toBe(figCount - 1);

    const small = {
      type: 'mindmap',
      root: { title: '小图', children: [{ title: '甲' }] },
    };
    const smallHtml = `<figure class="k-diagram-figure" data-k-spec='${JSON.stringify(small)}'>${buildDiagramSvg(small).svg}</figure>`;
    expect(paginateDiagramsInHtml(smallHtml, OPTS)).toBe(smallHtml);
  });
});
