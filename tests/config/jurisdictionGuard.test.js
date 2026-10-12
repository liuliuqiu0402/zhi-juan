// ============================================================
// 管辖域守卫（2026-10-12 · S4 第四轮回流教训 → 机检锁）
// ------------------------------------------------------------
// 病根（第四轮 5 条真错里 R4-1／R4-2 **全是"我上一轮改动引入"**）：
//   ① **面不匹配**：【质量底线】等**全类型注入**的条，谓述却是**题面专属**（设问设计）
//      ⇒ 落到**不产题的资料**（内容型 preview/summary、默写类 dictation）上**空转**，
//        且与该类型定位语（preview「紧扣教材原文」／dictation「严格对应教材要求」／summary「全面细致地汇总知识」）**相抵**（R4-1）。
//   ② **位不匹配**：限定语只贴住紧邻的列举项，没盖住**同条其余分句**（R4-2 的括注只挂禁答列举之后）。
// 本守卫把①变成**机器可拦**：不产题资料的**条**里出现"设问"，该条必须带**管辖域标记**
//   （`凡…处`／`若含题`／`…不受此限`／`除…外`／`按…口径`），否则记为一个**裸条**。
// 纪律：**只减不增**——登记**既存**裸条指纹为基线；**新增任一裸条即判红**（R4-1 形态不得再引入）。
// 装配口径与 `intraRequestDuplicate.test.js` 的 buildCells 同源（用户消息＋system 附加段＋教辅块＋调用层）。
// ============================================================
import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { getPromptTemplate, STAGE_SUBJECTS } from '../../src/config/promptLibrary.js';
import { buildTeachingInjection } from '../../src/config/teachingBlueprints.js';
import { buildUserMessagePrompt, buildCallLayerBlocks } from '../../src/utils/injectionManifest.js';
import { buildProgramAttach } from '../../src/utils/programAttach.js';
import { materialChannelOf } from '../../src/config/coverageContract.js';
import { GEN_TYPE_KEYS } from '../../src/config/toolLibrary.js';

/** 不产"题面设问"的资料类型：内容型（preview／summary）＋默写类（dictation）。
 *  这三类里，"设问"**没有默认对象** ⇒ 必须被管辖域条件化，否则悬空。 */
const NON_QUESTION_FACE = ['preview', 'summary', 'dictation'];

/** 题面专属词（本次确诊的那一类：**设问**）。
 *  说明：不加"题号/分值/选项/作答位/卷面"——它们在 preview／summary／dictation 里有**合法**落点
 *  （"若含题"条件化承载，或默写类本身就有作答位），并入会把守卫变成噪音源（实测 3692 命中）。 */
const FACE_WORDS = ['设问'];

/** 管辖域标记：把题面词**条件化**的措辞（整条缺一即视为裸条） */
const JURISDICTION = [
  /凡[^，。；\n]{0,8}处/, // 凡设问处 / 凡设题处
  /若含题/,
  /不受此限/,
  /除[^，。；\n]{0,20}外/, // 除讲解示范型栏目外
  /按[^，。；\n]{0,12}口径/,
];

/** 按**条**切分（本项目口径：块内一条一行）——管辖域作用于**整条**。
 *  （若按分号切句，"本资料若含题：…；作答位紧随其题、在设问之后…"会被误切成裸条。） */
const clausesOf = (text) => text.split('\n').map((s) => s.trim()).filter(Boolean);

/** 裸条键＝**去空白后的整条**（有两条"题面带选项…"仅中段不同，任何截断都会碰撞） */
const fingerprint = (s) => s.replace(/\s+/g, '');

const OPEN_PAIRS = Object.entries(STAGE_SUBJECTS)
  .flatMap(([stage, subjects]) => subjects.map((subject) => ({ stage, subject })));

/** 装配一份"正文实发"（与 intraRequestDuplicate.buildCells 同口径） */
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

