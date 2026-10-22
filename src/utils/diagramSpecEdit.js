/**
 * 🧩 导图规格的**编辑用纯函数**（面板 UI 与单测共用；不改渲染内核）
 * ============================================================
 * 背景（2026-10-22 属主："目前主要考虑模型生成的内容如果错了，可以改"）：
 *   导图在正文里是 `<figure class="k-diagram-figure" data-k-spec="{…}">`——**规格 JSON 是唯一事实源**，
 *   渲染是纯函数（buildDiagramSvg）。所以"改内容"＝改这份 JSON 再重画，**不需要重新调模型**。
 *
 * 本模块只做两件事：
 *   ① 把规格摊平成"可编辑文字条目"（带路径），供面板列出来逐条改；
 *   ② 按路径改文字 / 删条目 / 加子条目 / 换图种（仅 mindmap ↔ brace），**一律不可变返回新对象**。
 *   —— 不在这里做排版，也不碰 SVG；排版仍走 utils/diagrams。
 * ============================================================
 */

import { normalizeHex } from './diagrams/shared.js'; // 颜色校验单源（与渲染侧同一个函数，不在此另写一份正则）

/** 结构同构、可互转的"树形"图种（都是 { title, children[] }） */
export const TREE_TYPES = ['mindmap', 'brace'];

const clone = (o) => JSON.parse(JSON.stringify(o));

const typeOf = (spec) => (spec && spec.type) || 'mindmap';

/** 取某路径上的值 */
const getAt = (obj, path) => path.reduce((cur, k) => (cur == null ? undefined : cur[k]), obj);

/** 不可变写入：返回深拷贝后把 path 末端的值改成 text */
export const setTextAt = (spec, path, text) => {
  const next = clone(spec);
  if (!path.length) { next.title = String(text ?? ''); return next; }
  const parent = getAt(next, path.slice(0, -1));
  const key = path[path.length - 1];
  if (parent && typeof parent === 'object') parent[key] = String(text ?? '');
  return next;
};

/**
 * 摊平成可编辑条目：
 * `{ path, text, role, depth, removable, addable }`
 *   role: root | child | item | step | branch | effect | category | cause | node | link
 *   removable/addable: 该条目所属结构是否支持删除/在它下面加子项（仅树形图种为 true）
 */
export const collectEntries = (spec) => {
  const out = [];
  if (!spec || typeof spec !== 'object') return out;
  const type = typeOf(spec);

  if (TREE_TYPES.includes(type)) {
    const walk = (node, path, depth) => {
      out.push({
        path, text: String(node.title ?? ''), role: depth === 0 ? 'root' : 'child', depth,
        removable: depth > 0, addable: true,
        // 样式（2026-10-22 属主："文字能编辑，但不能加粗、改颜色"）：
        //   树形图种的节点可带 bold / color，面板据此回显控件状态。
        bold: !!node.bold, color: String(node.color ?? ''),
      });
      (node.children || []).forEach((c, i) => walk(c, [...path, 'children', i], depth + 1));
    };
    walk(spec, [], 0);
    return out;
  }

  if (type === 'timeline') {
    (spec.items || []).forEach((it, i) => out.push({ path: ['items', i, 'text'], text: String(it?.text ?? ''), role: 'item', depth: 0, removable: true, addable: false }));
    return out;
  }
  if (type === 'flow') {
    (spec.steps || []).forEach((st, i) => {
      out.push({ path: ['steps', i, 'text'], text: String(st?.text ?? ''), role: 'step', depth: 0, removable: true, addable: false });
      (st?.branches || []).forEach((br, bi) => {
        (br?.steps || []).forEach((bs, si) => out.push({ path: ['steps', i, 'branches', bi, 'steps', si, 'text'], text: String(bs?.text ?? ''), role: 'branch', depth: 1, removable: true, addable: false }));
      });
    });
    return out;
  }
  if (type === 'fishbone') {
    out.push({ path: ['effect'], text: String(spec.effect ?? ''), role: 'effect', depth: 0, removable: false, addable: false });
    (spec.categories || []).forEach((cat, i) => {
      out.push({ path: ['categories', i, 'name'], text: String(cat?.name ?? ''), role: 'category', depth: 1, removable: true, addable: false });
      (cat?.causes || []).forEach((c, ci) => out.push({ path: ['categories', i, 'causes', ci], text: String(c ?? ''), role: 'cause', depth: 2, removable: true, addable: false }));
    });
    return out;
  }
  if (type === 'concept') {
    (spec.nodes || []).forEach((n, i) => out.push({ path: ['nodes', i, 'text'], text: String(n?.text ?? ''), role: 'node', depth: 0, removable: true, addable: false }));
    (spec.links || []).forEach((l, i) => out.push({ path: ['links', i, 'label'], text: String(l?.label ?? ''), role: 'link', depth: 1, removable: true, addable: false }));
    return out;
  }
  return out;
};

