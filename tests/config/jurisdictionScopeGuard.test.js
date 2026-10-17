// ============================================================
// 管辖域覆盖守卫（2026-10-12 增 · **能机检则机检**）
// ------------------------------------------------------------
// 背景（属主）：**测试只覆盖某一个三维度，486 组合不可能全测** ⇒ 凡能机检的必须机检（机检天然遍历全部组合）。
// 本条治的是**第四轮 R4-2 的成因**：句尾括注（"…（讲解示范型栏目除外）"）**只辖住它紧挨的那一项列举**，
//   盖不到**同条其余要求句**（正文范围句、顺序句）⇒ 顺序覆盖。
// 立项时的修法＝**把管辖域提到句首**（"**除…外**，本次只输出…"）。⇒ 本条把该修法固化为**前置锁**：
//   含豁免语的**条**（一行一条），其**首现豁免**必须**早于**该条**首个要求词**（只输出／严禁／不得／一律／须）。
//   （豁免＝`（…除外）`／`（…不受此限）`／`除…外`；要求词＝驱动模型动作的谓述。）
// 纪律：新增合法例外**必须登记**并注明理由（离开"随手写过"）；全 54 开设对 × 9 类型遍历。
// ============================================================
import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
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

const clausesOf = (text) => text.split('\n').map((s) => s.trim()).filter(Boolean);

/** 豁免语（管辖域） */
const EXEMPT = /（[^）]{0,20}除外）|（[^）]{0,20}不受此限）|除[^，。；\n]{0,24}外/;
/** 要求词（驱动模型动作的谓述）——豁免须**前置于**其首现 */
const REQUIRE = /只输出|严禁|不得|一律|须/;

/** 登记豁免：合法"豁免不前置"的条——用**计数＋内容哈希**锁（长句逐字抄写易错）；
 *  任何增/删/改都判红 ⇒ 逼"新增同类 ⇒ 复核后显式更新基线"。
 *  🔒 2026-10-12 实测 4 条（**全部经核为合法写法**，非顺序覆盖）：
 *    ① 文字规范「凡出现汉字处一律用简体（**原文引文确需保留者除外**）」——豁免紧跟**它所辖的那一条**要求、条内无其余要求句 ⇒ 无覆盖缺口；
 *    ② 同一份卷内各大题标题不得重名「**除序号外**，题名须彼此可区分…」——此为**范围界定**（比较重名时排除序号），非"豁免某类"；
 *    ③ 卷内算式唯一性「不得在 ≥2 题复现（**对照/比较类并列子题除外**）；不得两题共用同一组关键数据」——**⚠️ 同形低风险留痕**：
 *       括注只辖住前项"算式复现"，未覆盖后项"共用关键数据"；疑点＝对照/比较类题**本就共用同组数据**（可能与后项张力）。
 *       **判为"待观察"**：对象窄、且后项事务不同（数据 vs 算式）；若真机出现"对照类被判不得共用数据"，再按最小改法补括注。
 *  🔴 2026-10-12（**属主场景质询后**）：**③ 已真修**——属主问"1–6 的乘法单元还能出高质量卷吗"，核证得该条**判准过严**
 *     （形式判据"同数值同运算即禁" ↔ 母判据"两处可互相替代才算重复"＋"同型多题属正规做法"⇒ **相抵**）；
 *     修法后该条**不再含"（…除外）"式豁免** ⇒ 从本清单**自然消失**，基线由 `{count:4,'71e2f2cbe46c'}` → **`{count:3,'643a539ba12a'}`**。
 *     （这正是本守卫的用法：**减少＝已修 ⇒ 显式更新基线**。）反向锁见 `tests/config/narrowUnitReuse.test.js`。 */
const BASELINE = { count: 3, hash: '643a539ba12a' };

/** 扫描：含豁免语的条里，"首现豁免"晚于"首个要求词"者判红 */
function scan() {
  const hits = [];
  for (const { stage, subject } of OPEN_PAIRS) {
    for (const g of GEN_TYPE_KEYS) {
      for (const line of clausesOf(buildMain(g, stage, subject))) {
        const mE = EXEMPT.exec(line);
        if (!mE) continue;
        const mR = REQUIRE.exec(line);
        if (!mR) continue;
        if (mE.index > mR.index) hits.push({ key: `${g}|${subject}|${stage}`, clause: line });
      }
    }
  }
  return hits;
}

const HITS = scan();
const UNIQ = [...new Set(HITS.map((h) => h.clause))].sort();
const uHash = crypto.createHash('sha1').update(UNIQ.map((s) => s.replace(/\s+/g, '')).join('\n')).digest('hex').slice(0, 12);

describe('管辖域覆盖守卫：含豁免语的条，豁免须前置于要求词（治"括注只辖住末尾列举"）', () => {
  it('扫描面须覆盖真实三维度（防扫描面被悄悄缩小）', () => {
    expect(OPEN_PAIRS.length).toBeGreaterThanOrEqual(50);
    expect(GEN_TYPE_KEYS.length).toBe(9);
  });

  it('不得有"豁免晚于要求词"的条（登记豁免除外）', () => {
    const got = { count: UNIQ.length, hash: uHash };
    expect(got, '豁免未前置的条集合漂移：新增＝新的顺序覆盖风险（须复核后登记并给理由）；减少＝已修（请更新基线）').toEqual(BASELINE);
  });

  it('守卫有牙：R4-2 修前措辞必被检出（防"空转守卫"）', () => {
    const before = '· 本次只输出资料正文（题目、卷面与作答区）——严禁在正文中输出任何答案、解析、评分标准、听力原文（讲解示范型栏目除外）；其余题目的参考答案由系统在正文生成后单独调用生成。';
    const after = '· **除讲解示范型栏目外**，本次只输出资料正文（题目、卷面与作答区）——严禁在正文中输出任何答案、解析、评分标准；讲解示范型栏目随题展示示范与解答，其余题目的参考答案由系统在正文生成后单独调用生成。';
    expect(EXEMPT.exec(before).index > REQUIRE.exec(before).index, '修前须判红').toBe(true);
    expect(EXEMPT.exec(after).index < REQUIRE.exec(after).index, '修后须判绿').toBe(true);
  });

  it('基线台账（人读镜像）', () => {
    // eslint-disable-next-line no-console
    console.log('豁免未前置 =', UNIQ.length, JSON.stringify(UNIQ.map((s) => s.slice(0, 90)), null, 1));
    expect(UNIQ.length).toBeGreaterThanOrEqual(0);
  });
});
