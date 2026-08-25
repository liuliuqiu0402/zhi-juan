// 时长/分值一致性守卫：蓝本、省市配置、骨架三处取值不互相矛盾
import { describe, it, expect } from 'vitest';
import { EXAM_BLUEPRINTS, getExamBlueprint } from '@/config/examPaperBlueprints';
import { EXAM_REGION_CONFIG } from '@/config/examRegionConfig';

describe('🔴 时长/分值一致性守卫（多处取值不互相矛盾）', () => {
  it('蓝本全部板块分值之和 == fullScore', () => {
    const bad = [];
    for (const [key, bp] of Object.entries(EXAM_BLUEPRINTS)) {
      if (!bp.sections) continue;
      const sum = bp.sections.reduce((a, c) => a + c.score, 0);
      if (sum !== bp.fullScore) bad.push(`${key}: 板块之和${sum}≠${bp.fullScore}`);
    }
    expect(bad).toEqual([]);
  });

  it('全部省市配置覆盖后分值仍闭合、无0/负分板块', () => {
    const bad = [];
    for (const region of Object.keys(EXAM_REGION_CONFIG)) {
      const cfg = EXAM_REGION_CONFIG[region];
      for (const stage of Object.keys(cfg)) {
        if (stage.startsWith('_')) continue;
        for (const subject of Object.keys(cfg[stage])) {
          const bp = getExamBlueprint(subject, stage, region);
          if (!bp) continue;
          const sum = bp.sections.reduce((a, c) => a + c.score, 0);
          if (sum !== bp.fullScore) bad.push(`${region}|${stage}|${subject}: 之和${sum}≠${bp.fullScore}`);
          if (bp.sections.some(s => s.score < 1)) bad.push(`${region}|${stage}|${subject}: 存在<=0分板块`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('蓝本 duration 均为"N分钟"格式', () => {
    const bad = [];
    for (const [key, bp] of Object.entries(EXAM_BLUEPRINTS)) {
      if (bp.duration && !/^\d+分钟$/.test(bp.duration)) bad.push(`${key}: ${bp.duration}`);
    }
    expect(bad).toEqual([]);
  });
});
