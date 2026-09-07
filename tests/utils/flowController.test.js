import { describe, it, expect } from 'vitest';
import { createFlowController } from '../../src/composables/useGenerationFlow.js';

const SEG = { text: '除数是小数的除法：把被除数与除数的小数点同时向右移动相同的位数，使除数变成整数再计算。', type: '例', isKeyConcept: true };
const anchors = [
  { chapterTitle: '一', bigConcept: '小数除法', name: '除数是小数的除法', level: '理解', specificConcepts: ['除数化整'], bind: { status: 'literal', segments: [SEG] } },
  { chapterTitle: '一', bigConcept: '小数除法', name: '小数乘小数', level: '理解', specificConcepts: ['先按整数乘'], bind: { status: 'literal', segments: [SEG] } },
];

const digestProvider = async () =>
  '【除数是小数的除法】理解：除数化整再除\n｜引用：把被除数与除数的小数点同时向右移动相同的位数，使除数变成整数再计算。\n【小数乘小数】理解：先按整数乘法算再点小数点\n｜引用：把被除数与除数的小数点同时向右移动相同的位数，使除数变成整数再计算。';

describe('生成流程控制器（复位阶段 2/3）', () => {
  it('全流程：研读通过 → ready → 追加委托书 → 写作 → 成稿', async () => {
    const ctl = createFlowController({ meta: { genType: 'practice' }, digestProvider });
    expect(ctl.state.phase).toBe('idle');
    const r1 = await ctl.startStudy({ anchors });
    expect(r1.ok).toBe(true);
    expect(ctl.state.phase).toBe('ready');
    expect(ctl.state.ledgerText).toContain('除数是小数的除法');
    const r2 = ctl.commission('你是教辅编辑，请按委托生成……');
    expect(r2.ok).toBe(true);
    expect(ctl.state.phase).toBe('writing');
    expect(r2.messageId).toBeTruthy();
    const r3 = ctl.deliver();
    expect(r3.ok).toBe(true);
    expect(ctl.state.phase).toBe('delivered');
  });

  it('非法顺序被流程状态机拦截：未研读不可委托、未委托不可成稿', async () => {
    const ctl = createFlowController({ digestProvider });
    expect(ctl.commission('x').ok).toBe(false); // idle 不可追加委托书
    expect(ctl.deliver().ok).toBe(false); // idle 不可成稿
    const ctl2 = createFlowController({ digestProvider });
    await ctl2.startStudy({ anchors });
    expect(ctl2.commission('委托书').ok).toBe(true);
    expect(ctl2.commission('再委托一次').ok).toBe(false); // writing 不可重复委托
  });

  it('研读校验失败 → 停留 studying 并给出原因（程序不代写笔记）', async () => {
    const ctl = createFlowController({ digestProvider: async () => '【除数是小数的除法】' });
    const r = await ctl.startStudy({ anchors });
    expect(r.ok).toBe(false);
    expect(ctl.state.phase).toBe('studying');
    expect(ctl.state.error).toContain('研读笔记校验未通过');
  });

  it('全部锚缺料 → need_material 提示，不静默', async () => {
    const ctl = createFlowController({ digestProvider });
    const r = await ctl.startStudy({ anchors: [{ name: '无绑定点', bind: { status: 'missing', segments: [] } }] });
    expect(r.ok).toBe(false);
    expect(ctl.state.error).toContain('缺料');
  });
});
