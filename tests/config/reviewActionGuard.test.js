// 模型侧「复核/自查动作」登记表 + 漂移守卫（2026-09-30 用户裁定 · 方案第一步/第二步）
// ============================================================
// 背景：模型侧要求"成稿前自查"的地方散落在 10 处，用了 6 套"改什么"的措辞
//   （改声明或改内容 / 改题面或改内容 / 改内容或改写法 / 换情境换数据换设问 / 不达标即自行修订 / 发现即改）。
//   它们**语义同向、不互相否定**，所以不会立刻致错；真正的代价是维护面：
//   ① 同一现象两处定性相反这类问题（自洽⑨ ↔ "并列对照子题除外"）就是这么漏网的——
//      全量测试全绿也没发现，靠人工审计两轮才查到；
//   ② 没有任何机械手段能发现"新增一处/偷改一处"。
// 本文件做的事（**不改任何实发文本**）：
//   ① 把 10 处连同"动作名 / 通道 / 生效范围 / 改法类型"登记成**单一事实源**；
//   ② 守卫：对**实发文本矩阵**（9 类型 × 学科 × 学段 的模板＋用户消息块＋system 附加段＋调用层块）
//      做扫描，要求
//        A. 实发文本里出现的每一处"复核动作句"都必须是登记过的（发现未登记的第 N 处）；
//        B. 每个登记条目的动作名必须真实出现在实发文本里（防"登记了、实则没了"的脱节）；
//        C. 每个条目的"改法"措辞必须命中其登记的改法类型（防悄悄长成第七套措辞）。
//   为什么扫**实发文本**而不是扫源码：源码里的注释、console、UI 标签（如块名 '输出前自检（调用层追加）'）
//   都不是模型收到的东西，扫源码会误报；实发文本才是"模型实际收到了什么"。
import { describe, it, expect } from 'vitest';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';
import { buildTeachingInjection } from '../../src/config/teachingBlueprints.js';
import {
  buildUserMessagePrompt, buildCallLayerBlocks, applyCallLayerSelfReview, TAIL_VARIETY,
} from '../../src/utils/injectionManifest.js';
import { buildProgramAttach } from '../../src/utils/programAttach.js';

/** 改法类型（枚举 = 单一事实源）：一处复核对"没做到"开出的处方，只许取这几类之一 */
const FIX_TYPES = {
  oneOfTwo: { label: '二选一修正（声明↔内容，改其一）', re: /二者取一/ },
  swap: { label: '换要素（情境/数据/设问角度）', re: /换情境|换数据|换设问/ },
  selfRevise: { label: '不达标即自行修订', re: /自行修订/ },
  fixNow: { label: '发现即改', re: /立即改正/ },
  fixGap: { label: '缺号即补、重启即改', re: /缺号即补|重启即改/ },
  deferToThreeDomains: { label: '引到三域（不另立判据）', re: /以上细目即【尾约束·全文自洽】三域在题类资料的展开/ },
};

/** 「复核动作句」的形态判据：时间锚 + 30 字内出现动作词 */
const ACTION_RE = /(?:定稿前|成稿前|输出前|输出完成后)[^，。；\n]{0,30}(?:自查|复核|核对|自检)/;

/**
 * 登记表（10 处）。`via`：
 *  · 'matrix'  = 可在实发文本矩阵里核验（模板/用户消息块/system 段/调用层块）
 *  · 'runtime' = 只在特定运行态出现（如第 1 次整卷生成失败后的重试附加段），矩阵里核不到，只登记
 */
