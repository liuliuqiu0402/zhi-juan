// 2026-09 结构性修正：引擎单次输出上限（max_tokens 硬上限）
// 背景：DeepSeek V4 系列（deepseek-v4-pro / deepseek-flash）最大输出 384K，但旧代码用
//      /reasoner|r1|think/ 判定，非 reasoner 一律 8192 → 正文按需 11K+ token 被硬钳到 8K
//      → 截断 → "正文不完整"（app 层 cap 形同失效）。本测试锁死上限表与"配置自洽"不变量。
import { describe, it, expect } from 'vitest';
import {
  MODEL_OUTPUT_LIMIT_RULES,
  resolveEngineOutputLimit,
  DEFAULT_BUDGET_BY_TYPE,
} from '../../src/config/apiConfig.js';

describe('引擎单次输出上限（2026-09 结构性修正）', () => {
  it('🔴 DeepSeek V4 系列（当前在用）解析为 384000——不得再落到 8192（正文截断根因）', () => {
    for (const m of ['deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-flash', 'DeepSeek-V4-Pro-0813']) {
      expect(resolveEngineOutputLimit('deepseek', m), `模型 ${m}`).toBe(384000);
    }
    expect(resolveEngineOutputLimit('deepseek', 'deepseek-v4-pro')).not.toBe(8192);
  });

  it('旧模型名保持原口径：reasoner/r1 → 65536；chat/v3/空名 → 8192', () => {
    expect(resolveEngineOutputLimit('deepseek', 'deepseek-reasoner')).toBe(65536);
    expect(resolveEngineOutputLimit('deepseek', 'deepseek-r1')).toBe(65536);
    expect(resolveEngineOutputLimit('deepseek', 'deepseek-chat')).toBe(8192);
    expect(resolveEngineOutputLimit('deepseek', 'deepseek-v3')).toBe(8192);
    expect(resolveEngineOutputLimit('deepseek', '')).toBe(8192);
    expect(resolveEngineOutputLimit('deepseek')).toBe(8192);
  });

  it('非 deepseek 引擎上限未固证 → Infinity（不钳制，防误伤）', () => {
    for (const p of ['volcano', 'alibaba', 'zhipu', 'ollama', '']) {
      expect(resolveEngineOutputLimit(p, 'any-model')).toBe(Infinity);
    }
  });

  it('回归：课时练正文按需 11378 token 不再被钳（旧代码会钳到 8192 → 丢内容）', () => {
    const needed = 11378; // 实测日志：[每类型预算] practice: 所需=9102→帽=11378
    const cap = resolveEngineOutputLimit('deepseek', 'deepseek-v4-pro');
    expect(Math.min(needed, cap)).toBe(needed);
    // 旧的错判口径会钳到 8192 —— 显式记录被修掉的旧行为
    const legacyCap = /reasoner|r1|think/i.test('deepseek-v4-pro') ? 65536 : 8192;
    expect(Math.min(needed, legacyCap)).toBe(8192);
  });

  it('🔴 配置自洽：各资料类型每槽 cap 均须 ≤ v4 实得上限（否则 app 层 cap 会被引擎层吃掉）', () => {
    const cap = resolveEngineOutputLimit('deepseek', 'deepseek-v4-pro');
    const slots = ['body', 'answer', 'once'];
    const violations = [];
    for (const [type, cfg] of Object.entries(DEFAULT_BUDGET_BY_TYPE || {})) {
      for (const s of slots) {
        const c = cfg?.[s]?.cap;
        if (typeof c === 'number' && c > cap) violations.push(`${type}.${s}.cap=${c}`);
      }
    }
    expect(violations, `以下槽 cap 超过引擎上限 ${cap}：${violations.join(', ')}`).toEqual([]);
  });

  it('上限表规则顺序：v4/flash 优先于 reasoner（防模型名同时命中时误判）', () => {
    expect(MODEL_OUTPUT_LIMIT_RULES[0].re.test('deepseek-v4-flash')).toBe(true);
    expect(resolveEngineOutputLimit('deepseek', 'deepseek-v4-reasoner')).toBe(384000);
  });
});
