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
    //    2026-10-16 复核：该对**同源未除**——V6-1 当时只把两句**各自改准**（改"大题标题**本身**"＋禁令），
    //    而真正相抵的是更上游那一对（"与卷首导语主题情境**前后呼应**" ⟂ "**一律不出现情境词**"），
    //    故 2026-10-16 真机复发（"一、小水滴口算接力"）。本轮处置＝**两条一起撤**（删邀请＋删禁令），
    //    只留正向分工句。⇒ 本项改为**反向锁**：那两条**不得同份并存**（回来一个必带另一个）。
    name: '大题标题情境：不得回退"前后呼应 × 一律不出现情境词"这对相反要求',
    forbidBoth: [/与卷首导语的主题情境前后呼应/, /一律不出现情境词/],
  },
  {
    // 来源：2026-10-16 真机（"四、小辨对错…写着括号，实际给横线"）——【作答位与载体】形态条**条内**两个分句
    //   给出相反处置："填**符号**（…**√×** 等）→ **括号空位**" ⟂ "**题面要求在某个对象上作标记的，
    //    标记落在该对象本身、不另设空位**"（"在括号里画√"两条都命中）。
    //    本轮处置＝**给死分界**（题面指明落点的按落点定形；"标记落在对象本身"只管"直接标记既有对象"的）。
    //    ⇒ 本项为**反向锁**：旧的无条件口径不得回退。
    name: '作答位形态：不得回退"题面要求在对象上作标记→标记落在对象本身"的无条件口径',
    forbidBoth: [/题面要求在某个对象上作标记的/, /标记落在该对象本身/],
  },
  {
    // 来源：2026-10-16 真机（数学·小学低段「不该编号的题被编了小题号」）——【题号与分值】块内两句
    //   给出相反要求：分值标注条尾"**编号与**计分按实际计分对象给出"（编号跟着计分对象走）⟂ 同块
    //   计分对象口径"与编号对象**不是同一把尺**——题号给'独立作答单位'、分数给'判分处'（编号不跟计分对象走）。
    //   填空（1 编号对象／24 计分对象）：按前者编 24 个号、按后者只编 1 个 ⇒ 模型二选一。
    //   本轮处置＝删"编号与"三字（编号对象单源＝QOC）⇒ 本项为**反向锁**：那对相反要求不得同份并存。
    name: '编号对象：不得回退"编号与计分按实际计分对象给出 × 编号不按计分对象"这对相反要求',
    forbidBoth: [/编号与计分按实际计分对象给出/, /与编号对象不是同一把尺/],
  },
  {
    // 来源：2026-10-16 真机（数学·小学低段「三、填空（每空1分，共24分）」实测仅 21 空）——账目条**同句并存
    //   两个方向**："各大题多少分按实际内容分配（【卷面结构】各处所标的分**不采纳**）"（分值←内容）⟂
    //   "**内容按分值给足**……不符即**调内容规模（增删题）**"（内容←分值）⇒ 模型照抄结构分值、内容随手产出。
    //   本轮处置＝按属主 2026-10-16 最新裁定收单方向（分值＝单价×实际判分处数）⇒ 本项为**反向锁**。
    name: '分值方向：不得回退"结构所标不采纳 × 内容按分值给足（调内容规模）"这对相反方向',
    forbidBoth: [/不照抄【卷面结构】所标分值/, /内容按分值给足/],
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
