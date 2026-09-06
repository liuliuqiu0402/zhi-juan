// 考点判定分类（coverageProbe）护栏测试
// ============================================================
// 🔴 目的（2026-09 章级聚合全局归并）：
//   - 行为词（意义/方法/规律…）+ 技能词（朗读/实验/演唱…）+ 考查方面尾词（特征/作用/影响…）
//     → chapter（正文以行为/情境呈现，考点名整串不逐字出现——误报源）；
//   - 概念专名（循环小数/质数/列数字/电压/一般现在时…）→ literal（须字面出现，防漏报）。
// 护栏双向：该归章级的必须归、该精确的绝不能因新词误放行（宁漏报不缺报）。
// ============================================================
import { describe, it, expect } from 'vitest';
import { classifyProbe, CHAPTER_TERMS, SKILL_TERMS, ASPECT_TERMS } from '../../src/utils/coverageProbe.js';

describe('classifyProbe：应归章级的考点形态（行为/技能/考查方面）', () => {
  const chapterCases = [
    // 数学
    '小数乘法的计算方法', '一个数乘大于1或小于1的数的规律', '估算在实际中的应用',
    '小数乘小数的竖式计算', '用方程解决问题',
    // 语文
    '联系上下文理解词语', '体会作者表达的情感', '朗读课文并背诵精彩段落', '说明方法及其作用',
    '按时间顺序叙述事情', // 含"顺序"→ 章级（排序/时序类行为呈现）
    '阅读短文说说这句话的作用', // 含"的作用"（问法形态）→ 章级；'光合作用/呼吸作用'（概念）不落此组
    // 英语
    '一般现在时的用法', // 含"用法"→ 章级（情境句呈现时态即覆盖）
    '四线三格中正确抄写字母',
    // 科学/理化生
    '观察水沸腾时的现象并记录', '氧气的制取实验', '测量物体的质量',
    // 史地政
    '新航路开辟的影响', '改革开放的意义', '我国地形的主要特征',
    // 体音美信
    '用自然的声音演唱歌曲', '设计一份作息时间表', '根据图形特点绘制对称轴',
  ];
  for (const name of chapterCases) {
    it(`「${name}」→ chapter（不逐字误报）`, () => {
      expect(classifyProbe(name), name).toBe('chapter');
    });
  }
});

describe('classifyProbe：概念专名必须精确（防新词误放行）', () => {
  const literalCases = [
    '循环小数', '质数与合数', '分数的基本性质', '列数字', '打比方',
    '一般现在时', '电压', '细胞的结构', '地球的公转', '轴对称图形', '平行四边形的面积',
    '朝代更替', '呼吸作用', '光合作用', '蒸腾作用', '商品的价值', '安史之乱',
  ];
  for (const name of literalCases) {
    it(`「${name}」→ literal（概念须字面出现）`, () => {
      expect(classifyProbe(name), name).toBe('literal');
    });
  }
});

describe('词表自检：不出现单字/空串；SKILL 与 ASPECT 各司其职', () => {
  it('全部引导词非空且 ≥2 字', () => {
    expect(CHAPTER_TERMS.length).toBeGreaterThan(20);
    for (const t of CHAPTER_TERMS) expect(t.length).toBeGreaterThanOrEqual(2);
  });
  it('SKILL_TERMS 是动词/操作（不含"特征/作用"类名词尾词）；ASPECT_TERMS 是名词问法尾词', () => {
    expect(SKILL_TERMS).not.toContain('特征');
    expect(ASPECT_TERMS).toContain('特征');
    expect(ASPECT_TERMS.some((t) => SKILL_TERMS.includes(t))).toBe(false);
  });
});
