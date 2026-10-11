// 覆盖率"分母"实测：从代码的**唯一事实源**推出 三维度基数 / 份数分母 / 句次规模
// 目的：不采信任何文档里的手抄数字（675／5,400／128 万曾被写错），一律由 src 实测。
import { STAGE_SUBJECTS, BUILTIN_TEMPLATES } from '../src/config/promptLibrary.js';
import { styleOptions } from '../src/config/expertKnowledge.js';

const GEN_TYPES = ['exam', 'practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review'];
const STAGES = Object.keys(STAGE_SUBJECTS);

// ① 实际开设的"学科×学段"对（唯一事实源 STAGE_SUBJECTS）
let pairs = 0;
for (const st of STAGES) for (const _ of STAGE_SUBJECTS[st]) pairs++;

// ② 三维度 cell（唯一事实源 BUILTIN_TEMPLATES 的 'subject|stage|genType' 键）
const cells = Object.keys(BUILTIN_TEMPLATES).filter((k) => (k.match(/\|/g) || []).length === 2);
const perType = {};
for (const k of cells) { const t = k.split('|')[2]; perType[t] = (perType[t] || 0) + 1; }

// ③ 配置分支（生成方式 × 素材通道 × 第3层注入）
const CFG = 2 * 2 * 2;

// ④ 组织风格分支：逐类型 = 适用该类型的风格选项数 + 1（“不选/默认”分支）
const styleByType = {};
let styleSum = 0;
for (const t of GEN_TYPES) {
  const n = styleOptions.filter((o) => !o.appliesTo || o.appliesTo.includes(t)).length + 1;
  styleByType[t] = n; styleSum += n;
}

const AVG_SENT = 238; // 进度账实测（完整装配类 1–4、不含素材）

console.log('—— ① 实际开设的"学科×学段"对（STAGE_SUBJECTS）——');
for (const st of STAGES) console.log(`  ${st}: ${STAGE_SUBJECTS[st].length} 科 → ${STAGE_SUBJECTS[st].join('、')}`);
console.log(`  合计 = ${pairs}｜文档记 54 → ${pairs === 54 ? '✓ 一致' : '✗ 不一致'}`);
console.log(`  笛卡尔网格 5 学段×15 学科 = ${5 * 15} 对；不存在组合 = ${5 * 15 - pairs} 对 = ${(5 * 15 - pairs) * GEN_TYPES.length} 个 cell（§2.5 的“189”是 **cell 单位** = 21 对 × 9 类型 → ${(5 * 15 - pairs) * GEN_TYPES.length === 189 ? '✓ 一致（单位不同，勿误判）' : '✗ 不一致'}）`);

console.log('\n—— ② 三维度 cell（BUILTIN_TEMPLATES）——');
console.log(`  cell 数 = ${cells.length}｜文档记 486 → ${cells.length === 486 ? '✓ 一致' : '✗ 不一致'}`);
console.log('  逐类型：' + GEN_TYPES.map((t) => `${t} ${perType[t] || 0}`).join('／'));
const miss = GEN_TYPES.filter((t) => (perType[t] || 0) !== pairs);
console.log(`  每类型应 = ${pairs}（= 学科×学段对数）→ ${miss.length === 0 ? '✓ 全部一致' : '✗ 偏差：' + miss.join('、')}`);

console.log('\n—— ③④ 份数分母 ——');
console.log(`  配置分支 = ${CFG}（split/once × anchor/full × 三层 on/off）`);
console.log('  组织风格分支（逐类型 = 适用选项 + 1）：' + GEN_TYPES.map((t) => `${t} ${styleByType[t]}`).join('／'));
console.log(`  Σ = ${styleSum}｜进度账记 31 → ${styleSum === 31 ? '✓ 一致' : '✗ 不一致（须核 appliesTo 取法，勿以文档硬填）'}`);
const denom = pairs * CFG * styleSum;
console.log(`  🔴 份数分母 = ${pairs} × ${CFG} × ${styleSum} = ${denom}｜进度账记 13,392 → ${denom === 13392 ? '✓ 一致' : '（以实测为准）'}`);
console.log('  逐类型份数：' + GEN_TYPES.map((t) => `${t} ${pairs * CFG * styleByType[t]}`).join('／'));
console.log(`  🔴 句次规模 = ${denom} × ${AVG_SENT} 句 ≈ ${(denom * AVG_SENT / 10000).toFixed(1)} 万句次（原“128 万”随分母订正作废）`);
console.log('\n  另：独立调用 10 类（答案页／听力抽取／听力翻译／压缩 map／压缩 fold／教材分析提取／知识图谱构建／教材页知识点提取／统一情境生成／变题生成）');
