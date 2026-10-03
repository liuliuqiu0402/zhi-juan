// 🔒 常驻守卫：引用必须真落地（假指针＝"说了看某块，那块根本没注入"）
// ============================================================
// 2026-10-03（C2 全范围）：历史病＝正文说"格式见【渲染指令】"而该段未注入、正文强制 [IMAGE] 而 system 无骨架——
//   "模型拿到'必须输出一个没有格式说明的东西'"，只能编或省块。故把"同份实发里每个【X】引用都能找到对应块"锁死。
// 2026-10-03（C3 续）：C2 只查**带【】的引用**；真盲区是**不带括号的物件指针**——
//   "见已注入的书写载体协议""作答空间条款""书写载体规则"。这些指向**条件注入块**：
//   书写载体协议行只在"有载体能力且非内容型"时注入（416/486 组合没有），
//   作答位条款只在题类【作答位与载体】里（内容型没有）——指针于是就**悬空**。
//   → 凡"见/按/依/据/由 + 物件名（协议/条款/契约/骨架/清单/规则）"的**裸指针**，
//     其名须在**同份实发**里至少再现一次（＝确有该物件的定义）；【X】的物件指针则要求块【X】在场。
// 2026-10-03（D3 发现 → 补覆盖）：本守卫原只跑 **split 默认**，once 分支未纳入 → 扩为 **486×2（once/split）**，
//   扩面即抓到 once 的 `【严禁】`／`【应在例题下即时展示完整解答与解析】`（强调标记误用块引用语法）→ 已修。
// 2026-10-03（A 方案 → 补"答案页调用"）：**实发是复数**——正文生成调用之外，split 模式还有**答案页独立调用**
//   （【正文】→【答案规范】＋角色＋逐题对齐＋答案格式）。本守卫一并纳入该份实发（见 ANS_* 常量与第三个用例）。
// 纪律：**只减不增**——豁免名单取"实测的合法用法/正则误切/跨实发隶属声明"，只准删不准加。
// ============================================================
import { describe, it, expect } from 'vitest';
import { getPromptTemplate, STAGE_SUBJECTS, ANSWER_ROLES, buildAnswerFormatSpec } from '../../src/config/promptLibrary.js';
import { TEACHING_GEN_TYPES, buildTeachingInjection } from '../../src/config/teachingBlueprints.js';
import { buildUserMessageBlocks } from '../../src/utils/injectionManifest.js';
import { buildProgramAttach } from '../../src/utils/programAttach.js';

/** 实测的**非块引用**（结构性行标记；不是"去看某块"的指针）——只减不增 */
const EXEMPT = ['要求·须逐项落实'];

/** 答案页调用里**允许的跨实发引用**——指向"正文实发"里的块，本调用不含该块
 *  （用户 2026-09-30 裁定的**隶属声明**：防"同一条要求两处各写一段、改一处漏一处"）。只减不增。 */
const ANS_EXEMPT = ['尾约束·全文自洽'];

/** 实测的**裸指针豁免**（合法用法／正则误切，非"指向不存在的块"）——只减不增
 *  · 学科协议   ："作图按学科协议输出作答区"＝按学科各自的协议（自然用法，非某块名）
 *  · 赖措辞清单 ：正则从"依『赖措辞清单』"误切（原文是"不存在…措辞清单"的否定句）
 *  · 本段命名规则：自指——命名规则就在本段内给出
 *  · 照规则     ：正则从"按『照规则』"误切（原文"按照规则…"） */
const BARE_EXEMPT = ['学科协议', '赖措辞清单', '本段命名规则', '照规则'];

/** 裸物件指针：见/按/依/据/由 (+已注入的) + …物件名 */
const BARE_PTR = /(?:见|按|依|据|由)(?:已注入的)?([^，。；\n：:【】（()]{0,12}?(?:协议|条款|契约|骨架|清单|规则))/g;
/** 带块名的物件指针：【X】的…物件名 → 块【X】须在场 */
const SCOPED_PTR = /【([^】]+)】的[^，。；\n]{0,10}?(?:协议|条款|契约|骨架|清单|规则)/g;

