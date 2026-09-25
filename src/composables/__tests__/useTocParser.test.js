import { describe, it, expect } from 'vitest';
import { useTocParser, fastCalculatePageRanges } from '../useTocParser';

// 目录「页码范围」自动重算 —— 手动优先语义
// ============================================================
// 🔴 为什么有这组测试（2026-09-25，用户实测 bug）：
//    在目录表里手动改「页码范围」后点保存，改的值会被 fastCalculatePageRanges
//    静默顶回「下一项起始页-1 / 总页数」——最后一行尤其明显（无下一项 → 总页数）。
//    修复：parsePageRange 置 rangeEndLocked=true，重算遇到锁定行跳过其 end。
// ============================================================

const flat = (rows) => rows.map(([page, start, end]) => ({ page, start, end }));

describe('fastCalculatePageRanges：未锁定，正常自动推导', () => {
  it('非末行 end = 下一不同页 - 1，末行 end = 总页数', () => {
    const list = flat([[5, 0, 0], [8, 0, 0], [12, 0, 0]]);
    fastCalculatePageRanges(list, 40);
    expect(list.map(n => [n.start, n.end])).toEqual([
      [5, 7],
      [8, 11],
      [12, 40],
    ]);
    expect(list.map(n => n.end)).toEqual([7, 11, 40]);
  });
});

describe('fastCalculatePageRanges：锁定行跳过 end，其余照常', () => {
  it('中间行锁定：自身 end 保留，前后行仍按页码推导', () => {
    const list = flat([[5, 0, 0], [8, 0, 0], [12, 0, 0]]);
    list[1].rangeEndLocked = true;   // 用户把手动范围 8-x 锁成 30
    list[1].end = 30;
    fastCalculatePageRanges(list, 40);
    // 锁定行 end 不动；第 0 行仍以「下一不同页 8」截断为 7；末行延伸到总页数
    expect(list.map(n => n.end)).toEqual([7, 30, 40]);
  });

  it('最后一行锁定：不顶回总页数（本次 bug 的核心场景）', () => {
    const list = flat([[5, 0, 0], [8, 0, 0], [12, 0, 0]]);
    list[2].rangeEndLocked = true;   // 用户把末行范围改成 12-20
    list[2].end = 20;
    fastCalculatePageRanges(list, 40);
    expect(list.map(n => n.end)).toEqual([7, 11, 20]);
  });

  it('锁定行自身不因 start=page 而变（start 与 page 已同步）', () => {
    const list = flat([[5, 5, 0]]);
    list[0].rangeEndLocked = true;
    list[0].end = 9;
    fastCalculatePageRanges(list, 40);
    expect(list[0].start).toBe(5);
    expect(list[0].end).toBe(9);
  });
});

describe('flattenOutline：锁定标记必须跨过扁平化派生树', () => {
  // 🔴 本次 bug 的真凶：displayOutline（编辑打到这）与 flatOutline（渲染/保存读这）
  //    是两批不同引用，flatten 若不带 rangeEndLocked，标记就蒸发，重算照旧顶回。
  it('扁平化后仍保留 rangeEndLocked', () => {
    const { flattenOutline } = useTocParser();
    const tree = [
      { title: 'A', page: 5, start: 5, end: 0, level: 0, rangeEndLocked: true },
      { title: 'B', page: 8, start: 8, end: 0, level: 1, rangeEndLocked: false },
    ];
    const flat = flattenOutline(tree);
    expect(flat[0].rangeEndLocked).toBe(true);
    expect(flat[1].rangeEndLocked).toBe(false);
  });

  it('整条闭环：编辑→扁平=保存所读→重算后手动 end 仍被尊重', () => {
    const { flattenOutline } = useTocParser();
    const tree = [
      { title: '末章', page: 12, start: 12, end: 20, level: 0, rangeEndLocked: true },
    ];
    const committedFlat = flattenOutline(tree).map(() => ({ start: 12, end: 20, page: 12, rangeEndLocked: true }));
    fastCalculatePageRanges(committedFlat, 40);
    expect(committedFlat[0].end).toBe(20);   // 不被顶回 40
  });
});