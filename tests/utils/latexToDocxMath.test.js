/**
 * LaTeX → docx 真公式（Word 公式对象）回归锁
 * ============================================================
 * 🔴 本轮修的缺陷（2026-09 用户实证）：Word 导出对公式的处理只在"整个文本节点恰好是 $...$"时命中
 *    （真实语句「半径为 $r$ 的圆」永不命中），命中时也只是剥掉 $ 后涂成**深蓝斜体**——
 *    于是 Word 交付物里 `\frac{a}{b}` 原样泄漏，既非公式也非印刷样式。
 *    现改为产出**真正的 Word 公式对象**（docx 内置 OMML 支持），可编辑、印刷级。
 *
 * 🔴 宁缺勿错：只转换能确定正确表达的子集；遇到不支持的构造整体返回 null（调用方降级为
 *    可读 Unicode 文本）。**错公式比纯文本更糟**——看起来对、实际错了。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { Document, Packer, Paragraph } from 'docx';
import { latexToDocxMath } from '@/utils/latexToDocxMath.js';

describe('latexToDocxMath：支持的子集产出真公式', () => {
  it('分式 / 根式（含 n 次方）', () => {
    expect(latexToDocxMath('\\frac{a}{b}')).toBeTruthy();
    expect(latexToDocxMath('\\sqrt{x+1}')).toBeTruthy();
    expect(latexToDocxMath('\\sqrt[3]{8}')).toBeTruthy();
  });

  it('上下标：^ / _ / 连续挂载', () => {
    expect(latexToDocxMath('x^{2}')).toBeTruthy();
    expect(latexToDocxMath('H_{2}O')).toBeTruthy();
    expect(latexToDocxMath('x_{i}^{2}')).toBeTruthy();
    expect(latexToDocxMath('x ^ 2')).toBeTruthy(); // 上下标前允许空白
  });

  it('n 元算子（∑ / ∫，含上下限与作用对象）', () => {
    expect(latexToDocxMath('\\sum_{i=1}^{n} i')).toBeTruthy();
    expect(latexToDocxMath('\\int_{0}^{1} x')).toBeTruthy();
  });

  it('函数/算子名走正体，紧随 {} 时补空格避免 "sinx"', () => {
    expect(latexToDocxMath('\\sin x')).toBeTruthy();
    expect(latexToDocxMath('\\sin{x}')).toBeTruthy();
    expect(latexToDocxMath('\\lim_{x\\to 0}')).toBeTruthy();
  });

  it('成对括号 \\left…\\right（圆/方/花）', () => {
    expect(latexToDocxMath('\\left(x+1\\right)')).toBeTruthy();
    expect(latexToDocxMath('\\left[x\\right]')).toBeTruthy();
    expect(latexToDocxMath('\\left\\{x\\right\\}')).toBeTruthy();
  });

  it('\\text 正体文字（化学条件等）与常用符号/希腊字母', () => {
    expect(latexToDocxMath('\\text{点燃}')).toBeTruthy();
    expect(latexToDocxMath('\\alpha+\\beta')).toBeTruthy();
    expect(latexToDocxMath('a\\times b\\leq c')).toBeTruthy();
  });

  it('真实教材公式整串可转换', () => {
    for (const f of ['v=\\frac{s}{t}', 'E_k=\\frac{1}{2}mv^{2}', 'x=\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}',
      '\\frac{1}{R}=\\frac{1}{R_1}+\\frac{1}{R_2}']) {
      expect(latexToDocxMath(f), f).toBeTruthy();
    }
  });
});

describe('latexToDocxMath：宁缺勿错（确实不支持的构造才 null，交调用方降级）', () => {
  it('未登记的命令 / 环境 → null（不猜着转换）', () => {
    expect(latexToDocxMath('\\unknowncmd{x}')).toBe(null);
    expect(latexToDocxMath('\\begin{array}{cc}a&b\\end{array}')).toBe(null); // 带列格式的 array 未登记
    expect(latexToDocxMath('\\boxed{x}')).toBe(null);
    expect(latexToDocxMath('\\substack{a\\\\b}')).toBe(null);
  });

  it('未闭合的括号 / 残留未消费 → null', () => {
    expect(latexToDocxMath('\\left(x+1')).toBe(null);
    expect(latexToDocxMath('a}b')).toBe(null);
  });

  it('混合定界符是合法 LaTeX（半开区间）→ 照实产出，不再误拒', () => {
    // `\left[a,b\right)` 表示半开区间，教材里正常出现；此前被"必须同类括号"的判定误拒
    expect(latexToDocxMath('\\left[a,b\\right)')).toBeTruthy();
    expect(latexToDocxMath('\\left|x\\right|')).toBeTruthy();
  });

  it('空输入 → null', () => {
    expect(latexToDocxMath('')).toBe(null);
    expect(latexToDocxMath('   ')).toBe(null);
    expect(latexToDocxMath(null)).toBe(null);
  });
});

describe('自建 OMML 补齐：docx 未实现的类也能产出真结构', () => {
  // 🔴 docx 是"按需实现"的库：方程数组 m:eqArr、重音 m:acc、上方附加 m:limUpp、
  //    矩阵 m:m、上下线 m:bar 都没有对应类。本仓库用其 XmlComponent 扩展点自建补齐。
  const xmlOf = async (latex) => {
    const doc = new Document({ sections: [{ children: [new Paragraph({ children: [latexToDocxMath(latex)] })] }] });
    const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
    return zip.file('word/document.xml').async('string');
  };

  it('分段函数 → m:eqArr 真多行，外层是花括号 m:d', async () => {
    const xml = await xmlOf('f(x)=\\begin{cases}x+1,&x>0\\\\0,&x=0\\end{cases}');
    expect(xml).toContain('<m:eqArr');
    expect(xml).toContain('<m:e>');            // 每个分支一行
    expect(xml).toContain('m:val="{"');        // 左花括号
    expect(xml, '两行必须各成一行，不能并成一行').toMatch(/<m:eqArr>.*<\/m:e><m:e>.*<\/m:e><\/m:eqArr>/);
  });

  it('矢量 → m:acc 真重音（箭头符在 m:chr）', async () => {
    const xml = await xmlOf('\\vec{F}=m\\vec{a}');
    expect(xml).toContain('<m:acc>');
    expect(xml).toContain('<m:accPr>');
    expect(xml).toContain('<m:chr m:val="⃗"');
  });

  it('上划线 → m:bar pos=top（OMML 的正确表达）', async () => {
    const xml = await xmlOf('\\overline{AB}');
    expect(xml).toContain('<m:bar>');
    expect(xml).toContain('<m:barPr>');
    expect(xml).toContain('m:val="top"');
  });

  it('🔴 化学方程式（\\mathrm 包裹）必须保住下标与箭头条件，不得被塌成纯文本', async () => {
    // 曾一律 plainOf 塌成纯文本 → 下标被吞（H₂O 变 HO）、箭头条件结构消失 = 静默错内容
    const xml = await xmlOf('\\mathrm{2H_{2}+O_{2}\\xrightarrow{\\text{点燃}}2H_{2}O}');
    expect(xml, '下标 H_2 必须保留').toContain('<m:sSub');
    expect(xml, '反应条件必须在箭头上方（m:limUpp）').toContain('<m:limUpp>');
    expect(xml).toContain('<m:lim>');
    expect(xml).toContain('点燃');
    // 元素符号与系数一个都不能少（防"塌成纯文本后只剩首字母"）
    for (const t of ['<m:t>2</m:t>', '<m:t>H</m:t>', '<m:t>O</m:t>']) {
      expect(xml, `缺少 ${t}`).toContain(t);
    }
  });

  it('\\text 纯文字仍塌成单个 run（排版干净）', async () => {
    const xml = await xmlOf('\\text{点燃}');
    expect(xml).toContain('<m:t>点燃</m:t>');
    expect((xml.match(/<m:r>/g) || []).length).toBe(1);
  });

  it('矩阵 → m:m + m:mr（单元格各自成列）', async () => {
    const xml = await xmlOf('\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}');
    expect(xml).toContain('<m:m>');
    expect(xml).toContain('<m:mr>');
    expect((xml.match(/<m:mr>/g) || []).length).toBe(2);
    expect(xml).toContain('m:val="("'); // pmatrix 的圆括号
  });

  it('半开区间 → m:d 自定义 begChr/endChr', async () => {
    const xml = await xmlOf('\\left[a,b\\right)');
    expect(xml).toContain('m:val="["');
    expect(xml).toContain('m:val=")"');
  });
});

describe('端到端：打包 docx 后确实生成 OMML（Word 公式 XML）', () => {
  it('端到端：括号类型不得静默认错（方括号必须落成 [ 而非回退成圆括号）', async () => {
    // 🔴 回归锁：`[`/`]` 被词法器单独分词，曾使 `\left[x\right]` 的右定界符取不到、回退成 ')'
    //    → 方括号被静默渲染成圆括号（看起来正常、其实错了）
    const doc = new Document({
      sections: [{ children: [new Paragraph({ children: [latexToDocxMath('\\left[x+1\\right]')] })] }],
    });
    const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
    const xml = await zip.file('word/document.xml').async('string');
    expect(xml).toContain('m:val="["');
    expect(xml).toContain('m:val="]"');
  });

  it('分式/根式/上下标/n 元算子都落成 m:oMath 结构', async () => {
    const nodes = [
      latexToDocxMath('\\frac{a}{b}'),
      latexToDocxMath('\\sqrt[3]{8}'),
      latexToDocxMath('x_{i}^{2}'),
      latexToDocxMath('\\sum_{i=1}^{n} i'),
    ];
    expect(nodes.every(Boolean)).toBe(true);

    const doc = new Document({ sections: [{ children: [new Paragraph({ children: nodes })] }] });
    const buf = await Packer.toBuffer(doc);
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file('word/document.xml').async('string');

    // 真公式的标志：OMML 命名空间结构存在（而非纯文本）
    expect(xml).toContain('<m:oMath');
    expect(xml).toContain('<m:f');       // 分式
    expect(xml).toContain('<m:num');
    expect(xml).toContain('<m:den');
    expect(xml).toContain('<m:rad');     // 根式
    expect(xml).toContain('<m:deg');     // n 次方次数
    expect(xml).toContain('<m:sSubSup'); // 上下标并排
    expect(xml).toContain('<m:nary');    // n 元算子
    expect(xml, '不得把 LaTeX 源码原样写进 Word').not.toContain('\\frac');
  });
});