/** split 模式"答案页独立调用"的两段 inline（useAiGenerator 逐字复制；与 intraRequestDuplicate 同源对齐） */
const ANS_ALIGN_SELF = '答案区按正文对应的栏目组织、并与正文同构：正文题目带题号时，答案区**逐题以与正文完全相同的题号起头**（正文用「1. 2. 3.…」则答案同用同一套题号、同序；仅**子题**用 (1)(2)）；**严禁省略题号层、严禁用「(1)(2)」括号序号或纯列表代替题目题号**。不重现正文作答空位。';
const ANS_ALIGN_PLAIN = '**逐题对齐硬要求**：答案区**每个题目都以与正文完全相同的题号起头**、逐一对应（**正式考卷**正文题号全卷连续，答案区同样全卷连续；**教辅**正文按栏目（组）分别起编，答案区按相同栏目（组）分组）；大题用与正文相同的汉字序号，仅**子题**才用 (1)(2)。**逐题作答、全卷覆盖**：正文中的每一道题都必须在答案区有对应的解答与解析，不得漏题。**严禁省略题号层、严禁用「(1)(2)」括号序号或纯列表代替题目题号**。不复述题干原文（含子题题干），不重现正文作答空位。；本条（答案区与正文逐题对齐）即【尾约束·全文自洽】三域中跨处一致一项在本模式下的落地与展开。';
const SELF_CONTAINED = ['summary', 'review', 'preview', 'dictation', 'errorbook'];

/** 输出模式两分支（2026-10-03 D3 发现：守卫原先只跑 split 默认，once 分支的【输出约定】文本未纳入） */
const OUTPUT_MODES = ['once', 'split'];

/** 枚举全范围 486 组合 × 2 输出模式（once/split）的**正文生成实发**文本（user 侧块＋教辅注入＋程序附加段/system） */
const buildAllCombos = () => {
  const out = [];
  for (const [stage, subjects] of Object.entries(STAGE_SUBJECTS)) {
    for (const subject of subjects) {
      for (const genType of ['exam', ...TEACHING_GEN_TYPES]) {
        const cell = String(getPromptTemplate({ grade: stage, subject, genType }).template || '');
        if (!cell) continue;
        for (const outputMode of OUTPUT_MODES) {
          const ctx = { genType, subject, stage, materialChannel: 'anchor', instructionText: cell, outputMode };
          const parts = [cell,
            buildTeachingInjection({ genType, stage, subject }) || '',
            buildProgramAttach({ subject, stageKey: stage, genType, instructionText: cell }) || ''];
          for (const b of buildUserMessageBlocks(ctx)) if (b.injected && b.text) parts.push(b.text);
          out.push({ key: `${genType}|${subject}|${stage}|${outputMode}`, all: parts.join('\n') });
        }
      }
    }
  }
  return out;
};

/** 枚举全范围 486 组合的**答案页独立调用实发**文本（split 模式第二次调用） */
const buildAnswerCalls = () => {
  const out = [];
  for (const [stage, subjects] of Object.entries(STAGE_SUBJECTS)) {
    for (const subject of subjects) {
      for (const genType of ['exam', ...TEACHING_GEN_TYPES]) {
        const cell = String(getPromptTemplate({ grade: stage, subject, genType }).template || '');
        if (!cell) continue;
        const selfC = SELF_CONTAINED.includes(genType);
        const ansRole = genType === 'exam' ? ANSWER_ROLES.exam(subject) : ANSWER_ROLES.other(genType);
        const ans = ['【正文】', '（正文）', '【答案规范】', ansRole,
          selfC ? ANS_ALIGN_SELF : ANS_ALIGN_PLAIN, buildAnswerFormatSpec(subject)]
          .filter(Boolean).join('\n');
        out.push({ key: `${genType}|${subject}|${stage}·答案页`, all: ans });
      }
    }
  }
  return out;
};

/** 判定 1：每个 `【X】` 引用须命中同份实发的某块标题
 *  G2（2026-10-04）：匹配口径＝**精确／互为前缀**（`===` / `h.startsWith(r)` / `r.startsWith(h)`）。
 *    ⚠️ 去掉了原 `h.includes(r)` **子串**匹配——它会把「引用名是真实块名的中段子串」误判为已落地
 *    （实证：同份实发真实块为【题号与分值】，而条款里写 `（【分值】条照常执行）`，子串匹配放行＝假落地）。
 *    保留前缀口径是必要的：`【卷面结构】` 指向带括注的 `【卷面结构（依…）】`、`【渲染指令】` 同理；
 *    `【题目自洽①】` 指 `【题目自洽】` 的子条款——均合法。 */
