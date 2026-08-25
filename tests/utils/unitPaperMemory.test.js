// 同单元同类型生成记忆测试（跨会话题目去重）
import { describe, it, expect, beforeEach } from 'vitest';
import {
  MEMORY_STORAGE_KEY,
  buildUnitKey,
  extractQuestionSamples,
  pushUnitPaperMemory,
  getUnitPaperMemory,
  clearUnitPaperMemory,
  buildMemoryDiffInstruction,
} from '../../src/utils/unitPaperMemory.js';

beforeEach(() => {
  localStorage.removeItem(MEMORY_STORAGE_KEY);
});

describe('unitPaperMemory 分桶键', () => {
  it('按 教材×范围×类型 构建唯一键', () => {
    expect(buildUnitKey({ bookId: 'b1', scope: '第二单元', genType: 'exam' }))
      .toBe('b1|第二单元|exam');
    expect(buildUnitKey({ bookId: 'b1', scope: '第二单元', genType: 'exam' }))
      .toBe(buildUnitKey({ bookId: 'b1', scope: '第二单元', genType: 'exam' }));
    // 不同类型不同桶
    expect(buildUnitKey({ bookId: 'b1', scope: '第二单元', genType: 'exam' }))
      .not.toBe(buildUnitKey({ bookId: 'b1', scope: '第二单元', genType: 'practice' }));
  });
});

describe('unitPaperMemory 题目摘要提取', () => {
  it('从整卷 HTML 提取每题首句摘要（限量）', () => {
    const html = [
      '<h2>一、识字与写字（共6题，共32分）</h2>',
      '<p class="question">1. 看拼音写词语，把句子补充完整。</p>',
      '<p>（1）海边的沙滩上，一只海鸥在天空飞。</p>',
      '<p class="question">2. 圈出加点字的正确读音。</p>',
      '<p>（1）我们一行（háng xíng）人走在乡间的小路上。</p>',
      '<p class="question">3. 连一连。</p>',
    ].join('\n');
    const samples = extractQuestionSamples(html, 5, 25);
    expect(samples.length).toBeGreaterThanOrEqual(2);
    expect(samples[0]).toContain('看拼音写词语');
    // 每条不超过 25 字符
    for (const s of samples) expect(s.length).toBeLessThanOrEqual(25);
  });
});

describe('unitPaperMemory 记录读写与容量', () => {
  it('写入后可按桶读取（最近在前）', () => {
    const key = buildUnitKey({ bookId: 'b1', scope: '第二单元', genType: 'exam' });
    pushUnitPaperMemory(key, ['题A1', '题A2']);
    pushUnitPaperMemory(key, ['题B1', '题B2']);
    const recs = getUnitPaperMemory(key);
    expect(recs.length).toBe(2);
    expect(recs[0].samples).toEqual(['题B1', '题B2']); // 最近在前
  });

  it('桶容量控制：超过上限只保留最近记录', () => {
    const key = buildUnitKey({ bookId: 'b1', scope: '第二单元', genType: 'exam' });
    for (let i = 0; i < 8; i++) pushUnitPaperMemory(key, [`题${i}`]);
    expect(getUnitPaperMemory(key).length).toBeLessThanOrEqual(5);
  });

  it('不同类型/范围互不影响', () => {
    const k1 = buildUnitKey({ bookId: 'b1', scope: '第二单元', genType: 'exam' });
    const k2 = buildUnitKey({ bookId: 'b1', scope: '第二单元', genType: 'practice' });
    pushUnitPaperMemory(k1, ['exam题']);
    expect(getUnitPaperMemory(k2).length).toBe(0);
  });

  it('清空某桶', () => {
    const key = buildUnitKey({ bookId: 'b1', scope: '第二单元', genType: 'exam' });
    pushUnitPaperMemory(key, ['题']);
    clearUnitPaperMemory(key);
    expect(getUnitPaperMemory(key).length).toBe(0);
  });
});

describe('unitPaperMemory 差异化指令构建', () => {
  it('有历史记录 → 注入差异化要求（含已出题目摘要）', () => {
    const key = buildUnitKey({ bookId: 'b1', scope: '第二单元', genType: 'exam' });
    pushUnitPaperMemory(key, ['看拼音写词语：海边的沙滩上', '圈出加点字：一行人']);
    const diff = buildMemoryDiffInstruction(key, '试卷');
    expect(diff).toContain('【差异化要求——本单元已生成过 1 份「试卷」】');
    expect(diff).toContain('看拼音写词语：海边的沙滩上');
    expect(diff).toContain('至少 70% 的题与已出不同');
  });

  it('无历史记录 → 返回空串（不注入）', () => {
    const key = buildUnitKey({ bookId: 'b2', scope: '第三单元', genType: 'exam' });
    expect(buildMemoryDiffInstruction(key, '试卷')).toBe('');
  });

  it('多份历史 → 只注入最近几份的摘要（限量）', () => {
    const key = buildUnitKey({ bookId: 'b1', scope: '第二单元', genType: 'exam' });
    for (let i = 0; i < 4; i++) pushUnitPaperMemory(key, [`第${i}份题目A`, `第${i}份题目B`]);
    const diff = buildMemoryDiffInstruction(key, '试卷');
    // 4 份历史，注入最近 3 份 × 每份 5 条以内
    expect(diff).toContain('已生成过 4 份');
    expect(diff).toContain('第3份题目A'); // 最近一份在
  });
});