/** 扫描：不产题资料的**裸条**（含题面词、整条无管辖域） */
function scan() {
  const hits = [];
  for (const genType of NON_QUESTION_FACE) {
    for (const { stage, subject } of OPEN_PAIRS) {
      const text = buildMain(genType, stage, subject);
      for (const s of clausesOf(text)) {
        if (!FACE_WORDS.some((w) => s.includes(w))) continue;
        if (JURISDICTION.some((re) => re.test(s))) continue;
        hits.push({ key: `${genType}|${subject}|${stage}`, clause: s });
      }
    }
  }
  return hits;
}

const HITS = scan();
const UNIQ = [...new Set(HITS.map((h) => h.clause))];
const BY_TYPE = NON_QUESTION_FACE.reduce((acc, t) => {
  acc[t] = HITS.filter((h) => h.key.startsWith(t + '|')).length;
  return acc;
}, {});

/** 🔒 基线（2026-10-12 实测）：**既存**裸条（去空白后整条）——只认这些；新增即判红（只减不增）。 */
const REGISTRY = [
  '·设问分型定深浅：**技能训练型**（以熟练准确为目的的基础技能练习，练到即是目的）重在**准确熟练**；**理解运用型**（以理解、运用为目的的设问）重在**推理、说理与迁移**',
  '·内容正确：图文一致（配图与正文相符）；逻辑自洽（条件充分、前后一致、设问与结果对应）',
  '·事实可信：凡确定性事实（人名、作品、年代、地名、数据、引文等），仅在确有把握时写出具体值；无把握时不虚构、不猜测，改为不点名的设问或定性表述',
  '综合性强，阅读量加大；增加开放性与探究性设问；可适当开放思辨，但不超高段课标能力要求',
  '素养立意（学科核心素养导向）；复杂情境+综合设问；知识内容符合高中课标',
  '函数与导数、几何、概率统计综合；解题过程完整、逻辑严谨、步骤规范；开放设问考查数学表达与推理。',
  '时政与政策表述规范：原理运用与事例对应准确；政策名称、报告提法以权威表述为准，不确定时不引用具体文件与数据，改用原理立意设问；事例人物真实，不虚构人物与事迹。',
  '·**各自给出独立设问的**（**逐项设问不同**）才各自编号；**整大题只含一个编号对象时**（＝整大题共用一条作答要求，哪怕其下并列多少项），题号即该大题序号**，其下不再另起题号与题干行**（各位置由作答位承载）；同一题号内再分问时，其标示形式与本卷层级相区分（符号不由本条指定）',
  '·题面带选项（A./B./C.等）的题，其作答位即上句判据所指的**圆括号空位**、**括号一律用半角（英文状态）括号**：**在材料与设问之后、选项之前**——**紧接第一个选项标号（A./B./①…）之前**（设问末字后有无标点、选项是否与设问同段皆然），写成"1.……的是()"；选项列于材料与设问之后；选项内、选项末尾及选项之后一律不加作答位（不给整行横线、不给空白作答行、不另设作答区）；**选项题的作答位形态与位置**属本条管辖——**题面声明与之不符时改题面**，不改空位形态；',
  '·⑨同题子问不得雷同：并列子问须各自承担不同的考查角度/类别，两空题干与答案不得相同；分类题目须给出≥2个不同类别空位，否则合并为一个空位（**例外**：同一组数据或材料的**并列对照子题**——从不同口径、不同单位或正反方向对照设问的孪生小题——属正常并列、**不按雷同处理**）；',
  '·题面带选项（A./B./C.等）的题，其作答位即上句判据所指的**圆括号空位**、**括号一律用半角（英文状态）括号**：**在题号之前的题首**，写成"()1.题干…"；选项列于材料与设问之后；选项内、选项末尾及选项之后一律不加作答位（不给整行横线、不给空白作答行、不另设作答区）；**选项题的作答位形态与位置**属本条管辖——**题面声明与之不符时改题面**，不改空位形态；',
];

