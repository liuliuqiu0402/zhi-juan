// 🔒 项3 守卫：**块与块之间边界清晰 / 块内一条一行不加空行 / 指令文本不带表情符号**（全范围·2026-10-02 二次返工）
// ============================================================
// 为什么上机检：项3 第一次是手 grep 过的，漏了（长串否定句、跨块空行都没扫到）。
//   "不能再漏"的唯一可靠办法＝把三条不变量变成**逐份断言**（扫面同 intraRequestDuplicate：真实三维度 486 × 2 份实发）。
//
// 三条不变量与判据：
//   ① 块界恰一空行、块内零空行 —— 判据：实发文本**不得出现连续 3 个换行**（`\n\n\n`）。
//      （各块的段间空行统一由 `\n\n` 承担；块内若多一个空行 → 与块界相邻即并成 3 个换行）
//   ② 块标题**独占一行** —— 判据：行首 `【…】` 之后**必须立即换行**（`^【[^】\n]{1,24}】[^\n]` 为违规）。
//      （正文内的**引用**如"见【输出格式】"在行中，不在行首，不受本条限制）
//   ③ 指令文本**零 emoji** —— 判据：实发文本不得命中 `\p{Extended_Pictographic}`。
//   ④ 独立调用（非"正文请求"装配的）按其**自身字面量**同样过 ①②③。
// ============================================================
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getPromptTemplate, ANSWER_ROLES, buildAnswerFormatSpec, STAGE_SUBJECTS,
} from '../../src/config/promptLibrary.js';
import { buildTeachingInjection } from '../../src/config/teachingBlueprints.js';
import { buildUserMessagePrompt, buildCallLayerBlocks } from '../../src/utils/injectionManifest.js';
import { buildProgramAttach } from '../../src/utils/programAttach.js';
import { buildMapMessages } from '../../src/utils/textbookCompression.js';
import { buildListeningExtractMessages } from '../../src/config/listeningExtractPrompt.js';
import { buildListeningTranslateMessages } from '../../src/config/listeningTranslatePrompt.js';
import { ANALYSIS_PROMPTS } from '../../src/config/analysisPrompts.js';
import { GEN_TYPE_KEYS } from '../../src/config/toolLibrary.js';
import { PROMPT_INLINE_SOURCES } from '../../src/config/caliberRegistry.js';
import { styleInstructions } from '../../src/config/expertKnowledge.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const EMOJI = /\p{Extended_Pictographic}/gu;
const THREE_NL = /\n\n\n/;

/** 实际开设的"学科×学段"对（唯一事实源 = STAGE_SUBJECTS） */
const OPEN_PAIRS = Object.entries(STAGE_SUBJECTS).flatMap(([stage, subjects]) => subjects.map((subject) => ({ stage, subject })));

/** 逐份实发装配（与 intraRequestDuplicate 同口径：486 组合 × 2 份） */
function buildCells() {
  const cells = [];
  for (const genType of GEN_TYPE_KEYS) {
    for (const { stage, subject } of OPEN_PAIRS) {
      const template = (getPromptTemplate({ grade: stage, subject, genType }).template) || '';
      const teaching = buildTeachingInjection({ genType, stage, subject }) || '';
      // 🔴 2026-10-02（项3 二次返工·修假违规）：教辅结构是**直接追加**到委托正文末尾的
      //   （生成端 `instructionDraft.value += teachingText`，其自带的前导 `\n\n` 即块界）；
      //   原把 teaching 当独立块再 `join('\n\n')` → 多一个空行（`\n\n\n\n`），是**装配口径错**，不是文本违规。
      const userMsg = buildUserMessagePrompt({
        genType, subject, materialChannel: 'anchor',
        anchorListText: '一、主题\n· 知识点。', instructionText: template + teaching,
      });
      const sysAttach = buildProgramAttach({ subject, stageKey: stage, genType, instructionText: template });
      const callLayer = buildCallLayerBlocks().map((b) => b.text).join('\n');
      // `user` 单独存：顺序判据（第⑦步）只判**用户消息**——system 段与调用层是**另外的消息**，
      //   混进同一串会让"尾约束收尾"假红（2026-10-02 第⑦步初版即踩此坑）。
      cells.push({ key: `${genType}|${subject}|${stage}·正文`, user: userMsg, text: [userMsg, sysAttach, callLayer].filter(Boolean).join('\n\n') });
      const ansRole = genType === 'exam' ? ANSWER_ROLES.exam(subject) : ANSWER_ROLES.other(genType);
      cells.push({ key: `${genType}|${subject}|${stage}·答案页`, text: ['【答案规范】', ansRole, buildAnswerFormatSpec(subject)].filter(Boolean).join('\n') });
    }
  }
  return cells;
}

