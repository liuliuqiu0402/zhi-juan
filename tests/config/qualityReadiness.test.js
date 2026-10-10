// ⑧ 质量就绪守卫（2026-10-02 · 第⑧步"照这条发出去，产出能不能到高质量"）
// ============================================================
// 为什么这样判：质量不能靠"读起来顺不顺"（用户口径），要**可独立核对**。
//   可核对的质量底座 = **产出必需判据齐备**：一份实发若缺"结构/形态/答案/底线/收口"任一类判据，
//   模型就不可能稳定产出可直接使用的资料（不是"文采问题"，是"缺胳膊少腿"）。
// 判定粒度：**真实三维度 486**（9 资料类型 × 实际开设的"学科×学段"对 54）——按三维度判一次，不按 972 份重复计。
// 断言方式：**行首锚定**（`\n【块名】`）定位块，避免命中别块正文里的"跨处引用"（第⑦步踩过此坑）。
// ============================================================
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMapMessages, buildFoldMessages } from '../../src/utils/textbookCompression.js';
import { buildListeningExtractMessages } from '../../src/config/listeningExtractPrompt.js';
import { buildListeningTranslateMessages } from '../../src/config/listeningTranslatePrompt.js';
import { ANALYSIS_PROMPTS } from '../../src/config/analysisPrompts.js';
import {
  getPromptTemplate, STAGE_SUBJECTS, ANSWER_ROLES, buildAnswerFormatSpec,
} from '../../src/config/promptLibrary.js';
import { buildTeachingInjection } from '../../src/config/teachingBlueprints.js';
import { buildUserMessagePrompt } from '../../src/utils/injectionManifest.js';
import { GEN_TYPE_KEYS } from '../../src/config/toolLibrary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const OPEN_PAIRS = Object.entries(STAGE_SUBJECTS).flatMap(([stage, subjects]) => subjects.map((subject) => ({ stage, subject })));

/** 9 类都要有的"底座判据"（缺一项即不可能高质量） */
const REQUIRED_ALL = [
  '【输出格式】',        // 形态：标题层级/标记/文字规范
  '【编号与组织】',      // 组织：题号与段落纪律
  '【答案区位置】',      // 答案归属（正文/答案区不混）
  '【质量底线】',        // 内容下限（充实/唯一/正确/不超学段…）
  '【输出约定】',        // 输出与篇幅约定
  '【尾约束·全文自洽】', // 收口：自洽
  '【尾约束·资料内多样】',// 收口：多样
];
/** 试卷专属（正式卷的卷面必需件） */
const REQUIRED_EXAM = [
  '【卷面结构（依', '【大题标题命名】', '【卷首】', '【卷面层级】',
  '【题号与分值】', '【卷面自洽】', '【情境与页码】',
];
/** 作答载体 与 题目自洽 两段（🔴 2026-10-03 **口径改准**·用户质询）：
 *  · 原口径"纯梳理型没有作答位"**不准**——知识总结的【典型例题】是**一道完整的题**、**答案回填在其作答位上**；
 *    预习的【课后问答】要求"预读与尝试作答" → **内容型也有作答位**。
 *  · 但内容型的"载体规格"**不在题类格式块里**，而在内容型【输出格式】自带的作答位条款（`carrierHint`：
 *    横线/括号空位标记 ＋ 长答书写载体）——故**题类格式块仍不向内容型广播**（三方审计"类型不串味"要求）；
 *    内容型创作要求里的空指向（"按本学科本学段的作答载体规格"）已改为**指向【输出格式】的作答位条款**。
 *  · 判据：**题类 7 类必注入**【作答位与载体】与【题目自洽】；**内容型一律不注入**这两块（其作答位条款自带）。
 *  ⚠️ 设计若变，本断言会红，再由人判。 */
const CARRIER_ALL = '【作答位与载体】';
const SELF_CHECK = '【题目自洽】';
const NO_SELF_CHECK_TYPES = ['summary', 'preview'];

