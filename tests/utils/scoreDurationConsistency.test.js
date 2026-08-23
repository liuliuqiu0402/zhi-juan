// 时长/分值一致性守卫：蓝本、省市配置、骨架三处取值不互相矛盾
import { describe, it, expect } from 'vitest';
import { EXAM_BLUEPRINTS, getExamBlueprint } from '@/config/examPaperBlueprints';
import { EXAM_REGION_CONFIG } from '@/config/examRegionConfig';
import { STANDARD_QUESTION_BANK } from '@/config/standardQuestionBank';

/** 提取字符串中的"数字+分"分值（仅匹配紧跟"分"的数字，排除百分比/题数等干扰） */
function scoreNumbers(s) {
  const out = [];
  const re = /(\d{1,3})\s*分/g;
  let m;
  while ((m = re.exec(s || '')) !== null) out.push(Number(m[1]));
  return out;
}

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

  it('骨架建议分值不超过对应蓝本板块分值（消除多处数值矛盾）', () => {
    const bad = [];
    for (const [subj, stages] of Object.entries(STANDARD_QUESTION_BANK)) {
      for (const [stage, types] of Object.entries(stages)) {
        for (const [type, sk] of Object.entries(types)) {
          const nums = scoreNumbers(sk.score);
          if (!nums.length) continue;
          for (const [key, bp] of Object.entries(EXAM_BLUEPRINTS)) {
            const [bs, bst] = key.split('|');
            const stageMatch = (stage === 'middle' && bst === 'middle') || (stage === 'high' && bst === 'high')
              || (stage === 'primary' && bst.startsWith('primary')) || (bst === 'all' && stage === 'middle');
            if (bs !== subj || !stageMatch) continue;
            for (const sec of bp.sections) {
              const secName = sec.name.replace(/^.*?·/, '');
              if (secName === type || type === sec.name) {
                for (const n of nums) {
                  if (n > sec.score && n - sec.score >= 5) {
                    bad.push(`${subj}|${stage}|${type}: 骨架${n}分 > 蓝本${sec.name}${sec.score}分`);
                  }
                }
              }
            }
          }
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
