// 🔍 自证 #3＝**面集**：`16 面 × 9 类型` 矩阵**无空格**（"在场"须有判据源；"缺席"须有依据）
// ============================================================
// 2026-10-11（S0 造尺 · S1 之后）：把方法定稿 §5.1/§5.2 的 16 面落成**可机读的"面 ↔ 判据源"映射**，
//   并对 **每类型全部真实 cell（54 对 × 该类型）** 的实发文本核"判据源是否真的发出去"。
// 三态（每一格必居其一，不得留空）：
//   · on  在场：该面有判据源 ⇒ 本守卫断言**判据源真在该类型实发文本中命中**（源被删/被门控掉即红）
//   · off 缺席：该面情形面在该类型不成立 ⇒ 必须给出**依据**（非空理由）
//   · gap 缺口：情形面成立但**未定位到判据源** ⇒ 必须登记（**这不是"绿"**，是本轮产出、待属主裁；
//              数量被钉死，修复后须同步改本表与方法定稿 §5.5 —— 防"悄悄抹平"）
// 判定层级＝程序校验；数据来源＝实发装配（与 `promptSourceRegistry` 同口径，含"生成期追加"通道）。
import { describe, it, expect } from 'vitest';
import {
  getPromptTemplate, STAGE_SUBJECTS, ANSWER_ROLES, buildAnswerFormatSpec,
} from '../../src/config/promptLibrary.js';
import { GEN_TYPE_KEYS } from '../../src/config/toolLibrary.js';
import { buildTeachingInjection } from '../../src/config/teachingBlueprints.js';
import { buildUserMessagePrompt, buildCallLayerBlocks, buildDiffRegenBlock, buildMultiTypeDiffBlock } from '../../src/utils/injectionManifest.js';
import { buildProgramAttach } from '../../src/utils/programAttach.js';
import { styleOptions, buildStyleAppend } from '../../src/config/expertKnowledge.js';

const stylesForType = (genType) => styleOptions
  .filter((o) => !o.appliesTo.length || o.appliesTo.includes(genType))
  .map((o) => o.value).filter((v) => buildStyleAppend(v));

/** 某类型**全部真实 cell** 的实发文本（54 份；素材/锚点置空＝豁免输入；含生成期追加） */
function textsOfType(genType) {
  const out = [];
  for (const [stage, subs] of Object.entries(STAGE_SUBJECTS)) {
    for (const subject of subs) {
      const t = (getPromptTemplate({ grade: stage, subject, genType }).template) || '';
      out.push([
        t,
        buildTeachingInjection({ genType, stage, subject }) || '',
        buildProgramAttach({ subject, stageKey: stage, genType, instructionText: t }) || '',
        buildUserMessagePrompt({ genType, subject, materialChannel: 'anchor', anchorListText: '@@A@@', instructionText: t }) || '',
        buildCallLayerBlocks().map((b) => b.text).join('\n'),
        genType === 'exam' ? ANSWER_ROLES.exam(subject) : ANSWER_ROLES.other(genType),
        buildAnswerFormatSpec(subject),
        stylesForType(genType).map((s) => buildStyleAppend(s)).join('\n'),
        buildDiffRegenBlock({ genType, diffKps: ['（已练知识点）'] }),
        buildMultiTypeDiffBlock({ typeName: '（类型名）', prevTypes: '（前序类型）', coveredKps: ['（已覆盖知识点）'] }),
      ].join('\n'));
    }
  }
  return out;
}
const TEXTS = Object.fromEntries(GEN_TYPE_KEYS.map((t) => [t, textsOfType(t)]));
const ALL = GEN_TYPE_KEYS;
const NOT_CONTENT = ALL.filter((t) => t !== 'preview' && t !== 'summary');
const hit = (genType, src) => TEXTS[genType].some((txt) => src.some((re) => re.test(txt)));

