/**
 * 🧮 安全表达式求值器（coordinate / shapes 的函数图象必需）—— 纯函数，可独立单测
 * ============================================================
 * 契约 / 印刷约定 / 共用能力见 `./shared.js` 头部；写法与注释风格照抄 `./mindmap.js`。
 *
 * 🔴 为什么必须**自己写**词法 + 递归下降，绝不借助任何"把字符串当代码执行"的手段：
 *   表达式来自**模型输出**（[GRAPH] 指令块的 `FUNCTION:` 字段），属不可信输入。
 *   任何形式的动态代码构造与执行（无论怎么包装、怎么沙箱）都等于把渲染进程交给模型输出 ——
 *   在 Electron 渲染器里可直接触达 Node 能力，这是不可接受的安全面。
 *   递归下降求值器是纯函数：可单测、无副作用；非法输入只是返回 null + 告警。
 *   ⚠️ 因此本文件（以及调用它的 coordinate.js / shapes.js）内**不得**出现动态代码执行相关 API，
 *      单测会剥离注释后直接 grep 源码守住这条红线。
 *
 * 支持的语法（与 [GRAPH] 指令的实际写法对齐）：
 *   · 数字（含 `.5` / `3.` / 全角句点容错）；变量 `x`；
 *   · 运算符 `+ - * / ^`，`**` 与 `^` 同义（幂、右结合）；括号（含 `[]` `{}` 容错）；
 *   · 一元正负号；常量 `pi` / `e`；
 *   · 函数 sqrt abs sin cos tan asin acos atan log lg ln exp floor ceil round（必须带括号）；
 *   · 容错归一化：`−–—`→`-`、`×∗`→`*`、`÷`→`/`、全角括号/逗号、上标 `²³⁴…`→`^n`。
 *   · ⚠️ 刻意不支持（按规格：模型输出通常就是 `2*x`）：隐式乘法 `2x`、多参函数、
 *     科学计数法 `1e3`、任何未知字符 → 一律返回 null（**宁可不出图，也不猜**）。
 *
 * 求值口径：结果非有限（NaN / ±Infinity；如 sqrt(-1)、1/0、ln(0)、asin(2)）→ 返回 null。
 *   于是采样侧只要"跳过 null"就自然处理了定义域边界与渐近线（见 sampleExpression）。
 * ============================================================
 */

/* ============================ 常量表 ============================ */

/** 内置常量（小写集合） */
const CONSTS = Object.freeze({ pi: Math.PI, e: Math.E });

/** 内置函数（单参）。log/lg = 常用对数（底 10），ln = 自然对数 */
const MATH_FUNCS = Object.freeze({
  sqrt: (v) => Math.sqrt(v),
  abs: (v) => Math.abs(v),
  sin: (v) => Math.sin(v),
  cos: (v) => Math.cos(v),
  tan: (v) => Math.tan(v),
  asin: (v) => Math.asin(v),
  acos: (v) => Math.acos(v),
  atan: (v) => Math.atan(v),
  log: (v) => Math.log10(v),
  lg: (v) => Math.log10(v),
  ln: (v) => Math.log(v),
  exp: (v) => Math.exp(v),
  floor: (v) => Math.floor(v),
  ceil: (v) => Math.ceil(v),
  round: (v) => Math.round(v),
});

/** 导出供调用方/文档使用（例如 UI 上提示模型可用哪些函数） */
export const MATH_FUNCTION_NAMES = Object.freeze(Object.keys(MATH_FUNCS));
export const MATH_CONSTANT_NAMES = Object.freeze(Object.keys(CONSTS));

/** 亚采样密度：判定"两点之间是否真的连续"时补采的点数（见 sampleExpression） */
const SUB_SAMPLES = 12;

const asText = (v) => (v == null ? '' : String(v));

/* ============================ ① 告警出口（可注入，便于单测断言） ============================ */

const warned = new Set();
let warnSink = (msg) => {
  if (typeof console !== 'undefined' && console && typeof console.warn === 'function') console.warn(msg);
};

/**
 * 替换告警出口（默认 console.warn）。传非函数 = 静默。
 * 🔴 同一份表达式只告警一次（采样时会反复调用求值器，不去重会刷屏）。
 */
export const setMathExprWarnSink = (fn) => {
  warnSink = typeof fn === 'function' ? fn : () => {};
  warned.clear();
};

const warnOnce = (key, msg) => {
  const k = String(key);
  if (warned.has(k)) return;
  warned.add(k);
  try {
    warnSink(msg);
  } catch {
    /* 告警本身绝不能影响出图 */
  }
};

/* ============================ ② 归一化 + 词法 ============================ */

const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };

