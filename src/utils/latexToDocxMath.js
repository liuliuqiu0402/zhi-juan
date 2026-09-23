/**
 * LaTeX → docx 公式对象（Word 真公式）
 * ============================================================
 * 🔴 为什么需要（2026-09 用户实证）：Word 导出此前对公式的处理**只在"整个文本节点恰好是 $...$"时命中**
 *    （真实语句「半径为 $r$ 的圆」永不命中），命中时也只是剥掉 $ 后涂成**深蓝斜体**——
 *    于是 Word 交付物里 `$\frac{a}{b}$` 原样泄漏成乱码文本，既非公式也非印刷样式。
 *    docx 库内置完整 OMML 支持（MathFraction / MathRadical / MathSubXxx / MathSum / MathIntegral /
 *    MathFunction 等），
 *    本模块把 LaTeX 解析成这些对象，产出**真正的 Word 公式**（可编辑、可重排、印刷级）。
 *
 * 🔴 宁缺勿错（本项目红线）：只转换**能确定正确表达**的子集；遇到任何不支持的构造，
 *    整体返回 null，由调用方降级为可读 Unicode 文本（`convertFormulaToText`）——
 *    绝不"猜着转换"产出错公式（错公式比纯文本更糟：看起来对、实际错了）。
 *
 * 支持子集：\frac、\sqrt（含 \sqrt[n]）、^{}、_{}、^{}_{}、\sum/\int（含上下限）、
 *    函数/算子名（sin/cos/lim…，正体）、\left…\right 成对括号（圆/方/花括号）、
 *    \text/\mathrm/\operatorname、常用符号命令与希腊字母、间距命令。
 * ============================================================
 */
import {
  Math as DocxMath,
  MathRun,
  MathFraction,
  MathRadical,
  MathSuperScript,
  MathSubScript,
  MathSubSuperScript,
  MathSum,
  MathIntegral,
} from 'docx';
// docx 未实现的 OMML 类由本仓库自建补齐（方程数组 m:eqArr、重音 m:acc、
// 上方附加 m:limUpp、矩阵 m:m、自定义定界符 m:d）——见 utils/ommlExtras.js 文件头
import {
  MathEquationArray,
  MathAccent,
  MathBar,
  MathLimitUpper,
  MathMatrix,
  MathDelimiter,
} from './ommlExtras.js';
// 🔴 刻意不用 docx 的 `MathText`：它**未从 ESM 入口导出**（CJS 有，属上游打包不一致），
//    在 Vite/vitest 下 `MathText === undefined`，`new MathText()` 会抛错。实测由本模块单测抓出。
//    正体文字改用 MathRun（Word 数学区里字母默认斜体，函数名如 sin 呈斜体——可接受的轻微保真损失，
//    换来的是"不依赖未导出符号、不因上游打包差异而静默降级"）。

// ==================== 命令表 ====================

/** 符号类命令 → Unicode 字符（在 Word 公式里以正体字符呈现） */
const SYMBOL_CMD = {
  cdot: '·', cdots: '⋯', times: '×', div: '÷', pm: '±', mp: '∓',
  leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', equiv: '≡', approx: '≈',
  infty: '∞', rightarrow: '→', to: '→', leftarrow: '←', Rightarrow: '⇒',
  rightleftharpoons: '⇌', leftrightarrow: '↔',
  // 箭头族（化学方程式的 ↑↓ 沉淀/气体符号、长箭头、映射）
  uparrow: '↑', downarrow: '↓', updownarrow: '↕',
  longrightarrow: '⟶', Longrightarrow: '⟹', hookrightarrow: '↪', mapsto: '↦',
  in: '∈', notin: '∉', cup: '∪', cap: '∩', subset: '⊂', subseteq: '⊆', emptyset: '∅',
  angle: '∠', perp: '⊥', parallel: '∥', triangle: '△', circ: '∘', degree: '°',
  // 集合/逻辑/关系（数学函数与集合题高频；缺则整式降级）
  mid: '|', vert: '|', Vert: '‖', sim: '∼', cong: '≅', propto: '∝',
  forall: '∀', exists: '∃', nabla: '∇', partial: '∂', implies: '⇒', iff: '⇔',
  therefore: '∴', because: '∵', prime: '′', ast: '∗', star: '⋆',
  lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉', langle: '⟨', rangle: '⟩',
  ldots: '…', dots: '…',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε',
  zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ',
  nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ',
  phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π',
  Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  // 转义字符
  '%': '%', '&': '&', '_': '_', '#': '#', '{': '{', '}': '}', '$': '$',
  backslash: '\\', textbackslash: '\\',
  // 间距
  ',': ' ', ';': ' ', ':': ' ', '!': '', quad: ' ', qquad: '  ',
};

