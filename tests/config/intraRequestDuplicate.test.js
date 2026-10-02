// 🔒 单次注入内"多块同义"守卫（2026-10-01 用户裁定）
// ============================================================
// 用户原话："**每一次三维度前提下给到模型的，不可以存在多块同义的指令。**"
// 与 tests/config/caliberSingleSource.test.js 的区别（后者是首版，扫描面太窄）：
//   · 扫描单位：本守卫扫**整份实发**——用户消息（buildUserMessagePrompt）＋ system 附加段（buildProgramAttach）
//     ＋ 教辅结构块（buildTeachingInjection）＋ 调用层块（buildCallLayerBlocks）＋ **split 模式答案页调用**；
//     旧守卫只扫"exam｜语文｜小学低段的**模板**"。
//   · 覆盖组合：9 资料类型 × **实际开设的"学科×学段"对**（54 对，见 STAGE_SUBJECTS）= **486 个真实三维度组合**，逐份断言。
//     ⚠️ 原用 15×5×9＝675 的**全笛卡尔网格**——含 189 个**根本不存在的组合**（如"物理|小学低段""历史|小学"），
//     那些份永远不会被生成，扫它们既失真也非"真实三维度口径"。2026-10-01 改按实际开设对枚举。
//   · 判据数量：登记表见 src/config/caliberRegistry.js 的 CALIBERS（本文件用其收紧版扫描）。
// 纪律（同 caliberSingleSource）：**只减不增**——allow 取"当前实测值"为基线；每收口一组就把 allow 下调到 1，
//   从而把"已收口"锁死，防回潮。
import { describe, it, expect } from 'vitest';
import { getPromptTemplate, ANSWER_ROLES, buildAnswerFormatSpec, STAGE_SUBJECTS } from '../../src/config/promptLibrary.js';
import { buildTeachingInjection } from '../../src/config/teachingBlueprints.js';
import { buildUserMessagePrompt, buildCallLayerBlocks } from '../../src/utils/injectionManifest.js';
import { buildProgramAttach } from '../../src/utils/programAttach.js';
import { SUBJECT_KEYS, STAGE_KEYS, GEN_TYPE_KEYS } from '../../src/config/toolLibrary.js';

/** split 模式答案页调用里两个 inline 段（useAiGenerator 逐字复制，用于复现该次调用）
 *  🔴 2026-10-02（守卫失真·订正）：原 `SELF_CONTAINED_ANS` 是**收口前的旧文**（与源码不符），
 *     使本守卫对该次调用的复现失真（"自包含答案不复述正文"的实测值因此不成立）——已删该常量；
 *     并把 `ANS_ALIGN_PLAIN` 补齐源码里的 `ANS_ALIGN_TAIL_REF` 尾句（原缺）。现三处均逐字对齐源码。 */
const ANS_ALIGN_SELF = '答案区按正文对应的栏目组织、并与正文同构：正文题目带题号时，答案区**逐题以与正文完全相同的题号起头**（正文用「1. 2. 3.…」则答案同用同一套题号、同序；仅**子题**用 (1)(2)）；**严禁省略题号层、严禁用「(1)(2)」括号序号或纯列表代替题目题号**。不重现正文作答空位。';
const ANS_ALIGN_PLAIN = '**逐题对齐硬要求**：答案区**每个题目都以与正文完全相同的题号起头**、逐一对应（**正式考卷**正文题号全卷连续，答案区同样全卷连续；**教辅**正文按栏目（组）分别起编，答案区按相同栏目（组）分组）；大题用与正文相同的汉字序号，仅**子题**才用 (1)(2)。**逐题作答、全卷覆盖**：正文中的每一道题都必须在答案区有对应的解答与解析，不得漏题。**严禁省略题号层、严禁用「(1)(2)」括号序号或纯列表代替题目题号**。不复述题干原文（含子题题干），不重现正文作答空位。；本条（答案区与正文逐题对齐）即【尾约束·全文自洽】三域中跨处一致一项在本模式下的落地与展开。';

const SELF_CONTAINED = ['summary', 'review', 'preview', 'dictation', 'errorbook'];

