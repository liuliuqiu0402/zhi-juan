import { describe, it, expect } from 'vitest';
import { HardRuleChecker } from '@/utils/qualityChecker';

describe('HardRuleChecker', () => {
  describe('checkFullwidthChars', () => {
    it('检测全角数字', () => {
      const issues = HardRuleChecker.checkFullwidthChars('１２３是数字');
      expect(issues.some(i => i.type === '格式错误')).toBe(true);
    });

    it('半角数字不报错', () => {
      const issues = HardRuleChecker.checkFullwidthChars('123是数字');
      expect(issues.filter(i => i.type === '格式错误').length).toBe(0);
    });

    it('答案标为"略"应警告', () => {
      const issues = HardRuleChecker.checkFullwidthChars('答案：略');
      expect(issues.some(i => i.type === '答案不完整')).toBe(true);
    });
  });

  describe('checkAnswerCompleteness', () => {
    it('缺少答案区域应警告', () => {
      const issues = HardRuleChecker.checkAnswerCompleteness('这是一段没有解答说明的内容');
      expect(issues.some(i => i.type === '缺少答案')).toBe(true);
    });

    it('包含答案区域不报错', () => {
      const issues = HardRuleChecker.checkAnswerCompleteness('题目\n<div class="answer-section">答案在这里</div>');
      expect(issues.filter(i => i.type === '缺少答案').length).toBe(0);
    });
  });

  describe('checkHTMLTags', () => {
    it('标签闭合正确不报错', () => {
      const issues = HardRuleChecker.checkHTMLTags('<div><p>内容</p></div>');
      expect(issues.length).toBe(0);
    });

    it('未闭合标签报错', () => {
      const issues = HardRuleChecker.checkHTMLTags('<div><p>内容');
      expect(issues.some(i => i.type === 'HTML标签不平衡')).toBe(true);
    });
  });

  describe('check', () => {
    it('完整检查返回结果数组', () => {
      const issues = HardRuleChecker.check('题目内容\n答案：略', [], '数学', '小学', '一年级');
      expect(Array.isArray(issues)).toBe(true);
    });

    it('学科不匹配时不检查超纲', () => {
      // 高中英语不在 GRADE_VOCABULARY 中
      const issues = HardRuleChecker.check('content with 导数', [], '英语', '高中', '一年级');
      expect(issues.every(i => i.type !== '超纲词汇')).toBe(true);
    });
  });

  describe('getIssueSummary', () => {
    it('正确统计错误和警告', () => {
      const issues = [
        { severity: 'error', type: '格式错误', detail: 'test' },
        { severity: 'warning', type: '超纲词汇', detail: 'test' },
        { severity: 'warning', type: '答案不完整', detail: 'test' }
      ];
      const summary = HardRuleChecker.getIssueSummary(issues);
      expect(summary.total).toBe(3);
      expect(summary.errors).toBe(1);
      expect(summary.warnings).toBe(2);
      expect(summary.hasErrors).toBe(true);
    });
  });
});