/** 函数/算子名 → 正体文本（\\sin x、\\lim_{…}）；紧随 {...} 时补一个空格避免"sinx" */
const UPRIGHT_NAMES = new Set([
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
  'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh',
  'log', 'ln', 'lg', 'exp', 'det', 'dim', 'gcd', 'max', 'min', 'lim', 'mod', 'deg',
]);

/** 重音命令 → OMML `m:chr` 字符（`m:acc` 会把该字符排在基座**上方**） */
const ACCENT_CHAR = {
  vec: '\u20D7', hat: '\u0302', widehat: '\u0302', bar: '\u0304', tilde: '\u0303',
  dot: '\u0307', ddot: '\u0308',
};

/** `\left`/`\right` 定界符字符归一（`\|` → ‖；`.` 表示该侧无定界符） */
const DELIM_NORMALIZE = { '\\|': '‖', '|': '|', '.': '' };
const normalizeDelim = (ch) => {
  const c = String(ch == null ? '' : ch);
  return Object.prototype.hasOwnProperty.call(DELIM_NORMALIZE, c) ? DELIM_NORMALIZE[c] : c;
};

// ==================== 词法 ====================

/** 词法分析：命令 / 花括号 / 上下标 / 单字符 / 空白 */
const tokenize = (src) => {
  const out = [];
  let i = 0;
  const s = String(src || '');
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') {
      const m = /^\\([a-zA-Z]+)/.exec(s.slice(i));
      if (m) {
        out.push({ t: 'cmd', v: m[1] });
        i += m[0].length;
        while (i < s.length && s[i] === ' ') i += 1; // LaTeX 忽略命令后的空格
        continue;
      }
      out.push({ t: 'cmd', v: s[i + 1] || '' });
      i += 2;
      continue;
    }
    if (c === '{' || c === '}' || c === '^' || c === '_' || c === '[' || c === ']') {
      out.push({ t: c });
      i += 1;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\n') {
      out.push({ t: 'sp' });
      i += 1;
      continue;
    }
    out.push({ t: 'ch', v: c });
    i += 1;
  }
  return out;
};

// ==================== 语法（递归下降） ====================

/**
 * 解析。任何不支持的构造 → 返回 null（由调用方整体降级，不产出半对的公式）。
 * 节点种类：run / text / group / frac / rad / sup / sub / subsup / nary / bracket
 */

/** 跳过 ^ / _ 之前的空白（LaTeX 允许 `x ^ 2`） */
const skipSpaceBeforeScript = (tks, pos) => {
  let p = pos;
  while (tks[p] && tks[p].t === 'sp') p += 1;
  return tks[p] && (tks[p].t === '^' || tks[p].t === '_') ? p : pos;
};

/**
 * 取"定界符 token"的字符。
 * 🔴 必须同时认三种写法，否则括号类型会**静默认错**（实测由单测抓出）：
 *    ① 普通字符 token（`(`, `)`）；
 *    ② `[` / `]` 被词法器单独分成 `t:'['` / `t:']'`（为解析 `\sqrt[n]` 的可选参数）——
 *       原实现只认 `t:'ch'`，于是 `\left[x\right]` 的 `]` 取不到、回退成 `)` → 方括号被错认成圆括号；
 *    ③ `\{` / `\}` / `\|` 是**命令** token（v 为 '{' / '}' / '|'）。
 */
