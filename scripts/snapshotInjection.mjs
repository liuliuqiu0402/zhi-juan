#!/usr/bin/env node
/**
 * 注入快照（批 A 前置工具 · v2）
 * ============================================================
 * 目的：把"某类型**实际会注入给模型**的文本"装配后落成文件，供 L1 计数使用。
 * 判准见 `docs/audit/事务聚类与探针表-2026-10-11.md` §八：
 *   "一处"指**注入后的最终 prompt**，不是源码——同一事务的决定句在注入文本里须**恰出现 1 次**。
 *
 * v2 更正（2026-10-11，v1 有致命缺漏，必须重取基准）：
 *   ✗ v1 未把**委托正文**（模板正文，实发主体）传入装配 —— 快照漏掉最大一段；
 *     且 buildProgramAttach 未传 instructionText → floorClauseSections 的**段级兜底全部触发**，
 *     把【质量底线】等整段注入 system —— 而真实装配中模板已含这些段、兜底不触发。
 *     两处叠加 ⇒ v1 快照**既漏又增**，T01–T04 计数不成立。
 *   ✓ v2 逐字复刻真实装配链（与 tests/config/intraRequestDuplicate.test.js 的 buildCells 同口径）：
 *     委托正文 = buildInjectionInstruction({template: tpl.template, ...})（占位符替换 + 任务行）
 *     system  = buildProgramAttach({subject, stageKey, genType, instructionText})  ← 必须传正文
 *     用户消息 = buildUserMessagePrompt({..., instructionText})                    ← 必须传正文
 *     教辅段   = buildTeachingInjection(...)（仅非 exam）
 *     调用层   = buildCallLayerBlocks()（当前为空数组，D16 后）
 *
 * 用法：
 *   node scripts/snapshotInjection.mjs type=exam subject=语文 stage=primary_high grade=三年级
 */
import fs from 'node:fs';
import path from 'node:path';

import { getPromptTemplate, buildInjectionInstruction, buildStructureText, GEN_TYPE_NAMES } from '../src/config/promptLibrary.js';
import { styleInstructions } from '../src/config/expertKnowledge.js';
import { buildTeachingInjection } from '../src/config/teachingBlueprints.js';
import { buildUserMessagePrompt, buildCallLayerBlocks } from '../src/utils/injectionManifest.js';
import { buildProgramAttach } from '../src/utils/programAttach.js';
import { materialChannelOf } from '../src/config/coverageContract.js';
import { buildLevelInstruction } from '../src/config/levelMapping.js';
import { buildSpecialDomainAnchorLine } from '../src/config/specialDomains.js';
import { anchorListRoleNote } from '../src/utils/anchorTreeContract.js';
import { buildRenderContract } from '../src/config/eduRenderContract.js';

const arg = (k, d) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(k + '='));
  return hit ? hit.slice(k.length + 1) : d;
};

const genType = arg('type', 'exam');
const subject = arg('subject', '语文');
const stage = arg('stage', 'primary_high');
const grade = arg('grade', '三年级');

const warn = [];
const parts = [];
const push = (label, fn) => {
  try {
    const t = String(fn() || '').trim();
    if (t) parts.push(`\n\n===== ${label} =====\n${t}`);
    else warn.push(`${label}: 空`);
  } catch (e) {
    warn.push(`${label}: ${e.message}`);
  }
};

// 1) 模板 + 卷面结构（蓝图缺省不影响判据计数，仅卷面结构回退）
const tpl = getPromptTemplate({ grade: stage, subject, genType });
let structure = '';
let fullScore = '';
let duration = '';
try {
  const { findBlueprint } = await import('../src/config/blueprintProvider.js');
  const bp = findBlueprint({ genType, subject, stage, region: '', scopeType: '' });
  if (bp) { structure = buildStructureText(bp); fullScore = bp.fullScore || ''; duration = bp.duration || ''; }
} catch (e) { warn.push(`蓝图: ${e.message}`); }

const materialChannel = materialChannelOf(genType) || 'full';

// 2) 委托正文（= 实发主体，v1 漏此段）
const instructionText = buildInjectionInstruction({
  template: tpl.template,
  grade,
  stage,
  subject,
  genTypeLabel: GEN_TYPE_NAMES[genType] || genType,
  label: '',
  structure,
  fullScore,
  duration,
  genType,
  materialChannel,
});