describe('管辖域守卫：不产题的资料上，"设问设计"指令必须有管辖域（防 R4-1 形态再引入）', () => {
  it('扫描面须覆盖真实三维度（防扫描面被悄悄缩小）', () => {
    expect(OPEN_PAIRS.length).toBeGreaterThanOrEqual(50);
    expect(NON_QUESTION_FACE.length).toBe(3);
  });

  it('不得新增裸条（登记基线之外一律判红）', () => {
    const unknown = UNIQ.filter((s) => !REGISTRY.includes(fingerprint(s)));
    expect(
      unknown.map((s) => s.slice(0, 120)),
      '不产题资料上新增了无管辖域的"设问"指令（空转/相抵风险 ⇒ 见 R4-1）：给该条加管辖域，或登记基线',
    ).toEqual([]);
  });

  it('守卫有牙：R4-1 前/后措辞须分别判红、判绿', () => {
    const before = '· 命题立意：…每处设问须能指认其对应的课标能力/素养点（指认不出的删去），不得以"教材原文逐句挖空／要点逐条改写"充当设问设计';
    const after = '· 命题立意：…**凡设问处**，每处设问须能指认其对应的课标能力/素养点（指认不出的删去），不得以"教材原文逐句挖空／要点逐条改写"充当设问';
    expect(FACE_WORDS.some((w) => before.includes(w)), 'R4-1 前措辞须含题面词').toBe(true);
    expect(JURISDICTION.some((re) => re.test(before)), 'R4-1 前措辞须**无**管辖域（⇒ 会被判红）').toBe(false);
    expect(JURISDICTION.some((re) => re.test(after)), 'R4-1 后措辞须**有**管辖域（⇒ 判绿）').toBe(true);
  });

  it('基线台账（人读镜像：当前裸条指纹＋计数）', () => {
    // eslint-disable-next-line no-console
    console.log('按类型 =', JSON.stringify(BY_TYPE), '\n指纹 =', JSON.stringify(UNIQ.map(fingerprint), null, 1));
    expect(UNIQ.length).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================
// 泛化守卫：**面不匹配的唯一发生地**＝"全类型注入的条"
// ------------------------------------------------------------
// R4-1 的机制是：一条**在全部资料类型里都注入**的条，其谓述只对**某类资料**成立。
// 故本块不问"某类型里有没有题面词"，而问——
//   **在 9 个资料类型里逐字相同的那些条**（＝全类型注入的条），含**题面专属谓述**时是否带管辖域。
// 这样：① 面不匹配**必被捕获**（不论哪个词）；② 不误伤题类专属块（内容型里根本没有该块 ⇒ 不在交集内）。
// 纪律同前：**只减不增**——登记既存为基线，**新增即判红**。
// ============================================================
/** 题面专属谓述（"对象"只在**有题面**的资料里成立的那一类词） */
const FACE_WORDS_WIDE = ['设问', '题号', '分值', '选项', '作答位', '卷面', '大题', '小题'];

/** 取"在 9 个资料类型里逐字相同"的条（＝全类型注入的条） */
function universalClauses(stage, subject) {
  const perType = GEN_TYPE_KEYS.map((g) => new Set(clausesOf(buildMain(g, stage, subject))));
  return [...perType[0]].filter((line) => perType.every((s) => s.has(line)));
}

function scanUniversal() {
  const hits = [];
  for (const { stage, subject } of OPEN_PAIRS) {
    for (const line of universalClauses(stage, subject)) {
      if (!FACE_WORDS_WIDE.some((w) => line.includes(w))) continue;
      if (JURISDICTION.some((re) => re.test(line))) continue;
      hits.push({ key: `${subject}|${stage}`, clause: line });
    }
  }
  return hits;
}

const UHITS = scanUniversal();
const UUNIQ = [...new Set(UHITS.map((h) => h.clause))].sort();
const uKey = UUNIQ.map(fingerprint).join('\n');
const uHash = crypto.createHash('sha1').update(uKey).digest('hex').slice(0, 12);

/** 🔒 基线（2026-10-12 实测）：既存"全类型条上的裸谓述"。
 *  用 **计数＋内容哈希** 锁死（条目是长句，逐条抄写易错）：**任何增/删/改都判红**，
 *  逼"有意改动 ⇒ 复核后显式更新基线"。（修复掉一条也须更新——这正是我们要的留痕。）
 *  🔴 2026-10-12（R1·乙·面集门控落地后**显式更新**）：**18 → 17**。
 *    来源＝`promptLibrary.js` `QUALITY_FACE_GATES` 把「设问分型定深浅」按面集门控（`dictation` 无设问 ⇒ 该条不注入）
 *    ⇒ 它不再是"9 类型逐字相同"的条，退出本集合。**只此一条变动**，其余 17 条未动。 */
const UNIVERSAL_BASELINE = { count: 17, hash: '0e4faa17584e' };

// ============================================================
// 「对象词 × 类型集」集合等值锁（2026-10-12 增 · **能机检则机检**）
// ------------------------------------------------------------
// 背景（属主）：**测试只覆盖某一个三维度，486 组合不可能全测** ⇒ 凡能机检的必须机检——机检天然**遍历全部组合**。
// 本块把"某条的对象只在某些类型存在"做成**集合等值**断言：该条**出现类型集**必须**恰等于登记集**
//   （多一类＝空转／对象缺席而注入；少一类＝误门控缺判据）。**全 54 开设组合遍历**。
// 纪律：新增此类条**必须登记**；登记集要改须显式改此表（离开"随手改"）。
// ============================================================
const OBJECT_FACE_CLAUSES = [
  { name: '命题纪律·选项位置打散', re: /命题纪律：同一组题的正确答案在选项序列中的位置须打散/,
    // 对象＝**选项序列** ⇒ keep ＝**非内容型**（内容型不走【题目自洽】本块）**且非默写**（dictation 无选项）。
    keep: ['exam', 'practice', 'special', 'reading', 'errorbook', 'review'] },
  { name: '设问分型定深浅', re: /设问分型定深浅：/,
    // 对象＝**设问** ⇒ keep ＝ 除 dictation（默写不设问）。
    keep: ['exam', 'practice', 'special', 'preview', 'reading', 'summary', 'errorbook', 'review'] },
];

describe('「对象词 × 类型集」集合等值锁（全组合遍历·能机检则机检）', () => {
  it('每条的对象词条，其出现类型集须恰等于登记 keep 集', () => {
    const bad = [];
    for (const c of OBJECT_FACE_CLAUSES) {
      const appears = new Set();
      for (const { stage, subject } of OPEN_PAIRS) {
        for (const g of GEN_TYPE_KEYS) {
          if (c.re.test(buildMain(g, stage, subject))) appears.add(g);
        }
      }
      const got = [...appears].sort().join(',');
      const want = [...c.keep].sort().join(',');
      if (got !== want) bad.push(`「${c.name}」实测出现于 [${got}] ≠ 登记 [${want}]`);
    }
    expect(bad, '对象词条的类型集漂移（多＝空转／少＝误门控）').toEqual([]);
  });
});

describe('泛化守卫：全类型注入的条上，题面专属谓述必须有管辖域', () => {
  it('既存集合不得漂移（增／删／改一律判红）', () => {
    expect(
      { count: UUNIQ.length, hash: uHash },
      '全类型注入的条上的裸谓述集合发生漂移：新增＝面不匹配（在某些资料上必空转/相抵）；删除＝已修复（请复核后更新基线）；修改＝需复核',
    ).toEqual(UNIVERSAL_BASELINE);
  });

  it('基线台账（人读镜像）', () => {
    // eslint-disable-next-line no-console
    console.log('全类型裸谓述 =', UUNIQ.length, uHash, '\n明细 =', JSON.stringify(UUNIQ.map(fingerprint), null, 1));
    expect(UUNIQ.length).toBeGreaterThanOrEqual(0);
  });
});