/** 删除某条目（path 末端是数组下标；根节点与不可删项返回 null） */
export const removeAt = (spec, path) => {
  const idx = path[path.length - 1];
  if (typeof idx !== 'number') return null;
  const next = clone(spec);
  const arr = getAt(next, path.slice(0, -1));
  if (!Array.isArray(arr) || idx < 0 || idx >= arr.length) return null;
  arr.splice(idx, 1);
  return next;
};

/** 在树形图种的某个节点下**加一个子项**（新增项文字先给占位，面板里再改） */
export const addChildAt = (spec, path, text = '新要点') => {
  if (!TREE_TYPES.includes(typeOf(spec))) return null;
  const next = clone(spec);
  const node = getAt(next, path) || next;
  node.children = Array.isArray(node.children) ? node.children : [];
  node.children.push({ title: String(text || '新要点') });
  return next;
};

/** 把树形节点上移/下移一位（dir = -1 上移 / +1 下移）；根节点不动 */
export const moveNode = (spec, path, dir) => {
  const idx = path[path.length - 1];
  if (typeof idx !== 'number') return null;
  const next = clone(spec);
  const arr = getAt(next, path.slice(0, -1));
  const to = idx + dir;
  if (!Array.isArray(arr) || to < 0 || to >= arr.length) return null;
  const [item] = arr.splice(idx, 1);
  arr.splice(to, 0, item);
  return next;
};

const isPathPrefix = (prefix, path) => prefix.length <= path.length && prefix.every((v, i) => path[i] === v);

/**
 * 🎨 改条目样式（2026-10-22 属主："导图里的文字能编辑，但是目前不能进行加粗、修改颜色等操作吗？"）
 *   patch = { bold?: boolean, color?: '#rrggbb' | '' }
 *   · bold 为真写入 `bold:true`，为假则**删字段**（规格里不残留 false，模型输出的 JSON 更干净）；
 *   · color 走 `normalizeHex` 校验，非法或空 ⇒ 删字段（回落默认色），绝不把任意串写进 SVG 属性。
 * 返回新规格；非树形或路径无效 ⇒ null。
 */
export const setStyleAt = (spec, path, patch = {}) => {
  if (!TREE_TYPES.includes(typeOf(spec))) return null;
  if (!Array.isArray(path)) return null;
  const next = clone(spec);
  const node = getAt(next, path);
  if (!node || typeof node !== 'object') return null;
  if ('bold' in patch) {
    if (patch.bold) node.bold = true;
    else delete node.bold;
  }
  if ('color' in patch) {
    const c = normalizeHex(patch.color);
    if (c) node.color = c;
    else delete node.color;
  }
  return next;
};

/**
 * ⬇️ 降一级（面板「→」）：把该节点挂到**上一个同级**之下，成为它的子项。
 *   第一个同级没有"上一个" ⇒ 返回 null（面板上该按钮禁用）。
 *   与拖拽的 `moveNodeTo` 是同一件事的确定性版本——不依赖拖拽（真机上从输入框起拖常常拖不动）。
 */
export const indentNode = (spec, path) => {
  if (!TREE_TYPES.includes(typeOf(spec))) return null;
  const idx = Array.isArray(path) ? path[path.length - 1] : null;
  if (typeof idx !== 'number' || idx <= 0) return null;
  const next = clone(spec);
  const arr = getAt(next, path.slice(0, -1));
  if (!Array.isArray(arr) || idx >= arr.length) return null;
  const [node] = arr.splice(idx, 1);
  const prev = arr[idx - 1];
  if (!prev || typeof prev !== 'object') return null;
  prev.children = Array.isArray(prev.children) ? prev.children : [];
  prev.children.push(node);
  return next;
};

/**
 * ⬆️ 升一级（面板「←」）：把该节点提到**父节点的下一个同级**位置（父的兄弟位）。
 *   一级节点（path 长度 2）已无父级可升 ⇒ null。
 */
