import { describe, it, expect } from 'vitest';
import {
  createGenerationSession,
  appendMessage,
  requestTransition,
  applyCompaction,
  historyChars,
  planStudyBatches,
  planOutputBudget,
  guardBrowseTarget,
  isReturnableSegment,
  estimateStudyCost,
} from '../../src/utils/generationSession.js';

describe('生成会话编排器（复位阶段 1）', () => {
  it('状态机：合法迁移 idle→studying→ready→writing→delivered', () => {
    const s = createGenerationSession();
    expect(requestTransition(s, 'studying')).toEqual({ ok: true });
    expect(s.stage).toBe('studying');
    expect(requestTransition(s, 'ready')).toEqual({ ok: true });
    expect(s.stage).toBe('ready');
    expect(requestTransition(s, 'writing')).toEqual({ ok: true });
    expect(s.stage).toBe('writing');
    expect(requestTransition(s, 'delivered')).toEqual({ ok: true });
    expect(s.stage).toBe('delivered');
  });

  it('状态机：非法迁移被拒绝且阶段不变', () => {
    const s = createGenerationSession();
    const r1 = requestTransition(s, 'ready'); // idle 不可直接 ready
    expect(r1.ok).toBe(false);
    expect(s.stage).toBe('idle');
    const r2 = requestTransition(s, '不存在');
    expect(r2.ok).toBe(false);
    requestTransition(s, 'studying');
    const r3 = requestTransition(s, 'delivered'); // studying 不可直接 delivered
    expect(r3.ok).toBe(false);
    expect(s.stage).toBe('studying');
  });

  it('状态机：缺料后只能回研读（need_material→studying）', () => {
    const s = createGenerationSession();
    requestTransition(s, 'studying');
    requestTransition(s, 'need_material');
    expect(s.stage).toBe('need_material');
    expect(requestTransition(s, 'writing').ok).toBe(false);
    expect(requestTransition(s, 'studying').ok).toBe(true);
  });

  it('消息追加：纯追加、类型受控、轮次计数', () => {
    const s = createGenerationSession();
    appendMessage(s, { role: 'user', content: '研读批1', compressible: true });
    appendMessage(s, { role: 'user', content: '委托书', compressible: false });
    appendMessage(s, { role: 'tool', content: 'browse返回' });
    expect(s.messages).toHaveLength(3);
    expect(s.messages[1].compressible).toBe(false);
    expect(s.rounds).toBe(3);
    expect(historyChars(s)).toBeGreaterThan(0);
    expect(() => appendMessage(s, { role: 'user', kind: 'bad', content: 'x' })).toThrow();
  });

  it('压缩：替换而非叠加，且不可压缩项（委托书）不可被替换', () => {
    const s = createGenerationSession();
    const a = appendMessage(s, { role: 'user', content: '研读批1', compressible: true });
    const b = appendMessage(s, { role: 'user', content: '研读批2', compressible: true });
    appendMessage(s, { role: 'user', content: '委托书', compressible: false });
    const before = s.messages.length;
    const r = applyCompaction(s, { summary: '（研读覆盖点名+摘要）', replacedIds: [a.id, b.id] });
    expect(r.ok).toBe(true);
    // 2 条被替换为 1 条摘要
    expect(s.messages.length).toBe(before - 1);
    expect(s.messages[0].kind).toBe('summary');
    expect(s.messages[0].content).toBe('（研读覆盖点名+摘要）');
    // 委托书仍在原位且未被压缩
    expect(s.messages.some((m) => m.content === '委托书')).toBe(true);
  });

  it('压缩：含不可压缩项/不存在 id/替换全部消息时拒绝', () => {
    const s = createGenerationSession();
    const a = appendMessage(s, { role: 'user', content: '可压缩', compressible: true });
    const b = appendMessage(s, { role: 'user', content: '委托书', compressible: false });
    expect(applyCompaction(s, { summary: 'x', replacedIds: [a.id, b.id] }).ok).toBe(false);
    expect(applyCompaction(s, { summary: 'x', replacedIds: ['不存在'] }).ok).toBe(false);
    expect(applyCompaction(s, { summary: 'x', replacedIds: [a.id, b.id, '不存在'] }).ok).toBe(false);
  });

  it('研读分批：上限管分批、不管切料；超限单位整段单批并标记 oversize', () => {
    const units = [
      { id: 'u1', label: '点1', chars: 800 },
      { id: 'u2', label: '点2', chars: 900 },
      { id: 'u3', label: '点3', chars: 600 },
      { id: 'big', label: '超限点', chars: 4000 },
    ];
    const { batches, oversize } = planStudyBatches(units, 2500);
    // u1+u2+u3=2300≤2500 同批；big(4000) 超限单独成批并标记
    expect(batches.map((b) => b.unitIds)).toEqual([['u1', 'u2', 'u3'], ['big']]);
    expect(oversize).toEqual(['big']);
    const empty = planStudyBatches([], 2500);
    expect(empty.batches).toEqual([]);
  });

  it('输出预算：宁余勿缺；超引擎上限显式提示，绝不静默截断', () => {
    const ok = planOutputBudget({ neededTokens: 5000, engineCapTokens: 65536 });
    expect(ok.action).toBe('ok');
    expect(ok.requested).toBe(Math.ceil(5000 * 1.25));
    expect(ok.clamped).toBe(Math.min(ok.requested, 65536));
    const over = planOutputBudget({ neededTokens: 80000, engineCapTokens: 65536 });
    expect(over.action).toBe('need_prompt');
    expect(over.overEngine).toBe(true);
    expect(over.clamped).toBe(65536); // 请求值被钳到引擎上限，但以显式提示为前提
  });

  it('browse 白名单：范围内放行、越界与空目标拒绝', () => {
    const s = createGenerationSession();
    expect(guardBrowseTarget(s, '小数乘法的意义', ['小数乘法的意义', '除数是小数的除法']).ok).toBe(true);
    expect(guardBrowseTarget(s, '整本书的任意章', ['小数乘法的意义']).ok).toBe(false);
    expect(guardBrowseTarget(s, '', ['小数乘法的意义']).ok).toBe(false);
  });

  it('段类型过滤：练习/未知段不返回，示范/正文段可返回', () => {
    expect(isReturnableSegment('例')).toBe(true);
    expect(isReturnableSegment('正文')).toBe(true);
    expect(isReturnableSegment('练习')).toBe(false);
    expect(isReturnableSegment('')).toBe(false);
  });

  it('研读成本估算：批数与超限清单可复用为费用旋钮输入', () => {
    const units = [
      { id: 'a', label: 'a', chars: 2000 },
      { id: 'b', label: 'b', chars: 2000 },
      { id: 'c', label: 'c', chars: 2000 },
    ];
    const est = estimateStudyCost(units, 2500);
    expect(est.batches).toBe(3); // 每批一个（任一单批超 2500 会超限，此处刚在限内需新批）
    expect(est.oversize).toEqual([]);
  });
});