const delimOf = (tk) => {
  if (!tk) return null;
  if (tk.t === 'ch') return tk.v;
  if (tk.t === '[' || tk.t === ']') return tk.t;
  if (tk.t === 'cmd' && (tk.v === '{' || tk.v === '}' || tk.v === '|')) return tk.v;
  return null;
};

/** 找到与 \\left 配对的 \\right（考虑嵌套） */
const findRight = (tks, from) => {
  let depth = 0;
  for (let i = from; i < tks.length; i += 1) {
    if (tks[i].t === 'cmd' && tks[i].v === 'left') depth += 1;
    else if (tks[i].t === 'cmd' && tks[i].v === 'right') {
      if (depth === 0) return i;
      depth -= 1;
    }
  }
  return -1;
};

let parseCmd; // 前向声明（与 parseOneNode 相互递归）

/** 解析一个参数：{...} 组 或 单 token */
const parseArg = (tks, pos) => {
  const tk = tks[pos];
  if (!tk || tk.t === '}') return null;
  if (tk.t === '{') {
    const inner = parseList(tks, pos + 1);
    if (!inner) return null;
    return { nodes: inner.nodes, pos: inner.pos + 1 }; // 跳过 }
  }
  if (tk.t === 'cmd') {
    const r = parseCmd(tks, pos);
    return r ? { nodes: [r.node], pos: r.pos } : null;
  }
  if (tk.t === 'sp') return { nodes: [], pos: pos + 1 };
  if ('^_[]'.includes(tk.t)) return null;
  return { nodes: [{ k: 'run', text: tk.v }], pos: pos + 1 };
};

/** 把上下标挂到基座上（合并 x_i^2 这类连续挂载） */
const attachScript = (base, kind, arg) => {
  const baseArr = base.k === 'group' ? base.children : [base];
  if (kind === '^') {
    if (base.k === 'sub') return { k: 'subsup', base: base.base, sub: base.sub, sup: arg };
    return { k: 'sup', base: baseArr, sup: arg };
  }
  if (base.k === 'sup') return { k: 'subsup', base: base.base, sub: arg, sup: base.sup };
  return { k: 'sub', base: baseArr, sub: arg };
};

/** 解析单个节点（含其后紧跟的上下标） */
const parseOneNode = (tks, pos) => {
  const tk = tks[pos];
  if (!tk || tk.t === '}') return null;
  let node;
  let p = pos;

  if (tk.t === '{') {
    const inner = parseList(tks, pos + 1);
    if (!inner) return null;
    node = { k: 'group', children: inner.nodes };
    p = inner.pos + 1;
  } else if (tk.t === 'cmd') {
    const r = parseCmd(tks, pos);
    if (!r) return null;
    node = r.node;
    p = r.pos;
  } else if (tk.t === 'sp') {
    return { node: { k: 'run', text: ' ' }, pos: pos + 1 };
  } else if (tk.t === 'ch') {
    node = { k: 'run', text: tk.v };
    p = pos + 1;
  } else {
    return null; // ^ _ [ ] 出现在此处属非法
  }

  // 上下标链
  for (;;) {
    const q = skipSpaceBeforeScript(tks, p);
    if (tks[q] && (tks[q].t === '^' || tks[q].t === '_')) {
      const arg = parseArg(tks, q + 1);
      if (!arg) return null;
      node = attachScript(node, tks[q].t, arg.nodes);
      p = arg.pos;
      continue;
    }
    break;
  }
  return { node, pos: p };
};