/** 把模型常见的"书写形态"归一成 ASCII 表达式（不改语义，只改字符） */
export const normalizeMathSource = (src) => asText(src)
  .replace(/[−–—]/g, '-')
  .replace(/[×∗∙]/g, '*')
  .replace(/[÷]/g, '/')
  .replace(/（/g, '(').replace(/）/g, ')')
  .replace(/[｛]/g, '{').replace(/[｝]/g, '}')
  .replace(/，/g, ',')
  .replace(/[。．]/g, '.')
  .replace(/[＾ˆ]/g, '^')
  .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => `^${[...m].map((ch) => SUP[ch]).join('')}`);

const NUM_LITERAL_RE = /^(?:\d+(?:\.\d+)?|\.\d+)$/;

/**
 * 词法分析：字符逐个扫描（手写扫描器比正则更可控，也不会在非法字符上静默跳过）。
 * @returns {Array<{t:string, v?:any}>|null} null = 词法非法
 */
export const tokenizeMathExpression = (src) => {
  const s = normalizeMathSource(src);
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }

    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j += 1;
      const lit = s.slice(i, j);
      if (!NUM_LITERAL_RE.test(lit)) return null;      // "1.2.3" / "." 之类
      const num = Number(lit);
      if (!Number.isFinite(num)) return null;
      out.push({ t: 'num', v: num });
      i = j;
      continue;
    }

    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < s.length && /[A-Za-z_0-9]/.test(s[j])) j += 1;
      // ⚠️ 标识符允许含数字，所以 `2x` 会先被切成 num(2) + name(x)，
      //    随后在语法层因"数字后紧跟标识符"被判非法（不隐式相乘）。
      out.push({ t: 'name', v: s.slice(i, j).toLowerCase() });
      i = j;
      continue;
    }

    if (c === '*' && s[i + 1] === '*') { out.push({ t: 'op', v: '^' }); i += 2; continue; }
    if (c === '+' || c === '-' || c === '*' || c === '/' || c === '^') { out.push({ t: 'op', v: c }); i += 1; continue; }
    if (c === '(' || c === '[' || c === '{') { out.push({ t: 'lp' }); i += 1; continue; }
    if (c === ')' || c === ']' || c === '}') { out.push({ t: 'rp' }); i += 1; continue; }

    return null;                                        // 未知字符（含全角符号、`?`、`=` 等）
  }
  if (!out.length) return null;
  return out;
};

/* ============================ ③ 语法（递归下降） ============================ */

/**
 * 文法（自上而下，优先级由低到高）：
 *   expr    := term (('+'|'-') term)*
 *   term    := factor (('*'|'/') factor)*
 *   factor  := ('+'|'-') factor | power        // 一元符号比 ^ 弱 → `-2^2` = -(2^2) = -4（与课本一致）
 *   power   := primary ('^' factor)?           // 右结合 → `2^3^2` = 2^(3^2) = 512；指数可带符号 → `2^-1`
 *   primary := num | name | func '(' expr ')' | '(' expr ')'
 *   name    := 'x' | 常量
 * @returns {object|null} AST；null = 语法非法
 */
export const parseMathExpression = (src) => {
  const tokens = tokenizeMathExpression(src);
  if (!tokens) return null;
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = (pred) => {
    const tk = tokens[pos];
    if (tk && pred(tk)) { pos += 1; return tk; }
    return null;
  };

  const parsePrimary = () => {
    const tk = peek();
    if (!tk) return null;
    if (tk.t === 'num') { pos += 1; return { k: 'num', v: tk.v }; }
    if (tk.t === 'lp') {
      pos += 1;
      const inner = parseExpr();
      if (!inner) return null;
      return eat((t) => t.t === 'rp') ? inner : null;
    }
    if (tk.t === 'name') {
      pos += 1;
      if (tk.v === 'x') return { k: 'x' };
      if (Object.prototype.hasOwnProperty.call(CONSTS, tk.v)) return { k: 'num', v: CONSTS[tk.v] };
      if (Object.prototype.hasOwnProperty.call(MATH_FUNCS, tk.v)) {
        if (!eat((t) => t.t === 'lp')) return null;      // 函数必须带括号：`sin x` 不认
        const arg = parseExpr();
        if (!arg) return null;
        if (!eat((t) => t.t === 'rp')) return null;
        return { k: 'call', f: tk.v, a: arg };
      }
      return null;                                       // 未知标识符
    }
    return null;
  };

  const parsePower = () => {
    const base = parsePrimary();
    if (!base) return null;
    const tk = peek();
    if (tk && tk.t === 'op' && tk.v === '^') {
      pos += 1;
      const exp = parseFactor();                         // 右结合 + 允许指数带一元符号
      if (!exp) return null;
      return { k: 'bin', op: '^', l: base, r: exp };
    }
    return base;
  };

  function parseFactor() {
    const tk = peek();
    if (tk && tk.t === 'op' && (tk.v === '+' || tk.v === '-')) {
      pos += 1;
      const inner = parseFactor();
      if (!inner) return null;
      return tk.v === '-' ? { k: 'neg', a: inner } : inner;
    }
    return parsePower();
  }

  const parseTerm = () => {
    let node = parseFactor();
    if (!node) return null;
    for (;;) {
      const tk = peek();
      if (tk && tk.t === 'op' && (tk.v === '*' || tk.v === '/')) {
        pos += 1;
        const rhs = parseFactor();
        if (!rhs) return null;
        node = { k: 'bin', op: tk.v, l: node, r: rhs };
      } else break;
    }
    return node;
  };

  function parseExpr() {
    let node = parseTerm();
    if (!node) return null;
    for (;;) {
      const tk = peek();
      if (tk && tk.t === 'op' && (tk.v === '+' || tk.v === '-')) {
        pos += 1;
        const rhs = parseTerm();
        if (!rhs) return null;
        node = { k: 'bin', op: tk.v, l: node, r: rhs };
      } else break;
    }
    return node;
  }

  const ast = parseExpr();
  if (!ast || pos !== tokens.length) return null;         // 残留 token（如 `1+2)` / `2x`）视为非法
  return ast;
};

