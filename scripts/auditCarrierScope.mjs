#!/usr/bin/env node
/**
 * 全局生效核验：作答要求载体（**不只 486 面**）
 * ============================================================
 * 用途：改完"标题／说明行"族判据后，回答"改动只在我测的那几个面上生效，还是全局？"
 * 口径：9 资料类型 × 54 真实开设对 × 该类型**全部风格分支** × 素材通道 2（anchor/full）
 *   ⇒ 实际装配 3,348 份，逐份断言：
 *     · 旧载体五句 **0 命中**（回潮即 exit 1）；
 *     · exam：含"其下不再另起说明行"＋"落实为标题里的作答方式"；
 *     · 教辅题类（practice/special/reading/dictation/review）：含"题内不复述组标题"；
 *     · 非内容型：含"编号对象："（内容型按设计门控缺席）。
 *   不适用：errorbook（块标题层、无组标题）；summary/preview（内容型、无题号层）。
 * 用法：`node scripts/auditCarrierScope.mjs`
 * 与测试的关系：`tests/config/answerRequirementCarrier.test.js` 锁 486 面（快、随 npm test 跑）；
 *   本脚本补上风格／通道分支的展开，作为"全局生效"的可复跑证据。
 */
import { buildInstructionText, PAIRS } from './instructionText.mjs';
import { GEN_TYPE_KEYS } from '../src/config/toolLibrary.js';
import { styleOptionsForType } from '../src/config/expertKnowledge.js';

const OLD = [
  '在本大题级统一给出',
  '其下不再另起作答说明',
  '小组标题或说明',
  '按行分组',
  '不写进标题',
  '作答说明可在本大题内统一给出',
];
const CONTENT = new Set(['summary', 'preview']);
const TEACHING = new Set(['practice', 'special', 'reading', 'dictation', 'review']);

const styles = (t) => ['（默认）', ...styleOptionsForType(t).options.map((o) => o.value)];
const styleArg = (s) => (s === '（默认）' ? '' : s);

let cells = 0;
const bad = [];
const missing = [];
const byType = new Map();

for (const genType of GEN_TYPE_KEYS) {
  const rec = { cells: 0, oldHits: 0, carrierOk: 0, qocOk: 0 };
  for (const { stage, subject } of PAIRS) {
    for (const st of styles(genType)) {
      for (const channel of ['anchor', 'full']) {
        const text = buildInstructionText(genType, subject, stage, { style: styleArg(st), materialChannel: channel });
        cells += 1; rec.cells += 1;
        const tag = `${genType}|${subject}|${stage}|${st}|${channel}`;
        for (const o of OLD) if (text.includes(o)) { rec.oldHits += 1; bad.push(`${tag} ⇒ ${o}`); }
        if (genType === 'exam') {
          const ok = text.includes('其下不再另起说明行') && text.includes('落实为标题里的作答方式');
          if (ok) rec.carrierOk += 1; else missing.push(`${tag} ⇒ exam 标题单源`);
        } else if (TEACHING.has(genType)) {
          if (text.includes('题内不复述组标题')) rec.carrierOk += 1;
          else missing.push(`${tag} ⇒ 教辅组标题单源`);
        } else {
          rec.carrierOk += 1; // 内容型 / errorbook：不适用（另有边界锁）
        }
        if (!CONTENT.has(genType)) {
          if (text.includes('编号对象：')) rec.qocOk += 1;
          else missing.push(`${tag} ⇒ 编号对象口径缺席`);
        } else rec.qocOk += 1;
      }
    }
  }
  byType.set(genType, rec);
}

console.log(`组合数：${cells}（9 类型 × 54 开设对 × 风格分支 × 通道 2）`);
console.log('类型\t组合\t旧载体命中\t载体单源\t编号对象');
for (const [t, r] of byType) {
  console.log(`${t}\t${r.cells}\t${r.oldHits}\t${r.carrierOk}/${r.cells}\t${r.qocOk}/${r.cells}`);
}
console.log(`旧载体命中合计：${bad.length}`);
if (bad.length) console.log(bad.slice(0, 8).join('\n'));
console.log(`新判据缺席合计：${missing.length}`);
if (missing.length) console.log(missing.slice(0, 8).join('\n'));
process.exit(bad.length || missing.length ? 1 : 0);
