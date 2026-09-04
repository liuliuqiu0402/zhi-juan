// 指令同旧句批量同步（instructionSync）测试
// ============================================================
// 🔴 目的：锁定"行级 diff 1:1 配对 + 跨库扫描 + 替换"契约，纯函数不改库。
import { describe, it, expect } from 'vitest';
import { diffOldNewLines, scanSyncTargets, applySyncReplace, groupSyncHitsByLib } from '../../src/utils/instructionSync.js';

describe('diffOldNewLines：行级 diff 配对', () => {
  it('单行替换 → 1:1 行对（旧行→新行）', () => {
    const oldT = '你是命题专家。\n· 作答书写载体：旧句甲\n· 另一行不变';
    const newT = '你是命题专家。\n· 作答书写载体：新句乙\n· 另一行不变';
    const { pairs, unbalanced } = diffOldNewLines(oldT, newT);
    expect(unbalanced).toEqual([]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].old).toBe('· 作答书写载体：旧句甲');
    expect(pairs[0].next).toBe('· 作答书写载体：新句乙');
  });

  it('多行同时替换 → 按出现顺序 1:1 配对', () => {
    const oldT = '行1\n行A\n行2\n行B';
    const newT = '行1\n行C\n行2\n行D';
    const { pairs } = diffOldNewLines(oldT, newT);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]).toEqual({ old: '行A', next: '行C' });
    expect(pairs[1]).toEqual({ old: '行B', next: '行D' });
  });

  it('增删行数不等 → pairs 为空（不自动替换），unbalanced 记录被删行', () => {
    const { pairs, unbalanced } = diffOldNewLines('行1\n行A\n行2', '行1\n行2\n行C\n行D');
    expect(pairs).toEqual([]);
    expect(unbalanced).toEqual(['行A']);
  });

  it('仅新增/仅删除 → 不产生自动替换对', () => {
    expect(diffOldNewLines('行1', '行1\n行2').pairs).toEqual([]);
    expect(diffOldNewLines('行1\n行2', '行1').pairs).toEqual([]);
  });

  it('空行忽略、无实质改动 → pairs 空', () => {
    expect(diffOldNewLines('行1\n\n行2', '行1\n\n行2').pairs).toEqual([]);
    expect(diffOldNewLines('', '').pairs).toEqual([]);
  });
});

describe('scanSyncTargets / applySyncReplace / groupSyncHitsByLib', () => {
  const targets = [
    { lib: 'instruction', key: 'k1', name: '语文低段 exam', text: '· 作答书写载体：旧句甲\n模板A' },
    { lib: 'instruction', key: 'k2', name: '数学 exam', text: '模板B（无旧句）' },
    { lib: 'rules', key: 'r1', name: '分值校验', text: '附注：旧句甲 需核对' },
  ];

  it('扫描：命中含旧句的条目（同条目多对分别列出），无命中为空', () => {
    const pairs = [{ old: '旧句甲', next: '新句乙' }, { old: '不存在', next: 'x' }];
    const hits = scanSyncTargets(targets, pairs);
    expect(hits).toHaveLength(2);
    expect(hits.map((h) => h.key)).toEqual(['k1', 'r1']);
    expect(scanSyncTargets(targets, [])).toEqual([]);
  });

  it('按库分组：指令库与规则库分开展示', () => {
    const pairs = [{ old: '旧句甲', next: '新句乙' }];
    const groups = groupSyncHitsByLib(scanSyncTargets(targets, pairs));
    expect(groups.map((g) => g.lib)).toEqual(['instruction', 'rules']);
    expect(groups[0].items).toHaveLength(1);
    expect(groups[0].items[0].key).toBe('k1');
  });

  it('替换：文本中旧句全部替换为新句；不含旧句原样返回', () => {
    expect(applySyncReplace('旧句甲 与 旧句甲', '旧句甲', '新句乙')).toBe('新句乙 与 新句乙');
    expect(applySyncReplace('不含', '旧句甲', '新句乙')).toBe('不含');
  });
});