/** 解析一串节点（遇 } 或结束即停） */
function parseList(tks, pos) {
  const nodes = [];
  let p = pos;
  while (p < tks.length && tks[p].t !== '}') {
    const r = parseOneNode(tks, p);
    if (!r) return null;
    p = r.pos;
    const node = r.node;
    // n 元算子吸收紧随的一项作为作用对象（LaTeX 习惯写法 \sum_{i=1}^n a_i）
    if (node.k === 'nary' && !node.body.length) {
      const nxt = parseOneNode(tks, p);
      if (nxt) { node.body = [nxt.node]; p = nxt.pos; }
    }
    nodes.push(node);
  }
  return { nodes, pos: p };
}

/**
 * 表格类环境 → 行 × 单元格的节点矩阵（`\\` 分行、`&` 分列）。
 * 返回 null 表示某个单元格无法解析（→ 整体放弃，交调用方降级，不产出半对结构）。
 */
const toCellRows = (tks) => {
  const rows = [[]];
  for (const tk of tks) {
    if (tk.t === 'cmd' && tk.v === '\\') { rows.push([]); continue; }
    rows[rows.length - 1].push(tk);
  }
  const out = [];
  for (const rowTks of rows) {
    const cells = [[]];
    for (const tk of rowTks) {
      if (tk.t === 'ch' && tk.v === '&') { cells.push([]); continue; }
      cells[cells.length - 1].push(tk);
    }
    const cellNodes = [];
    for (const cellTks of cells) {
      if (!cellTks.length) { cellNodes.push([]); continue; }
      const r = parseList(cellTks, 0);
      if (!r || r.pos !== cellTks.length) return null; // 未完全消费 → 没理解 → 不转换
      cellNodes.push(r.nodes);
    }
    out.push(cellNodes);
  }
  return out;
};

/**
 * cases / aligned 用：把一行的多个单元格**并成一行**（m:eqArr 的行没有列概念），
 * 单元格之间留空隙；cases 的源码通常已带逗号（`x+1, & x>0`），故只补空白、不再补标点。
 */
const toRows = (tks) => {
  const cells = toCellRows(tks);
  if (!cells) return null;
  return cells.map((rowCells) => {
    const out = [];
    rowCells.forEach((cell, i) => {
      if (i > 0) out.push({ k: 'run', text: '  ' });
      out.push(...cell);
    });
    return out;
  });
};

