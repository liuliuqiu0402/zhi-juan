/**
 * 🧩 导图规格编辑纯函数单测（2026-10-22 属主："模型生成的内容如果错了，可以改"）
 * 这些函数是"编辑面板"的全部逻辑（改文字/增删/上下移/换图种），**不可变**、可单测。
 */
import { describe, it, expect } from 'vitest';
import {
  collectEntries, setTextAt, removeAt, addChildAt, moveNode, changeTreeType,
} from '../../src/utils/diagramSpecEdit.js';

const MM = {
  type: 'mindmap',
  title: '分数',
  children: [
    { title: '意义', children: [{ title: '把一个整体平均分' }] },
    { title: '计算', children: [] },
  ],
};

describe('diagramSpecEdit · 树形（思维导图/括号图）', () => {
  it('摊平：根 + 子项都带可定位路径与层级', () => {
    const es = collectEntries(MM);
    expect(es.map((e) => e.text)).toEqual(['分数', '意义', '把一个整体平均分', '计算']);
    expect(es[0].path).toEqual([]);
    expect(es[0].role).toBe('root');
    expect(es[0].removable).toBe(false);
    expect(es[2].path).toEqual(['children', 0, 'children', 0]);
    expect(es[2].depth).toBe(2);
    expect(es[1].addable).toBe(true);
  });

  it('改文字：不可变，原对象不被改', () => {
    const next = setTextAt(MM, ['children', 1, 'title'], '运算');
    expect(next.children[1].title).toBe('运算');
    expect(MM.children[1].title).toBe('计算');
    expect(next).not.toBe(MM);
  });

  it('删除子项；删根无效（根没有数组下标）', () => {
    const next = removeAt(MM, ['children', 1]);
    expect(next.children.map((c) => c.title)).toEqual(['意义']);
    expect(removeAt(MM, [])).toBeNull();
    expect(MM.children.length).toBe(2);
  });

  it('加子项：挂在该节点下；非树形图种返回 null', () => {
    const next = addChildAt(MM, ['children', 1], '通分');
    expect(next.children[1].children.map((c) => c.title)).toEqual(['通分']);
    expect(addChildAt({ type: 'timeline', items: [] }, [], 'x')).toBeNull();
  });

  it('上下移动：边界不动', () => {
    const up = moveNode(MM, ['children', 1], -1);
    expect(up.children.map((c) => c.title)).toEqual(['计算', '意义']);
    expect(moveNode(MM, ['children', 0], -1)).toBeNull();
    expect(moveNode(MM, ['children', 1], 1)).toBeNull();
  });

  it('换图种：mindmap ↔ brace 互转；跨类返回 null', () => {
    expect(changeTreeType(MM, 'brace').type).toBe('brace');
    expect(changeTreeType(MM, 'flow')).toBeNull();
    expect(changeTreeType({ type: 'timeline', items: [] }, 'mindmap')).toBeNull();
  });
});

describe('diagramSpecEdit · 其它图种（逐条改文字）', () => {
  it('时间轴：列出各条的 text', () => {
    const es = collectEntries({ type: 'timeline', items: [{ when: '1900', text: '甲' }, { when: '1901', text: '乙' }] });
    expect(es.map((e) => e.text)).toEqual(['甲', '乙']);
    expect(es[0].path).toEqual(['items', 0, 'text']);
    expect(es[0].removable).toBe(true);
    expect(es[0].addable).toBe(false);
  });

  it('鱼骨图：结果 + 分类名 + 原因', () => {
    const es = collectEntries({ type: 'fishbone', effect: '成绩下降', categories: [{ name: '方法', causes: ['不复习'] }] });
    expect(es.map((e) => e.text)).toEqual(['成绩下降', '方法', '不复习']);
    expect(es[0].removable).toBe(false);
  });

  it('流程图与概念图：文字都能列出来定位', () => {
    const flow = collectEntries({ type: 'flow', steps: [{ text: '开始', kind: 'start' }, { text: '判断', kind: 'decision', branches: [{ label: '是', steps: [{ text: '结束' }] }] }] });
    expect(flow.map((e) => e.text)).toEqual(['开始', '判断', '结束']);
    const concept = collectEntries({ type: 'concept', nodes: [{ id: 'a', text: '甲' }], links: [{ from: 'a', to: 'a', label: '属于' }] });
    expect(concept.map((e) => e.text)).toEqual(['甲', '属于']);
  });

  it('改文字对非树形图种同样生效', () => {
    const spec = { type: 'timeline', items: [{ when: '1900', text: '甲' }] };
    expect(setTextAt(spec, ['items', 0, 'text'], '乙').items[0].text).toBe('乙');
    expect(spec.items[0].text).toBe('甲');
  });
});