/**
 * 判据 → 允许出现次数（**在一份实发内**）。
 * allow 口径：取 2026-10-01 实测基线；**只减不增**。收口到 1 后不得回涨。
 * 说明：同一判据的"引用式"落地（如"判据见作答位条款"）不另计正句次数——如需豁免，在本表注明。
 */
const INTRA_CALIBERS = [
  // 🔴 已收口（2026-10-01 批次二）：自洽⑤ 改引用式，正句落作答位条款 → 一份实发内 1 处
  { name: '同性质不再另起整行短答载体', re: /不得再[^，。；\n]{0,10}另起/g, allow: 1 },
  // 唯一正句 = 题目自洽⑧；另一处命中（作答位条款"书写格优先于'同题/同卷短答空位形态统一、一个空位只写一种载体'"）
  // 属**仲裁引用**（点名它所优先于的条款，不是把判据再写一遍；修复准则 §八③ 要求冲突对必须带优先级声明），
  // 按 §九既有裁定豁免、不计为多块同义 → allow 记 2（防第 3 处出现）。
  { name: '同卷空位形态统一', re: /同卷[^，。；\n]{0,12}形态[^，。；\n]{0,6}统一/g, allow: 2 },
  // 保留 2 的裁定说明（2026-10-01·⑥复核）：一为**总纲**（题目自洽①：声明↔实给），一为该原则在**具体对象**
  //    （材料/线索）上的落地表述——属"原则 + 细则"（§D9 不计重复），保留 2。
  { name: '声明↔实给一致', re: /已声明\/已注明|声明提供的线索/g, allow: 2 },
  // 🔴 已收口（2026-10-01·⑥拼接）：先改准度量口径（拆两份实发，"跨份"→"每份"）；再收口
  //    **答案页调用内部**的同义反复（ansAlignNote 去掉同序重述 + buildAnswerFormatSpec 3→2 + 答案页角色 tip 去同号句）
  //    → 实测 5→3，基线随之订正为 3。
  { name: '答案与正文逐题同号', re: /与正文完全相同的(?:阿拉伯)?题号|与正文一致的题号|同号同序|与正文相同的题号/g, allow: 3 },
  // 🔧 正则订正（2026-10-02）：原式在**自包含答案页实发**里命中不到真正的签字句（只在 errorbook 分支靠
  //    "答案区不重复复述"侥幸取到 1）→ 改指**收口后的唯一正句**（库内常量 ANSWER_ROLES 自包含分支的
  //    "严禁将正文的知识框架…整体复述到答案区"）＋errorbook 的"答案区不重复复述"；allow 仍 1（一处正句）。
  { name: '自包含答案不复述正文', re: /严禁将正文的知识框架[^。\n]{0,40}复述到答案区|答案区不重复复述/g, allow: 1 },
  // 🔧 正则订正（2026-10-01）：原 /题号[^，。；\n]{0,8}(?:连续|跳号|重启)/ 会把**编号口径**（"题号全卷连续"）
  //    误当**自查动作**（"逐题自查题号是否连续"）→ 收窄到自查语义；自查动作本身另有 reviewActionGuard 登记。
  // 🔴 已收口（2026-10-01）：①正则订正后又收口——委托正文里的"逐题自查题号连续"动作句已删（D16 自检类补丁，
  //    题号编法前置已精准、程序侧校验驱动重试）→ 1→0（委托正文内不得出现；调用层重试附加段仍保留该动作）。
  { name: '题号连续性自查（动作句）', re: /题号是否连续|题号连续性/g, allow: 0 },
  // 🔧 正则订正（2026-10-01）：原正则把"唯一性"家族笼统计入（组织不雷同／材料数据不复现／设问不堆砌是三条不同判据）。
  //    收窄到**同一判据的两处签字句**：质量底线"材料/数据组合不复现" ↔ 尾约束·资料内多样"同一种设问方式不重复出现"。
  //    allow=2 系 §九既有裁定（登记为"原则 + 成稿前动作"分工），本轮不收口——如要收口须同时改 reviewActionGuard 登记。
  { name: '内容唯一性（同一组数据/设问不重复）', re: /不得复现相同材料|同一考查点、同一情境、同一组数据、同一种设问方式不重复出现/g, allow: 2 },
  // 🔴 已收口（2026-10-01·⑥拼接）：⑦（题目自洽）的"空位宽度与所需答案长度相当"与作答位条款**同判据**，
  //    收口为"判据见作答位条款"的引用式 → 5→3。余 3 处同在作答位条款**一条之内**、各为不同判据
  //    （按答案字位数换算宽度 / 1 字位≈1 em 换算锚 / 标签档位号 N 的语义），非多块同义。
  { name: '空位宽度按答案长度', re: /空位宽度|与所需答案长度相当|答案的字位数/g, allow: 3 },
  // 🔴 已收口（2026-10-01）：素材使用约定两条权限括注删 → 4→3；再删【输出前自检】块（含其第 4 条"不超本学段"）→ 3→2。
  // 保留 2 的裁定说明（2026-10-01·⑥复核）：【质量底线】的总纲句 + 【学段特点】的**课标分档细则**——
  //    原则 + 分维细化（§D9 不计重复）；删任一都会丢一侧（通用下限 / 本学段界定）。
  { name: '不超本学段课标要求', re: /不超(?:出)?本学段|不超学业质量|不超纲/g, allow: 2 },
  // 🔴 已收口（2026-10-01）：创作要求2 的"主题相关、难度适切"复述已删（正句在【素材使用约定】）→ 3→2；
  //    再删【质量底线】"内容正确"条里的同句 → 2→1（只准一处正句）。
  { name: '取材主题相关·难度适切', re: /主题相关、难度适切/g, allow: 1 },
  // 保留 2 的裁定说明（2026-10-01·⑥复核）：本组两份正句分属**两条不同载体**（如语文低段田字格 + 拼音格），
  //    不是同一判据的重复 → 不收口；分组不构成"多块同义"。
  { name: '书写载体须真协议', re: /必须真实输出/g, allow: 2 },
  { name: '情境取向依本学科学段课标', re: /取向依本学科本学段的课标要求/g, allow: 1 },
  // 🔴 已收口（2026-10-01 批次二）：split 输出约定改引用式，正句落模板 answerPlacement → 一份实发内 1 处
  { name: '讲解示范型栏目答案回填', re: /答案即回填在例题自身的作答位/g, allow: 1 },
  // 🔧 正则订正：原 /分项归属的是"题"|按分项横切/ 会在**同一句内**命中两次（同句不属"多块"）→ 收窄到一句一个签字。
  // 🔴 已收口（2026-10-01 批次二）：易错题本【创作要求】改引用式（分项次序/块内层级引到【输出格式】）→ 1 处
  { name: '易错题本逐题成组（按分项横切的层）', re: /按分项横切/g, allow: 1 },
  // 🔴 已收口（2026-10-01 批次二）：【输出格式】题号条删去与【卷面格式】重复的"两种口径各自成立"
  //    （保留测试所锚的"不得互相否定"）→ 一份实发内 1 处
  // 🔴 已收口（2026-10-02·项4 以结果反推）：该**元语句**（"两种口径各自成立、不得互相否定"）是**给维护者**看的
  //   （防两条口径打架），对模型无动作；原挂在 exam 的"大题序号全卷连续"条尾（还把**教辅口径**整句带进了 exam 实发）
  //   → 已删该括注（设计说明留在两个口径常量的文档注释里）→ 实测 1→**0**：一份实发内不得出现。
  { name: '两种口径各自成立', re: /两种口径各自成立/g, allow: 0 },
  // 已收口项：值 = 0 表示"一份实发内不得出现"（防回潮）
  { name: '总纲结尾第二处卷尾复核动作句', re: /定稿前按三域（声明↔实给、要素之间、跨处之间）逐项复核/g, allow: 0 },
];