const CELLS = buildCells();

// ── 第⑦步：**顺序不变量**（2026-10-02 全范围机检；判据＝"位置与先后符合模型遵守习惯"）
//   既定设计口径（`injectionManifest` 头部 A4-4 定版，原文："LLM 首尾强/中段弱"）：
//     锚点清单/压缩原文（开头）→ 素材使用约定 → 组织方式 → **委托正文（末尾锚定）** → 输出约定 → 尾约束×2。
//   本组断言把它固化为**可核对的不变量**（逐份 486×2，不抽检；块名一改即红）。
//   ⚠️ 判据刻意用 `indexOf` 定位**已知块名**（不用"扫所有【】行"——素材正文里也可能出现【】）。
const ORDER_MARKERS = {
  first: '【锚点清单】',
  preInstruction: ['【素材使用约定】', '【组织方式】'],
  instruction: '【卷面结构（依',
  family: ['【输出格式】', '【编号与组织】', '【作答位与载体】', '【题目自洽】', '【答案区位置】', '【质量底线】'],
  examSurface: ['【卷首】', '【卷面层级】', '【题号与分值】', '【卷面自洽】', '【情境与页码】'],
  system: ['【渲染指令（', '【版面质检规则（生成前约束）】'],
  tail: ['【尾约束·全文自洽】', '【尾约束·资料内多样】'],
};

/** 素材区起止（**块内空行**判定的豁免带：素材正文自带段落空行，属内容、不是"块内加空行"）
 *  · 起点：素材块标题行（教材依据／教材原文／压缩原文／参考资料…）
 *  · 终点：其后第一个 `【输出格式】` 行（正文请求里**恒在素材之后**，生产装配保证）
 *  🔴 2026-10-02（项5 收尾·把项3 的"代理判据"升级为**逐块判定**）：原判据只看"连续 3 换行"，
 *     块内**单个**空行（两条之间空一行）逃过 → 现补：**除素材区外，空行只允许出现在块标题行之前**。 */
const MATERIAL_HEAD_RE = /^【(?:教材依据|教材原文|压缩原文|参考资料|〔)/;
const MATERIAL_END_RE = /^【输出格式】/;

/** 逐块判定（**精准判据**）：**同一条目序列内**不得插空行——即"空行前一非空行"与"空行后一非空行"
 *  **都是条目行**（`· ` / `- ` / `* ` / `1. `）时，属"块内一条一行被空行割断"（正是项3 要禁的形态）。
 *  判据刻意取窄：素材正文、块标题、缩进子列表前的空行都不在其内（那些不是"两条之间"）。
 *  🔴 2026-10-02（项5 收尾）：把项3 原"连续 3 换行"的**代理判据**升级为**逐块的两条之间判定**。 */
const ITEM_LINE_RE = /^\s*(?:[·\-*]\s|\d+\.\s)/;
function intraBlockBlankLines(text) {
  const lines = String(text || '').split('\n');
  const bad = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() !== '') continue;
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j += 1;
    let k = i - 1;
    while (k >= 0 && lines[k].trim() === '') k -= 1;
    const next = j < lines.length ? lines[j] : '';
    const prev = k >= 0 ? lines[k] : '';
    if (ITEM_LINE_RE.test(prev) && ITEM_LINE_RE.test(next)) {
      bad.push(`块内两条之间插空行（前一条：${JSON.stringify(prev.slice(0, 24))}）`);
    }
  }
  return bad;
}

/** 四条不变量：返回违规明细（空数组＝全过） */
function violations(text) {
  const bad = [];
  if (THREE_NL.test(text)) bad.push(`连续 3 换行（块内多空行/块界多空行）：${JSON.stringify((text.match(/\n\n\n[\s\S]{0,40}/) || [''])[0])}`);
  bad.push(...intraBlockBlankLines(text));
  const sameLine = text.match(/^【[^】\n]{1,24}】[^\n]+/m);
  if (sameLine) bad.push(`块标题未独占一行：${JSON.stringify(sameLine[0].slice(0, 40))}`);
  const emojis = text.match(EMOJI);
  if (emojis) bad.push(`指令文本含 emoji：${[...new Set(emojis)].join('')}`);
  return bad;
}

