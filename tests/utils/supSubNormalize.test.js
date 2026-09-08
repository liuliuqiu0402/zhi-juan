/**
 * 上下标 Unicode 归一（规则 text-format-sup-sub 程序执行点）
 * 2026-09 接线前该规则仅 prompt 约束；接线后数理化卷生成后自动归一 ²³⁺ₙ → <sup>/<sub>（跳过 $…$ 公式区）
 */
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const wrap = (body) => `<div class="paper"><h2>一、填空题</h2>${body}<div class="answer-section"><h2>参考答案</h2></div></div>`;

describe('examValidator · text-format-sup-sub（数理化生成后归一执行点）', () => {
  it('数学卷：²³⁺ 泄漏 → 自动转为 <sup> 标记', () => {
    const html = wrap('<p>3² × 2³ ＝ 72，面积单位 cm²。</p>');
    const { html: out } = auditExamPaper(html, { subject: '数学', stage: 'primary_high', genType: 'practice' });
    expect(out).toContain('3<sup>2</sup>');
    expect(out).toContain('2<sup>3</sup>');
    expect(out).toContain('cm<sup>2</sup>');
    expect(out).not.toContain('²');
  });

  it('化学卷：H₂O 下标 → <sub>', () => {
    const html = wrap('<p>电解水：2H₂O ＝ 2H₂↑ ＋ O₂↑。</p>');
    const { html: out } = auditExamPaper(html, { subject: '化学', stage: 'middle', genType: 'practice' });
    expect(out).toContain('H<sub>2</sub>O');
    expect(out).not.toContain('₂');
  });

  it('$…$ 公式区跳过（防破坏公式语法）', () => {
    const html = wrap('<p>设 $x²$ 与 $y₂$ 待求。</p>');
    const { html: out } = auditExamPaper(html, { subject: '数学', stage: 'middle', genType: 'practice' });
    expect(out).toContain('$x²$');
    expect(out).toContain('$y₂$');
  });

  it('非数理化（语文）不触发归一', () => {
    const html = wrap('<p>文中提到 5² 层楼。</p>');
    const { html: out } = auditExamPaper(html, { subject: '语文', stage: 'primary_high', genType: 'practice' });
    expect(out).toContain('5²');
  });
});
