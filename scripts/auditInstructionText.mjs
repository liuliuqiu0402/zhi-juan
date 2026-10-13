#!/usr/bin/env node
/**
 * 入指令文本 · 枚举式审计（**可复跑·不依赖"守卫绿"**）
 * ============================================================
 * 为什么需要它（属主 2026-10-13 质询）："以前每次都回答这个层面上没问题了，可是一测试，问题还是这个层面上的"。
 *   根因＝**只根据"守卫全绿"推断"没问题"**，而守卫只覆盖**已登记**的不变量 ⇒ **未登记的面就是盲区**。
 *   本脚本换做法：对 486 面（54 开设对 × 9 类型）的**装配后指令文本**逐面枚举，**按块归因**后分类打印：
 *     · 红线维度 —— 命中即真错（exit 1）
 *     · 观察维度 —— 只报数+样例（有的是合法前指/语义词/课标要点，须人读判断）
 *
 * 用法：`node scripts/auditInstructionText.mjs`
 * 依据（属主裁定）：①"所有入指令文本不应有不严谨表述"（范围指代/指代不实）；②"真题只是框架，**备注**不得指定内容"；
 *   ③"要**适量**，不能改**定量**（定量相当于给死了数值）"。
 */
import { faceTexts } from './instructionText.mjs';

const faces = faceTexts();
if (faces.length !== 486) {
  console.log(`✗ 面集异常：${faces.length}（应为 486）⇒ 拒绝出结论`);
  process.exit(1);
}

const CONTENT_WORDS = /数据与编码|互联网应用与创新|物联网|人工智能与智慧社会|数据与计算|信息系统与社会|在线学习与生活|数字媒体初步|数字设备初步认识|用眼卫生|细胞代谢|遗传与变异|工艺流程|物质结构|化学用语|物质推断|元素符号|化学式|方程式|力学与电学综合|电磁学综合|数与式|方程不等式|解三角形|解析几何|二年级含表内乘法|一年级下册起|三年级含三位数加减|多位数乘一位数|六年级含解方程/;
/** 蓝图/栏目**备注行**的标记（buildStructureText 与教辅 reqLine 同款）——note 只在这一类行上 */
const isNoteLine = (ln) => ln.includes('【要求·须逐项落实】');
/** ⚠️ 只取标记**之后**的正文＝note 本体（标记**之前**是栏目名/大类名——栏目名按既有裁定**保留**，不在此维度内） */
const noteBodyOf = (ln) => {
  const i = ln.indexOf('【要求·须逐项落实】');
  return i < 0 ? '' : ln.slice(i + '【要求·须逐项落实】'.length);
};
/** 课标要点/学段要求块（属"课标要求"，不是备注） */
const isCaliberLine = (ln, blockHead) => /【[^】]*要点】|【学段要求/.test(blockHead);

const byBlock = (f) => {
  const out = [];
  let head = '(无块头)';
  for (const ln of String(f.text).split('\n')) {
    const m = ln.match(/【[^】\n]{1,20}】/);
    if (m) head = m[0];
    out.push({ ln, head });
  }
  return out;
};

/** 逐类统计（filter 返回 true 表示该行计入本维度） */
const DIMS = [
  ['🔴 旧范围指代·本单元/本课', (ln) => /本单元|本课/.test(ln)],
  ['🔴 非试卷面称"本卷"', (ln, f) => f.genType !== 'exam' && /本卷/.test(ln)],
  ['🔴 蓝图/栏目**备注行**（note 本体）含内容指定词', (ln) => isNoteLine(ln) && CONTENT_WORDS.test(noteBodyOf(ln))],
  ['· 课标要点块含"册次级"领域词（**属课标要求·报数备查**）', (ln, f, h) => isCaliberLine(ln, h) && CONTENT_WORDS.test(ln)],
  ['· 模糊量词·适量（**保留**·不得改定量）', (ln) => /适量/.test(ln)],
  ['· 定量型（数字＋道/题）', (ln) => /[0-9０-９]+\s*[-~～—至]?\s*[0-9０-９]*\s*(道|题)/.test(ln)],
  ['· 裸指代·下列/上述/此处', (ln) => /下列|上述|此处/.test(ln)],
];

const w = (s, n) => String(s).padEnd(n);
let red = 0;
console.log(`入指令文本枚举审计：${faces.length} 面（54 开设对 × 9 类型）\n`);
console.log(w('维度', 52) + w('命中面数', 10) + '样例');
console.log('-'.repeat(118));
for (const [label, pred] of DIMS) {
  const hitFaces = new Set();
  const samples = [];
  for (const f of faces) {
    for (const { ln, head } of byBlock(f)) {
      if (!pred(ln, f, head)) continue;
      hitFaces.add(f);
      if (samples.length < 2 && !samples.includes(head)) samples.push(head);
    }
  }
  const isRed = label.startsWith('🔴');
  if (isRed && hitFaces.size) red += 1;
  console.log(w(label, 52) + w(`${hitFaces.size}/${faces.length}`, 10) + samples.join(' ｜ '));
}
console.log('-'.repeat(118));
console.log(red === 0
  ? '结论：红线维度全部为 0（旧范围指代／非试卷面称"本卷"／蓝图备注行含内容指定 均未命中）'
  : `结论：✗ 有 ${red} 个红线维度命中 ⇒ 真错，须处置后再谈"没问题"`);
process.exit(red === 0 ? 0 : 1);
