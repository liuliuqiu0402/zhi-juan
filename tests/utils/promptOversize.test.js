// 输入超长：**只体检、不改文本** + 上限口径按引擎分三支（2026-09-30 用户裁定 · 第三步）
// ============================================================
// 改前的问题（都要作为回归点锁住）：
//   · 旧实现会**改动文本**：把"命中保留关键词的块"整体前置、其余段落超预算时整体丢弃；
//   · 旧实现认的素材段是"段头为【教材原文/【模板参考/【教材参考"的整段，而**素材段常把其后的指令
//     一并吞进来**（分析任务 prompt 的形状：`【教材原文】\n<原文>\n\n请完成以下分析任务：…必须返回
//     以下 JSON 格式…` 同处一段）→ 逐句压缩会连指令/输出格式一起吃掉 = 误伤；
//   · 写作/答案类调用没有它认的素材段 → 旧行为对这类调用**只有重排 + 丢段**，最坏丢掉答案页的【正文】。
// 改后不变式：**text 恒等于入参**（一个字符都不动），只产出可诊断告警；超长交由 API 显式报错。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { inspectOverlongPrompt } from '../../src/utils/promptOversize.js';
import { resolveMaxInputTokens, resolveEngineOutputLimit } from '../../src/config/apiConfig.js';

const ROOT = path.resolve(__dirname, '../..');
const est = (t) => String(t || '').length;

/** 写作请求形状：素材块是【锚点清单】/【压缩原文】，不属"教材原文"分类 */
const WRITING_PROMPT = [
  '【锚点清单】' + '一、主题\n· 知识点。'.repeat(30),
  '【压缩原文】' + '教材语段。'.repeat(30),
  '【创作要求】' + '要求正文。'.repeat(200),
  '【尾约束·全文自洽】' + '三域复核。'.repeat(20),
].join('\n\n');

/** 答案页调用形状：旧实现会把【正文】当"非关键段落"整体丢掉 */
const ANSWER_PROMPT = '【压缩原文·答案参考】' + '参考语段。'.repeat(30)
  + '\n\n【正文】\n' + '一、选择题\n1. 题干一（　）\n'.repeat(50)
  + '\n\n【答案规范】\n答案区每个题目都以与正文完全相同的题号起头。' + '规范。'.repeat(50);

/** 🔴 分析任务形状：素材段**把其后的指令与 JSON 格式要求一并吞在同一段**（压缩会误伤的真凭据） */
const ANALYSIS_PROMPT = '你是一位语文教学专家。请分析以下教材内容：\n\n'
  + '【教材原文】\n' + '原文句子。'.repeat(300)
  + '\n\n请完成以下分析任务：\n1. 图表描述\n2. 公式提取\n必须返回以下 JSON 格式：\n{"a":1}\n只返回 JSON。';

const SHAPES = [
  ['写作请求', WRITING_PROMPT],
  ['答案页调用（含【正文】）', ANSWER_PROMPT],
  ['分析任务（素材段吞指令）', ANALYSIS_PROMPT],
];

describe('① text 恒等于入参：一律不改动文本（逐字节）', () => {
  for (const [label, src] of SHAPES) {
    it(`${label} → text 与输入完全一致`, () => {
      const r = inspectOverlongPrompt(src, { maxInputTokens: 300, estimateTokens: est });
      expect(r.text).toBe(src);
      expect(r.stats.changed).toBe(false);
    });
  }

  it('🔴 答案页：【正文】与题干必须完整（旧实现的最坏后果）', () => {
    const r = inspectOverlongPrompt(ANSWER_PROMPT, { maxInputTokens: 200, estimateTokens: est });
    expect(r.text).toContain('【正文】');
    expect(r.text).toContain('1. 题干一');
    expect(r.text).not.toContain('因输入长度受限已被压缩或省略');
  });

  it('🔴 分析任务：指令与 JSON 格式要求不得被吃掉（素材段吞指令的真凭据）', () => {
    const r = inspectOverlongPrompt(ANALYSIS_PROMPT, { maxInputTokens: 200, estimateTokens: est });
    expect(r.text).toContain('请完成以下分析任务：');
    expect(r.text).toContain('必须返回以下 JSON 格式：');
    expect(r.text.trimEnd().endsWith('只返回 JSON。'), '末尾未被截断').toBe(true);
  });

  it('首尾空白也逐字节保留', () => {
    const src = '  ' + WRITING_PROMPT + '\n\n  ';
    expect(inspectOverlongPrompt(src, { maxInputTokens: 10, estimateTokens: est }).text).toBe(src);
  });
});

