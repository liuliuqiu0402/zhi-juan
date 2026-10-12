// 🔍 S3′·④ **独立调用 10 类** 逐条八问复核（方法文件 §十二）
// ============================================================
// 口径（E4 登记）：独立调用**不在正文生成请求里**，各自是独立一次调用 → 各有各的"实发"，须**分别逐条过**。
//   **条**＝**注入单元**（一个 build 段／一个条目＝1），**逐句过时逐条登记**（不预填数字、不拍脑袋）。
// 二重锚（防"凭记忆编条目"）：
//   ① **字面锚**：每条给一个**源码字面**正则，须真在 `file` 文本中命中（源被删／改名即红）；
//   ② **登记互证**：本表的 10 个 id 须与 `caliberRegistry.PROMPT_CALL_SOURCES` 的**独立调用键**一致
//      （且显式排除"层级/卷别提示"——那条已改准为**非独立调用**）。
// 八问（标准 §3.2）：①三维度 ②课标 ③啰嗦 ④精准 ⑤诱导 ⑥拼接 ⑦排序 ⑧质量；**每格 8 条全落点，不得跳问**。
// 判定层级＝**纸面推演 ＋ 程序校验**（**无真机通道**，⑧不冒称实测）。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PROMPT_CALL_SOURCES } from '../../src/config/caliberRegistry.js';
import { ANALYSIS_PROMPTS } from '../../src/config/analysisPrompts.js';

/** 仓库根（vitest 以仓库根为 cwd 运行） */
const ROOT = process.cwd();
const srcText = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const U = 'src/composables/useAiGenerator.js';
const PL = 'src/config/promptLibrary.js';
const LX = 'src/config/listeningExtractPrompt.js';
const LT = 'src/config/listeningTranslatePrompt.js';
const TC = 'src/utils/textbookCompression.js';

