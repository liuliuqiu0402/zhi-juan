/**
 * 书写载体三维度注册表 · 防漂移矩阵
 * ============================================================
 * 目标：作答书写载体不再出问题，从"注册表不漂移"处兜底——
 *  1. WRITING_CARRIER 必须覆盖 全学科×全学段（15×5），每个组合显式数组、无意外空洞；
 *     新增/改名学科若漏配载体行 → 越界剥离防线失守（getCarrierAllowlist 回退 null=不检测），本测试即红；
 *  2. 允许值 / must.forbid / declaration 的 class 令牌必须合法（渲染/剥离/白名单可命中）；
 *  3. 数学方格纸仅小学段（middle/high=[]），防"用方格纸"越学段诱导；
 *  4. must/declaration 引用的学科与学段键必须在 SUBJECT_KEYS / STAGE_KEYS 内（防键名漂移成死规则）。
 */
import { describe, it, expect } from 'vitest';
import { WRITING_CARRIER, CARRIER_RULES, CARRIER_DECLARATION, getCarrierAllowlist } from '../../src/config/layoutSpec.js';
import { SUBJECT_KEYS } from '../../src/config/toolLibrary.js';
import { STAGE_KEYS } from '../../src/utils/gradeStage.js';

const STAGE_SET = new Set(STAGE_KEYS);
const SUBJ_SET = new Set(SUBJECT_KEYS);
const CLASS_RE = /^[a-z][a-z0-9-]*$/;

describe('书写载体三维度注册表（防漂移矩阵）', () => {
  it('WRITING_CARRIER 覆盖全学科×全学段且显式数组（双向无游离）', () => {
    for (const s of SUBJECT_KEYS) {
      const row = WRITING_CARRIER[s];
      expect(row, `学科「${s}」缺少载体行`).toBeTruthy();
      for (const st of STAGE_KEYS) {
        expect(Array.isArray(row[st]), `${s} × ${st} 应为显式数组`).toBe(true);
      }
    }
    for (const k of Object.keys(WRITING_CARRIER)) {
      expect(SUBJ_SET.has(k), `注册表含游离学科键「${k}」`).toBe(true);
    }
  });

  it('允许值/must/forbid/declaration 的 class 令牌均为合法小写 class', () => {
    const collect = [];
    for (const s of SUBJECT_KEYS) for (const st of STAGE_KEYS) collect.push(...WRITING_CARRIER[s][st]);
    for (const r of CARRIER_RULES.must) collect.push(r.carrier);
    for (const r of CARRIER_RULES.forbid) collect.push(...(r.carriers || []));
    for (const list of Object.values(CARRIER_DECLARATION)) for (const d of list) collect.push(d.cls);
    for (const c of new Set(collect)) expect(c).toMatch(CLASS_RE);
  });

  it('数学方格纸仅小学段（middle/high 显式空，防越学段诱导）', () => {
    expect(WRITING_CARRIER['数学'].middle).toEqual([]);
    expect(WRITING_CARRIER['数学'].high).toEqual([]);
    for (const st of ['primary_low', 'primary_mid', 'primary_high']) {
      expect(WRITING_CARRIER['数学'][st]).toContain('square-grid');
    }
  });

  it('语文/英语关键档位与学段定位一致', () => {
    expect(WRITING_CARRIER['语文'].primary_low).toContain('tian-zi-ge');
    expect(WRITING_CARRIER['语文'].primary_low).toContain('pinyin-line');
    expect(WRITING_CARRIER['语文'].primary_high).toContain('line');
    expect(WRITING_CARRIER['英语'].primary_mid).toContain('four-line-three');
    expect(WRITING_CARRIER['英语'].primary_low).toEqual(['line']); // 显式声明=无书写格（3 年级起点）
  });

  it('must/declaration 引用的学科与学段键必须注册在册（防死规则）', () => {
    for (const r of CARRIER_RULES.must) {
      expect(SUBJ_SET.has(r.subject), `must 学科「${r.subject}」不在 SUBJECT_KEYS`).toBe(true);
      for (const st of r.stages) expect(STAGE_SET.has(st), `must 学段「${st}」不在 STAGE_KEYS`).toBe(true);
    }
    for (const subj of Object.keys(CARRIER_DECLARATION)) {
      expect(SUBJ_SET.has(subj), `declaration 学科「${subj}」不在 SUBJECT_KEYS`).toBe(true);
    }
  });

  it('getCarrierAllowlist：未知学科回退 null（不检测），已知返回数组', () => {
    expect(getCarrierAllowlist('不存在的学科', 'middle')).toBe(null);
    expect(Array.isArray(getCarrierAllowlist('语文', 'primary_low'))).toBe(true);
    expect(getCarrierAllowlist('数学', 'middle')).toEqual([]);
  });
});