const REVIEW_ACTIONS = [
  {
    id: 'tail-self', block: '尾约束·全文自洽', channel: '用户消息（末尾锚定）', scope: '全类型',
    action: '定稿前逐节逐题三域复核', anchor: '定稿前逐节逐题按下面三域复核', fixType: 'oneOfTwo', via: 'matrix',
  },
  {
    id: 'tail-variety', block: '尾约束·资料内多样', channel: '用户消息（末尾锚定）', scope: '全类型',
    action: '定稿前逐部分核对', anchor: '定稿前逐部分核对', fixType: 'swap', via: 'matrix',
  },
  {
    id: 'question-format', block: '题目自洽总纲①至⑰', channel: '委托正文【输出格式】', scope: '仅题类',
    action: '成稿前逐题核对', anchor: '成稿前逐题核对', fixType: 'deferToThreeDomains', via: 'matrix',
  },
  {
    // 守卫 A 逮到的第 11 处（原审计漏登记）：总纲**结尾**还有一句"定稿前按三域…逐项复核"
    id: 'question-format-crossref', block: '题目自洽总纲（结尾·三域交叉引用）', channel: '委托正文【输出格式】', scope: '仅题类',
    action: '定稿前按三域逐项复核', anchor: '定稿前按三域（声明↔实给、要素之间、跨处之间）逐项复核', fixType: 'deferToThreeDomains', via: 'matrix',
  },
  {
    id: 'quality-base', block: '质量底线', channel: '委托正文（缺段则 system 兜底）', scope: '全类型',
    action: '定稿前按底线逐条自查', anchor: '定稿前按以下底线逐条自查', fixType: 'selfRevise', via: 'matrix',
  },
  {
    id: 'organize-exam', block: '组织方式（exam 分支）', channel: '用户消息', scope: '仅 exam',
    action: '成稿前逐栏目对照自查', anchor: '成稿前逐栏目对照自查', fixType: 'oneOfTwo', via: 'matrix',
  },
  {
    id: 'req-fulfil-column', block: '要求落实（教辅·栏目版）', channel: '委托正文', scope: '教辅（非易错题本）',
    action: '成稿前逐栏目对照自查', anchor: '成稿前逐栏目对照自查', fixType: 'oneOfTwo', via: 'matrix',
  },
  {
    id: 'req-fulfil-per-item', block: '要求落实（易错题本·逐题项）', channel: '委托正文', scope: '易错题本',
    action: '成稿前逐题逐项对照自查', anchor: '成稿前逐题逐项对照自查', fixType: 'oneOfTwo', via: 'matrix',
  },
  {
    id: 'question-numbering', block: '题号连续性自查（输出格式块）', channel: '委托正文', scope: '仅题类',
    action: '输出完成后逐题自查题号连续', anchor: '输出完成后逐题自查', fixType: 'fixGap', via: 'matrix',
  },
  {
    id: 'retry-gap-note', block: '上一轮复核发现的问题（重试附加段）', channel: '调用层追加（重试时）', scope: '整卷正文重试',
    action: '输出完成后逐题自查题号连续', anchor: '输出完成后逐题自查', fixType: 'fixGap', via: 'runtime',
  },
  {
    id: 'call-self-review', block: '输出前自检', channel: '调用层追加', scope: 'generation / review',
    action: '输出前自检', anchor: '输出前自检', fixType: 'fixNow', via: 'matrix',
  },
];

const GEN_TYPES = ['exam', 'practice', 'special', 'reading', 'dictation', 'errorbook', 'review', 'summary', 'preview'];
const SUBJECTS = ['语文', '数学', '英语'];
const STAGES = ['primary_low', 'primary_high', 'middle'];

/** 实发文本矩阵：把"模型实际收到的东西"按 9 类型 × 学科 × 学段 拼出来 */
const buildMatrixText = () => {
  const out = [];
  for (const genType of GEN_TYPES) {
    for (const subject of SUBJECTS) {
      for (const stage of STAGES) {
        const template = getPromptTemplate({ grade: stage, subject, genType }).template || '';
        // 🔴 教辅结构块（大类标题/要求落实）**不在模板里**，由生成端另路追加 → 必须一并计入实发文本，
        //    否则「要求落实」那两处复核动作在矩阵里核不到（原先就漏在外面）。
        const teaching = buildTeachingInjection({ genType, stage, subject }) || '';
        const userMsg = buildUserMessagePrompt({
          genType, subject, materialChannel: 'anchor',
          anchorListText: '一、主题\n· 知识点。', instructionText: template,
        });
        const sysAttach = buildProgramAttach({ subject, stageKey: stage, genType, instructionText: template });
        const callLayer = buildCallLayerBlocks().map((b) => b.text).join('\n');
        out.push([template, teaching, userMsg, sysAttach, callLayer].join('\n'));
      }
    }
  }
  return out.join('\n');
};

