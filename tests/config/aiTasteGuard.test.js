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
import { VALIDATOR_RULES, VALIDATOR_GATES, EMPTY_PRAISE_WORDS, AI_CLICHE_PHRASES, AI_CLICHE_MIN, AI_OPTION_SYM } from '../../src/config/validatorRules.js';
import { faceTexts } from '../../scripts/instructionText.mjs';
import { detectOptionSymmetry } from '../../src/utils/optionSymmetry.js';

const rule = VALIDATOR_RULES.find((r) => r.id === 'empty-praise-guard');
const engineSrc = fs.readFileSync(path.resolve(__dirname, '../../src/utils/examValidator.js'), 'utf8');
const faces = faceTexts();

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

// ── 第 2 条：AI 味套话指纹（元话语／并列套式／总结套话），超阈值才报 ──
const rule2 = VALIDATOR_RULES.find((r) => r.id === 'ai-cliche-guard');
const allCliche = Object.values(AI_CLICHE_PHRASES).flat();
/** 与 examValidator 1.5.6e **同口径**的纯计数（三族合计；用于"有牙自证"） */
const countCliche = (plain) => {
  let total = 0;
  for (const list of Object.values(AI_CLICHE_PHRASES)) for (const w of list) total += plain.split(w).length - 1;
  return total;
};

describe('去 AI 味 · AI 味套话指纹（ai-cliche-guard）', () => {
  it('⑥ 规则已注册为 guard 类，且不得给 promptHint（产物侧机检）', () => {
    expect(rule2, '规则缺注册').toBeTruthy();
    expect(rule2.category).toBe('guard');
    expect('promptHint' in rule2).toBe(false);
  });

  it('⑦ 接线：引擎 has() 分支在场 ＋ 已登记 VALIDATOR_GATES', () => {
    expect(engineSrc).toContain("has('ai-cliche-guard')");
    expect(engineSrc).toContain('AI_CLICHE_MIN');
    expect(VALIDATOR_GATES.has('ai-cliche-guard')).toBe(true);
  });

  it('⑧ 词表与阈值单源；阈值＝3（防"一次出现就报"的噪音）', () => {
    expect(AI_CLICHE_MIN).toBe(3);
    expect(allCliche.length).toBeGreaterThanOrEqual(10);
    expect(AI_CLICHE_PHRASES.meta.length).toBeGreaterThanOrEqual(5);
    expect(AI_CLICHE_PHRASES.parallel.length).toBeGreaterThanOrEqual(2);
    expect(AI_CLICHE_PHRASES.summary.length).toBeGreaterThanOrEqual(1);
  });

  it('⑧b 词表内**不得互相包含**（否则一次出现被计两次 → 阈值失真）', () => {
    const dup = [];
    for (const a of allCliche) for (const b of allCliche) if (a !== b && b.includes(a)) dup.push(`${a} ⊂ ${b}`);
    expect(dup, `互含词对：${dup.join('、')}`).toEqual([]);
  });

  it('⑨ 有牙自证：≥阈值必报、低于阈值不报（判定行为符合预期）', () => {
    // 低于阈值：单次/两次可能是正常行文 ⇒ 不报
    expect(countCliche('<p>值得注意的是，这一步要先统一单位。</p>')).toBe(1);
    expect(countCliche('<p>值得注意的是甲，另一方面乙。</p>')).toBe(2);
    // 达到阈值 ⇒ 报
    const bad = '<p>值得注意的是甲，需要强调的是乙，不难看出丙。</p>';
    expect(countCliche(bad)).toBeGreaterThanOrEqual(AI_CLICHE_MIN);
    // 人工写法（直接给信息）不触发
    expect(countCliche('<p>这道题最常见的错误是漏掉单位换算。</p>')).toBe(0);
  });

  it('⑩ 模板侧零诱导：486 面装配文本不得含套话指纹（避免自己教模型写）', () => {
    const bad = faces.filter((f) => allCliche.some((w) => f.text.includes(w))).map((f) => `${f.subject}×${f.stage}×${f.genType}`);
    expect(bad.slice(0, 5), `模板命中：${bad.length} 面`).toEqual([]);
  });
});

// ── 第 3 条：选项对称指纹（纯函数判据·只在能自证时报） ──
describe('去 AI 味 · 选项对称指纹（ai-option-symmetry-guard）', () => {
  const rule3 = VALIDATOR_RULES.find((r) => r.id === 'ai-option-symmetry-guard');

  it('⑪ 规则已注册为 guard 类，且不得给 promptHint（产物侧机检）', () => {
    expect(rule3, '规则缺注册').toBeTruthy();
    expect(rule3.category).toBe('guard');
    expect('promptHint' in rule3).toBe(false);
    expect(VALIDATOR_GATES.has('ai-option-symmetry-guard')).toBe(true);
    expect(engineSrc).toContain("has('ai-option-symmetry-guard')");
  });

  it('⑫ 阈值单源：≥4 个选项、每个 ≥4 汉字（防"短选项天然同长"误报）', () => {
    expect(AI_OPTION_SYM).toEqual({ minOptions: 4, minHanzi: 4 });
  });

  it('⑬ 有牙自证：文本型且字数完全相同 ⇒ 报；短选项/长度参差/断链 ⇒ 不报', () => {
    // ① 命中：4 个 4 汉字选项，字数完全相同（AI 味"太对称"）
    const hit = '<p>1. 下列说法正确的是（　）</p><p>A. 甲乙丙丁B. 戊己庚辛C. 壬癸子丑D. 寅卯辰巳</p>';
    expect(detectOptionSymmetry(hit).length).toBe(1);
    expect(detectOptionSymmetry(hit)[0].hanzi).toBe(4);
    // ② 不命中：短数字选项（数学常见、天然同长）
    const num = '<p>1. 3＋5＝（　）</p><p>A. 6B. 7C. 8D. 9</p>';
    expect(detectOptionSymmetry(num)).toEqual([]);
    // ③ 不命中：字数参差（真人常态）
    const uneven = '<p>1. 下列说法正确的是（　）</p><p>A. 甲乙丙丁B. 戊己庚辛壬C. 壬癸D. 寅卯辰巳午未</p>';
    expect(detectOptionSymmetry(uneven)).toEqual([]);
    // ④ 不命中：选项号**断链**（A、B、D，不可自证 ⇒ 不报）
    const broken = '<p>A. 甲乙丙丁B. 戊己庚辛D. 壬癸子丑</p>';
    expect(detectOptionSymmetry(broken)).toEqual([]);
  });
});
