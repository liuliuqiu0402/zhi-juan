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
    // 2026-10-03（①三维度·学科纯净）：原锁的英语语音示范（"…发音不同…see → ee"）已从这条**语英共用规则**中剥离——
    //  一条生成请求＝一学段＋一学科，语文条里不得出现英语样例。判据"画线部分须在词内标出目标字母/字词"仍在；
    //  英语语音辨析要求另由【英语学科事实底线】单源承载（"语音标注…字母组合须与题面标注范围逐字一致"）。
    expect(r.promptHint).toContain('词内标出');
    expect(r.promptHint).toContain('无效题');
    expect([...r.subjects].sort().join('')).toBe('英语语文');

    const en = buildValidatorPrompt({ subject: '英语', stage: 'primary_high', genType: 'practice' });
    expect(en).toContain('画线部分');
    const math = buildValidatorPrompt({ subject: '数学', stage: 'primary_high', genType: 'practice' });
    expect(math).not.toContain('underline-sentence');
  });

  it('zhupoint：判据为**原则式**（题干凡要求对某字加点即适用，不枚举措辞）＋加点硬性；仅语文注入', () => {
    const r = getValidatorRule('text-format-zhupoint');
    expect(r).toBeTruthy();
    // 🔴 2026-09-30（机制 B·判据可判定化）：原断言锁"给加点字选择正确读音"这一**具体措辞**，
    //    而正是枚举式判据导致"给加点的字选择正确的读音"（措辞一变）判据失效、加点字被写成加粗。
    //    现改锁**原则式判据**与"加粗不是加点"的消歧句。
    expect(r.promptHint).toContain('加点的字');
    expect(r.promptHint).toContain('加粗不是加点');
    expect(r.promptHint).toContain('emphasis-dot');
    expect(r.promptHint).toContain('无效题');
    expect(r.subjects).toEqual(['语文']);

    const zh = buildValidatorPrompt({ subject: '语文', stage: 'primary_mid', genType: 'practice' });
    expect(zh).toContain('emphasis-dot');
    const en = buildValidatorPrompt({ subject: '英语', stage: 'primary_high', genType: 'practice' });
    expect(en).not.toContain('emphasis-dot');
  });
});