const MATRIX = buildMatrixText();

describe('模型侧复核动作登记表：完整性', () => {
  it('条目数与唯一性（新增/删除一处必须同步本表——这是故意的"手动同步"提醒）', () => {
    expect(REVIEW_ACTIONS).toHaveLength(11);
    expect(new Set(REVIEW_ACTIONS.map((a) => a.id)).size).toBe(REVIEW_ACTIONS.length);
  });

  it('每条的改法类型都必须是登记过的枚举值', () => {
    for (const a of REVIEW_ACTIONS) {
      expect(FIX_TYPES[a.fixType], `${a.id} 的改法类型未登记`).toBeTruthy();
    }
  });

  it('每条的动作名本身就是"复核动作句"形态（与守卫判据同源）', () => {
    for (const a of REVIEW_ACTIONS) {
      expect(ACTION_RE.test(a.anchor), `${a.id} 的 anchor 不匹配动作句判据`).toBe(true);
    }
  });
});

describe('守卫 A：实发文本里不得出现未登记的复核动作（防第 11 处悄悄长出来）', () => {
  it('每一处动作句都能归属到登记条目', () => {
    const hits = [...MATRIX.matchAll(new RegExp(ACTION_RE.source, 'g'))].map((m) => m[0]);
    expect(hits.length, '矩阵里应能找到复核动作句（否则判据失效）').toBeGreaterThan(0);
    const anchors = REVIEW_ACTIONS.map((a) => a.anchor);
    const uncovered = [...new Set(hits)].filter((h) => !anchors.some((a) => h.includes(a) || a.includes(h)));
    expect(uncovered, `未登记的复核动作句：${uncovered.join(' | ')}`).toEqual([]);
  });
});

describe('守卫 B/C：登记条目与实发文本不得脱节', () => {
  const matrixEntries = REVIEW_ACTIONS.filter((a) => a.via === 'matrix');

  it('每个（矩阵可核的）条目的动作名必须真实出现在实发文本里', () => {
    const missing = matrixEntries.filter((a) => !MATRIX.includes(a.anchor)).map((a) => a.id);
    expect(missing, `登记了却不在实发文本里：${missing.join('、')}`).toEqual([]);
  });

  it('每个条目的"改法"措辞必须命中其登记的改法类型（防长成第七套措辞）', () => {
    const bad = matrixEntries
      .filter((a) => !FIX_TYPES[a.fixType].re.test(MATRIX))
      .map((a) => `${a.id}(期望 ${FIX_TYPES[a.fixType].label})`);
    expect(bad, `改法措辞与登记类型不符：${bad.join('、')}`).toEqual([]);
  });

  it('runtime 条目（重试附加段）不在矩阵里，但必须仍被生成端真实产出', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(path.resolve(__dirname, '../../src/composables/useAiGenerator.js'), 'utf8');
    expect(src).toContain('输出完成后逐题自查题号连续性');
  });
});

describe('回归：本轮已收口的互斥指令不得回潮', () => {
  it('自洽⑨ 的"并列对照子题例外"与【质量底线】的同类豁免同口径', () => {
    const q = getPromptTemplate({ grade: 'primary_high', subject: '语文', genType: 'practice' }).template || '';
    expect(q).toContain('不按雷同处理');
    expect(q).toContain('与【质量底线】内容唯一性的同类豁免同一口径');
  });

  it('尾约束仍在实发用户消息的**末尾**（调用层追加块插在其之前）', () => {
    const p = buildUserMessagePrompt({ genType: 'exam', subject: '数学', materialChannel: 'anchor', anchorListText: 'x', instructionText: 'y' });
    const out = applyCallLayerSelfReview(p);
    expect(out.trimEnd().endsWith(TAIL_VARIETY.trim())).toBe(true);
  });
});
