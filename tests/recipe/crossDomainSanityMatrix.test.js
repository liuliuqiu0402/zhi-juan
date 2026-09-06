// 跨域自检矩阵（2026-09 通用化：不靠"逐卷试错"，把历史实证的每一类问题固化为
// 全学科回归样本——同类别在其它学科/类型换措辞复发时立即红）
// ============================================================
// 结构：样本表（类别 × 变体 × 期望），断言经 全学科扫描链（normalizeBlankMarkers →
// sanityScan）跑；矩阵命中即锁定该类别已被通用检测器覆盖。
// 已固化类别（来源为历史用户实证卷）：
//   计数荒谬 / 单位突变 / 填空宽度过宽统一 / 双载体叠写 / 题干裸u画线 /
//   选择类无选项 / 书写位声明缺载体 / 过程自述剥离
// ============================================================
import { describe, it, expect } from 'vitest';
import { normalizeBlankMarkers } from '../../src/utils/contentCleaner.js';
import { stripPlanningPreamble } from '../../src/utils/contentCleaner.js';
import { sanityScan } from '../../src/utils/contentSanity.js';

// 走归一链再扫描（与生成产物链一致）
const produce = (html) => {
  const norm = stripPlanningPreamble(normalizeBlankMarkers(html));
  return { norm, issues: sanityScan(norm) };
};

describe('跨域自检矩阵：历史问题类别 → 通用检测器必须命中', () => {
  const hitCases = [
    // [类别, 样本（学科措辞变体）]
    ['计数荒谬', '<p>1. 学校卖出 0.86 张（即 86 张）门票。</p>'],
    ['单位突变', '<p>1. 路程 2.05 千米（单位换算后为 205 千米）。</p>'],
    ['填空宽度过宽统一', '<p>1. <u class="blank-8">&emsp;</u></p><p>2. <u class="blank-8">&emsp;</u></p><p>3. <span class="blank-8">&emsp;</span></p><p>4. <u class="blank-8">&emsp;</u></p><p>5. <span class="blank-8">&emsp;</span></p>'],
    ['选择类无选项（语文读音）', '<p>1. 给加点字选择正确的读音。</p><p>孟浩然的"然"读作(　　　　)。</p>'],
    ['书写位声明缺载体', '<p>1. 把下面的字写在横线上。</p><p>（1）dé(　　　　)高望重</p>'],
  ];
  for (const [cat, html] of hitCases) {
    it(`检出：${cat}`, () => {
      const { issues } = produce(html);
      expect(issues.length, `${cat} 应被通用扫描命中`).toBeGreaterThan(0);
    });
  }

  it('题干裸 <u> 画线（语文卷实证）→ 归一拆壳去画线', () => {
    const { norm } = produce('<p>1. <u>请写出你的感受，并结合诗句简要分析。</u></p>');
    expect(norm).not.toContain('<u>请写出');
    expect(norm).toContain('请写出你的感受');
  });

  it('双载体叠写（下划线空 + 括号空）→ 归一去重保留后出现者', () => {
    const { norm } = produce('0.86 × 3.2 <u class="blank-8">&emsp;</u>（　　）');
    expect(norm).not.toContain('<u class="blank-');
  });

  it('过程自述段 → 剥离', () => {
    const { norm } = produce('<p>我已获取教材原文。现在编写正文。</p><h2>一、计算</h2>');
    expect(norm).toContain('<h2>一、计算</h2>');
    expect(norm).not.toContain('我已获取教材原文');
  });
});

describe('跨域自检矩阵：正常卷面控制组 → 不误报', () => {
  const cleanCases = [
    ['有选项的选择题', '<p>1. 选择正确的读音。</p><p>A. rán　B. zhǔ</p>'],
    ['声明横线且给了横线空', '<p>1. 写在横线上：<u class="blank-4">&emsp;</u></p>'],
    ['空位宽度随答案不同', '<p>1. <u class="blank-1">&emsp;</u> <u class="blank-4">&emsp;</u> <u class="blank-2">&emsp;</u></p>'],
    ['正常计数/单位', '<p>1. 彩带长 1.2 米，共 5 段，每段 0.24 米。</p>'],
    ['公式/算式正常', '<p>1. 3.5×1.2＝<u class="blank-4">&emsp;</u> 元。</p>'],
  ];
  for (const [desc, html] of cleanCases) {
    it(`不误报：${desc}`, () => {
      const { issues } = produce(html);
      expect(issues, desc).toEqual([]);
    });
  }
});