/** 命令分派 */
parseCmd = (tks, pos) => {
  const name = tks[pos].v;
  const p0 = pos + 1;

  if (Object.prototype.hasOwnProperty.call(SYMBOL_CMD, name)) {
    const ch = SYMBOL_CMD[name];
    return { node: { k: 'run', text: ch }, pos: p0 };
  }

  // 正体函数/算子名：紧随 {...} 时补空格，避免 "sinx"
  if (UPRIGHT_NAMES.has(name)) {
    const children = [{ k: 'text', children: [{ k: 'run', text: name }] }];
    if (tks[p0] && tks[p0].t === '{') children.push({ k: 'run', text: ' ' });
    return { node: children.length > 1 ? { k: 'group', children } : children[0], pos: p0 };
  }

  switch (name) {
    // 分段函数 / 方程组 / 矩阵环境。
    // 🔴 docx **未实现** OMML 的方程数组（m:eqArr）与矩阵（m:m）——但这是**上游覆盖面取舍、
    //    不是规范限制**；本仓库用 docx 导出的 XmlComponent 扩展点自建了这两类
    //    （见 utils/ommlExtras.js），故这里能给出**真·多行**结构而非"分号连写"近似。
    case 'begin': {
      const envArg = parseArg(tks, p0);
      if (!envArg) return null;
      const env = plainOf(envArg.nodes).trim();
      const KIND = {
        cases: 'cases', aligned: 'aligned', align: 'aligned', gather: 'aligned',
        matrix: 'matrix', pmatrix: 'pmatrix', bmatrix: 'bmatrix', vmatrix: 'vmatrix',
      };
      const kind = KIND[env];
      if (!kind) return null; // 未登记环境（array/eqnarray…）→ 整体降级
      // 找配对的 \end{同名环境}
      let endIdx = -1;
      for (let i = envArg.pos; i < tks.length; i += 1) {
        if (tks[i].t === 'cmd' && tks[i].v === 'end') { endIdx = i; break; }
      }
      if (endIdx < 0) return null;
      const endArg = parseArg(tks, endIdx + 1);
      if (!endArg || plainOf(endArg.nodes).trim() !== env) return null;
      const bodyTks = tks.slice(envArg.pos, endIdx);
      // 🔴 两种行结构（eqArr 是"扁平节点"行、矩阵是"单元格"行）判空方式不同，
      //    曾用同一判据套两种形状 → 分段函数恒被判空、整体降级（由单测抓出）
      const hasFlatContent = (rows) => Array.isArray(rows) && rows.some((r) => Array.isArray(r) && r.length > 0);
      const hasCellContent = (rows) => Array.isArray(rows)
        && rows.some((r) => Array.isArray(r) && r.some((c) => Array.isArray(c) && c.length > 0));

      if (kind === 'cases' || kind === 'aligned') {
        const rows = toRows(bodyTks);
        if (!hasFlatContent(rows)) return null;
        const rowsNode = { k: 'eqRows', rows };
        // cases：左花括号包住多行、右侧无定界符（教材上分段函数的标准形态）
        return kind === 'cases'
          ? { node: { k: 'delim', beg: '{', end: '', children: [rowsNode] }, pos: endArg.pos }
          : { node: rowsNode, pos: endArg.pos };
      }
      const cellRows = toCellRows(bodyTks);
      if (!hasCellContent(cellRows)) return null;
      const matNode = { k: 'matRows', rows: cellRows };
      const wrap = { pmatrix: ['(', ')'], bmatrix: ['[', ']'], vmatrix: ['|', '|'] }[kind];
      return wrap
        ? { node: { k: 'delim', beg: wrap[0], end: wrap[1], children: [matNode] }, pos: endArg.pos }
        : { node: matNode, pos: endArg.pos };
    }
    case 'frac': {
      const a = parseArg(tks, p0);
      if (!a) return null;
      const b = parseArg(tks, a.pos);
      if (!b) return null;
      return { node: { k: 'frac', num: a.nodes, den: b.nodes }, pos: b.pos };
    }
    case 'sqrt': {
      let deg = null;
      let p = p0;
      if (tks[p] && tks[p].t === '[') {
        let end = -1;
        for (let i = p + 1; i < tks.length; i += 1) if (tks[i].t === ']') { end = i; break; }
        if (end < 0) return null;
        const inner = parseList(tks.slice(p + 1, end), 0);
        if (!inner) return null;
        deg = inner.nodes;
        p = end + 1;
      }
      const body = parseArg(tks, p);
      if (!body) return null;
      return { node: { k: 'rad', deg, body: body.nodes }, pos: body.pos };
    }
    case 'text':
    case 'mathrm':
    case 'operatorname': {
      const a = parseArg(tks, p0);
      if (!a) return null;
      return { node: { k: 'text', children: a.nodes }, pos: a.pos };
    }
    // 化学反应箭头（条件写在箭头上方）：`\xrightarrow{点燃}` / `\xleftarrow{…}`
    // 🔴 docx 未实现 OMML 的"上方附加"（m:limUpp），由 ommlExtras 自建补齐 →
    //    条件文字**真排在箭头上方**（教材印刷形态），且不再有"条件被降级吞掉"的风险。
    case 'xrightarrow':
    case 'xleftarrow': {
      const a = parseArg(tks, p0);
      if (!a) return null;
      const arrow = name === 'xleftarrow' ? '←' : '→';
      return { node: { k: 'limUpp', children: [{ k: 'run', text: arrow }], limit: a.nodes }, pos: a.pos };
    }
    // 重音：\vec{F} \hat{x} \bar{x} \overline{AB} \tilde{x} \dot{x}
    // 🔴 docx 未实现 OMML 的重音（m:acc），由 ommlExtras 自建补齐 → 真重音而非组合字符
    case 'vec':
    case 'hat':
    case 'widehat':
    case 'bar':
    case 'tilde':
    case 'dot':
    case 'ddot': {
      const a = parseArg(tks, p0);
      if (!a) return null;
      return { node: { k: 'acc', accent: ACCENT_CHAR[name], children: a.nodes }, pos: a.pos };
    }
    // 上/下划线：OMML 的正确表达是 m:bar（不是重音）——docx 同样未实现，由 ommlExtras 自建
    case 'overline':
    case 'underline': {
      const a = parseArg(tks, p0);
      if (!a) return null;
      return { node: { k: 'bar', pos: name === 'underline' ? 'bot' : 'top', children: a.nodes }, pos: a.pos };
    }
    case 'sum':
    case 'int': {
      const kind = name === 'int' ? 'int' : 'sum';
      let sub = null;
      let sup = null;
      let p = p0;
      for (let guard = 0; guard < 2; guard += 1) {
        const q = skipSpaceBeforeScript(tks, p);
        if (!(tks[q] && (tks[q].t === '^' || tks[q].t === '_'))) break;
        const arg = parseArg(tks, q + 1);
        if (!arg) return null;
        if (tks[q].t === '^') sup = arg.nodes; else sub = arg.nodes;
        p = arg.pos;
      }
      return { node: { k: 'nary', kind, sub, sup, body: [] }, pos: p };
    }
    case 'left': {
      const openCh = delimOf(tks[p0]);
      if (openCh == null) return null;
      const rightIdx = findRight(tks, p0 + 1);
      if (rightIdx < 0) return null;
      const inner = parseList(tks.slice(p0 + 1, rightIdx), 0);
      if (!inner) return null;
      const closeCh = delimOf(tks[rightIdx + 1]);
      if (closeCh == null) return null;
      // 任意成对定界符都支持（圆/方/花/竖线/尖括号/单侧 . ）：
      // OMML 的 m:d 本就接受自定义 begChr/endChr，无需按"括号种类"分派
      return {
        node: { k: 'delim', beg: normalizeDelim(openCh), end: normalizeDelim(closeCh), children: inner.nodes },
        pos: rightIdx + 2,
      };
    }
    default:
      return null; // 不支持 → 整体降级（宁缺勿错）
  }
};

