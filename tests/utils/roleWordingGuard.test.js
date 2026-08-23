// 角色话术守卫：exam（试卷）指令不得混入"教辅"定位；时长统一以蓝本为准
import { describe, it, expect } from 'vitest';
import { getMatchingBlockInstructions } from '@/config/instructionLib';

describe('🔴 角色话术守卫（试卷对标正式命题，非教辅）', () => {
  it('exam 的品质标准块为"正式命题水准"话术，不含"教辅/53天天练"', () => {
    const blocks = getMatchingBlockInstructions({ category: '生成-品质标准', subject: '', stage: '', genType: 'exam' });
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.some(b => b.content.includes('53天天练'))).toBe(false);
    expect(blocks.some(b => b.content.includes('真题卷') || b.content.includes('正式命题'))).toBe(true);
  });

  it('非 exam 的品质标准块保留教辅话术（角色分流正确）', () => {
    for (const genType of ['practice', 'special', 'reading', 'errorbook', 'preview', 'dictation', 'review', 'summary']) {
      const blocks = getMatchingBlockInstructions({ category: '生成-品质标准', subject: '', stage: '', genType });
      expect(blocks.some(b => b.content.includes('53天天练')), `${genType} 应保留教辅话术`).toBe(true);
    }
  });

  it('exam 的编辑标准块不再叫"教辅编辑标准"', () => {
    const edit = getMatchingBlockInstructions({ category: '生成-编辑标准', subject: '', stage: '', genType: 'exam' });
    expect(edit.length).toBeGreaterThan(0);
    expect(edit.some(b => b.name.includes('教辅'))).toBe(false);
    expect(edit.some(b => b.content.includes('教辅'))).toBe(false);
  });

  it('exam 的时间分配块统一"以真题卷蓝本为准"，无"50或60分钟"式范围建议', () => {
    let total = 0;
    for (const st of ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high']) {
      const blocks = getMatchingBlockInstructions({ category: '生成-时间分配', subject: '', stage: st, genType: 'exam' });
      for (const b of blocks) {
        total++;
        expect(b.content).toContain('真题卷结构蓝本');
        expect(b.content).not.toMatch(/50或60|70或80|90或100/);
      }
    }
    expect(total).toBeGreaterThan(0);
  });

  it('exam 的答案规范块不再含"教辅级答案"话术', () => {
    const blocks = getMatchingBlockInstructions({ category: '生成-答案与解析规范', subject: '', stage: '', genType: 'exam' });
    expect(blocks.some(b => b.content.includes('教辅级答案'))).toBe(false);
  });
});
