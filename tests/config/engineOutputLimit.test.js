// 2026-09 结构性修正 + 2026-09-10 成本护栏 + 复现防线：引擎单次输出上限（max_tokens 硬上限）
// 背景：DeepSeek V4 系列（deepseek-v4-pro / deepseek-flash）官方物理上限 384K，但产品单次帽取 64K
//      （成本可控：防小范围勾选发散写满、单次费用不可控）；旧代码用 /reasoner|r1|think/ 判定，
//      非 reasoner 一律 8192 → 正文按需 11K+ token 被硬钳到 8K → 截断 → "正文不完整"
//      （app 层 cap 形同失效）。本测试锁死上限表与"配置自洽"不变量。
// 🔴 2026-09-10 复现防线：兜底不再默认 8192——仅"旧 chat/v3 系"精确落 8192，其余一切
//      （含未来新名/空名）落 64K；防未来新模型名不匹配再被误钳（正文截断事故复现）。
import { describe, it, expect } from 'vitest';
import {
  MODEL_OUTPUT_LIMIT_RULES,
  resolveEngineOutputLimit,
  DEFAULT_BUDGET_BY_TYPE,
} from '../../src/config/apiConfig.js';

describe('引擎单次输出上限（2026-09 结构性修正）', () => {
  it('🔴 DeepSeek V4 系列（当前在用）解析为 65536（成本护栏档）——不得再落到 8192（正文截断根因）', () => {
    for (const m of ['deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-flash', 'DeepSeek-V4-Pro-0813']) {
      expect(resolveEngineOutputLimit('deepseek', m), `模型 ${m}`).toBe(65536);
    }
    expect(resolveEngineOutputLimit('deepseek', 'deepseek-v4-pro')).not.toBe(8192);
  });

  it('🔴 成本护栏：v4 档产品单次帽 ≤ 64K（官方物理 384K 不得直接作为单次帽——费用不可控）', () => {
    for (const m of ['deepseek-v4-pro', 'deepseek-flash']) {
      expect(resolveEngineOutputLimit('deepseek', m)).toBeLessThanOrEqual(65536);
    }
  });

  it('旧 chat/v3 系精确落 8192；reasoner/r1 与空名/未知名走 64K 安全档（防误钳复现）', () => {
    expect(resolveEngineOutputLimit('deepseek', 'deepseek-chat')).toBe(8192);
    expect(resolveEngineOutputLimit('deepseek', 'deepseek-v3')).toBe(8192);
    expect(resolveEngineOutputLimit('deepseek', 'deepseek-reasoner')).toBe(65536);
    expect(resolveEngineOutputLimit('deepseek', 'deepseek-r1')).toBe(65536);
    // 🔴 复现防线：空名（配置探测失败）与未识别的未来新名，一律 64K——不得落 8192
    expect(resolveEngineOutputLimit('deepseek', '')).toBe(65536);
    expect(resolveEngineOutputLimit('deepseek')).toBe(65536);
    expect(resolveEngineOutputLimit('deepseek', 'deepseek-v9-future')).toBe(65536);
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

  it('规则表结构：首条=chat/v3 精确分支（不外溢），末条=64K 全兜底（防再落 8192 误钳）', () => {
    expect(MODEL_OUTPUT_LIMIT_RULES[0].re.test('deepseek-chat')).toBe(true);
    expect(MODEL_OUTPUT_LIMIT_RULES[0].re.test('deepseek-v4-flash')).toBe(false); // v4 不被 v3 分支误捕
    expect(MODEL_OUTPUT_LIMIT_RULES[MODEL_OUTPUT_LIMIT_RULES.length - 1].re.test('deepseek-anything')).toBe(true);
    expect(resolveEngineOutputLimit('deepseek', 'deepseek-v4-reasoner')).toBe(65536);
  });
});
