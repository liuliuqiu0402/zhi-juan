// 输入超长「关键块优先」压缩：纯函数化后的**行为特征**（2026-09-30 用户裁定 · 方案第一步/第二步）
// 目的两条：
//   ① 抽函数**不得改行为**——同一输入 → 同一 text（与抽出前的内联实现逐字节等价，按既有语义钉住）；
//   ② 把"顺序反转 / 整体丢段 / 写作路径其实不压缩素材"这些既有行为变成**可观测**（notes → 生成报告）。
// 为什么需要：该分支内联在 `callAI` 里，跑不了离线断言；且原先只 console.warn，用户侧不可见 = 静默。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { compressOverlongPrompt } from '../../src/utils/promptCompression.js';

const ROOT = path.resolve(__dirname, '../..');
// 确定性估算器（1 字符 = 1 token）→ 预算可控、断言不依赖启发式
const est = (t) => String(t || '').length;

/** 写作路径的典型拼装：素材块是【锚点清单】/【压缩原文】（**不是**教材原文/模板参考） */
const WRITING_PROMPT = [
  '【锚点清单】' + '一、主题\n· 知识点。'.repeat(30),
  '【压缩原文】' + '教材语段。'.repeat(30),
  '【素材使用约定】…（口径）',
  '【创作要求】' + '要求正文。'.repeat(200),
  '【尾约束·全文自洽】' + '三域复核。'.repeat(20),
  '【尾约束·资料内多样】' + '不重复。'.repeat(20),
].join('\n\n');

describe('超长压缩纯函数：写作路径的实际行为', () => {
  it('🔴 素材块不属"教材原文/模板参考"分类 → 该分支在写作路径下**不压缩任何素材**', () => {
    const r = compressOverlongPrompt(WRITING_PROMPT, { maxInputTokens: 600, estimateTokens: est });
    expect(r.stats.material, '【锚点清单】/【压缩原文】不落入素材分类').toBe(0);
    expect(r.notes.join('\n'), '须如实交代，不得让"压缩"名不副实').toContain('未做任何素材压缩');
  });

  it('🔴 顺序反转：关键块被**整体前置**，其余段落后置 → 尾约束不在末尾（末尾锚定在本分支失效）', () => {
    // 给足预算 → 只暴露"顺序"这一既有行为（不触发整体丢弃）
    const r = compressOverlongPrompt(WRITING_PROMPT, { maxInputTokens: 100000, estimateTokens: est });
    expect(r.text.startsWith('【尾约束·全文自洽】'), '关键块被前置').toBe(true);
    const iTail = r.text.lastIndexOf('【尾约束·资料内多样】');
    const iLater = r.text.indexOf('【创作要求】');
    expect(iLater, '后置段落排在尾约束之后').toBeGreaterThan(iTail);
    expect(r.text.trimEnd().endsWith('要求正文。'), '末尾是后置段落而非尾约束').toBe(true);
    expect(r.notes.join('\n'), '须如实告警"末尾锚定失效"').toContain('末尾锚定在本分支失效');
    expect(r.stats.truncated, '本组未触发整体丢弃').toBe(false);
  });

  it('🔴 非关键段落可被**整体丢弃**（不只是"压缩"），且逐个点名', () => {
    const r = compressOverlongPrompt(WRITING_PROMPT, { maxInputTokens: 600, estimateTokens: est });
    expect(r.stats.truncated).toBe(true);
    expect(r.stats.dropped.length, '丢弃的段落要被点名').toBeGreaterThan(0);
    expect(r.stats.dropped).toContain('创作要求');
    expect(r.notes.join('\n')).toContain('非关键段落被整体丢弃');
    // 丢弃后 text 只剩关键块（此处无素材保留）
    expect(r.text).not.toContain('要求正文');
  });

  it('素材路径（【教材原文】）仍按原逻辑逐句压缩；整段放不下即省略并附加系统提示', () => {
    const p = '【教材原文】' + '句子。'.repeat(200) + '\n\n【尾约束·全文自洽】' + 'x'.repeat(700);
    const r = compressOverlongPrompt(p, { maxInputTokens: 1000, estimateTokens: est });
    expect(r.stats.material, '教材原文段被识别为素材').toBe(1);
    expect(r.text.endsWith('如需完整参考请分段生成或增加上下文窗口】\n'), '省略提示须附加').toBe(true);
    expect(r.notes.join('\n')).toContain('参考段落被压缩或省略');
    expect(r.stats.instruction, '本输入没有非关键段落').toBe(0);
    expect(r.notes.join('\n'), '没有后置段落时不得乱报"尾锚失效"').not.toContain('末尾锚定在本分支失效');
  });

  it('确定性：同一输入 → 同一 text（抽函数不得引入随机/顺序不稳）', () => {
    const a = compressOverlongPrompt(WRITING_PROMPT, { maxInputTokens: 600, estimateTokens: est });
    const b = compressOverlongPrompt(WRITING_PROMPT, { maxInputTokens: 600, estimateTokens: est });
    expect(a.text).toBe(b.text);
    expect(a.notes).toEqual(b.notes);
  });

  it('空输入不抛错（退化输入的安全网）', () => {
    expect(() => compressOverlongPrompt('', { maxInputTokens: 1000, estimateTokens: est })).not.toThrow();
  });
});

describe('单一事实源：压缩逻辑不得在生成端留第二份', () => {
  const ai = () => fs.readFileSync(path.join(ROOT, 'src', 'composables', 'useAiGenerator.js'), 'utf8');

  it('生成端改为调用纯函数，内联副本不得回归', () => {
    const s = ai();
    expect(s).toContain('compressOverlongPrompt(finalPrompt');
    for (const gone of [
      'const guaranteeRegex = /角色身份|顶层约束|尾约束|答案区',
      'const sections = finalPrompt.split(/\\n(?=【)/)',
      'const omittedSections = [];',
    ]) expect(s, `内联副本不得回归：${gone}`).not.toContain(gone);
  });

  it('压缩告警经 bodyPathNotes 进生成报告（不得只 console = 静默）', () => {
    const s = ai();
    expect(s).toContain('promptShapeNotes.push(...compressed.notes)');
    expect(s).toContain('bodyPathNotes.push(...promptShapeNotes.splice(0))');
  });
});
