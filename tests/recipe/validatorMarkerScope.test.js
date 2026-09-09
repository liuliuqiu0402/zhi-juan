// 2026-09：画线/加点"真实词内/词上标记"规则补位回归
// 背景：随堂巩固出现"题干写'画线部分'但选项词内无任何画线标记"（英语语音辨析/语文给加点字选读音），
//       根因是注入示范只覆盖"画线句子/画线词语/圈出加点字"，未教模型"画线部分需在词内标出字母组合、
//       给加点字选读音需先加点"——已补位示范与自洽性硬性；本测试锁定补位内容与学科注入范围。
import { describe, it, expect } from 'vitest';
import { getValidatorRule, buildValidatorPrompt } from '@/config/validatorRules.js';

describe('画线/加点真实标记规则补位（2026-09）', () => {
  it('underline：覆盖"画线部分"并给出词内标字母组合示范与硬性自洽；仅语文/英语注入', () => {
    const r = getValidatorRule('text-format-underline');
    expect(r).toBeTruthy();
    expect(r.promptHint).toContain('画线部分');
    expect(r.promptHint).toContain('<u class="underline-sentence">');
    expect(r.promptHint).toContain('发音');
    expect(r.promptHint).toContain('无效题');
    expect([...r.subjects].sort().join('')).toBe('英语语文');

    const en = buildValidatorPrompt({ subject: '英语', stage: 'primary_high', genType: 'practice' });
    expect(en).toContain('画线部分');
    const math = buildValidatorPrompt({ subject: '数学', stage: 'primary_high', genType: 'practice' });
    expect(math).not.toContain('underline-sentence');
  });

  it('zhupoint：覆盖"给加点字选择正确读音"的加点硬性；仅语文注入', () => {
    const r = getValidatorRule('text-format-zhupoint');
    expect(r).toBeTruthy();
    expect(r.promptHint).toContain('给加点字选择正确读音');
    expect(r.promptHint).toContain('emphasis-dot');
    expect(r.promptHint).toContain('无效题');
    expect(r.subjects).toEqual(['语文']);

    const zh = buildValidatorPrompt({ subject: '语文', stage: 'primary_mid', genType: 'practice' });
    expect(zh).toContain('给加点字选择正确读音');
    const en = buildValidatorPrompt({ subject: '英语', stage: 'primary_high', genType: 'practice' });
    expect(en).not.toContain('给加点字');
  });
});
