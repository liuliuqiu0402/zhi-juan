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

describe('正文题号"全卷连续"守卫 · 源码接线（2026-09-26 · 试卷题号重启 → 答案区无法逐题对齐）', () => {
  it('exam 正文采纳前必须判"题号重启"，且判据从 contentCleaner 导入（非就地自造）', () => {
    expect(src, '未接入 detectBodyNumberingRestart → 试卷题号重启不会拦').toContain('detectBodyNumberingRestart');
    const m = src.match(/import \{[^}]*\} from '\.\.\/utils\/contentCleaner\.js';/);
    expect(m, 'useAiGenerator 对 contentCleaner 的 import 块缺失').toBeTruthy();
    expect(m[0]).toContain('detectBodyNumberingRestart');
  });

  it('重启 → 第 1 次回灌"全卷连续编号"并重试；第 2 次不判死（完整卷优先）+ 进报告', () => {
    expect(src).toContain('bodyRestart');                    // 判据已接入正文采纳分支
    expect(src).toContain('全卷连续编号');                    // 回灌给模型的要求
    expect(src).toContain('题号·分段拦截');                   // 第 1 次拦截日志
    expect(src).toContain('题号·分段放行');                   // 第 2 次放行日志
    expect(src, '第 2 次仍重启须进【问题列表】交人工核对').toContain('建议人工核对题号连续性');
    // 🔴 2026-10-06（面 7 程序链·同口径补位）：回灌措辞原只写"逐题递增"，未排除"同型并列整栏"——
    //   与正文题号对象口径（题号只给独立作答单位；同型并列整栏不逐项编号）**不同口径**，重试时可能反向诱导补号。
    //   现两处回灌（重启／缺号）一并带上该口径边界；本条为**锁**：边界句不得被再删。
    expect(src, '重启回灌须带编号对象口径边界').toContain('题号只给独立作答单位；同型并列不逐项编号');
    // 🔴 2026-10-09（面5·促力措辞并轨·user 问"是否还硬拽小题号+连续"）：回灌"从 1 起递增"补**主语限定"应给号的题"**——
    //    原句主语缺失（"题号从 1 起"），与"该给号才给号"半句并读仍可被读成"每题必号·连续"，是促编号力残留。本条为锁。
    expect(src, '回灌"从 1 起递增"须限定主语为应给号的题').toContain('**应给号的题**，其题号从 1 起逐题递增');
  });

  it('🔴 小学正式卷（各大题各自起编）：全卷"缺号/重启"拦截一并按学段分叉（2026-10-05 同族补齐）', () => {
    // 小学口径下"全卷 1~峰值连续"不成立；且行内数字（如"找规律填数 6、12、18、…"里的 18）会被计成题号、
    // 抬高峰值 → 全卷缺号判定必误报（实测："1~18 缺 9~17"→ 重试＋回灌"全卷连续"，反把应然的分段号改坏）。
    // 🔴 2026-10-10（用户裁定·彻底砍"编号连续性"拦截）：原两条系"缺号/重启拦截须按学段分叉"的**前向锁**；
    //    拦截已整体砍除（含"小学豁免"——无拦截即无误拦）⇒ 改为**反向锁**：不得再出现"编号连续性拦截"的接线
    //    （编号连续性不得再代模型定卷面形态；编号对象口径见【题号与分值】——此处不复述其字面，免得触单源守卫）。
    expect(src, '缺号拦截接线须已移除').not.toContain('perBigNumbering ? null : detectBodyNumberingGap(content)');
    expect(src, '重启拦截接线须已移除').not.toContain('genType === \'exam\' && !perBigNumbering');
    expect(src, '正文交付不得再以编号连续性门控').not.toContain('&& !qGap && !bodyRestart.restart');
    expect(src, '终检不得再判"缺号全文未出现＝真丢题"').not.toContain('const finalLoss = !!(finalCls');
  });

  it('答案侧脱钩"全卷连续"假设：改为按正文实际编号对齐 + 逐题覆盖', () => {
    expect(src, '旧硬要求"全卷连续、同序"在正文不连续时不可满足，须已移除').not.toContain('全卷连续、同序');
    // 🔴 2026-10-01（⑥拼接）：原断句"正文怎么编号，答案就逐题用同一套号"属**同义反复**之一（同一要求
    //    在答案页调用内说了 5 遍），已随收口删除；改断其**判据本体**（逐题以正文相同题号起头 + 逐题覆盖）。
    expect(src).toContain('每个题目都以与正文完全相同的题号起头');
    expect(src).toContain('逐题作答、全卷覆盖');
  });
});
