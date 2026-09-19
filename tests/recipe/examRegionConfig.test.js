// 省市分值可维护测试（蓝图库面板"省市分值维护"，用户覆盖优先于内置）
// ============================================================
// 🔴 目的：锁定"省市数值不是写死不可改"的契约——
//    - setRegionOverride 保存后 getRegionConfig 用户优先
//    - getExamBlueprint 覆盖总分/时长使用用户覆盖值（120→覆盖值，板块按比例缩放）
//    - removeRegionOverride 回退内置
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest';
import {
  setRegionOverride, removeRegionOverride, getRegionConfig,
} from '@/config/examRegionConfig.js';
import { getExamBlueprint } from '@/config/examPaperBlueprints.js';

beforeEach(() => {
  try { localStorage.removeItem('wisdom_region_config_v1'); } catch {}
});

describe('省市分值维护（用户覆盖优先）', () => {
  it('保存覆盖后 getRegionConfig 用户优先，getExamBlueprint 使用覆盖值', () => {
    // 内置：江苏·南通 语文 150
    expect(getExamBlueprint('语文', 'middle', '江苏·南通').fullScore).toBe(150);
    // 用户覆盖为 140 → 生效
    setRegionOverride('江苏·南通', 'middle', '语文', { fullScore: 140, duration: '130分钟' });
    expect(getRegionConfig()['江苏·南通'].middle['语文'].fullScore).toBe(140);
    const bp = getExamBlueprint('语文', 'middle', '江苏·南通');
    expect(bp.fullScore).toBe(140);
    expect(bp.duration).toBe('130分钟');
    // 板块和 = 新总分（末大题修正闭合）
    expect(bp.sections.reduce((s, x) => s + x.score, 0)).toBe(140);
  });

  it('删除覆盖后回退内置', () => {
    setRegionOverride('江苏·南通', 'middle', '语文', { fullScore: 140 });
    expect(removeRegionOverride('江苏·南通', 'middle', '语文')).toBe(true);
    expect(getExamBlueprint('语文', 'middle', '江苏·南通').fullScore).toBe(150);
  });
});

// ============================================================
// 🔴 2026-09-19 用户裁定：**栏目级覆盖**（机制先行、数据按需填）
//   绝大多数省市栏目结构趋同 → 只做分值等比例缩放即可；
//   仅当某省市结构确与全国骨架不同（如某省不设判断题）时，才在省市配置里写 sections 整组替换。
// ============================================================
describe('省市栏目可覆盖（结构确不同才用）', () => {
  const base = getExamBlueprint('道德与法治', 'middle');   // 骨架：选择32/判断8/材料分析60

  it('未配 sections 时行为不变：只缩放分值、沿用蓝本骨架', () => {
    setRegionOverride('湖南', 'middle', '道德与法治', { fullScore: 100, duration: '60分钟' });
    const bp = getExamBlueprint('道德与法治', 'middle', '湖南');
    expect(bp.sections.map((s) => s.name)).toEqual(base.sections.map((s) => s.name));
    expect(bp.sections.reduce((n, s) => n + s.score, 0)).toBe(bp.fullScore);
  });

  it('配了 sections 则整组替换栏目，note 按同名栏目从蓝本继承', () => {
    // 湖南中考道法为"选择题＋非选择题"，不设判断题 —— 正是需要栏目覆盖的典型
    setRegionOverride('湖南', 'middle', '道德与法治', {
      fullScore: 100,
      duration: '60分钟',
      sections: [
        { name: '选择题', score: 42 },
        { name: '非选择题', score: 58 },
      ],
    });
    const bp = getExamBlueprint('道德与法治', 'middle', '湖南');
    expect(bp.sections.map((s) => s.name)).toEqual(['选择题', '非选择题']);
    expect(bp.sections.map((s) => s.score)).toEqual([42, 58]);
    expect(bp.sections.reduce((n, s) => n + s.score, 0)).toBe(100);
    // note 同名继承：选择题沿用蓝本"基础知识与价值判断"；新栏名"非选择题"无同名 → 留空不报错
    expect(bp.sections[0].note).toBe(base.sections.find((s) => s.name === '选择题').note);
    expect(bp.sections[1].note).toBe('');
    // 未覆盖的省市不受影响（防串味）
    expect(getExamBlueprint('道德与法治', 'middle', '江苏·南通').sections.map((s) => s.name))
      .toEqual(base.sections.map((s) => s.name));
  });

  it('栏目分值之和 ≠ 省市总分时按比例缩放并末栏修正（账目自洽不变量）', () => {
    setRegionOverride('湖南', 'middle', '道德与法治', {
      fullScore: 100,
      sections: [{ name: '选择题', score: 1 }, { name: '非选择题', score: 1 }],
    });
    const bp = getExamBlueprint('道德与法治', 'middle', '湖南');
    expect(bp.sections.reduce((n, s) => n + s.score, 0)).toBe(100);
  });

  it('非法栏目（缺名/分值非正）被过滤，不污染蓝本', () => {
    setRegionOverride('湖南', 'middle', '道德与法治', {
      fullScore: 100,
      sections: [{ name: '', score: 30 }, { name: '有效栏', score: 0 }, { name: '选择题', score: 100 }],
    });
    const bp = getExamBlueprint('道德与法治', 'middle', '湖南');
    expect(bp.sections.map((s) => s.name)).toEqual(['选择题']);
    expect(bp.sections.reduce((n, s) => n + s.score, 0)).toBe(100);
  });

  // 🔴 三态语义（2026-09-19）：把"改总分不误丢栏目"这条不变量下沉到配置层，
  //   UI 与脚本调用同一语义，不必各自记忆"要不要带上 sections"。
  it('sections 三态语义：数组=替换、null=清空、不传=保持原有', () => {
    setRegionOverride('湖南', 'middle', '道德与法治', {
      fullScore: 100,
      sections: [{ name: '选择题', score: 42 }, { name: '非选择题', score: 58 }],
    });
    // 不传 sections、只改总分/时长 → 已配栏目必须保留（防被当成"未配栏目"而丢）
    setRegionOverride('湖南', 'middle', '道德与法治', { fullScore: 100, duration: '60分钟' });
    expect(getRegionConfig()['湖南'].middle['道德与法治'].sections.map((s) => s.name))
      .toEqual(['选择题', '非选择题']);
    // 传 null → 清空栏目覆盖，回到全国骨架
    setRegionOverride('湖南', 'middle', '道德与法治', { fullScore: 100, sections: null });
    expect(getExamBlueprint('道德与法治', 'middle', '湖南').sections.map((s) => s.name))
      .toEqual(base.sections.map((s) => s.name));
  });
});
