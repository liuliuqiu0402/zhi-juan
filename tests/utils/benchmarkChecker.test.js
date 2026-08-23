// 命题内容质量基准 checkers 落地：机械记忆词/语篇长度/设问层次程序化质检
import { describe, it, expect } from 'vitest';
import { HardRuleChecker } from '@/utils/qualityChecker';

describe('命题基准 checkers 程序化质检（全学科×学段落地）', () => {
  describe('1. 机械记忆型设问句式（banMechanical）', () => {
    it('语文中段：检测到"根据课文内容填空："句式 → 机械记忆题 warning', () => {
      const content = '<h2>积累与运用</h2>'
        + '<p class="question">1. 根据课文内容填空：______________</p>'
        + '<p class="question">2. 默写古诗：______________</p>'
        + '<div class="answer-section"><h2>答案</h2></div>';
      const issues = HardRuleChecker.check(content, [], '语文', '初中', '八年级', 'practice');
      const mech = issues.filter(i => i.type === '机械记忆题');
      expect(mech.length).toBeGreaterThan(0);
      expect(mech[0].severity).toBe('warning');
      expect(mech[0].detail).toContain('机械记忆');
    });

    it('数学中段：无 banMechanical（填空/口算为正常题型），不误报', () => {
      const content = '<h2>一、计算</h2>'
        + '<p class="question">1. 直接写得数：3×7=____</p>'
        + '<p class="question">2. 填空：4×____=28</p>'
        + '<div class="answer-section"><h2>答案</h2></div>';
      const issues = HardRuleChecker.check(content, [], '数学', '初中', '八年级', 'practice');
      expect(issues.filter(i => i.type === '机械记忆题')).toEqual([]);
    });

    it('未知学科/无基准：不报机械记忆题', () => {
      const content = '<p class="question">1. 根据课文内容填空：____</p>';
      const issues = HardRuleChecker.check(content, [], '音乐', '初中', '八年级', 'practice');
      expect(issues.filter(i => i.type === '机械记忆题')).toEqual([]);
    });
  });

  describe('2. 语篇长度分档（minPassage/maxPassage）', () => {
    it('语文中段：语篇超过 900 字上限 → 语篇超长 warning', () => {
      const long = '山'.repeat(1200);
      const content = '<h2>阅读</h2><p class="question">1. 阅读短文。</p>' + `<p>${long}</p>`
        + '<div class="answer-section"><h2>答案</h2></div>';
      const issues = HardRuleChecker.check(content, [], '语文', '初中', '八年级', 'practice');
      const over = issues.filter(i => i.type === '语篇超长');
      expect(over.length).toBeGreaterThan(0);
      expect(over[0].detail).toContain('900');
    });

    it('英语中学段：材料长度在分档内（200-350字）→ 不报语篇问题', () => {
      const passage = 'Today is a fine day. '.repeat(13); // ~299字符，在 200-350 分档内
      const content = '<h2>Reading</h2><p class="question">1. Read the passage.</p>' + `<p>${passage}</p>`
        + '<p class="question">2. What is the main idea?</p>'
        + '<div class="answer-section"><h2>答案</h2><p>听力原文：...</p></div>';
      const issues = HardRuleChecker.check(content, [], '英语', '初中', '八年级', 'practice');
      expect(issues.filter(i => i.type === '语篇超长' || i.type === '语篇过短')).toEqual([]);
    });

    it('数学中段：无 minPassage 配置（解答题短题干正常）→ 不报语篇', () => {
      const content = '<h2>一、解答</h2>'
        + '<p class="question">1. 解方程：2x+3=11。</p>'
        + '<div class="answer-section"><h2>答案</h2></div>';
      const issues = HardRuleChecker.check(content, [], '数学', '初中', '八年级', 'practice');
      expect(issues.filter(i => i.type === '语篇超长' || i.type === '语篇过短')).toEqual([]);
    });
  });

  describe('3. 设问层次（requireDepth）', () => {
    it('语文中段：含题目但无"为什么/你认为/推断"类推理设问 → 设问层次单一 warning', () => {
      const passage = '春天来了，校园里的花开了，同学们在操场上做游戏。'.repeat(15); // 拉长正文避免短内容豁免
      const content = '<h2>阅读</h2>'
        + `<p>${passage}</p>`
        + '<p class="question">1. 文中描写了哪些景物？</p>'
        + '<p class="question">2. 找出描写颜色的词语。</p>'
        + '<p class="question">3. 文章第一段的主要内容是什么？</p>'
        + '<p class="question">4. 文中提到了哪些人物？</p>'
        + '<div class="answer-section"><h2>答案</h2></div>';
      const issues = HardRuleChecker.check(content, [], '语文', '初中', '八年级', 'practice');
      const depth = issues.filter(i => i.type === '设问层次单一');
      expect(depth.length).toBeGreaterThan(0);
      expect(depth[0].detail).toContain('推理');
    });

    it('语文中段：含"为什么/结合全文分析"推理设问 → 不报设问层次', () => {
      const content = '<h2>阅读</h2>'
        + '<p class="question">1. 文中描写了哪些景物？</p>'
        + '<p class="question">2. 作者为什么说"这是最好的时节"？请结合全文分析。</p>'
        + '<div class="answer-section"><h2>答案</h2></div>';
      const issues = HardRuleChecker.check(content, [], '语文', '初中', '八年级', 'practice');
      expect(issues.filter(i => i.type === '设问层次单一')).toEqual([]);
    });

    it('内容过短（<300字）不触发设问层次检查（避免对残片误报）', () => {
      const content = '<p class="question">1. 这是什么？</p>';
      const issues = HardRuleChecker.check(content, [], '语文', '初中', '八年级', 'practice');
      expect(issues.filter(i => i.type === '设问层次单一')).toEqual([]);
    });
  });

  describe('4. 与既有检查共存（不破坏听力/分值/教材校验）', () => {
    it('英语含听力但无原文 → 仍报听力原文缺失（error 退稿），不受新增检查影响', () => {
      const content = '<h2>听力部分</h2>'
        + '<p class="question">1. What time does the class start?</p>'
        + '<p class="question">2. Where is the library?</p>'
        + '<div class="answer-section"><h2>答案</h2><p>1. B（2分）</p></div>';
      const issues = HardRuleChecker.check(content, [], '英语', '初中', '八年级', 'exam');
      const listening = issues.filter(i => i.type === '听力原文缺失');
      expect(listening.length).toBeGreaterThan(0);
      expect(listening[0].severity).toBe('error');
    });

    it('非英语学科不触发听力检查（无学科串扰）', () => {
      const content = '<h2>听力部分</h2><p class="question">1. 听老师读句子，圈出正确词语。</p>'
        + '<div class="answer-section"><h2>答案</h2></div>';
      const issues = HardRuleChecker.check(content, [], '语文', '初中', '八年级', 'practice');
      expect(issues.filter(i => i.type === '听力原文缺失')).toEqual([]);
    });
  });
});
