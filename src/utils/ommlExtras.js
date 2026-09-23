/**
 * docx 缺失的 OMML 组件（自建补齐）
 * ============================================================
 * 🔴 为什么需要（2026-09 用户追问"docx 为啥没有方程组类、能补上吧"）：
 *    docx 是**按需实现**的库，不是完整 OOXML 生成器 —— 它实现了常见数学对象
 *    （分式 m:f、根式 m:rad、上下标 m:sSub/m:sSup、n 元算子 m:nary、括号 m:d），
 *    但 **方程数组 m:eqArr、重音 m:acc、上方附加 m:limUpp、矩阵 m:m 都没有对应类**。
 *    这是**上游覆盖面取舍，不是规范限制** —— docx 同时导出了 `XmlComponent` 扩展点，
 *    缺的部分可自行构造（已实测产出 `<m:eqArr><m:e>…</m:e></m:eqArr>` 等合法 OMML）。
 *
 *    补这些直接消掉 Word 导出仅剩的降级项：
 *      · cases 分段函数 / aligned 方程组 → m:eqArr（真·多行）
 *      · \vec \hat \bar \overline 等重音 → m:acc（真·重音，不再是组合字符）
 *      · \xrightarrow{条件} 化学箭头 → m:limUpp（条件真在箭头上方）
 *      · matrix/pmatrix/bmatrix 矩阵 → m:m + m:mr
 *      · | ‖ ⟨⟩ 等定界符 → m:d + 自定 begChr/endChr
 *
 * 🔴 写法照抄 docx 自身实现（super(rootKey) + root.push），保证序列化与命名空间一致。
 *    OMML 子元素顺序按 ECMA-376 规定（Properties 在前、必选主体在后），否则 Word 会判为损坏文档。
 * ============================================================
 */
import { XmlComponent, XmlAttributeComponent, MathBase, MathAccentCharacter } from 'docx';

/** 通用 m:val 字符属性（docx 未导出其 begChr/endChr 属性类） */
class CharValueAttributes extends XmlAttributeComponent {
  constructor(character) {
    super({ character });
    this.xmlKeys = { character: 'm:val' };
  }
}

/** 形如 `<m:xxx m:val="…"/>` 的字符元素 */
class CharValueElement extends XmlComponent {
  constructor(rootKey, character) {
    super(rootKey);
    this.root.push(new CharValueAttributes(character));
  }
}

/** 形如 `<m:xxx>子元素…</m:xxx>` 的容器 */
const container = (rootKey, children = []) => {
  const el = new XmlComponent(rootKey);
  for (const c of children) el.root.push(c);
  return el;
};

/** 归一：允许传单个组件或组件数组，统一成数组（避免调用方在"要不要再套一层"上出错） */
const asList = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

/**
 * m:eqArr —— 方程数组（多行，可整体被括号包裹）
 * 用于 cases 分段函数 与 aligned 方程组：**真·换行**，不再是"分号连写"。
 * @param {Array<Array|Object>} rows 每行：组件数组（或单个组件）
 */
export class MathEquationArray extends XmlComponent {
  constructor(rows) {
    super('m:eqArr');
    for (const row of rows) this.root.push(new MathBase(asList(row)));
  }
}

/** m:acc —— 重音（\vec \hat \bar \overline \underline \tilde \dot） */
export class MathAccent extends XmlComponent {
  constructor({ accent, children }) {
    super('m:acc');
    this.root.push(container('m:accPr', [new MathAccentCharacter(accent)]));
    this.root.push(new MathBase(asList(children)));
  }
}

/** m:bar —— 上划线 / 下划线（\overline、\underline）；这才是 OMML 对"线"的正确表达 */
export class MathBar extends XmlComponent {
  constructor({ pos, children }) {
    super('m:bar');
    this.root.push(container('m:barPr', [new CharValueElement('m:pos', pos === 'bot' ? 'bot' : 'top')]));
    this.root.push(new MathBase(asList(children)));
  }
}

/** m:lim —— 上限内容（供 m:limUpp 使用；docx 只有 m:limLoc，无 m:lim） */
class MathLimit extends XmlComponent {
  constructor(children) {
    super('m:lim');
    for (const c of children) this.root.push(c);
  }
}

/** m:limUpp —— 上方附加（化学方程式的反应条件写在箭头上方） */
export class MathLimitUpper extends XmlComponent {
  constructor({ children, limit }) {
    super('m:limUpp');
    this.root.push(new MathBase(asList(children)));
    this.root.push(new MathLimit(asList(limit)));
  }
}

/** m:mr —— 矩阵行 */
class MathMatrixRow extends XmlComponent {
  constructor(cells) {
    super('m:mr');
    for (const cell of cells) this.root.push(new MathBase(asList(cell)));
  }
}