/** 🔴 2026-10-02（项3 二次返工·补扫描面）：独立调用**不止** 5 类——④ 补登记的 4 类独立调用
 *  （知识图谱构建/教材页知识点提取/统一情境生成/变题生成）与情境框架、目录模式卡都在 useAiGenerator 里，
 *  按**锚点对**逐字抽出（与 E3 区间同法），连同 E2 的组织风格注入句、答案页 inline 一起过三查。
 *  ⚠️ 第一次项3 就是手 grep 漏了这些"区间之外"的 inline 段——故本表按**登记点**穷举，不按印象。 */
const GEN_SRC = path.join(ROOT, 'src/composables/useAiGenerator.js');
const ANCHOR_PAIRS = [
  ['const prompt2 = `', '`;'],                 // 知识图谱构建
  ['const prompt = `你是一位', '`;'],           // 教材页知识点提取（多模态）
  ['const contextPrompt = `', '`;'],           // 统一情境生成
  ['const variantPrompt = `', '`;'],           // 变题生成（编辑器）
  ['contextFramework = `', '`;'],              // 统一情境框架（运行时块）
  ['【未分析·目录模式】', '${tocText}'], // 目录模式卡（锚点清单通道里夹带指令）
];
/** 答案页 inline（useAiGenerator 逐字镜像；下方断言其源码逐字存在，防漂移） */
const ANS_INLINE = [
  '答案区按正文对应的栏目组织、并与正文同构：正文题目带题号时，答案区**逐题以与正文完全相同的题号起头**（正文用「1. 2. 3.…」则答案同用同一套题号、同序；仅**子题**用 (1)(2)）；**严禁省略题号层、严禁用「(1)(2)」括号序号或纯列表代替题目题号**。不重现正文作答空位。',
  '**逐题对齐硬要求**：答案区**每个题目都以与正文完全相同的题号起头**、逐一对应（**正式考卷**正文题号全卷连续，答案区同样全卷连续；**教辅**正文按栏目（组）分别起编，答案区按相同栏目（组）分组）；大题用与正文相同的汉字序号，仅**子题**才用 (1)(2)。**逐题作答、全卷覆盖**：正文中的每一道题都必须在答案区有对应的解答与解析，不得漏题。**严禁省略题号层、严禁用「(1)(2)」括号序号或纯列表代替题目题号**。不复述题干原文（含子题题干），不重现正文作答空位。',
  '；本条（答案区与正文逐题对齐）即【尾约束·全文自洽】三域中跨处一致一项在本模式下的落地与展开。',
];

/** 独立调用（不属"正文请求"装配）按其自身字面量过同样三条 */
function standaloneTexts() {
  const out = [];
  out.push(buildMapMessages({ batch: { title: '第1课', text: '原文。' }, mode: 'practice' }).map((m) => m.content).join('\n'));
  out.push(buildMapMessages({ batch: { title: '第1课', text: '原文。' }, mode: 'full' }).map((m) => m.content).join('\n'));
  out.push(buildListeningExtractMessages('1. M: Hi.').map((m) => m.content).join('\n'));
  out.push(buildListeningTranslateMessages('小明去图书馆。').map((m) => m.content).join('\n'));
  for (const p of ANALYSIS_PROMPTS) out.push(String(p.content || ''));
  // E2：组织风格注入句（**生成期追加在指令框末尾**——按生产端 `withStyle` 的包装逐字镜像，
  //   否则只扫说明句、漏掉 `【组织风格】` 这个块标题行本身）
  for (const [v, t] of Object.entries(styleInstructions)) out.push(`【组织风格】\n· ${v}：${t}`);
  for (const t of ANS_INLINE) out.push(t);                                        // 答案页 inline（逐字镜像）
  const gen = fs.readFileSync(GEN_SRC, 'utf8');
  for (const [a, b] of ANCHOR_PAIRS) {
    const i = gen.indexOf(a); const j = i >= 0 ? gen.indexOf(b, i) : -1;
    expect(i, `锚点起点缺失（防假绿）：${a}`).toBeGreaterThan(-1);
    expect(j, `锚点终点缺失（防假绿）：${b}`).toBeGreaterThan(i);
    // 抽出来的是**源码字面量**：须把两处"源码书写"还原成实际文本——
    //   ① CRLF 归一（否则行尾 `\r` 被判成"标题行后还有内容"＝假违规）；
    //   ② 转义还原（`\n` 在源码里是两字符，还原成真换行，否则模板内的换行被判成"同段"）。
    out.push(gen.slice(i, j + b.length).replace(/\r\n/g, '\n').replace(/\\n/g, '\n'));
  }
  return out;
}

