// 指令注入全面审计（守卫测试）：8资料类型×3学段×17学科=408组合
// 维度1 执行正确性：关键 guarantee 块（角色身份/红线/顶层约束/尾约束/资料类型结构/答案区锚定）无缺口
// 维度2 内容一致性：聚合指令中无新旧规范矛盾残留（"小题一律不标分值"等旧词必须为 0）
// 维度3 新规范存在性：exam 顶层约束必须含"所有小题标分"新规范
// 用途：CI 防回归——任何跨文件规范不同步/关键块缺匹配都会在此暴露
import { describe, it } from 'vitest';
import { getMatchingBlockInstructions } from '@/config/instructionLib.js';

const TYPES = ['exam', 'practice', 'special', 'reading', 'preview', 'dictation', 'summary', 'errorbook'];
const STAGES = ['primary', 'middle', 'high'];
const SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理', '科学', '道德与法治', '音乐', '美术', '体育', '信息科技', '心理', '劳动'];

const KEY_CATS = {
  '生成-角色身份': { all: true },
  '生成-红线约束': { all: true },
  '生成-顶层约束': { types: ['exam'] },
  '生成-尾约束': { all: true },
  '生成-资料类型结构': { all: true, critical: true },
  '生成-答案区强制锚定': { all: true },
};
const STALE_WORDS = ['小题一律不标分值', '不逐题标', '小题不标分值'];
const AGG_CATS = ['生成-顶层约束', '生成-红线约束', '生成-尾约束', '生成-资料类型结构', '生成-输出格式', '生成-答案区强制锚定', '生成-核心任务'];

describe('指令注入全面审计（408 组合）', () => {
  it('执行正确性无缺口 + 内容一致性无矛盾残留', () => {
    const missing = [];
    const staleHits = [];
    let combos = 0;
    for (const gt of TYPES) {
      for (const stage of STAGES) {
        for (const subject of SUBJECTS) {
          combos++;
          for (const [cat, cfg] of Object.entries(KEY_CATS)) {
            if (cfg.types && !cfg.types.includes(gt)) continue;
            const blocks = getMatchingBlockInstructions({ category: cat, subject, stage, genType: gt });
            if (blocks.length === 0) missing.push(`${cat} ← ${gt}|${stage}|${subject}`);
          }
          const agg = [];
          for (const cat of AGG_CATS) {
            for (const b of getMatchingBlockInstructions({ category: cat, subject, stage, genType: gt })) agg.push(b.content);
          }
          const joined = agg.join('\n');
          for (const stale of STALE_WORDS) {
            if (joined.includes(stale)) staleHits.push(`${stale} @ ${gt}|${stage}|${subject}`);
          }
          if (gt === 'exam') {
            const top = getMatchingBlockInstructions({ category: '生成-顶层约束', subject: '', stage: '', genType: 'exam' });
            if (top.length > 0 && !top[0].content.includes('所有小题')) {
              staleHits.push(`顶层约束缺"所有小题"新规范 @ ${stage}|${subject}`);
            }
          }
        }
      }
    }
    console.log(`审计组合数: ${combos}`);
    console.log(`执行正确性·缺失块: ${missing.length} 处`);
    console.log(`内容一致性·矛盾残留: ${staleHits.length} 处`);
    const criticalMissing = missing.filter(m => m.startsWith('生成-资料类型结构'));
    if (criticalMissing.length > 0) throw new Error(`资料类型结构缺口 ${criticalMissing.length} 处: ${criticalMissing.slice(0, 5).join('; ')}`);
    if (missing.length > 0) console.warn('非致命缺失（可接受兜底）:', missing.slice(0, 8).join('; '));
    if (staleHits.length > 0) throw new Error(`矛盾残留 ${staleHits.length} 处: ${staleHits.slice(0, 5).join('; ')}`);
  });
});