export const outdentNode = (spec, path) => {
  if (!TREE_TYPES.includes(typeOf(spec))) return null;
  if (!Array.isArray(path) || path.length < 4) return null;
  const idx = path[path.length - 1];
  const parentPath = path.slice(0, -2);
  const parentArrPath = parentPath.slice(0, -1);
  const parentIdx = parentPath[parentPath.length - 1];
  if (typeof idx !== 'number' || typeof parentIdx !== 'number') return null;
  const next = clone(spec);
  const arr = getAt(next, path.slice(0, -1));
  const parentArr = getAt(next, parentArrPath);
  if (!Array.isArray(arr) || !Array.isArray(parentArr)) return null;
  if (idx < 0 || idx >= arr.length) return null;
  const [node] = arr.splice(idx, 1);
  parentArr.splice(parentIdx + 1, 0, node);
  return next;
};

/**
 * 🖱 拖拽改结构（面板内）：把 `fromPath` 指向的节点，挂到 `toParentPath` 指向的节点之下（追加为子项）。
 *   · 根不可拖（没有数组下标）；
 *   · **不能拖进自己或自己的子孙**（防环），命中即返回 null；
 *   · 目标必须是树形图种的一个节点。
 */
export const moveNodeTo = (spec, fromPath, toParentPath) => {
  if (!TREE_TYPES.includes(typeOf(spec))) return null;
  const idx = fromPath?.[fromPath.length - 1];
  if (typeof idx !== 'number') return null;
  if (isPathPrefix(fromPath, toParentPath || [])) return null;
  const next = clone(spec);
  const fromArr = getAt(next, fromPath.slice(0, -1));
  if (!Array.isArray(fromArr) || idx < 0 || idx >= fromArr.length) return null;
  const target = getAt(next, toParentPath || []);
  if (!target || typeof target !== 'object') return null;
  const [node] = fromArr.splice(idx, 1);
  target.children = Array.isArray(target.children) ? target.children : [];
  target.children.push(node);
  return next;
};

/** 可由树形"自动重建"的目标图种（时间轴需要 when，不在此列：应由人工补） */
export const TREE_REBUILD_TARGETS = ['fishbone', 'concept', 'flow'];

/**
 * 🌱 换图种时按映射规则**自动重建结构**（仅树形源）：
 *   · fishbone：根=结果；一级=分类；二级及以下叶子=原因（近似可用）
 *   · concept：全部节点=概念（自动生成 id）；父子边=关系，标签"包含"（近似可用）
 *   · flow：先序摊平为顺序步骤，首=start、末=end、其余=process（**有损：层级不再保留**）
 * 返回新规格；源不是树形、或目标不受支持、或没有可用内容 ⇒ null。
 */
export const rebuildFromTree = (spec, type) => {
  if (!TREE_TYPES.includes(typeOf(spec))) return null;
  const rootChildren = Array.isArray(spec.children) ? spec.children : [];
  if (!rootChildren.length) return null;

  if (type === 'fishbone') {
    return {
      type: 'fishbone',
      effect: String(spec.title ?? ''),
      categories: rootChildren.map((c) => ({
        name: String(c?.title ?? ''),
        causes: (c?.children || []).map((x) => String(x?.title ?? '')).filter(Boolean),
      })),
    };
  }

  if (type === 'concept') {
    const nodes = [];
    const links = [];
    let seq = 0;
    const walk = (node, parentId) => {
      const id = `n${seq += 1}`;
      nodes.push({ id, text: String(node?.title ?? '') });
      if (parentId) links.push({ from: parentId, to: id, label: '包含' });
      (node?.children || []).forEach((c) => walk(c, id));
    };
    walk(spec, null);
    return { type: 'concept', nodes, links };
  }

  if (type === 'flow') {
    const flat = [];
    const walk = (node) => {
      flat.push(String(node?.title ?? ''));
      (node?.children || []).forEach(walk);
    };
    walk(spec);
    const steps = flat.map((text, i) => ({
      text,
      kind: i === 0 ? 'start' : (i === flat.length - 1 ? 'end' : 'process'),
    }));
    return { type: 'flow', steps };
  }

  return null;
};

/** 换图种：只允许 mindmap ↔ brace 互转（结构同构）；其它返回 null（面板里禁用） */
export const changeTreeType = (spec, type) => {
  if (!TREE_TYPES.includes(typeOf(spec)) || !TREE_TYPES.includes(type)) return null;
  const next = clone(spec);
  next.type = type;
  return next;
};

/** 校验规格能否编辑（面板打开前把坏 JSON 挡掉） */
export const isEditableSpec = (spec) => !!spec && typeof spec === 'object' && typeof (spec.type || 'mindmap') === 'string';

export default {
  TREE_TYPES, TREE_REBUILD_TARGETS, collectEntries, setTextAt, removeAt, addChildAt,
  moveNode, moveNodeTo, indentNode, outdentNode, setStyleAt, rebuildFromTree, changeTreeType, isEditableSpec,
};
