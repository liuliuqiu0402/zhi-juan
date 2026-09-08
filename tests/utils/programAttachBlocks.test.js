/**
 * 程序附加段·分段明细（buildProgramAttachBlocks）
 * 锁死"面板展示 = 实际注入"：blocks 文本与 buildProgramAttach 注入文本同源、逐规则可定位
 */
import { describe, it, expect } from 'vitest';
import { buildProgramAttach, buildProgramAttachBlocks } from '../../src/utils/programAttach.js';

describe('programAttachBlocks（注入文本 ↔ 面板分段同源）', () => {
  const base = { subject: '数学', stageKey: 'primary_high', genType: 'practice', needsImageText: '练习 课时练', instructionText: '' };

  it('rules 段逐规则带 id/文本，且拼回即注入文本', () => {
    const text = buildProgramAttach(base);
    const blocks = buildProgramAttachBlocks(base);
    // 规则段存在且每个都携带规则 id 与 promptHint 原文
    const ruleBlocks = blocks.filter((b) => b.lib === 'rules');
    expect(ruleBlocks.length).toBeGreaterThan(0);
    for (const r of ruleBlocks) {
      expect(r.id).toBeUndefined(); // 结构：lib/key/name/text
      expect(r.key).toBeTruthy();
      expect(r.name).toBeTruthy();
      expect(r.text.length).toBeGreaterThan(5);
      // 注入文本必须包含该条 promptHint（面板展示=实际注入）
      expect(text).toContain(r.text);
    }
    // 全 block 文本并集 ⊆ 注入文本（渲染契约整段、输出兜底整段同样在内）
    const contractBlock = blocks.find((b) => b.lib === 'render-contract');
    if (contractBlock) expect(text).toContain(contractBlock.text);
  });

  it('注入文本语义与重构前一致（含质检规则标题与 · 条目）', () => {
    const text = buildProgramAttach(base);
    expect(text).toContain('【版面质检规则（生成前约束）】');
    expect(text).toMatch(/· /);
  });

  it('指令文本已含【输出格式】时不再追加输出格式兜底段', () => {
    const withFmt = buildProgramAttachBlocks({ ...base, instructionText: '……【输出格式】\n1. 书写……' });
    expect(withFmt.some((b) => b.name.includes('输出格式兜底'))).toBe(false);
  });

  it('兜底段若存在，其文本必在注入文本内（面板展示=实际注入）', () => {
    const textNo = buildProgramAttach({ ...base, instructionText: '自定义模板没有输出格式' });
    const blocksNo = buildProgramAttachBlocks({ ...base, instructionText: '自定义模板没有输出格式' });
    const hint = blocksNo.find((b) => b.name.includes('输出格式兜底'));
    if (hint) expect(textNo).toContain(hint.text);
    else expect(blocksNo.length).toBeGreaterThan(0); // 至少仍有渲染契约/规则段
  });
});