// ==================== 生成 docx 组件 ====================

/** 取节点的纯文本（用于 MathText） */
const plainOf = (nodes) => (nodes || []).map((n) => {
  if (n.k === 'run') return n.text;
  if (n.k === 'text') return plainOf(n.children);
  if (n.k === 'group') return plainOf(n.children);
  return '';
}).join('');

/**
 * 是否"纯文本"（不含任何结构节点）。
 * 🔴 用于决定 `\mathrm{}`/`\text{}` 能否安全塌成单个 run —— 见 toComponent 的 text 分支。
 */
const isPlainText = (nodes) => (nodes || []).every((n) => {
  if (!n) return true;
  if (n.k === 'run') return true;
  if (n.k === 'text' || n.k === 'group') return isPlainText(n.children);
  return false;
});

/** 单节点 → docx 组件；group 返回数组（由 toComponents 摊平） */
const toComponent = (n) => {
  switch (n.k) {
    case 'run':
      return n.text === '' ? null : new MathRun(n.text);
    case 'text': {
      // `\mathrm{}` / `\text{}`：**只在内容确为纯文本时**才塌成单个 run（排版干净）；
      // 含结构（上下标 / 化学箭头条件 / 分式…）时逐个保留结构。
      // 🔴 曾一律 plainOf 塌成纯文本 → `\mathrm{H_{2}O}` 静默变成 "HO"（下标被吞）、
      //    `\mathrm{2H_{2}+O_{2}\xrightarrow{点燃}...}` 整串结构消失 —— 静默错内容，由单测抓出。
      const nodes = n.children || [];
      if (isPlainText(nodes)) return new MathRun(plainOf(nodes));
      const comps = toComponents(nodes);
      return comps.length ? comps : null;
    }
    case 'group':
      return toComponents(n.children);
    case 'frac':
      return new MathFraction({ numerator: toComponents(n.num), denominator: toComponents(n.den) });
    case 'rad': {
      const children = toComponents(n.body);
      if (!children.length) return null;
      return n.deg
        ? new MathRadical({ children, degree: toComponents(n.deg) })
        : new MathRadical({ children });
    }
    case 'sup': {
      const children = toComponents(n.base);
      if (!children.length) return null;
      return new MathSuperScript({ children, superScript: toComponents(n.sup) });
    }
    case 'sub': {
      const children = toComponents(n.base);
      if (!children.length) return null;
      return new MathSubScript({ children, subScript: toComponents(n.sub) });
    }
    case 'subsup': {
      const children = toComponents(n.base);
      if (!children.length) return null;
      return new MathSubSuperScript({
        children,
        subScript: toComponents(n.sub),
        superScript: toComponents(n.sup),
      });
    }
    case 'nary': {
      const children = toComponents(n.body);
      if (!children.length) return null;
      const opts = { children };
      if (n.sub && n.sub.length) opts.subScript = toComponents(n.sub);
      if (n.sup && n.sup.length) opts.superScript = toComponents(n.sup);
      return n.kind === 'int' ? new MathIntegral(opts) : new MathSum(opts);
    }
    case 'delim':
      // 任意成对定界符（含单侧、竖线、尖括号）；自建 MathDelimiter 产出 m:d + 自定义 begChr/endChr
      return new MathDelimiter({
        beg: n.beg,
        end: n.end,
        children: toComponents(n.children),
      });
    case 'eqRows': {
      // 分段函数 / 方程组：真·多行（m:eqArr）
      const rows = n.rows.map((row) => toComponents(row));
      if (!rows.some((r) => r.length)) return null;
      return new MathEquationArray(rows);
    }
    case 'matRows': {
      // 矩阵：真·行列（m:m + m:mr），单元格各自成列，Word 里可对齐
      const rows = n.rows.map((row) => row.map((cell) => toComponents(cell)));
      if (!rows.some((r) => r.some((c) => c.length))) return null;
      return new MathMatrix(rows);
    }
    case 'acc':
      // 重音（\vec \hat \bar …）：真重音（m:acc）
      return new MathAccent({ accent: n.accent, children: toComponents(n.children) });
    case 'bar':
      // 上/下划线（\overline \underline）：m:bar + m:pos
      return new MathBar({ pos: n.pos, children: toComponents(n.children) });
    case 'limUpp':
      // 上方附加（化学方程式的反应条件）：条件真排在箭头上方（m:limUpp）
      return new MathLimitUpper({
        children: toComponents(n.children),
        limit: toComponents(n.limit),
      });
    default:
      return null;
  }
};

const toComponents = (nodes) => {
  const out = [];
  for (const n of nodes || []) {
    const c = toComponent(n);
    if (Array.isArray(c)) out.push(...c);
    else if (c) out.push(c);
  }
  return out;
};

/**
 * LaTeX（不含 $ 定界符）→ docx Math 对象
 * @param {string} latex
 * @returns {import('docx').Math|null} 无法确定正确表达时返回 null（调用方降级为 Unicode 文本）
 */
export const latexToDocxMath = (latex) => {
  const src = String(latex == null ? '' : latex).trim();
  if (!src) return null;
  try {
    const tks = tokenize(src);
    const parsed = parseList(tks, 0);
    if (!parsed || parsed.pos !== tks.length) return null; // 有残留 = 未完全理解 → 不转换
    const children = toComponents(parsed.nodes);
    if (!children.length) return null;
    return new DocxMath({ children });
  } catch {
    return null;
  }
};

export default { latexToDocxMath };