/* ============================ ④ 求值 ============================ */

const evalNode = (n, x) => {
  switch (n.k) {
    case 'num': return n.v;
    case 'x': return x;
    case 'neg': return -evalNode(n.a, x);
    case 'call': return MATH_FUNCS[n.f](evalNode(n.a, x));
    case 'bin': {
      const a = evalNode(n.l, x);
      const b = evalNode(n.r, x);
      switch (n.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return a / b;
        case '^': return Math.pow(a, b);
        default: return NaN;
      }
    }
    default: return NaN;
  }
};

/**
 * 编译成 `(x) => number|null` 的**纯函数**（内部 AST 求值，无可执行代码构造）。
 * @returns {Function|null} null = 表达式非法（同时告警一次）
 */
export const compileMathExpression = (expr) => {
  const src = asText(expr);
  const ast = parseMathExpression(src);
  if (!ast) {
    warnOnce(`parse:${src}`, `[mathExpr] 表达式非法，已忽略：${src === '' ? '(空)' : src}`);
    return null;
  }
  return (x) => {
    const v = evalNode(ast, x);
    return Number.isFinite(v) ? v : null;               // 定义域外/非有限 → null（采样侧据此跳过）
  };
};

/**
 * 求值一次（便于单测与调试）。
 * @returns {number|null} 非法表达式或非有限结果 → null
 */
export const evaluateExpression = (expr, x) => {
  const fn = compileMathExpression(expr);
  if (!fn) return null;
  const xv = Number(x);
  if (!Number.isFinite(xv)) return null;
  return fn(xv);
};

/* ============================ ⑤ 采样（供函数图象用） ============================ */

const toDomain = (domain, fallback) => {
  const a = Array.isArray(domain) ? Number(domain[0]) : NaN;
  const b = Array.isArray(domain) ? Number(domain[1]) : NaN;
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return fallback ? fallback.slice() : null;
  return a < b ? [a, b] : [b, a];
};

/**
 * 在 domain 内等距采样并切成"可连线的折线段"。
 * @param {string} expr 表达式
 * @param {[number,number]} domain 采样区间（调用方缺省传 xlim）
 * @param {object} opts
 *   - count 采样点数，默认 240（规格定死）
 *   - view  [lo,hi] 纵轴可视范围（= ylim）：越界点被裁掉，裁剪处把折线**截在边界上**
 * @returns {{ok:boolean, samples:Array, segments:Array<Array<{x,y}>>, pointCount:number,
 *            segmentCount:number, maxJump:number}}
 *
 * 🔴 断点判据（被"1/x 不得连出一条跨越整幅的直线"逼出来的）：
 *   只看"相邻两采样点跳变很大"是错的 —— 陡而**连续**的直线（如 y=100x 在 ylim=[-10,10] 内）
 *   跳变同样很大，按跳变断开会把一条连续直线画成两截（实测踩过）。
 *   真正的判据是"这段区间里函数到底连不连续"：在两点之间补采 SUB_SAMPLES 个亚采样点，
 *   只要出现非有限值或跑出可视范围，就认定这里有极点/定义域断裂 → 断开。
 * ============================================================
 */
