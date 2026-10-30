/**
 * 🧩 导图规格编辑纯函数单测（2026-10-22 属主："模型生成的内容如果错了，可以改"）
 * 这些函数是"编辑面板"的全部逻辑（改文字/增删/上下移/换图种），**不可变**、可单测。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  collectEntries, setTextAt, removeAt, addChildAt, moveNode, moveNodeTo,
  rebuildFromTree, changeTreeType, setStyleAt, indentNode, outdentNode,
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

describe('diagramSpecEdit · 拖拽改结构（含防环）', () => {
  it('拖到另一个节点上 ⇒ 挂成它的子项；原对象不变', () => {
    const next = moveNodeTo(MM, ['children', 1], ['children', 0]);
    expect(next.children[0].children.map((c) => c.title)).toEqual(['把一个整体平均分', '计算']);
    expect(next.children.length).toBe(1);
    expect(MM.children[1].title).toBe('计算');
  });

  it('不能拖进自己或自己的下级（会成环）', () => {
    expect(moveNodeTo(MM, ['children', 0], ['children', 0])).toBeNull();
    expect(moveNodeTo(MM, ['children', 0], ['children', 0, 'children', 0])).toBeNull();
  });

  it('根不可拖；非树形图种不支持拖拽', () => {
    expect(moveNodeTo(MM, [], ['children', 0])).toBeNull();
    expect(moveNodeTo({ type: 'timeline', items: [] }, ['items', 0], [])).toBeNull();
  });

  it('拖到根上 ⇒ 成为一级要点', () => {
    const next = moveNodeTo(MM, ['children', 0, 'children', 0], []);
    expect(next.children.map((c) => c.title)).toEqual(['意义', '计算', '把一个整体平均分']);
  });
});

describe('diagramSpecEdit · 换图种自动重建结构', () => {
  it('树 → 鱼骨图：根=结果、一级=分类、二级=原因', () => {
    const r = rebuildFromTree(MM, 'fishbone');
    expect(r.type).toBe('fishbone');
    expect(r.effect).toBe('分数');
    expect(r.categories.map((c) => c.name)).toEqual(['意义', '计算']);
    expect(r.categories[0].causes).toEqual(['把一个整体平均分']);
  });

  it('树 → 概念图：全部节点成概念、父子成"包含"关系', () => {
    const r = rebuildFromTree(MM, 'concept');
    expect(r.nodes.map((n) => n.text)).toEqual(['分数', '意义', '把一个整体平均分', '计算']);
    expect(r.links.length).toBe(3);
    expect(r.links.every((l) => l.label === '包含')).toBe(true);
    expect(new Set(r.nodes.map((n) => n.id)).size).toBe(r.nodes.length);
  });

  it('树 → 流程图：先序摊平，首 start、末 end、其余 process', () => {
    const r = rebuildFromTree(MM, 'flow');
    expect(r.steps.map((s) => s.text)).toEqual(['分数', '意义', '把一个整体平均分', '计算']);
    expect(r.steps[0].kind).toBe('start');
    expect(r.steps[r.steps.length - 1].kind).toBe('end');
  });

  it('时间轴不自动重建（需要 when）；非树形源、空内容均返回 null', () => {
    expect(rebuildFromTree(MM, 'timeline')).toBeNull();
    expect(rebuildFromTree({ type: 'timeline', items: [] }, 'fishbone')).toBeNull();
    expect(rebuildFromTree({ type: 'mindmap', title: '空' }, 'fishbone')).toBeNull();
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

// 2026-10-22 属主："现在是不能拖动层级的吗？只能调整同级顺序？"
//   + "导图里的文字能编辑，但是目前不能进行加粗、修改颜色等操作吗？"
describe('diagramSpecEdit · 升降层级（不只靠拖拽）', () => {
  const T = {
    type: 'mindmap',
    title: '分数',
    children: [
      { title: '意义', children: [{ title: '平均分' }] },
      { title: '计算', children: [{ title: '通分' }, { title: '约分' }] },
    ],
  };

  it('降一级：第二个同级挂到第一个同级之下', () => {
    const next = indentNode(T, ['children', 1]);
    expect(next.children.length).toBe(1);
    expect(next.children[0].title).toBe('意义');
    expect(next.children[0].children.map((c) => c.title)).toEqual(['平均分', '计算']);
    expect(T.children.length, '原对象不变').toBe(2);
  });

  it('降一级：第一个同级没有"上一个"→ 无效', () => {
    expect(indentNode(T, ['children', 0])).toBeNull();
    expect(indentNode(T, [])).toBeNull();               // 根不能降级
  });

  it('升一级：孙节点提到父节点的同级位（紧随父之后）', () => {
    const next = outdentNode(T, ['children', 1, 'children', 1]);
    expect(next.children[1].children.map((c) => c.title)).toEqual(['通分']);
    expect(next.children.map((c) => c.title)).toEqual(['意义', '计算', '约分']);
    expect(T.children[1].children.length, '原对象不变').toBe(2);
  });

  it('升一级：一级节点已无父级 → 无效', () => {
    expect(outdentNode(T, ['children', 1])).toBeNull();
    expect(outdentNode(T, [])).toBeNull();
  });

  it('非树形图种不做结构移动', () => {
    const tl = { type: 'timeline', items: [{ when: '1900', text: '甲' }] };
    expect(indentNode(tl, ['items', 0])).toBeNull();
    expect(outdentNode(tl, ['items', 0, 'text'])).toBeNull();
  });
});

describe('diagramSpecEdit · 加粗／改色（写进规格，渲染侧照做）', () => {
  const S = { type: 'mindmap', title: '分数', children: [{ title: '意义' }] };

  it('加粗：写入 bold:true；取消时删除字段（不留 false）', () => {
    const on = setStyleAt(S, ['children', 0], { bold: true });
    expect(on.children[0].bold).toBe(true);
    const off = setStyleAt(on, ['children', 0], { bold: false });
    expect('bold' in off.children[0]).toBe(false);
    expect(S.children[0].bold).toBeUndefined();
  });

  it('改色：十六进制通过校验并小写归一；清空／非法值 → 回落默认（删字段）', () => {
    const c = setStyleAt(S, ['children', 0], { color: '#C00000' });
    expect(c.children[0].color).toBe('#c00000');
    expect(setStyleAt(c, ['children', 0], { color: '' }).children[0].color).toBeUndefined();
    expect(setStyleAt(c, ['children', 0], { color: 'red' }).children[0].color).toBeUndefined();
    expect(setStyleAt(c, ['children', 0], { color: 'url(x)' }).children[0].color).toBeUndefined();
  });

  it('样式可读回：collectEntries 带 bold / color（面板回显控件状态）', () => {
    const styled = setStyleAt(setStyleAt(S, ['children', 0], { bold: true }), ['children', 0], { color: '#1f7a5c' });
    const e = collectEntries(styled).find((x) => x.text === '意义');
    expect(e.bold).toBe(true);
    expect(e.color).toBe('#1f7a5c');
  });

  it('非树形图种不写样式（返回 null，不污染时间轴/鱼骨图结构）', () => {
    expect(setStyleAt({ type: 'timeline', items: [{ when: '1900', text: '甲' }] }, ['items', 0], { bold: true })).toBeNull();
  });

  // 2026-10-22 属主："节点字号可以做""手工拖框改宽高值得做吧"
  it('字号：写入并按 11–24 夹取；清空/非法 → 删字段（回落自动）', () => {
    const a = setStyleAt(S, ['children', 0], { fs: 18 });
    expect(a.children[0].fs).toBe(18);
    expect(setStyleAt(S, ['children', 0], { fs: 99 }).children[0].fs).toBe(24);
    expect(setStyleAt(S, ['children', 0], { fs: 2 }).children[0].fs).toBe(11);
    expect(setStyleAt(a, ['children', 0], { fs: '' }).children[0].fs).toBeUndefined();
    expect(setStyleAt(S, ['children', 0], { fs: 'abc' }).children[0].fs).toBeUndefined();
  });

  it('手动宽高：写入并按区间夹取；清空 → 删字段', () => {
    const a = setStyleAt(S, ['children', 0], { w: 260, h: 90 });
    expect(a.children[0].w).toBe(260);
    expect(a.children[0].h).toBe(90);
    expect(setStyleAt(S, ['children', 0], { w: 10 }).children[0].w).toBe(40);
    expect(setStyleAt(S, ['children', 0], { w: 9999 }).children[0].w).toBe(600);
    expect(setStyleAt(a, ['children', 0], { w: '' }).children[0].w).toBeUndefined();
  });

  it('样式可读回：collectEntries 带 fs / w / h（面板回显控件状态）', () => {
    const styled = setStyleAt(S, ['children', 0], { fs: 16, w: 200, h: 60 });
    const e = collectEntries(styled).find((x) => x.text === '意义');
    expect(e.fs).toBe(16);
    expect(e.w).toBe(200);
    expect(e.h).toBe(60);
  });
});

// 🔴 2026-10-30（属主："用户可以在排版模块拖动这个框调整长宽吗？"→ 定方案 A：面板给"宽/高"数值输入）：
//   这两个输入不存在时，`w`/`h` 就只有底层能力、用户改不到 —— 用静态守卫防止再被悄悄撤掉。
describe('编辑面板 · 宽/高输入在位（方案 A）', () => {
  const src = readFileSync(path.join(process.cwd(), 'src', 'components', 'DiagramEditorPanel.vue'), 'utf8');

  it('有"宽/高"两个数字输入，并接到 setStyleAt 的 w / h 字段', () => {
    expect(src, '宽 输入').toContain("onNum(e.path, 'w', $event.target.value)");
    expect(src, '高 输入').toContain("onNum(e.path, 'h', $event.target.value)");
    expect(src, '宽的语义提示（最小值、不裁字）').toContain('最小宽度');
    expect(src, '高的语义提示').toContain('最小高度');
  });

  it('输入区间与渲染侧校验一致（40–600 / 24–800）', () => {
    expect(src).toMatch(/min="40"[\s\S]{0,80}max="600"/);
    expect(src).toMatch(/min="24"[\s\S]{0,80}max="800"/);
  });
});
