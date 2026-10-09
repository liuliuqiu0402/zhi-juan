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
    // 🔴 2026-10-09（〔291〕画线族·原则化）：原锚枚举"画线句子/画线词语/画线部分/划出文中…句"，对"划线/标出/描出"
    //    等措辞够不着（与加点同构的"丁×乙"）。现锚改判据式"凡题干以画线/划线/划出/画出…标示待标处"，并明写对象类型不设限。
    //    本处锁：原则化不得回退。
    expect(r.promptHint, '锚须为判据式（不再枚举"画线句子/画线词语"）').toContain('凡题干以');
    expect(r.promptHint, '对象类型不设限').toContain('画线对象不限于句子或词语');
    // 🔴 2026-10-09（属主裁定·"择定判定法"同族横扫·零裸奔）：画线与加点同族，一并补"按题干要求判"判定法。
    expect(r.promptHint, '画线须有"按题干要求判"判定法').toContain('画线对象按题干要求判');
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
    // 🔴 2026-10-09（〔282〕〔283〕腿1·扩锚）：原锚写死"加点的词语"，对"照样子"类题的**句式样板**（如"有时候…"
    //    "在…"）够不着 → 修复不生效。现锚改为判据式"加点对象"，并明写对象类型不设限。本处锁：扩锚不得回退。
    // 🔴 2026-10-09（属主裁定·"择定判定法"·照〔附·4·严〕）：原正句只说"与题干所指加点对象相对应"——
    //    **只给方向、未给判定法** ⇒ 模型无从自判"所指"是哪个单位（实测：该点"教"点了"室"、该点"有时候"点了"温和"）。
    //    现改为与**载体同式**的判定法（载体原文＝"**按所填内容是什么判**：填符号→括号、填短答→横线"）。
    //    本处锁：判定法在位、且旧的"只指方向"表述已撤（防回退）。
    expect(r.promptHint, '加点须有"按题干要求判"判定法').toContain('加点对象按题干要求判');
    expect(r.promptHint, '只点"题干所要求学生标示的那个单位"').toContain('题干所要求学生标示的那个单位');
    expect(r.promptHint, '不得自选（消歧）').toContain('不得按“哪个词更像重点/答案”自选');
    expect(r.promptHint, '对象类型不设限（覆盖句式标志成分）').toContain('加点对象不限于词语');
    // 🔴 2026-10-09（属主裁定·撤回加字）：本轮曾试加"标记对象自洽…择定只以题干要求为唯一依据"一句，
    //    经判据层复核＝与原"**凡题干所指…皆须照标**"**同义**（属**同义稀释**、且违"不加字/不打补丁"）
    //    ⇒ **已删除**（净增回到 0）。故此处**不再锁该句**；加点"点哪个单位"仍由**单源正句**承载：
    //    "与题干所指加点对象相对应"＋"加点对象不限于词语…皆须照标"（上式两锁即其守卫）。
    expect(r.subjects).toEqual(['语文']);

    const zh = buildValidatorPrompt({ subject: '语文', stage: 'primary_mid', genType: 'practice' });
    expect(zh).toContain('emphasis-dot');
    const en = buildValidatorPrompt({ subject: '英语', stage: 'primary_high', genType: 'practice' });
    expect(en).not.toContain('emphasis-dot');
  });
});
