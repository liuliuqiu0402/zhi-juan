/**
 * 正文截断 / 续写链 · 源码接线守卫
 * ============================================================
 * 背景（2026-09-24 · 真实云端模型实证 + 用户裁定"不接受打补丁，要根治"）：
 *   ① 知识总结单次输出 13555 字符 ÷ CHARS_PER_TOKEN(1.3) = 10427 token > 硬顶 8532
 *      → 旧逻辑"余额 ≤ 0 → 返回 0 → break" 把续写链**一轮都没跑**就锁死（"经 0 次续写…仍未完整"）；
 *   ② 本项目曾有**两套续写**：callAI 内薄层（两条引擎分支各一份、第三份内联去重、
 *      不检测续写自身再截断、finishReason 不回传）与正文额度链 → 同一个截断"正文能补齐、答案页半截放行"。
 *
 *   逻辑藏在大闭包里、纯函数单测覆盖不到接线，故用源码守卫锁住：
 *   ① 唯一实现：所有续写都必须走 continuationChain，且**不得再出现第二/第三份内联去重**
 *   ② 正文链：额度策略仍按 attemptQuota 推导（含首轮保底、升级预算重试跟随）
 *   ③ 答案页：续写链"仍截断"必须被当未完整处理（不得静默放行半截答案）
 * 谁把这些改回去，这里立刻红。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const src = fs.readFileSync(path.join(ROOT, 'src', 'composables', 'useAiGenerator.js'), 'utf8');

describe('续写链 · 唯一实现（两套收敛后不得回潮）', () => {
  it('引用了续写链唯一实现模块', () => {
    expect(src, '续写链唯一实现未接入').toContain("from '../utils/continuationChain.js'");
    expect(src).toContain('runContinuationChain');
  });

  it('三处续写都走同一条链（正文链 + Ollama + OpenAI 兼容）', () => {
    const calls = (src.match(/runContinuationChain\(\{/g) || []).length;
    expect(calls, '续写调用点少于 3 处：说明又有分支自己写了一套').toBeGreaterThanOrEqual(3);
  });

  it('不得再有第二/第三份内联去重（旧薄层各写一份的病灶）', () => {
    expect(src, '内联去重（精确末尾）回潮了').not.toContain('GEN_CONST.DEDUP_TAIL_EXACT');
    expect(src, '内联去重（渐进重叠）回潮了').not.toContain('GEN_CONST.DEDUP_OVERLAP_MAX');
    expect(src, '旧薄层的"续写失败即用原输出"措辞回潮了（那正是静默半截的措辞）').not.toContain('使用原输出');
  });

  it('detectTruncation / appendContinuationWithDedup 只从链模块再导出，不再本地实现', () => {
    expect(src).toContain('export { detectTruncation, appendContinuationWithDedup };');
    expect(src, 'detectTruncation 本地实现又长回来了').not.toContain('export const detectTruncation =');
    expect(src, 'appendContinuationWithDedup 本地实现又长回来了').not.toContain('export const appendContinuationWithDedup =');
  });
});

describe('正文续写 · 额度策略接线', () => {
  it('① 首轮保底：单次输出就超硬顶时也不能把续写链锁死', () => {
    expect(src, '续写预算丢了首轮保底 → 单次超硬顶即 0 轮续写（本次实证的病因）')
      .toContain('guaranteedRounds: 1');
  });

  it('② 保底必须回传已用轮数（否则每轮都能再保底 = 无界续写）', () => {
    expect(src).toContain('roundsUsed: round - 1');
  });

  it('③ 升级预算重试：续写额度跟着一起升级，而不是只放大单次帽', () => {
    expect(src, '重试未按升级后的单次帽重推额度 → 第 2 次尝试硬顶与第 1 次相同，"升级"无效')
      .toContain('const attemptQuota = planOutputQuota(');
    expect(src).toContain('Math.max(bodyEffectiveCap, attemptCap)');
    expect(src, '正文链未使用升级后的额度轮数').toContain('maxRounds: attemptQuota.rounds');
  });
});

describe('答案页 · 不得静默放行半截答案', () => {
  it('续写链已如实上报 finishReason（引擎分支都要 returnMeta）', () => {
    expect(src).toContain('finishReason: ollamaFinish');
    expect(src).toContain('finishReason = dsChain.truncated ? \'length\' : \'stop\'');
  });

  it('答案页把"续写后仍截断"当未完整处理（重试 / 判失败），并有对应日志与报错', () => {
    expect(src, '答案页没检查"仍被截断"→ 长度过线的半截答案会被静默放行').toContain('ansTruncated');
    expect(src).toContain('续写后仍被截断');
    expect(src).toContain('两次尝试均为空/过短/续写后仍截断');
  });
});

describe('答案区完整性 · 源码接线守卫（2026-09-26 · 真实事故：漏 import → ReferenceError 整卷失败）', () => {
  it('从 continuationChain 用到的导出**必须全部出现在 import 块**（漏一个 = 答案页运行时 ReferenceError）', () => {
    const m = src.match(/import \{[^}]*\} from '\.\.\/utils\/continuationChain\.js';/);
    expect(m, 'useAiGenerator 对 continuationChain 的 import 块缺失').toBeTruthy();
    const importBlock = m[0];
    // 实证：ANSWER_CONT_MAX_ROUNDS 曾只在函数体内引用、漏在 import 里，
    // 单测（不触发答案页运行时路径）抓不到，真机语文②整卷两次重试均为 ReferenceError。
    for (const name of [
      'detectTruncation', 'appendContinuationWithDedup', 'runContinuationChain',
      'makeBudgetedPlanRound', 'SIMPLE_CONTINUATION_MAX_ROUNDS', 'ANSWER_CONT_MAX_ROUNDS',
    ]) {
      expect(importBlock, `从 continuationChain 漏 import ${name} → 答案页运行时 ReferenceError`).toContain(name);
    }
  });

  it('答案页首判与重试两处都要把续写轮数对齐正文（contMaxRounds 已接入）', () => {
    expect((src.match(/contMaxRounds: ANSWER_CONT_MAX_ROUNDS/g) || []).length,
      '答案页未把续写轮数对齐正文 → 长答案页又锁死 2 轮就放弃')
      .toBeGreaterThanOrEqual(2);
  });
});
