// ============================================================
// L1 锚·门（2026-10-13 增 · 属主："不要偷懒 / 你是机器"）
// ------------------------------------------------------------
// 背景：锚表原**只打印 ✓/✗、从不判红**（无退出码、不在测试里）⇒ 与源码静默漂移数轮无人发现。
// 本文件把它变成**门**：
//   ① 覆盖 **486 面**（54 开设对 × 9 类型）——进程内装配，不落盘、不靠真机；
//   ② 计数对象＝**指令文本**（委托正文→user→system→教辅→调用层→风格），**不含快照头部**
//      （头部是"样本说明"非指令源，曾致 T13·G96「第N层」假阳性）；
//   ③ 任一 ✗ 即 fail；**尚未按面条件化**的锚列入 `PENDING`（显式登记）——
//      新增 ✗（不在 PENDING 内）立刻判红；修好一个就该从 PENDING 删一个（只减不增）。
// 锚表单源＝`scripts/l1Anchors.mjs`（与快照脚本共用一份）。
// ============================================================
import { describe, it, expect } from 'vitest';
import { getPromptTemplate, buildInjectionInstruction, buildStructureText, GEN_TYPE_NAMES, STAGE_SUBJECTS } from '../../src/config/promptLibrary.js';
import { DEFAULT_STYLE_BY_TYPE, buildStyleAppend, subjectGradeSystem } from '../../src/config/expertKnowledge.js';
import { buildTeachingInjection, getTeachingBlueprint } from '../../src/config/teachingBlueprints.js';
import { buildUserMessagePrompt, buildCallLayerBlocks } from '../../src/utils/injectionManifest.js';
import { buildProgramAttach } from '../../src/utils/programAttach.js';
import { materialChannelOf } from '../../src/config/coverageContract.js';
import { findBlueprint } from '../../src/config/blueprintProvider.js';
import { GEN_TYPE_KEYS } from '../../src/config/toolLibrary.js';
import { anchorsFor } from '../../scripts/l1Anchors.mjs';
// 🔴 2026-10-13（单源化）：面级装配原为**本文件私有**，`antiHomogenizationGuard` 需要同一份 ⇒
//   已抽到 `scripts/instructionText.mjs`（**单源**），此处改为 import（装配口径逐字不变，断言一字未改）。
import { buildInstructionText } from '../../scripts/instructionText.mjs';

const BUCKET = { primary_low: '小学', primary_mid: '小学', primary_high: '小学', middle: '初中', high: '高中' };
const HINT = { primary_low: '一年级', primary_mid: '三年级', primary_high: '五年级', middle: '七年级', high: '高一' };

const PAIRS = Object.entries(STAGE_SUBJECTS).flatMap(([stage, subs]) => subs.map((subject) => ({ stage, subject })));

// （装配函数已单源化 ⇒ 见文件头 import：`scripts/instructionText.mjs`）

/** 尚待按面条件化的锚（**显式登记**；修好一个删一个，只减不增）。
 *  成因：锚期望是照最初 16 面样本写死的，未按"类型／学科／学段"声明适用面。
 *  面分布（2026-10-13 486 面实测）：486 / 432 / 270 / 108 / 54 各一层。 */
const PENDING = new Set([]); // ✅ 2026-10-13 清零：19 条锚全部按源码声明条件化完毕

// 🔴 2026-10-13 首跑即证：① `T13·G96 清零（"第N层"）` 由 ✗ → ✓ ——**快照头部被排除在计数外**后假阳性消失；
//   ② 修正①〜④后 ✗ 锚 19 → 15；③ 新增未登记项 `T19·G9 抽样口径正句` ⇒ 已登记（不静默放过）。

const FACES = [];
const BAD = new Map(); // 锚名 -> 面数
const FACE_TEXT = new Map(); // 面 -> 指令文本（供 ⑥ 守卫复用同一装配，避免第三份副本）
for (const { stage, subject } of PAIRS) {
  for (const genType of GEN_TYPE_KEYS) {
    const text = buildInstructionText(genType, subject, stage);
    const faceId = `${genType}|${subject}|${stage}`;
    FACE_TEXT.set(faceId, text);
    FACES.push(faceId);
    for (const a of anchorsFor({ genType, subject, stage, hasStructure: !!findBlueprint({ genType, subject, stage, region: '', scopeType: '' }) })) {
      const hits = (text.match(a.re) || []).length;
      const ok = a.expect === null ? hits >= 1 : hits === a.expect;
      if (!ok) BAD.set(a.name, (BAD.get(a.name) || 0) + 1);
    }
  }
}

