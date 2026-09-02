// 预算校准·学段归一回归：桶键一律走共享 resolveStageKey（单一事实源）
// 曾为本地 normalizeStageKey：小学全折叠成 primary_mid（一年级~六级不分），且 'primary' 被误判成 'middle'。
import { describe, it, expect } from 'vitest';
import {
  recordSample,
  getCalibration,
  getCalibratedCoef,
  applyCalibration,
  listTypeBuckets,
} from '../../src/utils/budgetCalibration.js';

const sampleOf = (stage, grade, name = '') => ({
  genType: 'exam', subject: '校准语文', stage, grade, name, scope: '第一单元', mode: 'split',
  selectedRawChars: 1200, budgetTokens: 5000, outputChars: 900, truncated: false, overCap: false,
});

describe('budgetCalibration 学段归一（共享 resolveStageKey，单一事实源）', () => {
  it('小学按年级分低/中/高段：一年级→primary_low、三年级→primary_mid、六年级→primary_high', () => {
    const subj = '子段语文';
    recordSample({ ...sampleOf('小学', '一年级', '一年级语文上册'), subject: subj });
    recordSample({ ...sampleOf('小学', '三年级', '三年级语文上册'), subject: subj });
    recordSample({ ...sampleOf('小学', '六年级', '六年级语文上册'), subject: subj });
    const stages = listTypeBuckets('exam').filter(b => b.subject === subj).map(b => b.stage).sort();
    expect(stages).toContain('primary_low');
    expect(stages).toContain('primary_mid');
    expect(stages).toContain('primary_high');
  });

  it('五档 key 直接透传（存量样本/面板枚举回传不二次解析）', () => {
    const subj = '透传语文';
    recordSample({ ...sampleOf('primary_high', '', ''), subject: subj });
    const b = listTypeBuckets('exam').find(x => x.subject === subj);
    expect(b.stage).toBe('primary_high');
  });

  it('教材名回退：无 grade、教材名含六年级 → primary_high', () => {
    const subj = '回退语文';
    recordSample({ ...sampleOf('小学', '', '六年级上册'), subject: subj });
    const b = listTypeBuckets('exam').find(x => x.subject === subj);
    expect(b.stage).toBe('primary_high');
  });

  it('粗键 primary 不再误判成 middle（消除潜伏错桶），归一到 primary_high', () => {
    const subj = '粗键语文';
    recordSample({ ...sampleOf('primary', '', ''), subject: subj });
    const b = listTypeBuckets('exam').find(x => x.subject === subj);
    expect(b.stage).not.toBe('middle');
    expect(b.stage).toBe('primary_high');
  });

  it('读写同桶 round-trip：小学六年级采纳后，仅同(学段,年级)可读回，小学一年级读不到', () => {
    const subj = '读写语文';
    const mk = (st, gr) => ({ ...sampleOf(st, gr), subject: subj });
    // 低门槛（loose=8）沉淀 8 条有效样本 → applyCalibration 可按 primary_high 桶采纳
    for (let i = 0; i < 8; i++) recordSample(mk('小学', '六年级'));
    const applied = applyCalibration('exam', subj, 'primary_high', 'split', 8);
    expect(applied.ok).toBe(true);

    // 读：同教材(小学,六年级)解析到主定档 primary_high 桶 → 命中
    const hit = getCalibratedCoef('exam', subj, '小学', 'split', 'balanced', '六年级');
    expect(typeof hit).toBe('number');
    expect(hit).toBeGreaterThan(0);
    // 读：同校验但一年级 → primary_low 桶，另桶无校准 → null（不误命中）
    expect(getCalibratedCoef('exam', subj, '小学', 'split', 'balanced', '一年级')).toBeNull();
    // getCalibration 与 getCalibratedCoef 同源命中
    const cal = getCalibration('exam', subj, '小学', 'split', '六年级');
    expect(cal && typeof cal.base === 'number').toBe(true);
  });
});