// ============================================================
// 去 AI 味 · 空洞评价词守卫（2026-10-14 · 属主"AI 味不要太重"·《指令文本性质清单 v1》H3 缺口闭合）
// ------------------------------------------------------------
// 判据：AI 味典型症状之一是"形容词在场、信息为零"——"非常重要／十分关键／需要特别注意"这类写法
//   不告诉你**注意什么**。处置分两半，两半都锁在这里：
//     ① **产物侧机检**：规则 `empty-praise-guard`（guard 通道·只报不改）真的接在引擎上；
//     ② **模板侧零诱导**：486 面**装配后指令文本**本身不得含这些词（否则等于自己教模型写）。
// 另锁"纪律与单源"：本条**不得给 promptHint**（实发提示词零新增，守 promptGrowthGuard）；词表只此一处。
// ============================================================
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { VALIDATOR_RULES, VALIDATOR_GATES, EMPTY_PRAISE_WORDS } from '../../src/config/validatorRules.js';
import { faceTexts } from '../../scripts/instructionText.mjs';

const rule = VALIDATOR_RULES.find((r) => r.id === 'empty-praise-guard');
const engineSrc = fs.readFileSync(path.resolve(__dirname, '../../src/utils/examValidator.js'), 'utf8');

describe('去 AI 味 · 空洞评价词（empty-praise-guard）', () => {
  it('① 规则已注册为 guard 类（只报不改，不是 fix）', () => {
    expect(rule, '规则缺注册').toBeTruthy();
    expect(rule.category).toBe('guard');
    expect(rule.enabled).toBe(true);
    expect(rule.subjects).toEqual(['*']);
  });

  it('② 纪律：不得给 promptHint（实发提示词零新增，守净字纪律）', () => {
    expect('promptHint' in rule, '本规则不得注入提示词——它是产物侧机检').toBe(false);
  });

  it('③ 接线：引擎里真的存在执行分支（has() 独立分支）＋ 已登记 VALIDATOR_GATES', () => {
    expect(engineSrc).toContain("has('empty-praise-guard')");
    expect(VALIDATOR_GATES.has('empty-praise-guard')).toBe(true);
  });

  it('④ 判据词表单源、非空，且判定行为符合预期（有牙自证）', () => {
    expect(Array.isArray(EMPTY_PRAISE_WORDS)).toBe(true);
    expect(EMPTY_PRAISE_WORDS.length).toBeGreaterThanOrEqual(6);
    const hit = (s) => EMPTY_PRAISE_WORDS.filter((w) => s.includes(w));
    // 命中样本（AI 味）
    expect(hit('<p>这一点非常重要，解题时要特别注意。</p>').length).toBeGreaterThan(0);
    // 不命中样本（人工写法：点明注意什么）
    expect(hit('<p>这一步要先统一单位，漏掉单位是常见错误。</p>')).toEqual([]);
    // 引擎侧的取文口径（去标签）后仍能命中
    const plain = '<p>十分关键</p>'.replace(/<[^>]+>/g, ' ');
    expect(hit(plain).length).toBe(1);
  });

  it('⑤ 模板侧零诱导：486 面装配文本不得含空洞评价词（否则等于教模型写）', () => {
    const faces = faceTexts();
    expect(faces.length).toBe(486);
    const bad = faces.filter((f) => EMPTY_PRAISE_WORDS.some((w) => f.text.includes(w))).map((f) => `${f.subject}×${f.stage}×${f.genType}`);
    expect(bad.slice(0, 5), `模板命中：${bad.length} 面`).toEqual([]);
  });
});