describe('L1 锚·门：486 面逐面核（新增 ✗ 即判红）', () => {
  it('覆盖 486 面（54 开设对 × 9 类型）', () => {
    expect(PAIRS.length).toBe(54);
    expect(GEN_TYPE_KEYS.length).toBe(9);
    expect(FACES.length).toBe(486);
  });

  it('锚表可达（单源模块）；锚数＝绊线，增删锚须显式改此数', () => {
    // 72 = 71（2026-10-13 抽表时）+ 1（T05·内容型强调口径正句，补"内容型支无锚"的缺口）
    expect(anchorsFor({ genType: 'exam', subject: '语文', stage: 'primary_high' }).length).toBe(72);
  });

  it('不得出现"登记表之外的 ✗"（新增即判红；修好后请从 PENDING 删除）', () => {
    const unexpected = [...BAD.keys()].filter((n) => !PENDING.has(n));
    expect(unexpected, '出现未登记的 ✗ 锚 ⇒ 面不匹配或字面漂移，须按源码声明条件化/修正').toEqual([]);
  });

  it('登记表只减不增（不得为凑绿而增项）', () => {
    const ghost = [...PENDING].filter((n) => !BAD.has(n));
    // 已修好的项仍在登记表中 ⇒ 提醒清理（不判红，只报数）
    // eslint-disable-next-line no-console
    console.log(`PENDING=${PENDING.size}｜实际 ✗ 锚=${BAD.size}｜可清理=${ghost.length ? ghost.join(' | ') : '无'}`);
    expect(BAD.size).toBeLessThanOrEqual(PENDING.size);
  });
});

// ============================================================
// ② 类型必备体例矩阵·第一层：**体例骨架须在每个面在场**（2026-10-13 增）
// ------------------------------------------------------------
// 证据（全部为源码事实，非推断）：
//   · `teachingBlueprints.js:57` `TEACHING_BLUEPRINTS`（以**教辅类型**为顶层键）；`:1177` `TEACHING_GEN_TYPES = Object.keys(TEACHING_BLUEPRINTS)`
//   · `:243` `TEACHING_SUBJECT_BLUEPRINTS`（学科覆盖表）；`:1357` 注入点 `TEACHING_BLUEPRINTS[genType]`
//   · `scripts/snapshotInjection.mjs:104` 教辅结构**仅非 exam 注入**（`if (genType !== 'exam')`）
// ⇒ 判据：**非 exam 的每个面**，教辅结构（体例骨架）必须非空。
//   （第二层"逐栏目名在场"待下批，需先取各类型 sections 的声明清单。）
// ============================================================
describe('② 类型必备体例矩阵：非 exam 面「骨架在场」＋「声明栏目逐面在场」', () => {
  const empty = [];
  const missRows = [];
  let declaredTotal = 0;
  let facesWithDecl = 0;
  for (const { stage, subject } of PAIRS) {
    for (const genType of GEN_TYPE_KEYS) {
      if (genType === 'exam') continue;
      // ⚠️ 2026-10-13 加固（防"绿得站不住"）：断言须落在**最终装配文本**（FACE_TEXT）上，
      //   而非只看教辅块——否则"教辅块被后续覆盖/未并入最终 prompt"这类问题会漏过。
      const tBlock = buildTeachingInjection({ genType, stage, subject }) || '';
      const face = `${genType}|${subject}|${stage}`;
      const t = FACE_TEXT.get(face) || '';
      if (!t.trim()) { empty.push(face); continue; }
      // 第二层：**声明栏目**（与注入同一解析入口 getTeachingBlueprint）须在**最终 prompt 与教辅块两处**都在场
      const bp = getTeachingBlueprint({ genType, stage, subject });
      const declared = (bp?.sections || []).map((s) => s && s.name).filter(Boolean);
      const missing = declared.filter((n) => !t.includes(n) || !tBlock.includes(n));
      declaredTotal += declared.length;
      if (declared.length) facesWithDecl += 1;
      if (missing.length) missRows.push(`${face} 缺[${missing.join('/')}]（声明 ${declared.length} 项）`);
    }
  }

  it('第一层：无"非 exam 面体例骨架为空"', () => {
    // eslint-disable-next-line no-console
    console.log(`② 骨架：空面 ${empty.length}/${PAIRS.length * 8}`);
    expect(empty.slice(0, 30)).toEqual([]);
  });

  it('第二层：声明栏目须逐面在场（缺任一即红）', () => {
    // eslint-disable-next-line no-console
    console.log(`② 栏目：缺项面 ${missRows.length}/${PAIRS.length * 8}｜声明总数 ${declaredTotal}（含声明的面 ${facesWithDecl}/${PAIRS.length * 8}）`);
    // 反空转：若取不到任何声明，则"0 缺项"毫无意义 ⇒ 必须真的取到声明
    expect(declaredTotal, '未取到任何声明栏目 ⇒ 检查空转，不算通过').toBeGreaterThan(500);
    expect(facesWithDecl, '取到声明的面过少 ⇒ 检查空转').toBeGreaterThan(PAIRS.length * 8 - 5);
    expect(missRows.slice(0, 20)).toEqual([]);
  });
});