// ⚠️ 委托正文**不单独成段**：它就在 user 消息的 instruction 指针块里（v2 若另 push 会双计）。
push('user · 消息全文（含委托正文）', () => buildUserMessagePrompt({
  genType, subject, materialChannel,
  anchorListText: '一、主题\n· 知识点。',
  instructionText,
}));
push('system · 程序附加段', () => buildProgramAttach({ subject, stageKey: stage, genType, instructionText }));
if (genType !== 'exam') push('教辅 · 结构注入', () => buildTeachingInjection({ genType, stage, subject }));
push('调用层 · 追加块', () => buildCallLayerBlocks().map((b) => b.text).join('\n'));

const text = parts.join('');

const outDir = path.resolve('docs/audit/snapshot');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${genType}-${subject}-${stage}.txt`);
fs.writeFileSync(outFile, text, 'utf8');

// —— L1 锚 ——计数对象＝**注入后的最终文本**
// 口径（属主判准·探针表 §八）：同一事务的**决定句**在注入文本里须**恰出现 1 次**；
//   被收敛/删除的旧字面须**零出现**（L2 反向锁）。{ re, expect }：expect 为期望命中次数。
const ANCHORS = [
  // T01 唯一性与数量
  { name: 'T01·正句（唯一性判据）', re: /两处可互相替代才算重复/g, expect: 1 },
  { name: 'T01·清零（旧表述）', re: /同一大题内同型小题也只作一题|不扎堆反复出现|尤其不得雷同|题量以委托书为准|不得复现相同材料|同一大类内不得拆成多道大题|同一知识点在同一资料内不得重复考查/g, expect: 0 },
  // T02 编号·序号·组标题（小题号编法应为 0；大题序号"全卷连续"属主裁定**保留**）
  { name: 'T02·小题号编法（应 0）', re: /小题号[^。；]{0,24}连续|按栏目[^。；]{0,8}起编|不得跳号|同号同序/g, expect: 0 },
  { name: 'T02·大题序号全卷连续（保留，应 ≥1）', re: /大题序号[^。；]{0,10}全卷连续/g, expect: 1 },
  { name: 'T02·清零（旧表述：术语映射元句／观察者口吻／否定式／内联复述）', re: /凡条款中出现|看得出成组的层次|不得重新从「一、」开始|同型并列只作一题|每板块/g, expect: 0 },
  // T18 考查方式（决定句：技能训练型重在准确熟练／理解运用型重在推理、说理与迁移）
  { name: 'T18·正句（设问分型）', re: /技能训练型/g, expect: 1 },
  { name: 'T18·清零（旧表述）', re: /不靠记忆|逐题各有考查侧重|展示理解/g, expect: 0 },
  // T06 内容型↔题类边界（串味）
  { name: 'T06·中性例证（通用句不含题类专属"待选项"）', re: /待选项/g, expect: 0 },
  { name: 'T06·文字规范中性句', re: /凡出现汉字处一律用简体/g, expect: 1 },
  { name: 'T06·清零（旧"一律用**简体汉字**"）', re: /一律用\*\*简体汉字\*\*/g, expect: 0 },
  // T07 教材原文来源与可用性
  { name: 'T07·正句（不得照搬教材原题）', re: /不得照搬教材原题/g, expect: 1 },
  { name: 'T07·清零（三域"不限所选教材"／G79 三项）', re: /不限所选教材|情节、篇目结构与人物设定/g, expect: 0 },
  // T03 计分对象·单价·账目
  { name: 'T03·正句（计分对象＝判分处）', re: /计分对象＝学生每答对一处即得 X 分/g, expect: 1 },
  { name: 'T03·G61 可判法（单位＝作答对象的名称）', re: /单位取["“]该处让学生作答什么["”]的名称/g, expect: 1 },
  { name: 'T03·清零（载体块内 exam 专属计分句／旧"通称"／同义并置）', re: /（正式考卷）\*\*书写类题按单位|不写承载它的线条／括号等形态名|分值标注（大题级与小题级）一律由正文分值条单源承载/g, expect: 0 },
  // T08 答案区·答案角色
  { name: 'T08·正句（例题示范：解答随题即时展示）', re: /其解答与解析随例题即时展示/g, expect: 1 },
  { name: 'T08·正句（答案回填在例题自身作答位上·单源）', re: /答案即回填在例题自身的作答位上/g, expect: 1 },
  { name: 'T08·清零（旧措辞／重复正句／自检壳）', re: /可随例题即时展示解答与解析|应在例题下即时展示完整解答与解析|答案已回填进它自己的作答位上|作答形态（作答载体）\*\*原样保留\*\*|一处不附即为不合格/g, expect: 0 },
  // T05 强调·标记·标记有效性
  { name: 'T05·题类强调口径正句', re: /题面不承载["“]强调["”]/g, expect: 1 },
  { name: 'T05·G84 ⑰ 就地写清禁标对象', re: /禁标的是答案本身/g, expect: 1 },
  { name: 'T05·清零（例外句／“突出重点才用加粗”括号复述）', re: /不受“材料中不得标出待作答内容”条限制|（突出“重点”才用加粗）/g, expect: 0 },
  // T16 压缩·续写·注入腔
  { name: 'T16·清零（复核壳／自认多源句／逐部分换版式／当场改壳）', re: /定稿前逐节逐题按下面三域复核|以上细目即【尾约束·全文自洽】三域|逐部分、逐单元换一套版式|凡有即当场改/g, expect: 0 },
  { name: 'T16·题类不注入三域（本快照＝exam）', re: /【尾约束·全文自洽】/g, expect: 0 },
  { name: 'T16·尾约束·资料内多样仍在', re: /【尾约束·资料内多样】/g, expect: 1 },
  // T04 空位·作答载体·篇幅
  { name: 'T04·正句（三处同位）', re: /待答之处＝空位之处＝载体之处/g, expect: 1 },
  { name: 'T04·正句（强调用的 <u> 与空位载体两分）', re: /正文不出现用于强调的 <u>/g, expect: 1 },
  { name: 'T04·清零（旧表述）', re: /正文不出现 <u>|（本条为准）|以其为准|格内留空|学科协议|严禁按题的先后递增/g, expect: 0 },
  // T10 情境（取向·落点·学段冲突）
  { name: 'T10·G29 不超学段（单源在【质量底线】，恰 1）', re: /不超学段/g, expect: 1 },
  { name: 'T10·G29 清零（学段表"不超学段："分档尾）', re: /不超学段：/g, expect: 0 },
  { name: 'T10·G30 清零（"情境真实、适切"多源广播）', re: /情境真实、适切|真实、适切的情境/g, expect: 0 },
  { name: 'T10·G15 作用域界定（含取向词的档恰 1；其余 0）', re: /本取向只作用于情境取材与难度起点/g, expect: stage === 'primary_low' ? 1 : 0 },
  // T11 蓝图·栏目（命名·组织·覆盖·换肤）—— 教辅锚按 genType 计（exam 不注入教辅结构块）
  { name: 'T11·G24 块头语义锚（内容归属参考…非分类标准）', re: /栏目的\*\*内容归属参考\*\*/g, expect: (genType === 'exam' || genType === 'errorbook') ? 0 : 1 },
  { name: 'T11·G24 清零（"活动类型与素养划分"旧称谓）', re: /的活动类型与素养划分/g, expect: 0 },
  { name: 'T11·G34 知识框架分工（选用导图式时改用导图块）', re: /选用「导图式」呈现风格时改用导图块/g, expect: genType === 'summary' ? 1 : 0 },
  { name: 'T11·G35 清零（errorbook"按…错因分类"）', re: /按知识点或错因分类/g, expect: 0 },
  { name: 'T11·G35 正句（按知识点或易错点分块）', re: /按\*\*知识点或易错点分块\*\*/g, expect: genType === 'errorbook' ? 1 : 0 },
  { name: 'T11·G36 设题判据同源（不可直接在原文找到原句答案）', re: /不可直接在原文找到原句答案/g, expect: genType === 'reading' ? 1 : 0 },
  { name: 'T11·G37 清零（dictation 学段注重复"含易错点"）', re: /单元要求掌握的内容都涉及到，含易错点/g, expect: 0 },
  { name: 'T11·G40 清零（栏位注配图/图形标记形态句）', re: /须给出配图标记|须给出图形标记/g, expect: 0 },
  { name: 'T11·G41 清零（"由你按本卷内容选用/自定"）', re: /由你按本卷内容/g, expect: 0 },
  { name: 'T11·G58 perItem 用单源全名', re: /其中「题目呈现」是讲解示范的题/g, expect: genType === 'errorbook' ? 1 : 0 },
  { name: 'T11·G58 清零（简称"题目/变式"指称）', re: /其中"题目"是讲解示范的题/g, expect: 0 },
  // T19 覆盖口径（全量 vs 抽样）
  { name: 'T19·G9 清零（卷面"本单元…内容都涉及到"＝全量口径）', re: /本单元[^，。；：]{0,20}内容都涉及到/g, expect: 0 },
  { name: 'T19·G9 抽样口径正句（语文 primary_low 卷面恰 2）', re: /领域的代表性知识点（抽样命题，不要求全量）/g, expect: (genType === 'exam' && subject === '语文' && stage === 'primary_low') ? 2 : 0 },
  { name: 'T19·G39 清零（"综合自测"栏复述覆盖口径）', re: /自测，本单元知识点都涉及到/g, expect: 0 },
  // T12 跨块指针（假指针清零）
  { name: 'T12·G49 清零（"清单所列要点"）', re: /清单所列要点/g, expect: 0 },
  { name: 'T12·G49 正句（本次范围所列要点）', re: /本次范围所列要点/g, expect: 1 },
  { name: 'T12·G50 清零（"见创作要求"跨块指针）', re: /见创作要求/g, expect: 0 },
  { name: 'T12·G53 清零（"【情境边界】"假块名）', re: /【情境边界】/g, expect: 0 },
  { name: 'T12·G54 清零（"不超该水平要求"悬空半句）', re: /不超该水平要求/g, expect: 0 },
  { name: 'T12·G55 清零（"学科×学段 课标要点"未点名描述）', re: /学科×学段 课标要点/g, expect: 0 },
  { name: 'T12·G98 清零（"见委托书【素材使用约定】"跨块指针）', re: /见委托书【素材使用约定】/g, expect: 0 },
  // T13 表述精准化（兜底句·元话语·无锚）
  { name: 'T13·G12 清零（"本条优先于一切通用表述"）', re: /本条优先于一切通用表述/g, expect: 0 },
  { name: 'T13·G14 清零（"本条是硬约束"／"以本条为准"）', re: /本条是硬约束|以本条为准/g, expect: 0 },
  { name: 'T13·G59 清零（"不存在…清单"式元话语）', re: /不存在[“"]允许的形态清单[”"]|不存在[“"]图依赖措辞清单[”"]/g, expect: 0 },
  { name: 'T13·G64 清零（"不宜在原文找现成字面答案"）', re: /不宜在原文找现成字面答案/g, expect: 0 },
  { name: 'T13·G64 正句（设问须有归纳/推断/表达层级）', re: /设问须有\*\*归纳、推断或表达\*\*层级/g, expect: genType === 'reading' ? 1 : 0 },
  { name: 'T13·G70 清零（"按需输出"／箭头比例机制解释）', re: /按需输出|渲染端按大小成比例定箭头长度/g, expect: 0 },
  { name: 'T13·G73 清零（听力句子无阈值／按锚自行组织／字号基线成因／不超该水平）', re: /句子不宜过长|按锚自行组织|字号\/基线不统一|不超该水平要求/g, expect: 0 },
  { name: 'T13·G82 清零（"主题相关、难度适切"）', re: /主题相关、难度适切/g, expect: 0 },
  { name: 'T13·G82 正句（与本资料主题一致、难度合本学段）', re: /与本资料主题一致、难度合本学段/g, expect: 1 },
  { name: 'T13·G95 清零（无锚语"可写、可判"）', re: /可写、可判/g, expect: 0 },
  { name: 'T13·G96 清零（层号元描述"第N层"）', re: /第1层|第2层|第3层/g, expect: 0 },
  { name: 'T13·G101 清零（"此处不另立"元话语）', re: /此处不另立/g, expect: 0 },
  // ⚠️ `以本条为准`（选项题硬约束条）属 **G14 / T13**（批次 D），**不计入 T04**——故不列入上式。
];

console.log(`快照：${outFile}`);
console.log(`字数：${text.length}｜各段：${parts.length}`);
if (warn.length) console.log(`⚠️ ${warn.join(' | ')}`);
console.log('—— L1 计数（口径：注入后的最终文本）——');
for (const a of ANCHORS) {
  const hits = (text.match(a.re) || []).length;
  const ok = a.expect === hits ? '✓' : '✗';
  console.log(`${ok} ${a.name}: ${hits}（期望 ${a.expect}）`);
}
// —— L2 互斥探针（G5·数学档）：「不以机械套算」须与**类型豁免**同现，否则对默写/运算训练过度 ——
if (text.includes('不以机械套算')) {
  const ok = text.includes('以熟练为目的的运算训练不作此要求');
  console.log(`${ok ? '✓' : '✗'} T18·G5·L2：「不以机械套算」× 类型豁免句 同现 = ${ok}`);
}
// —— T10·G66/G67 风格注入句源（风格非默认注入 → 单独扫 styleInstructions 的**值**，不扫源码注释）——
const styleText = Object.values(styleInstructions).join('\n');
const STYLE_ANCHORS = [
  { name: 'T10·G66 空锚清零（"情境类型锚"／"取向依课标"）', re: /本学科课程标准界定的情境类型|情境取向依本学科本学段的课标要求/g, expect: 0 },
  { name: 'T10·G67 无锚语清零（一眼可读／层级不宜过深／不做形式化包装／清晰易读／重点突出）', re: /一眼可读|层级不宜过深|不做形式化包装|清晰易读|重点突出/g, expect: 0 },
];
console.log('—— L1 计数（styleInstructions 值域）——');
for (const a of STYLE_ANCHORS) {
  const hits = (styleText.match(a.re) || []).length;
  const ok = a.expect === hits ? '✓' : '✗';
  console.log(`${ok} ${a.name}: ${hits}（期望 ${a.expect}）`);
}
// —— T19·G39 互斥探针：同一教辅注入内「覆盖口径」恰 1 处（review 为样本）——
if (genType === 'review') {
  const n = (text.match(/都涉及到/g) || []).length;
  console.log(`${n === 1 ? '✓' : '✗'} T19·G39·L2：review 覆盖口径出现 ${n} 处（期望 1）`);
}
// —— T12 假指针探针（三处**不在本快照装配链**里的注入面：直接调其构造入口核字面）——
const lv = buildLevelInstruction({ stage: 'high', subject: '物理', genType: 'exam', scopeType: 'gaokao' });
console.log(`${!lv.includes('不超该水平要求') ? '✓' : '✗'} T12·G54·L2：水平块不再含悬空难度要求 → 「${lv}」`);
const dl = buildSpecialDomainAnchorLine({ anchor: '示例锚', key: '示例领域' });
console.log(`${dl.includes('【〈学科〉·〈学段〉要点】') && !dl.includes('学科×学段 课标要点') ? '✓' : '✗'} T12·G55·L2：领域锚句点真块名 → 「${dl}」`);
const rn = anchorListRoleNote();
console.log(`${!rn.includes('见委托书【素材使用约定】') ? '✓' : '✗'} T12·G98·L2：清单角色说明无跨块指针`);
const genSrc = fs.readFileSync(path.resolve('src/composables/useAiGenerator.js'), 'utf8');
const cf = (genSrc.match(/contextFramework = `([\s\S]*?)`;/) || [])[1] || '';
console.log(`${cf.includes('【情境与页码】的情境边界条') && !cf.includes('【情境边界】') ? '✓' : '✗'} T12·G53·L2：情境框架块引真块名（【情境与页码】）`);
// —— T13·G70：渲染指令段头（system 侧，不在本快照装配链）——
const rcText = buildRenderContract({ subject: '物理', stage: 'middle' });
console.log(`${rcText.includes('【渲染指令】') && !rcText.includes('按需输出') && !rcText.includes('编造比例') ? '✓' : '✗'} T13·G70·L2：渲染指令段头只留【渲染指令】＋无机制解释`);