export const sampleExpression = (expr, domain, { count = 240, view = null } = {}) => {
  const empty = { ok: false, samples: [], segments: [], pointCount: 0, segmentCount: 0, maxJump: 0 };
  const fn = compileMathExpression(expr);
  const dom = toDomain(domain, null);
  if (!fn || !dom) return empty;

  const n = Math.max(2, Math.round(count));
  const [a0, a1] = dom;
  const raw = [];
  for (let i = 0; i < n; i += 1) {
    const x = a0 + ((a1 - a0) * i) / (n - 1);
    let y = null;
    try { y = fn(x); } catch { y = null; }
    raw.push({ x, y: Number.isFinite(y) ? y : null });
  }

  // 可视范围：优先用调用方给定的 view（= ylim）；未给则由数据自身推出来（纯 API 兜底）
  let lo; let hi;
  if (Array.isArray(view) && Number.isFinite(Number(view[0])) && Number.isFinite(Number(view[1])) && Number(view[1]) > Number(view[0])) {
    lo = Number(view[0]);
    hi = Number(view[1]);
  } else {
    const ys = raw.filter((p) => p.y != null).map((p) => p.y);
    lo = ys.length ? Math.min(...ys) : -1;
    hi = ys.length ? Math.max(...ys) : 1;
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  }
  const eps = (hi - lo) * 1e-9;
  const finiteAt = (i) => raw[i] != null && raw[i].y != null;
  const inView = (i) => finiteAt(i) && raw[i].y >= lo - eps && raw[i].y <= hi + eps;

  const isDiscontinuous = (p, q) => {
    for (let k = 1; k < SUB_SAMPLES; k += 1) {
      const x = p.x + ((q.x - p.x) * k) / SUB_SAMPLES;
      let y = null;
      try { y = fn(x); } catch { y = null; }
      if (!Number.isFinite(y) || y < lo - eps || y > hi + eps) return true;
    }
    return false;
  };
  // 互补判据（兜底）：相邻两点在可视跨度内跳了 85% 以上 → 也判断裂。
  // 为什么还要这一条：像 abs(x)/x 这种"符号阶跃"，跳变点刚好落在两次采样**之间**时，
  // 12 个亚采样点可能全部落在可视范围内（两侧各是一段平的 ±1），连续性判据看不出问题，
  // 于是两支会被一条竖直细线连起来。85% 这个阈值刻意取得很保守：连续陡线要触发它，
  // 斜率得大到"在图上本来就是一条竖线"，断不断视觉上无差别（100x 在 ylim=[-10,10] 里只跳 25%）。
  const jumpTooLarge = (p, q) => Math.abs(q.y - p.y) > 0.85 * (hi - lo);

  /** 越界点 → 折线在可视边界上的截断点（两相邻采样点间线性内插） */
  const clipToEdge = (outP, inP) => {
    const edge = outP.y < lo ? lo : hi;
    if ((outP.y - edge) * (inP.y - edge) > 0) return null;     // 同侧，不跨边界
    const t = (edge - outP.y) / (inP.y - outP.y);
    if (!(t >= 0 && t <= 1)) return null;
    return { x: outP.x + (inP.x - outP.x) * t, y: edge };
  };

  const segments = [];
  let maxJump = 0;
  let i = 0;
  while (i < n) {
    if (!inView(i)) { i += 1; continue; }
    const seg = [];
    if (i - 1 >= 0 && finiteAt(i - 1) && !inView(i - 1)) {
      const p = clipToEdge(raw[i - 1], raw[i]);
      if (p) seg.push(p);
    }
    seg.push({ x: raw[i].x, y: raw[i].y });
    let j = i;
    while (j + 1 < n && inView(j + 1)
      && !jumpTooLarge(raw[j], raw[j + 1])
      && !isDiscontinuous(raw[j], raw[j + 1])) {
      seg.push({ x: raw[j + 1].x, y: raw[j + 1].y });
      maxJump = Math.max(maxJump, Math.abs(raw[j + 1].y - raw[j].y));
      j += 1;
    }
    if (j + 1 < n && finiteAt(j + 1) && !inView(j + 1)) {
      const p = clipToEdge(raw[j + 1], raw[j]);
      if (p) seg.push(p);
    }
    if (seg.length >= 2) segments.push(seg);
    i = j + 1;
  }

  return {
    ok: true,
    samples: raw,
    segments,
    pointCount: segments.reduce((s, x) => s + x.length, 0),
    segmentCount: segments.length,
    maxJump,
  };
};

export default {
  normalizeMathSource,
  tokenizeMathExpression,
  parseMathExpression,
  compileMathExpression,
  evaluateExpression,
  sampleExpression,
  setMathExprWarnSink,
  MATH_FUNCTION_NAMES,
  MATH_CONSTANT_NAMES,
};