// ============================================================
// ⑥ 子条不得严于母条（2026-10-13 增）
// ------------------------------------------------------------
// 来源：属主质询"不是说过不要过度约束吗？为什么还有"。
// 已查证的成因（**证据**）：学科落位条「卷内算式唯一性」曾写"同一算式（**同数值同运算**）不得在 ≥2 题复现"
//   ＝**形式判据**，而**母判据**【质量底线】`内容唯一性`为"**两处可互相替代才算重复**"＋正向声明
//   "同型多题／同一知识点多题／同一材料多题共用属**正规做法**" ⇒ **子条严于母条**（在窄单元上误伤：1–6 乘法算式仅 36 个、口算即 20 题）。
// 判据：**凡条中引用母判据**（`同【…】` / `与【…】` / `同源`）者，必须**同时**继承母判据的
//   ① **判准词**、② **正向例外（放宽句）**；缺任一项即判红。
// 装配复用本文件同一份 486 面文本（不新增副本）。
// ============================================================
const PARENTS = [
  {
    name: '【质量底线】内容唯一性',
    criterion: /两处可互相替代/,
    allowance: /属正规做法|属正常并列/,
  },
];

describe('⑥ 子条不得严于母条：引用母判据者须继承其判准词与正向例外', () => {
  it('无"引用母判据却丢了判准词/正向例外"的条（486 面扫描）', () => {
    const offenders = [];
    let refCount = 0;
    for (const [, text] of FACE_TEXT) {
      for (const raw of text.split('\n')) {
        const L = raw.trim();
        if (!L.startsWith('·')) continue;
        if (!/同【|与【|同源/.test(L)) continue;
        for (const p of PARENTS) {
          if (!L.includes(p.name)) continue;
          refCount += 1;
          const miss = [];
          if (!p.criterion.test(L)) miss.push('判准词');
          if (!p.allowance.test(L)) miss.push('正向例外');
          if (miss.length) offenders.push(`${p.name} 缺[${miss.join('+')}] :: ${L.slice(0, 120)}`);
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log(`⑥ 扫描：引用母判据的条命中 ${refCount} 处｜不合格 ${offenders.length}`);
    expect(offenders).toEqual([]);
  });

  it('守卫有牙：把子条的判准词换成形式判据 ⇒ 必判红（防"空转守卫"）', () => {
    const before = '· 卷内算式唯一性（同【质量底线】内容唯一性）：同一份卷内同一算式（同数值同运算）不得在 ≥2 题复现；出现即更换其中一题的数据与情境；';
    const after = '· 卷内算式唯一性（同【质量底线】内容唯一性：凡设题处以"两处可互相替代"判）：同一份卷内不得有两道可互相替代的题；同型多题、同点训练的连续小题属正常并列；';
    const p = PARENTS[0];
    expect(p.criterion.test(before), '修前应缺判准词').toBe(false);
    expect(p.allowance.test(before), '修前应缺正向例外').toBe(false);
    expect(p.criterion.test(after) && p.allowance.test(after), '修后应齐备').toBe(true);
  });
});