/**
 * m:m —— 矩阵（单元格为真·列，Word 里可对齐）
 * @param {Array<Array>} rows 每行：单元格数组，单元格可为组件或组件数组
 */
export class MathMatrix extends XmlComponent {
  constructor(rows) {
    super('m:m');
    for (const cells of rows) this.root.push(new MathMatrixRow(Array.isArray(cells) ? cells : [cells]));
  }
}

/**
 * m:d —— 定界符（可自定义左右字符，供 |、‖、⟨⟩、单侧括号等 docx 未覆盖的场景）
 * @param {{beg:string, end:string, children:Array}} opts 空字符串表示该侧无定界符
 */
export class MathDelimiter extends XmlComponent {
  constructor({ beg, end, children }) {
    super('m:d');
    this.root.push(container('m:dPr', [
      new CharValueElement('m:begChr', beg == null ? '(' : beg),
      new CharValueElement('m:endChr', end == null ? ')' : end),
    ]));
    this.root.push(new MathBase(asList(children)));
  }
}

/**
 * m:groupChr —— 上下大括号（`\underbrace{…}` / `\overbrace{…}`）
 * 教材里用于"推导步骤标注"（如数列求和推导）与二项式定理。
 */
export class MathGroupChar extends XmlComponent {
  constructor({ chr, pos, children }) {
    super('m:groupChr');
    this.root.push(container('m:groupChrPr', [
      new CharValueElement('m:chr', chr),
      new CharValueElement('m:pos', pos === 'top' ? 'top' : 'bot'),
    ]));
    this.root.push(new MathBase(asList(children)));
  }
}

/**
 * m:f 且 m:type="noBar" —— 无横线分式，即组合数 `\binom{n}{k}` 的数学内核。
 * docx 的 MathFraction 不暴露 m:type，故自建。
 */
export class MathNoBarFraction extends XmlComponent {
  constructor({ numerator, denominator }) {
    super('m:f');
    this.root.push(container('m:fPr', [new CharValueElement('m:type', 'noBar')]));
    this.root.push(container('m:num', asList(numerator)));
    this.root.push(container('m:den', asList(denominator)));
  }
}

/**
 * m:nary —— n 元算子（∑ ∏ ∫ ∮ ∬ ⋃ ⋂ …）。
 * 🔴 docx 只实现了 ∑（MathSum）与 ∫（MathIntegral）两种、且算子字符写死；
 *    教材/物理里 ∏、∮、∬、⋃、⋂ 都真实出现，故泛化为可指定算子字符。
 *    子元素顺序按 ECMA-376：naryPr → sub → sup → e（sub/sup 必选，即使为空也要出）；
 *    naryPr 内部顺序 chr → limLoc → subHide → supHide。
 *    `m:limLoc=undOvr` 让上下限排在算子上下方（教材印刷形态，而非角标）。
 */
export class MathNary extends XmlComponent {
  constructor({ chr, sub, sup, children }) {
    super('m:nary');
    const subList = asList(sub);
    const supList = asList(sup);
    const pr = [
      new CharValueElement('m:chr', chr),
      new CharValueElement('m:limLoc', 'undOvr'),
    ];
    if (!subList.length) pr.push(new CharValueElement('m:subHide', 1));
    if (!supList.length) pr.push(new CharValueElement('m:supHide', 1));
    this.root.push(container('m:naryPr', pr));
    this.root.push(container('m:sub', subList));
    this.root.push(container('m:sup', supList));
    this.root.push(new MathBase(asList(children)));
  }
}

/**
 * m:oMathPara —— **展示式**（独占一行、可居中的块级公式）。
 * 🔴 为什么必须单独有这个：`m:oMath` 放在段落里是**行内**公式，会挤在文字流中；
 *    教材/试卷里的展示式（求根公式、分段函数、方程组）是**独占一行并居中**的，
 *    对应 OMML 的 `m:oMathPara`（内含 `m:oMath`）——docx 同样未实现，故自建。
 * 用法：作为某段落的**唯一子元素**（schema 上 m:oMathPara 属段落级元素）。
 * 子元素顺序：oMathParaPr → oMath（oMathParaPr 内为 jc）。
 */
export class MathDisplay extends XmlComponent {
  constructor({ children, jc = 'center' }) {
    super('m:oMathPara');
    this.root.push(container('m:oMathParaPr', [new CharValueElement('m:jc', jc)]));
    this.root.push(container('m:oMath', asList(children)));
  }
}

export default {
  MathEquationArray,
  MathAccent,
  MathBar,
  MathDisplay,
  MathGroupChar,
  MathLimitUpper,
  MathMatrix,
  MathNoBarFraction,
  MathNary,
  MathDelimiter,
};