// ===== 16 面的判据源（可机读）＋ 逐类型在场/缺席/缺口 =====
const FACES = [
  // ── 内容自洽 9 面 ──
  { id: 'C1', group: '内容自洽', name: '声明↔实给', on: ALL,
    src: [/题面怎么说、卷面就怎么做/, /声明提供的线索（提示词、图、表、数据、要点等）须在材料中真实足量给出/] },
  { id: 'C2', group: '内容自洽', name: '题干↔答案↔解析', on: ALL,
    src: [/请为以下资料撰写《参考答案与解析》/, /请为以下试卷逐题撰写完整《参考答案与评分标准》/] },
  { id: 'C3', group: '内容自洽', name: '要素之间', on: ALL,
    src: [/题面语义自洽/, /逻辑自洽（条件充分、前后一致、设问与结果对应）/] },
  { id: 'C4', group: '内容自洽', name: '跨处一致', on: ALL,
    src: [/同卷空位形态统一/, /同一事实全份一种表述/] },
  { id: 'C5', group: '内容自洽', name: '账目', on: NOT_CONTENT,
    src: [/账目（对账，不作生成前提）/, /分值与空数/],
    off: {
      preview: '内容型（预习导学）不设分值/卷面结构账目——无"空数×单价＝分值"的标的物，账目关系不成立',
      summary: '内容型（知识总结）不设分值/卷面结构账目——同上，账目关系不成立',
    } },
  { id: 'C6', group: '内容自洽', name: '材料/情境', on: ALL,
    src: [/题干与所给情境/, /材料中只能有/, /情境按考查意图选配/] },
  { id: 'C7', group: '内容自洽', name: '层级↔内容', on: ALL,
    // 正式卷＝【卷面自洽】的"大类名与大题标题…相符"；教辅＝【栏目标题】＋【要求落实】（栏名↔内容与形态要求）；易错题本＝块标题自拟（写清本块是哪一处知识/哪一类错法）
    src: [/大类名与大题标题都须与其下各题实际考查的内容/, /【栏目标题/, /【要求落实】/, /块标题自拟/] },
  { id: 'C8', group: '内容自洽', name: '唯一性', on: ALL,
    src: [/内容唯一性/] },
  { id: 'C9', group: '内容自洽', name: '事实/教材口径', on: ALL,
    src: [/教材版本口径/, /事实可信/] },
  // ── 载体自洽 7 面 ──
  { id: 'Z1', group: '载体自洽', name: '载体↔所填内容', on: ALL,
    src: [/填空短答用横线空位/, /严禁用裸空格或全角空格串充当空位/, /书写载体协议/] },
  { id: 'Z2', group: '载体自洽', name: '载体↔位置', on: ALL,
    // 内容型（preview/summary）的"位置"判据源＝【内容组织格式】的 carrierPlacement（2026-10-11 属主裁定"要覆盖"后补）
    src: [/作答空行只跟在题干要求之后/, /作答位在材料与设问之后/, /就地留空/, /紧随其书写对象/,
      /作答位\*\*紧随其题、在设问之后\*\*/] },
  { id: 'Z3', group: '载体自洽', name: '载体↔声明', on: ALL,
    // 内容型的"题面声明→载体照给"判据源＝【内容组织格式】的 carrierPlacement（同上）
    src: [/题干指示作答所用的线形/, /声明了作答形态或给出材料/, /题干未写明时按此书写惯例/,
      /一律照声明给到/] },
  { id: 'Z4', group: '载体自洽', name: '载体↔数量宽度', on: ALL,
    src: [/N 为宽度档/, /宽度/] },
  { id: 'Z5', group: '载体自洽', name: '载体↔就位', on: ALL,
    src: [/作答位必须真实输出、不得省略/, /每道小题的作答位必须仍在本题题面内/] },
  { id: 'Z6', group: '载体自洽', name: '一致性', on: ALL,
    src: [/同卷空位形态统一/, /填空短答用横线空位/] },
  { id: 'Z7', group: '载体自洽', name: '不越权', on: ALL,
    src: [/不得用无 class 的裸 <u> 或空格串充当作答位/, /严禁用裸空格或全角空格串充当空位/] },
];

describe('自证 #3：面 × 类型 矩阵（在场有判据源 / 缺席有依据 / 缺口已登记）', () => {
  it('面集恰为 16 面（内容自洽 9 ＋ 载体自洽 7）', () => {
    expect(FACES.filter((f) => f.group === '内容自洽')).toHaveLength(9);
    expect(FACES.filter((f) => f.group === '载体自洽')).toHaveLength(7);
    expect(FACES).toHaveLength(16);
  });

  it('每一格都被判定（on／off／gap 必居其一，且互不相交）——矩阵无空格', () => {
    const bad = [];
    for (const f of FACES) {
      const on = new Set(f.on || []);
      const off = Object.keys(f.off || {});
      const gap = Object.keys(f.gap || {});
      for (const t of ALL) {
        const cnt = (on.has(t) ? 1 : 0) + (off.includes(t) ? 1 : 0) + (gap.includes(t) ? 1 : 0);
        if (cnt !== 1) bad.push(`${f.id}·${t} 判定数=${cnt}（须恰为 1）`);
      }
      for (const t of [...off, ...gap, ...on]) if (!ALL.includes(t)) bad.push(`${f.id} 含未知类型 ${t}`);
    }
    expect(bad, `矩阵存空格／重叠：\n${bad.join('\n')}`).toEqual([]);
  });

  it('"在场"格：该面判据源必须真在该类型实发文本中命中（源被删/被门控即红）', () => {
    const bad = [];
    for (const f of FACES) {
      for (const t of f.on || []) {
        if (!hit(t, f.src)) bad.push(`${f.id} ${f.name}·${t}：判据源未命中（${f.src.map((r) => r.source).join(' | ')}）`);
      }
    }
    expect(bad, `以下"在场"格缺判据源：\n${bad.join('\n')}`).toEqual([]);
  });

  it('"缺席"格：必须给出依据（非空理由）', () => {
    const bad = [];
    for (const f of FACES) {
      for (const [t, reason] of Object.entries(f.off || {})) {
        if (!reason || !String(reason).trim()) bad.push(`${f.id}·${t} 缺席无依据`);
      }
    }
    expect(bad, `以下"缺席"格缺依据：\n${bad.join('\n')}`).toEqual([]);
  });

  it('"缺口"为空（属主 2026-10-11 裁定"要覆盖"后已闭合）——若再出现缺口，须同步改本表与方法定稿 §5.5', () => {
    const gaps = [];
    for (const f of FACES) for (const [t, note] of Object.entries(f.gap || {})) {
      if (!note || !String(note).trim()) gaps.push(`${f.id}·${t} 缺口无登记说明`);
    }
    expect(gaps, `缺口登记不完整：\n${gaps.join('\n')}`).toEqual([]);
    const gapCells = FACES.flatMap((f) => Object.keys(f.gap || {}).map((t) => `${f.id}·${t}`));
    expect(gapCells, `矩阵应无缺口；实得：${gapCells.join('、')}`).toEqual([]);
  });
});
