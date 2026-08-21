import { describe, it, expect } from 'vitest';
import { getMatchingBlockInstructions } from '@/config/instructionLib';

describe('指令库 guarantee 行为', () => {
  it('生成-顶层约束 的首个返回项应为 guarantee 块', () => {
    const blocks = getMatchingBlockInstructions({ category: '生成-顶层约束', genType: 'exam' });
    expect(blocks.length).toBeGreaterThan(0);
    const first = blocks[0];
    expect(first).toBeTruthy();
    expect(first._guarantee === true || /^topconst_/.test(first.id) || /^role_/.test(first.id)).toBe(true);
  });

  it('生成-答案区强制锚定 包含 answer_anchor_question 且优先返回', () => {
    const blocks = getMatchingBlockInstructions({ category: '生成-答案区强制锚定', genType: 'exam' });
    expect(blocks.length).toBeGreaterThan(0);
    const found = blocks.find(b => b.id === 'answer_anchor_question');
    expect(found).toBeTruthy();
    expect(blocks[0].id === 'answer_anchor_question' || blocks[0]._guarantee === true).toBe(true);
  });
});