const bracketRefBad = (all, key, exempt) => {
  const bad = [];
  const headers = [...all.matchAll(/(?:^|\n)【([^】]+)】/g)].map((m) => m[1]);
  const seen = new Set();
  for (const m of all.matchAll(/【([^】]+)】/g)) {
    const r = m[1].trim();
    if (!r || seen.has(r) || exempt.some((e) => r.includes(e))) continue;
    seen.add(r);
    const ok = headers.some((h) => h === r || h.startsWith(r) || r.startsWith(h));
    if (!ok) bad.push(`${key}: 【${r}】未在场`);
  }
  return bad;
};

/** 判定 2：非括号物件指针须落回真名（同份实发至少再现一次）；【X】的物件指针须块【X】在场 */
const barePointerBad = (all, key) => {
  const bad = [];
  for (const m of all.matchAll(SCOPED_PTR)) {
    const blk = m[1].trim();
    if (!(all.includes(`【${blk}`) || all.includes(`${blk}：`))) bad.push(`${key}: 【${blk}】的物件指针而块不在场`);
  }
  for (const m of all.matchAll(BARE_PTR)) {
    const phrase = m[1].replace(/^已注入的/, '');
    if (phrase.length < 2 || BARE_EXEMPT.includes(phrase)) continue;
    if ((all.split(phrase).length - 1) >= 2) continue;
    bad.push(`${key}: 「${phrase}」只此一见（无该物件的定义）`);
  }
  return bad;
};

describe('引用必须真落地（同份实发内无假指针）', () => {
  const combos = buildAllCombos();
  const answerCalls = buildAnswerCalls();

  it('正文实发 486×2（once/split）：每个【X】引用都能在同份实发找到对应块', () => {
    const bad = combos.flatMap(({ key, all }) => bracketRefBad(all, key, EXEMPT));
    expect([...new Set(bad)].slice(0, 10), '假指针：引用了同份实发里不存在的块').toEqual([]);
  });

  it('正文实发 486×2（once/split）：非括号物件指针必须落回真名（同份实发确有该物件）', () => {
    const bad = combos.flatMap(({ key, all }) => barePointerBad(all, key));
    expect([...new Set(bad)].slice(0, 10), '悬空物件指针：指向同份实发不存在的物件').toEqual([]);
  });

  it('答案页调用实发 486（split 第二次调用）：每个【X】引用都能在同份实发找到对应块', () => {
    const bad = answerCalls.flatMap(({ key, all }) => bracketRefBad(all, key, ANS_EXEMPT));
    expect([...new Set(bad)].slice(0, 10), '假指针（答案页调用）：引用了本份实发里不存在的块').toEqual([]);
  });

  it('答案页调用实发 486（split 第二次调用）：非括号物件指针必须落回真名', () => {
    const bad = answerCalls.flatMap(({ key, all }) => barePointerBad(all, key));
    expect([...new Set(bad)].slice(0, 10), '悬空物件指针（答案页调用）').toEqual([]);
  });

  // 自证非假绿（G2 2026-10-04）：收紧为"精确/互为前缀"后，**中段子串**引用必须被判红——
  //   实证同类＝真实块【题号与分值】的条款曾写 `（【分值】条照常执行）`（子串匹配放行的假落地）。
  it('G2 自证：引用名是真实块名的**中段子串**时判红（防子串匹配假绿回潮）', () => {
    const fake = ['【题号与分值】', '· 某某要求（【分值】条照常执行）'].join('\n');
    const bad = bracketRefBad(fake, '自证', []);
    expect(bad.length, '中段子串引用须判红').toBeGreaterThan(0);
    // 互为前缀仍须放行（合法：短名指带括注的长块名）
    const okPrefix = ['【卷面结构（依课标）】', '· 见【卷面结构】'].join('\n');
    expect(bracketRefBad(okPrefix, '自证', []), '前缀引用不得误伤').toEqual([]);
  });
});