describe('② 告警如实交代"超长事实 + 为何不动文本"', () => {
  it('运行报告里能看出：超了多少、有没有素材段、为何不压缩', () => {
    const r = inspectOverlongPrompt(ANALYSIS_PROMPT, { maxInputTokens: 300, estimateTokens: est });
    expect(r.stats.totalTokens).toBeGreaterThan(300);
    expect(r.stats.limit).toBe(300);
    expect(r.stats.material, '检出素材段').toBe(1);
    const notes = r.notes.join('\n');
    expect(notes).toContain('超出上限');
    expect(notes).toContain('不改动任何文本');
    expect(notes, '有素材段时必须说明为何不压缩（无法可靠划界）').toContain('逐句压缩会误伤指令');
    expect(notes, '给出可操作建议').toContain('减少勾选');
    expect(notes, '与"宁可失败不给半截"同源').toContain('API 显式报错');
  });

  it('无可压缩素材时如实说明（写作/答案类调用的素材块不属该分类）', () => {
    const notes = inspectOverlongPrompt(WRITING_PROMPT, { maxInputTokens: 300, estimateTokens: est }).notes.join('\n');
    expect(notes).toContain('无可压缩素材');
  });

  it('确定性 + 空输入不抛错', () => {
    const a = inspectOverlongPrompt(ANALYSIS_PROMPT, { maxInputTokens: 300, estimateTokens: est });
    const b = inspectOverlongPrompt(ANALYSIS_PROMPT, { maxInputTokens: 300, estimateTokens: est });
    expect(a.notes).toEqual(b.notes);
    expect(() => inspectOverlongPrompt('', { maxInputTokens: 1000, estimateTokens: est })).not.toThrow();
    expect(inspectOverlongPrompt('', { maxInputTokens: 1000, estimateTokens: est }).text).toBe('');
  });
});

describe('③ 输入上限口径按引擎分三支（唯一出口 apiConfig.resolveMaxInputTokens）', () => {
  it('deepseek → 产品封顶值（默认 100000；可被设置覆盖）', () => {
    expect(resolveMaxInputTokens({ engine: 'deepseek' })).toBe(100000);
    expect(resolveMaxInputTokens({ engine: 'deepseek', settings: { maxInputTokensDeepseek: 80000 } })).toBe(80000);
  });

  it('ollama → 0.7 × 输出预算（本地显存/上下文口径原样保留）', () => {
    expect(resolveMaxInputTokens({ engine: 'ollama', maxTokens: 10000 })).toBe(7000);
    expect(resolveMaxInputTokens({ engine: 'ollama', maxTokens: 800, settings: { maxInputTokensOllamaRatio: 0.5 } })).toBe(400);
  });

  it('🔴 其他云端引擎（volcano/alibaba/zhipu/未知）→ Infinity：未固证不钳制，不再吃 Ollama 的 0.7', () => {
    for (const engine of ['volcano', 'alibaba', 'zhipu', '', 'unknown-engine']) {
      expect(resolveMaxInputTokens({ engine, maxTokens: 10000 }), `${engine || '(空)'} 不应被钳制`).toBe(Infinity);
    }
  });

  it('与输出侧同口径（对称性）：非 deepseek 两侧都不钳制', () => {
    expect(resolveEngineOutputLimit('volcano', 'x')).toBe(Infinity);
    expect(resolveMaxInputTokens({ engine: 'volcano', maxTokens: 10000 })).toBe(Infinity);
  });
});

describe('④ 单一事实源与接线', () => {
  const ai = () => fs.readFileSync(path.join(ROOT, 'src', 'composables', 'useAiGenerator.js'), 'utf8');

  it('生成端调用体检函数与口径唯一出口；旧压缩实现与旧模块名不得回归', () => {
    const s = ai();
    expect(s).toContain('inspectOverlongPrompt(finalPrompt');
    expect(s).toContain('resolveMaxInputTokens({');
    for (const gone of [
      "from '../utils/promptCompression.js'", // 旧模块（已收口为 promptOversize）不得再被引入
      'compressOverlongPrompt',               // 旧函数名（会改文本）
      'const guaranteeParts',                 // 旧"保谁丢谁"的实现痕迹
      'const omittedSections',                // 旧"整段丢弃"的实现痕迹
      'instructionText.substring(0, Math.floor((maxInputTokens - 200) * 1.5))', // 旧硬截断
      'apiConfig.generationSettings.maxInputTokensOllamaRatio ?? 0.7',          // 口径不得在调用点自己拼
    ]) expect(s, `不得回归：${gone}`).not.toContain(gone);
  });

  it('超长告警经 bodyPathNotes 进生成报告（不得只 console = 静默）', () => {
    const s = ai();
    expect(s).toContain('promptShapeNotes.push(...oversize.notes)');
    expect(s).toContain('bodyPathNotes.push(...promptShapeNotes.splice(0))');
  });
});
