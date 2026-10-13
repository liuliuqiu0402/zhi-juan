// ============================================================
// 防同质化 · 留白不退化守卫（2026-10-13 增 · 属主："不能限制在勾选的那本教材里，以前学过的要允许使用"
//   ＋ "无限生成不同质" ⇒ 把"刻意留白"做成机检，防后续改条把它们挤掉）
// ------------------------------------------------------------
// 为什么需要它：本项目的**防同质化**不是靠"更细的规定"，而是靠**刻意留白**（来源不限／组名自定／
//   资料内多样／情境按质量底线选配…）。这类留白**极易在下一次"补规范"时被顺手删掉**（历史上多次发生）。
//   故在此锁死：**面数精确等值**——少一面＝机制退化；多一面＝又冒出第二处复述（两条都是病）。
// 口径与门同源：面级装配 = `scripts/instructionText.mjs`（单源，门与本办法共用同一份装配）。
// ============================================================
import { describe, it, expect } from 'vitest';
import { faceTexts } from '../../scripts/instructionText.mjs';
import { COVERAGE_EXTENT } from '../../src/config/coverageContract.js';

const FACES = faceTexts();
const has = (s) => FACES.filter((f) => f.text.includes(s));

/** 留白基线（面数）＝2026-10-13 在 **486 面装配结果**上实测 */
const BLANKS = [
  { s: '来源不限、不作指定', n: 486, why: '素材来源不指定（防"内容被钉死在勾选教材"）' },
  { s: '【尾约束·资料内多样】', n: 486, why: '资料内多样（尾约束）' },
  { s: '避免各栏反复套用同一种版式', n: 486, why: '不同栏目之间形式可有差异' },
  { s: '自行定（不作指定）', n: 270, why: '组与组名由模型自定（题类 5 型）' },
  { s: '情境按【质量底线】选配', n: 162, why: '不写"每题必须有情境"（3 型组织风格档）' },
  { s: '也可联系**已学**内容（先前学段/册次）作铺垫', n: 108, why: '2026-10-13 属主新要求：以前学过的允许使用' },
];

/** 反向锁：已放宽／已修的旧字面，全域必须 0（回潮即红） */
const BANNED = [
  { s: '不臆断学生是否已学', why: 'Z17：2026-10-13 已放宽为"可联系已学内容"（旧禁令=对已学的封禁）' },
  { s: '一、知识梳理', why: '内容型 <h2> 示例名：会被多份产出逐字沿用 ⇒ 同质化' },
  { s: '见【输出格式】的块内组织条款', why: 'Z11：引用落点不实（实际在【编号与组织】）' },
  { s: '拼音／词语／句子', why: 'Z8：旧枚举漏英语字母/单词' },
  { s: '加粗只用于层级标题与讲解示范引出', why: 'Z10：旧口径使 review"重点难点突出"无标注手段' },
];

describe('防同质化：刻意留白不得退化（面级计数·精确等值）', () => {
  it('留白条款面数＝基线（少一面＝机制被挤掉；多一面＝又冒出第二处复述）', () => {
    const bad = [];
    for (const { s, n, why } of BLANKS) {
      const got = has(s).length;
      if (got !== n) bad.push(`「${s}」（${why}）实际 ${got} 面 ≠ 基线 ${n} 面`);
    }
    expect(bad, '留白机制退化或被复制').toEqual([]);
  });

  it('已学许可：恰在 integrate 类面在场（不在别类乱入），且旧禁令全域 0', () => {
    const integrate = new Set(
      Object.entries(COVERAGE_EXTENT).filter(([, v]) => v === 'integrate').map(([k]) => k),
    );
    const where = has('也可联系**已学**内容（先前学段/册次）作铺垫');
    expect(where.length, '须与本契约 integrate 类面数一致').toBe(
      FACES.filter((f) => integrate.has(f.genType)).length,
    );
    expect(where.every((f) => integrate.has(f.genType)), '不得外溢到 expand／strict 类').toBe(true);
    expect(has('不臆断学生是否已学').length, '旧禁令（封禁已学）不得回潮').toBe(0);
  });

  it('反向锁：已放宽/已修的旧字面全域 0', () => {
    const bad = [];
    for (const { s, why } of BANNED) {
      const got = has(s).length;
      if (got) bad.push(`旧字面回潮：「${s}」出现 ${got} 面（${why}）`);
    }
    expect(bad).toEqual([]);
  });
});