/** 实际开设的"学科×学段"对（唯一事实源 = STAGE_SUBJECTS；小学段无物理/化学/生物/史地政等） */
const OPEN_PAIRS = Object.entries(STAGE_SUBJECTS)
  .flatMap(([stage, subjects]) => subjects.map((subject) => ({ stage, subject })));
/** 真实三维度组合数 = 实际开设对 × 资料类型 = 54 × 9 = 486 */
const COMBO_COUNT = OPEN_PAIRS.length * GEN_TYPE_KEYS.length;

/** 每份实发的装配（与 reviewActionGuard / 生成端口径一致） */
function buildCells() {
  const cells = [];
  for (const genType of GEN_TYPE_KEYS) {
    for (const { stage, subject } of OPEN_PAIRS) {
        const template = (getPromptTemplate({ grade: stage, subject, genType }).template) || '';
        const teaching = buildTeachingInjection({ genType, stage, subject }) || '';
        const userMsg = buildUserMessagePrompt({
          genType, subject, materialChannel: 'anchor',
          anchorListText: '一、主题\n· 知识点。', instructionText: template,
        });
        const sysAttach = buildProgramAttach({ subject, stageKey: stage, genType, instructionText: template });
        const callLayer = buildCallLayerBlocks().map((b) => b.text).join('\n');
        const main = [userMsg, sysAttach, teaching, callLayer].filter(Boolean).join('\n');
        const selfC = SELF_CONTAINED.includes(genType);
        const ansRole = genType === 'exam' ? ANSWER_ROLES.exam(subject) : ANSWER_ROLES.other(genType);
        const answerCall = [
          '【答案规范】', ansRole,
          selfC ? ANS_ALIGN_SELF : ANS_ALIGN_PLAIN,
          buildAnswerFormatSpec(subject),
        ].filter(Boolean).join('\n');
        // 🔴 2026-10-01（⑥拼接·口径改准）：正文调用与答案页调用是**两份实发**（AGENTS："实发是复数"），
        //    原把二者拼成一份累计 → **跨份累计**（标准明令禁止，且会虚增"多块同义"计数）。现拆为两份分别计数。
        cells.push({ key: `${genType}|${subject}|${stage}·正文`, text: main });
        if (answerCall) cells.push({ key: `${genType}|${subject}|${stage}·答案页`, text: answerCall });
    }
  }
  return cells;
}