describe('项3 守卫：块界恰一空行 / 块内一条一行 / 零 emoji（全范围）', () => {
  it('扫面＝真实三维度 486 × 2 份（防扫描面被悄悄缩小）', () => {
    expect(CELLS.length).toBe(OPEN_PAIRS.length * GEN_TYPE_KEYS.length * 2);
    expect(CELLS.length).toBeGreaterThanOrEqual(900);
  });

  it('①块界恰一空行且块内零空行（无连续 3 换行）②块标题独占一行③零 emoji', () => {
    const bad = [];
    for (const c of CELLS) {
      for (const v of violations(c.text)) bad.push(`${c.key} —— ${v}`);
    }
    expect(bad.slice(0, 30), `实发结构违规 ${bad.length} 处`).toEqual([]);
  });

  it('第⑦步·顺序不变量：素材在前／注入块先于委托正文／格式族与卷面族有序／system 有序／尾约束收尾（逐份）', () => {
    const bad = [];
    // 🔑 判据用**行首锚定**定位块（`\n【块名】`）——直接用 `indexOf('【…】')` 会命中**跨处引用**
    //   （别的块正文里提到某块名时不在行首），第⑦步初版即因此假红。
    const pos = (t, m) => (t.startsWith(m) ? 0 : t.indexOf(`\n${m}`));
    const asc = (t, marks, tag, key) => {
      let prev = -1;
      for (const m of marks) {
        const i = pos(t, m);
        if (i < 0) continue;
        if (i < prev) bad.push(`${key} —— ${tag}顺序倒置：${m}`);
        prev = i;
      }
    };
    for (const c of CELLS) {
      if (/·答案页$/.test(c.key)) {
        // 答案页：**输入在前、任务在后**（与正文请求同构）；【答案页输出格式】收尾
        const t = c.text;
        const iSpec = t.lastIndexOf('【答案页输出格式】');
        if (iSpec < 0) bad.push(`${c.key} —— 缺【答案页输出格式】`);
        else if (t.slice(iSpec + '【答案页输出格式】'.length).includes('【')) bad.push(`${c.key} —— 【答案页输出格式】不是末块`);
        continue;
      }
      const t = c.user;                                    // 只判**用户消息**（system 段另判，见下）
      if (!t.startsWith(ORDER_MARKERS.first)) bad.push(`${c.key} —— 首块不是素材（${ORDER_MARKERS.first}）`);
      for (const m of ORDER_MARKERS.preInstruction) {
        const i = pos(t, m); const j = pos(t, ORDER_MARKERS.instruction);
        if (i >= 0 && j >= 0 && i > j) bad.push(`${c.key} —— ${m} 应在委托正文之前`);
      }
      asc(t, ORDER_MARKERS.family, '输出格式族', c.key);
      asc(t, ORDER_MARKERS.examSurface, '卷面格式族', c.key);
      const iTail = pos(t, ORDER_MARKERS.tail[0]);
      const iTail2 = pos(t, ORDER_MARKERS.tail[1]);
      if (iTail < 0 || iTail2 < iTail) bad.push(`${c.key} —— 尾约束块缺失或顺序倒置`);
      else {
        for (const ms of [ORDER_MARKERS.family, ORDER_MARKERS.examSurface, ORDER_MARKERS.preInstruction, [ORDER_MARKERS.instruction], [ORDER_MARKERS.first]]) {
          for (const m of ms) {
            const i = pos(t, m);
            if (i > iTail) bad.push(`${c.key} —— 尾约束之后还有块：${m}`);
          }
        }
      }
      // system 段（另一条消息）：渲染指令在前、生成前质检在后
      asc(c.text, ORDER_MARKERS.system, 'system 段', c.key);
    }
    expect(bad.slice(0, 30), `顺序不变量违规 ${bad.length} 处`).toEqual([]);
  });

  it('独立调用（压缩 map/fold、听力抽取/翻译、分析提取）同样过三条不变量', () => {
    const bad = [];
    standaloneTexts().forEach((t, i) => {
      for (const v of violations(t)) bad.push(`standalone#${i + 1} —— ${v}`);
    });
    expect(bad.slice(0, 30), `独立调用结构违规 ${bad.length} 处：\n${bad.slice(0, 8).join('\n')}`).toEqual([]);
  });

  it('模型可见源文件：字符串里的 emoji 零命中（注释/console/日志不计）', () => {
    const files = [
      'src/config/promptLibrary.js', 'src/config/teachingBlueprints.js', 'src/config/examPaperBlueprints.js',
      'src/config/validatorRules.js', 'src/config/eduRenderContract.js', 'src/config/layoutSpec.js',
      'src/config/analysisPrompts.js', 'src/config/listeningExtractPrompt.js', 'src/config/listeningTranslatePrompt.js',
      'src/config/levelMapping.js', 'src/config/errorbookFacets.js', 'src/config/domainContract.js',
      'src/utils/injectionManifest.js', 'src/utils/programAttach.js', 'src/utils/textbookCompression.js',
    ];
    const bad = [];
    for (const f of files) {
      const raw = fs.readFileSync(path.join(ROOT, f), 'utf8');
      // 剥注释（注释不进模型）：块注释 ＋ **行尾/整行 `//` 注释**；再剥 console.* 日志行（不进模型）。
      //   ⚠️ 2026-10-02（项3 二次返工·修误报）：原只剥"整行 `//`"，**行尾注释**（`code; // 🔧 …`）被当字符串
      //   → 大把误报。修法用 `[^\r\n]*`（**不带 `$` 锚**）——源文件是 **CRLF**，而 `.` 不匹配 `\r`、`$` 只在
      //   输入末尾匹配 → `/\/\/.*$/` 在 CRLF 行上**永不命中**（实测：`'// x\r'.replace(/\/\/.*$/,'')` 原样返回）。
      const stripped = raw
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .map((l) => l.replace(/\/\/[^\r\n]*/g, ''))
        .filter((l) => !/console\.(log|warn|error|info|debug)/.test(l))
        .join('\n');
      const hit = stripped.match(EMOJI);
      if (hit) {
        const ln = stripped.split('\n').find((l) => l.match(EMOJI)) || '';
        bad.push(`${f}：${[...new Set(hit)].join('')} ｜ 命中行：${ln.trim().slice(0, 80)}`);
      }
    }
    // 🔴 2026-10-02（项3 二次返工·精化扫描面）：以下三个文件**整文件**含非指令文本（UI 展示名/诊断报告串），
    //   故从整文件扫描移出——它们的**指令文本**另有扫描面（实发装配 ① ② ③ ＋ E2 登记常量）；逐条登记理由，防悄悄放宽。
    const NON_INSTRUCTION_FILES = [
      { file: 'src/config/expertKnowledge.js', why: '资料类型选择项的**展示名**图标（设置页 UI；注入用的 styleInstructions 无图标）' },
      { file: 'src/config/specialDomains.js', why: '专项领域**展示名**图标（UI）；注入用的是 name/desc/source 三个无图标字段' },
      { file: 'src/utils/anchorTreeContract.js', why: '**入库校验诊断串**（违例报告，进报告/日志不进模型）' },
    ];
    for (const e of NON_INSTRUCTION_FILES) {
      const raw = fs.readFileSync(path.join(ROOT, e.file), 'utf8');
      const hit = raw.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
        .map((l) => l.replace(/\/\/[^\r\n]*/g, '')).join('\n').match(EMOJI);
      // 只在"确有命中"时登记为豁免（防登记了不存在的东西）
      if (!hit) bad.push(`${e.file}：已登记为"非指令文本"豁免，但实测**无命中** → 登记过期，应移回整文件扫描`);
    }
    // useAiGenerator：含 console/界面状态文案（statusText/进度提示）与生成报告标签，**指令文本**即 E3 登记区间
    //   → 按区间扫（＝ 真正进模型的那几段），不整文件扫（避免把 UI/日志当指令）。
    const gen = fs.readFileSync(path.join(ROOT, 'src/composables/useAiGenerator.js'), 'utf8');
    for (const [a, b] of PROMPT_INLINE_SOURCES['src/composables/useAiGenerator.js'].regions) {
      const seg = gen.slice(gen.indexOf(a), gen.indexOf(b))
        .replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
        .map((l) => l.replace(/\/\/[^\r\n]*/g, ''))
        .filter((l) => !/console\.(log|warn|error|info|debug)/.test(l)).join('\n');
      const hit2 = seg.match(EMOJI);
      if (hit2) bad.push(`useAiGenerator[区间 ${a.slice(0, 24)}…]：${[...new Set(hit2)].join('')}`);
    }
    expect(bad, '以下位置的**指令文本**里仍有 emoji').toEqual([]);
  });

  // 🔴 防漂移：答案页 inline 是**逐字镜像**（inline 在 useAiGenerator 里、不可 import）——
  //   故断言其与源码逐字同源；源码一改这里即红（与 promptSourceRegistry 的 head 校验同法）。
  it('答案页 inline 镜像与源码逐字同源（防漂移）', () => {
    const gen = fs.readFileSync(GEN_SRC, 'utf8');
    for (const t of ANS_INLINE) {
      expect(gen, `答案页 inline 与源码不符（第 ${t.slice(0, 18)}… 条）`).toContain(t);
    }
  });
});
