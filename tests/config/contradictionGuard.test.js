// ============================================================
// 同份「相反预设」守卫（2026-10-12 增 · **能机检则机检**）
// ------------------------------------------------------------
// 背景（属主）：**测试只覆盖某一个三维度，486 组合不可能全测** ⇒ 凡能机检的必须机检（机检天然遍历全部组合）。
// 本守卫把**历史上反复出现的那一类**——「同一份实发内两句给出相反要求／相反预设」——做成**回归网**：
//   · 形态 A（**条件锁定**）：A 句与 B 句**共现**时，A 句**必须带**某限定语（否则即相抵）。
//   · 形态 B（**共现禁止**）：A 句与 B 句**不得同份并存**。
// 登记的每一对都来自**真出现过的相抵**（R4-1／第五轮 V1／第六轮 V6-1），故**精确、不靠猜**。
// 纪律：新增登记须有**实发证据**；修好后此项**保持为反向锁**（防回潮）。
// 装配口径与 jurisdictionGuard 同源（buildMain＝用户消息＋system 附加段＋教辅块＋调用层）。
// ============================================================
import { describe, it, expect } from 'vitest';
import { getPromptTemplate, STAGE_SUBJECTS } from '../../src/config/promptLibrary.js';
import { buildTeachingInjection } from '../../src/config/teachingBlueprints.js';
import { buildUserMessagePrompt, buildCallLayerBlocks } from '../../src/utils/injectionManifest.js';
import { buildProgramAttach } from '../../src/utils/programAttach.js';
import { materialChannelOf } from '../../src/config/coverageContract.js';
import { GEN_TYPE_KEYS } from '../../src/config/toolLibrary.js';

const OPEN_PAIRS = Object.entries(STAGE_SUBJECTS)
  .flatMap(([stage, subjects]) => subjects.map((subject) => ({ stage, subject })));

function buildMain(genType, stage, subject) {
  const template = getPromptTemplate({ grade: stage, subject, genType }).template || '';
  const teaching = buildTeachingInjection({ genType, stage, subject }) || '';
  const userMsg = buildUserMessagePrompt({
    genType, subject, materialChannel: materialChannelOf(genType) || 'anchor',
    anchorListText: '一、主题\n· 知识点。', instructionText: template,
  });
  const sysAttach = buildProgramAttach({ subject, stageKey: stage, genType, instructionText: template });
  const callLayer = buildCallLayerBlocks().map((b) => b.text).join('\n');
  return [userMsg, sysAttach, teaching, callLayer].filter(Boolean).join('\n');
}

/** 登记表：每项都对应一次**真出现过的相抵**（注释记其来源） */
const CONTRADICTIONS = [
  {
    // 来源：第五轮 V1（12 份）——宽度条「写等量的全角空格」↔ ⑦「严禁用裸空格或全角空格串充当空位」。
    // 已修：宽度条加限定「**在空位载体内**」。⇒ 本项为**条件锁定**（共现时必须带该限定）。
    name: '全角空格：宽度条须限定"在空位载体内"（否则与 ⑦ 字面反令）',
    when: [/写等量的全角空格/, /严禁用裸空格或全角空格串/],
    require: /在空位载体内\*{0,2}写等量的全角空格/,
  },
  {
    // 来源：第五轮 V2——summary【创作要求】4「答案与解析**紧随本题之后**」↔ 例题例外「答案即**回填在例题自身的作答位上**」。
    // 已修：删该条。⇒ 本项为**共现禁止**（反向锁，防回潮）。
    name: '例题解答落位：不得与"紧随本题之后"并存',
    forbidBoth: [/答案与解析紧随本题之后/, /答案即回填在例题自身的作答位/],
  },
  {
    // 来源：第六轮 V6-1——exam 语文「大题标题**删去情境词后**须仍是完整的作答要求」（预设标题可含情境词）
    //        ↔ 情境边界条「大类层、大题标题与题干行…**一律不出现情境词**」。
    // 已修：改「大题标题**本身**须是完整的作答要求」。⇒ 本项为**共现禁止**（反向锁）。
    name: '大题标题：不得同时出现"删去情境词后须仍完整"与"一律不出现情境词"',
    forbidBoth: [/删去情境词后须仍是完整的作答要求/, /一律不出现情境词/],
  },
];

/** 扫描全部 54 开设对 × 9 类型 */
function scan() {
  const bad = [];
  for (const { stage, subject } of OPEN_PAIRS) {
    for (const g of GEN_TYPE_KEYS) {
      const t = buildMain(g, stage, subject);
      for (const c of CONTRADICTIONS) {
        if (c.forbidBoth && c.forbidBoth.every((re) => re.test(t))) {
          bad.push(`【${c.name}】${g}|${subject}|${stage}：两句同份并存`);
        }
        if (c.when && c.when.every((re) => re.test(t)) && !c.require.test(t)) {
          bad.push(`【${c.name}】${g}|${subject}|${stage}：共现但缺限定`);
        }
      }
    }
  }
  return bad;
}

const HITS = scan();

describe('同份「相反预设」守卫（全 54 组合遍历·能机检则机检）', () => {
  it('扫描面须覆盖真实三维度（防扫描面被悄悄缩小）', () => {
    expect(OPEN_PAIRS.length).toBeGreaterThanOrEqual(50);
    expect(GEN_TYPE_KEYS.length).toBe(9);
  });

  it('登记的相反预针对不得在任何一份实发里成立', () => {
    expect(HITS, '同份内出现相反要求/相反预设（历史相抵类回潮或新引入）').toEqual([]);
  });

  it('守卫有牙：合成相抵必被检出（防"空转守卫"）', () => {
    const c0 = CONTRADICTIONS[0];
    const synth = '· … 写等量的全角空格（1 字位≈1 个全角空格）；… ⑦…严禁用裸空格或全角空格串充当空位…';
    expect(c0.when.every((re) => re.test(synth)), '条件侧须命中').toBe(true);
    expect(c0.require.test(synth), '限定缺失 ⇒ 应判红').toBe(false);
    const c1 = CONTRADICTIONS[1];
    const synth2 = '· 答案与解析紧随本题之后 … · 答案即回填在例题自身的作答位上';
    expect(c1.forbidBoth.every((re) => re.test(synth2)), '共现侧须命中').toBe(true);
  });
});