const CELLS = buildCells();

/** 每判据在每个 cell 的出现次数 → 取最大值与该处 */
function measure() {
  const out = {};
  for (const c of INTRA_CALIBERS) {
    let max = 0; let where = '';
    for (const cell of CELLS) {
      const n = (cell.text.match(c.re) || []).length;
      if (n > max) { max = n; where = cell.key; }
    }
    out[c.name] = { max, where };
  }
  return out;
}

const MEASURED = measure();

describe('单次注入内"多块同义"守卫（每一份实发内，判据只准出现登记次数）', () => {
  it('组合面必须覆盖真实三维度（防扫描面被悄悄缩小）', () => {
    // 🔴 2026-10-01（①三维度·口径改准）：扫描面 = **真实三维度组合 486**（54 实际开设对 × 9 类型），
    //    每组合含**两份实发**（正文调用 + 答案页调用）→ 972 单元。原 675 网格含 189 个不存在组合。
    expect(CELLS.length).toBe(COMBO_COUNT * 2);
    expect(CELLS.length).toBeGreaterThanOrEqual(600);
  });

  it('未收口判据的实测值不得超过登记基线；已收口项（allow=0）必须为 0', () => {
    const bad = [];
    for (const c of INTRA_CALIBERS) {
      const { max, where } = MEASURED[c.name];
      if (c.allow !== null && max > c.allow) {
        bad.push(`「${c.name}」实测 ${max} 次 > 登记 ${c.allow}（例：${where}）`);
      }
    }
    expect(bad, '在一份实发内新增了同义指令（多块同义）').toEqual([]);
  });

  it('已收口的判据必须恰好等于登记值（=1 为"只准一处正句"，=0 为"不得出现"）', () => {
    const bad = [];
    for (const c of INTRA_CALIBERS) {
      if (c.allow === null) continue;
      const { max, where } = MEASURED[c.name];
      if (max !== c.allow) bad.push(`「${c.name}」实测 ${max} ≠ 登记 ${c.allow}（例：${where}）`);
    }
    expect(bad, '收口后被破坏（要么回潮、要么收口未订正基线）').toEqual([]);
  });

  it('基线台账（人读镜像：每判据在一份实发内的最大出现次数）', () => {
    // 本断言不判红，只为把"当前基线"打印出来便于订正 allow
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(MEASURED, null, 1));
    expect(Object.keys(MEASURED).length).toBe(INTRA_CALIBERS.length);
  });
});