const pos = (t, m) => (t.startsWith(m) ? 0 : t.indexOf(`\n${m}`));

/** 逐 486 三维度装配（与 blockStructure/生成端同口径：anchor 通道、split 模式） */
function buildCell(genType, stage, subject) {
  const template = getPromptTemplate({ grade: stage, subject, genType }).template || '';
  const teaching = buildTeachingInjection({ genType, stage, subject }) || '';
  return buildUserMessagePrompt({
    genType, subject, materialChannel: 'anchor',
    anchorListText: '一、主题\n· 知识点。', instructionText: template + teaching,
  });
}

describe('⑧ 质量就绪：逐 486 真实三维度核对"产出必需判据齐备"', () => {
  it('扫面＝真实三维度 486（9 类型 × 54 开设对），不抽检', () => {
    expect(OPEN_PAIRS.length, '真实开设的学科×学段对').toBe(54);
    expect(GEN_TYPE_KEYS.length).toBe(9);
    expect(OPEN_PAIRS.length * GEN_TYPE_KEYS.length).toBe(486);
  });

  it('九类通用底座七项齐备 ＋ 学科要点在位（缺一即红）', () => {
    const bad = [];
    for (const genType of GEN_TYPE_KEYS) {
      for (const { stage, subject } of OPEN_PAIRS) {
        const t = buildCell(genType, stage, subject);
        const tag = `${genType}|${subject}|${stage}`;
        for (const m of REQUIRED_ALL) if (pos(t, m) < 0) bad.push(`${tag} —— 缺 ${m}`);
        if (!/【[^】]*要点】/.test(t)) bad.push(`${tag} —— 缺学科要点块（【…要点】）`);
      }
    }
    expect(bad.slice(0, 30), `质量就绪违规 ${bad.length} 处`).toEqual([]);
  });

  it('试卷（exam）：卷面必需七件齐备', () => {
    const bad = [];
    for (const { stage, subject } of OPEN_PAIRS) {
      const t = buildCell('exam', stage, subject);
      for (const m of REQUIRED_EXAM) if (pos(t, m) < 0) bad.push(`exam|${subject}|${stage} —— 缺 ${m}`);
    }
    expect(bad.slice(0, 20), `试卷卷面件缺失 ${bad.length} 处`).toEqual([]);
  });

  it('题类 7 类必注入作答载体块；内容型按 学科×学段 有载体则注入，且一律不注入《题目自洽》', () => {
    const bad = [];
    for (const genType of GEN_TYPE_KEYS) {
      const noSelfCheck = NO_SELF_CHECK_TYPES.includes(genType);
      for (const { stage, subject } of OPEN_PAIRS) {
        const t = buildCell(genType, stage, subject);
        const tag = `${genType}|${subject}|${stage}`;
        // 题类必注入；内容型为"**有载体协议才有块**"（无书写载体的学科不注入——无载体可给）
        if (!noSelfCheck && pos(t, CARRIER_ALL) < 0) bad.push(`${tag} —— 缺 ${CARRIER_ALL}`);
        const hasSelf = pos(t, SELF_CHECK) >= 0;
        if (noSelfCheck && hasSelf) bad.push(`${tag} —— ${genType} 不应注入 ${SELF_CHECK}`);
        if (!noSelfCheck && !hasSelf) bad.push(`${tag} —— 需作答的资料缺 ${SELF_CHECK}`);
      }
    }
    expect(bad.slice(0, 30), `载体/自洽段归属违规 ${bad.length} 处`).toEqual([]);
  });

  it('答案页（逐 486 组合）：角色 ＋【答案规范】＋【答案页输出格式】三件齐备', () => {
    const bad = [];
    for (const genType of GEN_TYPE_KEYS) {
      for (const { stage, subject } of OPEN_PAIRS) {
        const ansRole = genType === 'exam' ? ANSWER_ROLES.exam(subject) : ANSWER_ROLES.other(genType);
        const t = ['【答案规范】', ansRole, buildAnswerFormatSpec(subject)].join('\n');
        const tag = `${genType}|${subject}|${stage}·答案页`;
        if (!/你是/.test(t)) bad.push(`${tag} —— 缺角色行`);
        if (!t.includes('【答案规范】')) bad.push(`${tag} —— 缺【答案规范】`);
        if (!t.includes('【答案页输出格式】')) bad.push(`${tag} —— 缺【答案页输出格式】`);
      }
    }
    expect(bad.slice(0, 20), `答案页必需件缺失 ${bad.length} 处`).toEqual([]);
  });

  it('L1 历史四类问题的应对面在位（组卷随意／内容单薄／图文·超纲·离题／同质化）', () => {
    const bad = [];
    // ① 组卷随意 & ④ 同质化：模型侧源头判据（质量底线通用条）
    const ANTI_RANDOM = [
      '同一大类内不得拆成多道大题',            // ① 同型只作一栏（含同一大类内、跨栏同型）
      '同类条目递进展开、互不雷同',            // ④ 不扎堆反复
      '同一份资料内不得复现相同材料/数据组合', // ④ 材料/数据不复现
      '按考查作用判重',                        // ④ 不重复＝判据式（按考查作用，非枚举维度）
      // 🔴 2026-10-10（用户实证·消"换包装"口子）：原定义"同型（作答方式与**考查内容**相同）"——
      //    "看拼音写词语"与"在语境中看拼音写词语"被判成两题（作答方式同、但"内容"被读成不同）。
      //    改锚**考查的知识与能力**（与"同一知识或能力点"同口径）：换情境/材料/措辞不改变判定。
      '作答方式与考查的知识与能力相同',
    ];
    // ① 分类/分层（**只判"题集类"**：练习/专项/阅读——不指定分层名，只要求"看得出成组层次"）
    const GROUPING = ['分组依据与组名都由你按本部分内容自行定', '看得出成组的层次'];
    // ② 内容单薄：可核对替代（不写数量下限）
    const ANTI_THIN = ['内容充实', '篇幅与容量与内容相称', '逐点都有实际的题目、材料或条目承载'];
    // ③ 图文/超纲/离题/逻辑
    const ANTI_WRONG = ['图文一致', '逻辑自洽', '不超出本学段课标学业质量要求', '不偏离本资料主题与范围'];
    for (const genType of GEN_TYPE_KEYS) {
      for (const { stage, subject } of OPEN_PAIRS) {
        const t = buildCell(genType, stage, subject);
        const tag = `${genType}|${subject}|${stage}`;
        // ⚠️ 这些是**块内内容串**（不在行首）→ 用 `includes`；`pos` 是行首锚定，只用于块名
        //   （2026-10-02 首跑即因此假红 5670 处）
        for (const m of [].concat(ANTI_RANDOM, ANTI_THIN, ANTI_WRONG)) if (!t.includes(m)) bad.push(`${tag} —— 缺 ${m}`);
        if (['practice', 'special', 'reading'].includes(genType)) {
          for (const m of GROUPING) if (!t.includes(m)) bad.push(`${tag} —— 题集类缺 ${m}`);
        }
      }
    }
    expect(bad.slice(0, 30), `历史问题应对面缺失 ${bad.length} 处`).toEqual([]);
  });

  it('L2 反向锁：已清除的"内部机制/解释性"表述不得回潮（逐 486）', () => {
    const FORBIDDEN = [
      '在本产品语义',                    // 批C/批D 清除（本产品内部语义解释）
      '在本产品',                        // F5 清除（本产品内部语义解释的**全族**——含"没有空位语义"变体，曾逃过上面那条精确锁）
      '会被当作强调标注清理掉',           // F5 清除（程序侧清理机制/免责描述——§12.x 矛盾项）
      '程序拼装并在生成后统一替换',       // 项4 批A 清除（机制描述→结果式）
      '把它当"背景描述"读过去',           // ⑤ 回补清除（否定式植入）
      '下划线在本产品语义',               // 批D 清除
    ];
    const bad = [];
    for (const genType of GEN_TYPE_KEYS) {
      for (const { stage, subject } of OPEN_PAIRS) {
        const t = buildCell(genType, stage, subject);
        for (const m of FORBIDDEN) if (t.includes(m)) bad.push(`${genType}|${subject}|${stage} —— 回潮：${m}`);
        // 字数**上限**只对**内容型**判（"内容型资料无字数限制"）；题类的"不少于N字"是**题面要求**（如作文），合法、不判。
        //   ⚠️ 2026-10-02：初版把"不少于N字"也当回潮 → 误伤语文蓝图的作文题要求（假红）；已收窄。
        if (['summary', 'preview', 'review', 'dictation'].includes(genType)
          && /字以内|不超过\s*\d+\s*字|限\s*\d+\s*字/.test(t)) {
          bad.push(`${genType}|${subject}|${stage} —— 回潮：内容型字数上限`);
        }
      }
    }
    expect(bad.slice(0, 20), `反向锁命中 ${bad.length} 处`).toEqual([]);
  });

  it('L3 "程序能兜底≠模型侧可删"：六对的模型侧源头要求仍在', () => {
    const bad = [];
    // 同 L1：判**块内内容串**，用 `includes`（非行首锚定）
    const need = (t, m, tag) => { if (!t.includes(m)) bad.push(`${tag} —— 缺 ${m}`); };
    for (const { stage, subject } of OPEN_PAIRS) {
      const t = buildCell('exam', stage, subject);
      const tag = `exam|${subject}|${stage}`;
      // 🔴 2026-10-10（〔347〕条款改名·促规范）：原「账目算式判据」条改「账目（对账，不作生成前提）」——同名同地，判据未变。
      need(t, '账目（对账，不作生成前提）', tag);        // ↔ examValidator 分值算式校验
      need(t, '全卷连续', tag);            // ↔ 题号连续性检测
      need(t, '题干内的分条', tag);        // ↔ 载体/层级清洗（分条不与题号层混同）
    }
    for (const genType of ['practice', 'special', 'reading']) {
      for (const { stage, subject } of OPEN_PAIRS) {
        const t = buildCell(genType, stage, subject);
        need(t, '不得照搬教材原题', `${genType}|${subject}|${stage}`);   // ↔ antiCopyGuard
      }
    }
    expect(bad.slice(0, 20), `模型侧源头要求缺失 ${bad.length} 处`).toEqual([]);
  });

  it('独立调用 10 类：任务行 ＋ 输出契约/格式件齐备（缺件即红）', () => {
    const bad = [];
    const need = (label, text, marks) => {
      const t = String(text || '');
      if (!t.trim()) { bad.push(`${label} —— 整段为空`); return; }
      // 阈值取 20：防"整段被删/清空"即可；**不臆断篇幅**（分析提取里本就有真·短约束句，
      //   初版取 50 → 误伤 #12）
      if (t.trim().length < 20) bad.push(`${label} —— 过短（疑被清空）：${t.trim().slice(0, 30)}`);
      for (const m of marks) if (!t.includes(m)) bad.push(`${label} —— 缺 ${m}`);
    };
    // ① 压缩 map／② 压缩 fold（fold 与 map 同源委托）：任务/保真/输出三段，**且顺序不可乱**（第⑦步）
    for (const [label, fn] of [['压缩map', buildMapMessages], ['压缩fold', buildFoldMessages]]) {
      for (const mode of ['full', 'practice']) {
        const msgs = fn({ batch: { title: '第1课', text: '原文。' }, mode });
        const all = msgs.map((m) => m.content).join('\n');
        need(`${label}(${mode})`, all, ['【压缩任务】', '【保真要求】', '【输出】']);
        const [a, b, c] = ['【压缩任务】', '【保真要求】', '【输出】'].map((m) => all.indexOf(`\n${m}`) >= 0 ? all.indexOf(`\n${m}`) : all.indexOf(m));
        if (!(a < b && b < c)) bad.push(`${label}(${mode}) —— 块序倒置（应：压缩任务→保真要求→输出）`);
      }
    }
    // ③④ 听力抽取／翻译：**system 先于 user**（角色/契约先给，材料后给）
    for (const [label, fn] of [['听力抽取', buildListeningExtractMessages], ['听力翻译', buildListeningTranslateMessages]]) {
      const msgs = fn(label === '听力抽取' ? '1. M: Hi.' : '小明去图书馆。');
      if (!(msgs.length === 2 && msgs[0].role === 'system' && msgs[1].role === 'user')) {
        bad.push(`${label} —— 消息序异常（应为 system→user）`);
      }
    }
    // ③ 听力抽取／④ 听力翻译：角色 ＋ **同一份 JSON 契约**
    need('听力抽取', buildListeningExtractMessages('1. M: Hi.').map((m) => m.content).join('\n'), ['JSON', '结构化']);
    need('听力翻译', buildListeningTranslateMessages('小明去图书馆。').map((m) => m.content).join('\n'), ['JSON', '译']);
    // ⑤ 教材分析提取（ANALYSIS_PROMPTS 全项）：各 prompt 的**字段契约**已在 E3 逐字登记（逐字 head 锁）
    //   → 此处只锁"非空 ＋ 够长"（防整段被删/被清空）；不臆断它们用哪个字面（初版判 `JSON` → 假红 16 处）
    ANALYSIS_PROMPTS.forEach((p, i) => {
      need(`分析提取#${i + 1}`, p.content, []);
    });
    // ⑥ 调用层 inline 4 类（知识图谱／教材页知识点提取／统一情境／变题）：源码锚点抽取（同 blockStructure 手法）
    const gen = fs.readFileSync(path.join(ROOT, 'src/composables/useAiGenerator.js'), 'utf8').split('\r\n').join('\n');
    const ANCHORS = [
      ['知识图谱构建', 'const prompt2 = `', '`;'],
      ['教材页知识点提取', 'const prompt = `你是一位', '`;'],
      ['统一情境生成', 'const contextPrompt = `', '`;'],
      ['变题生成', 'const variantPrompt = `', '`;'],
    ];
    for (const [label, a, b] of ANCHORS) {
      const i = gen.indexOf(a);
      const j = i >= 0 ? gen.indexOf(b, i) : -1;
      if (i < 0 || j < 0) { bad.push(`${label} —— 锚点缺失（防假绿）`); continue; }
      const raw = gen.slice(i + a.length, j).split('\\n').join('\n');
      // 输出契约的**逐字锁定在 `promptSourceRegistry`**（E3 登记 head 逐字存在）——此处只锁"任务行仍在"
      //   （初版对这些也判 `JSON` → 假红 2 处：页面提取/变题并不用该字面）
      need(label, raw, ['请']);
    }
    expect(bad.slice(0, 20), `独立调用缺件 ${bad.length} 处`).toEqual([]);
  });

  it('教辅（非 exam）：教辅结构注入在位（【要求落实】层）', () => {
    const bad = [];
    for (const genType of GEN_TYPE_KEYS) {
      if (genType === 'exam') continue;
      for (const { stage, subject } of OPEN_PAIRS) {
        const t = buildCell(genType, stage, subject);
        // 教辅结构件齐备：要求落实层 ＋ 学段要求层（**所有教辅**）＋ 大类标题层（**易错题本除外**）
        //   · errorbook 按"知识点/易错点"分**块**（块标题即 <h2>，不带"一、"序号），**不设"大类"层** → 设计如此
        for (const m of ['【要求落实】', '【学段要求（']) {
          if (pos(t, m) < 0) bad.push(`${genType}|${subject}|${stage} —— 缺 ${m}`);
        }
        if (genType !== 'errorbook' && pos(t, '【栏目标题') < 0) bad.push(`${genType}|${subject}|${stage} —— 缺【栏目标题`);
      }
    }
    expect(bad.slice(0, 20), `教辅结构缺失 ${bad.length} 处`).toEqual([]);
  });
});
