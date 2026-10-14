// 🔒 常驻守卫：设问由易到难（清单 D9 · 2026-10-14 补独立守卫，闭合"已登记·未上锁"缺口）
// ============================================================
// 背景：D9 是 T20 ①「真分层」同族判据——"设问由易到难，考查理解与运用"落在 exam 模板
//   【创作要求】第 6 条（**exam 专属**，与"练到本学段课标学业要求"并列为命题取向）。
//   此前仅在《指令文本性质清单》**登记**（guard='—'，note 写明"缺口"），无独立守卫 ⇒ 本文件补锁。
// 锁四件事：
//   ① exam **54 面恒在场**（防被删／被分支漏掉）；
//   ② **不广播**到非 exam（432 面零命中，防越界注入——①三维度纪律）；
//   ③ 判据词**逐字**（"考查理解与运用"是它并列的**可核对锚**，不得被改成只剩"由易到难"的形容词式要求）；
//   ④ **同族可判法共在**（真分层判法"遮住该名称、只看其下各题"）——依《指令改动标准》附2「可自判锚」：
//      判据不得只有形容词，须与可判法同场，否则"由易到难"无从自判。
import { describe, it, expect } from 'vitest';
import { faceTexts } from '../../scripts/instructionText.mjs';

const FACES = faceTexts();
const EXAM = FACES.filter((f) => f.genType === 'exam');
const NON_EXAM = FACES.filter((f) => f.genType !== 'exam');
const CLAUSE = '设问由易到难，考查理解与运用';
const PEER_CALIBER = '遮住该名称、只看其下各题'; // T20① 真分层判法（B4）

describe('设问由易到难（清单 D9 · exam 54 面 · 独立守卫）', () => {
  it('exam 54 面恒在场', () => {
    expect(EXAM.length, '开设对 × exam 应为 54').toBe(54);
    const miss = EXAM.filter((f) => !f.text.includes(CLAUSE)).map((f) => f.key);
    expect(miss.slice(0, 5), `以下 exam 面缺本判据（共 ${miss.length}）：${miss.join(',')}`).toEqual([]);
  });

  it('不广播到非 exam（432 面零命中，防越界）', () => {
    expect(NON_EXAM.length).toBe(432);
    const hit = NON_EXAM.filter((f) => f.text.includes(CLAUSE)).map((f) => f.key);
    expect(hit.slice(0, 5), `以下非 exam 面误注入本判据（共 ${hit.length}）：${hit.join(',')}`).toEqual([]);
  });

  it('判据词逐字（"考查理解与运用"是不能丢的可核对锚）', () => {
    const bad = EXAM.filter((f) => !/设问由易到难[^\n]*考查理解与运用/.test(f.text)).map((f) => f.key);
    expect(bad.slice(0, 5), `以下面判据词被改走样（共 ${bad.length}）：${bad.join(',')}`).toEqual([]);
  });

  it('同族可判法共在（真分层判法在场，"由易到难"不是孤立形容词）', () => {
    const bad = EXAM.filter((f) => !f.text.includes(PEER_CALIBER)).map((f) => f.key);
    expect(bad.slice(0, 5), `以下面缺同族可判法"${PEER_CALIBER}"（共 ${bad.length}）：${bad.join(',')}`).toEqual([]);
  });
});