// ===== 10 类独立调用 × 逐条（条＝注入单元；a＝源码字面锚）=====
const CALLS = [
  { id: '答案页（split 第二次调用）', file: U, cond: 'generateMode=split，且正文未含答案', items: [
    { t: '角色 EXAM：阅卷专家逐题作答＋评分标准', file: PL, a: /你是阅卷专家/ },
    { t: '角色 教辅：为以下资料撰写《参考答案与解析》', file: PL, a: /请为以下资料撰写《参考答案与解析》/ },
    { t: '【答案规范】＝buildAnswerFormatSpec（答案页格式规范）', file: PL, a: /参考答案与评分标准/ },
    { t: 'ANS_ALIGN_TAIL_REF（答案区与正文逐题对齐，隶属【尾约束·全文自洽】）', a: /ANS_ALIGN_TAIL_REF/ },
    { t: 'ansAlignNote（自包含分支：答案区按正文对应栏目组织、与正文同构）', a: /答案区按正文对应的栏目组织/ },
    { t: 'ansAlignNote（普通分支：逐题对齐硬要求）', a: /逐题对齐硬要求/ },
    { t: 'ansMaterial 段标题【压缩原文·答案参考】', a: /【压缩原文·答案参考】/ },
    { t: '正文段标题【正文】', a: /【正文】/ },
    { t: '答案段标题【答案规范】', a: /【答案规范】/ },
    { t: '正文空兜底（终止输出）', a: /正文为空，无法作答/ },
  ] },
  { id: '听力抽取（独立调用）', file: LX, cond: '仅英语且该资料类型需听力', items: [
    { t: '规则1 只搬运不创作（一致性红线）', a: /只搬运，不创作/ },
    { t: '规则2 逐句拆分（按说话人轮次、保序禁重排）', a: /逐句拆分/ },
    { t: '规则3 角色判定 M／W／N（判不出用 N、不猜）', a: /角色判定/ },
    { t: '规则4 题号（同材料多小题按首个小题目）', a: /按原文小题序号填 no/ },
    { t: '规则5 只要听力材料本身（题干/选项/分值不入 lines）', a: /只要听力材料本身/ },
    { t: '规则6 分节播音指令归该节首题 instruction（含判据）', a: /分节播音指令/ },
    { t: '规则7 题号范围归 range（不并入 lines、不丢 intro）', a: /题号范围/ },
    { t: '规则8 多个大题按顺序并入 items', a: /原文若含多个大题/ },
    { t: '规则9 只输出 JSON（无围栏、无前后记）', a: /只输出 JSON/ },
    { t: 'user 段：从答案页复制的听力原文＋结构化请求', a: /以下是从答案页复制出来的听力原文/ },
    { t: 'JSON 契约 LISTENING_STRUCT_SCHEMA（与翻译路径同源）', a: /"intro": "中文播报导语/ },
  ] },
  { id: '听力翻译（独立调用）', file: LT, cond: '仅英语听力内容需要译文时', items: [
    { t: '规则1 只翻译 lines（口语化、一句一信息点）', a: /只翻译听力材料正文/ },
    { t: '规则2 中文导语/播音指令/题号范围原样留中文（不译、不编造）', a: /中文的导语、播音指令、题号范围一律原样保留中文/ },
    { t: '规则3 逐句拆分（按轮次、保序）', a: /逐句拆分/ },
    { t: '规则4 角色判定 M／W／N', a: /角色判定/ },
    { t: '规则5 题号（同材料多小题按首个）', a: /按原素材的小题序号填 no/ },
    { t: '规则6 信息等价（可调语序用词，不得增删信息）', a: /信息等价/ },
    { t: '规则7 只输出 JSON', a: /只输出 JSON/ },
    { t: 'user 段：中文听力素材＋译为英语听力稿', a: /以下是用户粘贴的中文听力素材/ },
    { t: 'JSON 契约（与"搬运"路径同源，下游零改动）', a: /输出 JSON 契约/ },
  ] },
  { id: '教材原文压缩（独立调用·map 阶段）', file: TC, cond: '素材通道=full 时', items: [
    { t: 'system 只留角色（保真压缩器）', a: /你是教材原文的"保真压缩器"/ },
    { t: '【压缩任务】按 mode 档位（compressionSpecOf）', a: /【压缩任务】/ },
    { t: '【保真要求】档位专句（spec.instruction）', a: /【保真要求】/ },
    { t: '【硬约束】只做压缩/不增删内容＋只保留原文已有结构标题', a: /【硬约束】/ },
    { t: '【教材信息】＝学段·学科（标题已移出、不在本字段）', a: /【教材信息】/ },
    { t: '【原文】＝本节真实文本（标题只此一处）', a: /【原文】/ },
    { t: '【输出】仅压缩后原文文本、无说明前言', a: /【输出】/ },
  ] },
  { id: '教材原文压缩（独立调用·fold 阶段）', file: TC, cond: '同 map 阶段，折叠汇总时', items: [
    { t: '与 map **同字面**（buildFoldMessages 委托 buildMapMessages，不另立一套）', a: /export const buildFoldMessages = \(\{ batch, mode = '' \} = \{\}\) => buildMapMessages/ },
  ] },
  { id: '知识图谱构建（独立调用·生成第二步）', file: U, cond: '有教材素材时恒跑（正文生成之前）', items: [
    { t: '角色＋任务：构建层级知识图谱', a: /你是课程与教学专家。请基于以下各课内容，构建层级知识图谱/ },
    { t: '【输入数据说明】＋各课内容概要', a: /【输入数据说明】/ },
    { t: '请完成 4 项（清单/重难点/层级图谱/跨章关联）', a: /请完成：/ },
    { t: '条目数由本范围实际内容决定＋完整性闭合（不砍条目）', a: /条目数由本范围实际内容决定/ },
    { t: '目录模式说明（引课标推断、不臆造）', a: /目录模式说明：/ },
    { t: '返回 JSON 契约（knowledgeGraph 等）', a: /返回JSON：/ },
    { t: '语言口径与正文一致（外语教材：标签中文／具体概念原文语言）', a: /语言口径与正文一致/ },
  ] },
  { id: '教材页知识点提取（独立调用·多模态）', file: U, cond: '教材页面（图片）分析阶段', items: [
    { t: '角色＋任务：从教材页面提取最核心知识点', a: /请从这张教材页面（章节：/ },
    { t: '要求1 每个知识点一句话概括', a: /每个知识点用一句话概括/ },
    { t: '要求2 只提取最核心的 3-5 个', a: /只提取最核心的3-5个知识点/ },
    { t: '要求3 每行一个知识点、不编号、不要其他内容', a: /每行一个知识点、不要编号/ },
  ] },
  { id: '统一情境生成（独立调用·生成期）', file: U, cond: '组织风格＝统一情境类时', items: [
    { t: '角色＋任务：确定统领全卷的核心主题情境', a: /请为一份教辅资料确定一个统领全卷的核心主题情境/ },
    { t: '要求1 情境真实适切＋情境类型沿用课标界定', a: /情境类型沿用本学科课程标准界定的情境类型/ },
    { t: '要求2 情境能自然容纳不同设问角度与知识点', a: /情境应能自然地容纳不同设问角度与知识点/ },
    { t: '输出格式：严格 JSON（name/background/mainTask）', a: /必须返回严格 JSON/ },
  ] },
  { id: '变题生成（独立调用·编辑器）', file: U, cond: '编辑器「生成变体题」', items: [
    { t: '角色＋任务：为题目生成变体', a: /请为以下题目生成一个变体题目/ },
    { t: '【原题】', a: /【原题】/ },
    { t: '【原题规划】（题型/知识点/难度/分值）', a: /【原题规划】/ },
    { t: '【变体要求】（题型/数据/情境/选项 可改项＋不变项＋不得雷同）', a: /【变体要求】/ },
    { t: '尾句：只返回一道题的 HTML', a: /只返回一道题的HTML代码/ },
  ] },
  // 教材分析提取：条＝`ANALYSIS_PROMPTS` 模块条目（**由模块导出，不手抄**；锚＝条目 id 字面，可在源码文本中核）
  { id: '教材分析/知识点提取（独立调用）', file: 'src/config/analysisPrompts.js', cond: '生成前对勾选章节做分析提取',
    items: ANALYSIS_PROMPTS.map((p) => ({ t: `${p.category}·${p.id}`, a: new RegExp(p.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })) },
];

// ===== 八问（独立调用版：基准行 ＋ 覆盖行）=====
const Q8 = ['①三维度', '②课标', '③啰嗦', '④精准', '⑤诱导', '⑥拼接', '⑦排序', '⑧质量'];
const Q8_LAYER = ['程序校验', '纸面推演', '程序校验＋纸面', '纸面推演', '程序校验', '程序校验', '程序校验', '纸面＋程序（**无真机通道**）'];
/** 基准行：登记齐备（E4/PROMPT_INLINE_SOURCES 有主）＋守卫已绿；②不适用＝本条不引课标 */
const Q8_BASE = ['过', '不', '过', '过', '过', '过', '过', '过'];
const Q8_OVERRIDE = [
  { id: '教材原文压缩（独立调用·map 阶段）', t: '【教材信息】＝学段·学科（标题已移出、不在本字段）', q: 0, v: '处',
    why: '**T16·G102/G103**：原【范围】字段名与内容不符、标题同一次调用内注入三处 ⇒ 改【教材信息】并把标题移出' },
  { id: '教材原文压缩（独立调用·map 阶段）', t: 'system 只留角色（保真压缩器）', q: 5, v: '处',
    why: '**T16·G104**：原 system 与【硬约束】"不增不删"＝同事务两处复述 ⇒ system 只留角色（单源）' },
  { id: '教材原文压缩（独立调用·map 阶段）', t: '【硬约束】只做压缩/不增删内容＋只保留原文已有结构标题', q: 5, v: '处',
    why: '**T16·G104**：该事务公共句归【硬约束】一处（与上行同批）' },
  { id: '教材分析/知识点提取（独立调用）', t: '分析-文本分析规范·block_core_principle', q: 3, v: '处',
    why: '**T03·G19**：原清单含"分值"，与"没有标注填 0"**直接相抵** ⇒ 清单剔除"分值"（逐字复制字段不含分值）' },
  { id: '教材页知识点提取（独立调用·多模态）', t: '要求3 每行一个知识点、不编号、不要其他内容', q: 2, v: '处',
    why: '**2026-10-02（③啰嗦·收口）**：原分条3＋尾句两处都在要求"只给列表"⇒ 并入末条一句、删尾行' },
  { id: '知识图谱构建（独立调用·生成第二步）', t: '目录模式说明（引课标推断、不臆造）', q: 1, v: '过',
    why: '本条**引课标**：以"该学科课标（${curriculumLabel}）"为推断依据、且限定"不得臆造超出该章节标题的内容"⇒ ②＝过' },
  { id: '统一情境生成（独立调用·生成期）', t: '要求1 情境真实适切＋情境类型沿用课标界定', q: 1, v: '过',
    why: '本条**引课标**：情境类型"沿用本学科课程标准界定"（义教/高中课标原义）⇒ ②＝过' },
  { id: '答案页（split 第二次调用）', t: 'ansAlignNote（普通分支：逐题对齐硬要求）', q: 5, v: '处',
    why: '**2026-10-02（③啰嗦·一份实发内判据只准一处正句）**：`selfContainedAnsNote` 与库内 `ANSWER_ROLES` 同义 ⇒ 正句收口到常量、inline 整块删除' },
];

const rowsAll = CALLS.flatMap((c) => c.items.map((it) => {
  const row = Q8_BASE.slice();
  const ov = Q8_OVERRIDE.filter((o) => o.id === c.id && o.t === it.t);
  for (const o of ov) row[o.q] = o.v;
  return { id: c.id, t: it.t, row, ov };
}));

describe('S3′·④ 独立调用 10 类 逐条八问复核', () => {
  it('恰 10 类独立调用，且与 E4 登记（PROMPT_CALL_SOURCES）互证（显式排除"层级/卷别提示"）', () => {
    const NON_CALL = Object.keys(PROMPT_CALL_SOURCES).filter((k) => /层级\/卷别提示/.test(k));
    expect(NON_CALL).toHaveLength(1); // 该条已改准为"正文请求的一块·非独立调用"
    const registered = Object.keys(PROMPT_CALL_SOURCES).filter((k) => !/层级\/卷别提示/.test(k));
    expect(registered).toHaveLength(10);
    expect(CALLS.map((c) => c.id).sort()).toEqual(registered.sort());
  });

  it('每条都带**源码字面锚**且真命中（防"凭记忆编条目"——源被删／改名即红）', () => {
    const bad = [];
    const cache = {};
    for (const c of CALLS) {
      for (const it of c.items) {
        const rel = it.file || c.file;
        cache[rel] = cache[rel] ?? srcText(rel);
        if (!it.a.test(cache[rel])) bad.push(`${c.id}：${it.t} —— 锚未命中（${rel}）`);
      }
    }
    expect(bad, `以下条目锚未命中：\n${bad.join('\n')}`).toEqual([]);
  });

  it('教材分析提取＝模块导出条数（不手抄、不预填）', () => {
    const c = CALLS.find((x) => x.id === '教材分析/知识点提取（独立调用）');
    expect(c.items.length).toBe(ANALYSIS_PROMPTS.length);
    expect(c.items.length).toBe(13);
  });

  it('每格恰 8 条、取值∈{过／不／处}；"处"须指向事务号／裁定／日期', () => {
    const bad = [];
    for (const r of rowsAll) {
      if (r.row.length !== 8) bad.push(`${r.id}·${r.t} 条数=${r.row.length}`);
      r.row.forEach((v, i) => {
        if (!['过', '不', '处'].includes(v)) bad.push(`${r.id}·${r.t}·${Q8[i]} 取值异常=${v}`);
        if (v === '处') {
          const o = r.ov.find((x) => x.q === i);
          if (!o || !/T\d|S0|裁定|20\d\d-\d\d-\d\d/.test(String(o.why))) bad.push(`${r.id}·${r.t}·${Q8[i]} "已处置"未指向事务号/裁定/日期`);
        }
      });
    }
    expect(bad, `八问留痕异常：\n${bad.join('\n')}`).toEqual([]);
  });

  it('覆盖行必须真落在既有条目上（防写错 id／条名导致"静默不生效"）', () => {
    const cells = new Set(rowsAll.map((r) => `${r.id}·${r.t}`));
    const bad = Q8_OVERRIDE.filter((o) => !cells.has(`${o.id}·${o.t}`)).map((o) => `${o.id}·${o.t}`);
    expect(bad, `覆盖行指向了不存在的条目：\n${bad.join('\n')}`).toEqual([]);
  });

  it('判定层级不得留空；条数与直方图被钉死（防"悄悄改判／删条"式假绿）', () => {
    expect(Q8_LAYER.filter((x) => !String(x).trim())).toEqual([]);
    expect(rowsAll.length).toBe(71);
    const hist = { 过: 0, 不: 0, 处: 0 };
    for (const r of rowsAll) for (const v of r.row) hist[v] += 1;
    expect(hist).toEqual({ 过: 493, 不: 69, 处: 6 });
  });
});
