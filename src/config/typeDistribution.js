/**
 * 题型分布建议（Type Distribution）—— 独立配置，UI 题型自动填充用
 * ============================================================
 * 🔴 定位：从 instructionLib「生成-题型分布建议」（71条）迁出。
 *    仅服务 GenerateModule 的 UI 题型自动填充（getTypeDistribution），
 *    不参与生成注入（生成由配方规范块驱动）。
 *    结构：{ subject, stage, genType, typeDist }，typeDist 格式 "题型名:min-max,..."
 * ============================================================
 */

export const TYPE_DISTRIBUTIONS = [
  { id: 'typedist_exam_chinese_primary_low', subject: '语文', stage: 'primary_low', genType: 'exam', typeDist: `拼音与字词基础:4-6,句子运用:3-4,课文理解:2-3,写话/看图写话:1-1` },
  { id: 'typedist_exam_chinese_primary_mid', subject: '语文', stage: 'primary_mid', genType: 'exam', typeDist: `基础知识与运用:5-7,阅读理解:3-4,习作:1-1` },
  { id: 'typedist_exam_chinese_primary_high', subject: '语文', stage: 'primary_high', genType: 'exam', typeDist: `基础知识与运用:5-7,阅读理解:4-5,习作:1-1` },
  { id: 'typedist_exam_chinese_middle', subject: '语文', stage: 'middle', genType: 'exam', typeDist: `基础知识:4-6,文言文阅读:2-3,现代文阅读:4-5,写作:1-1` },
  { id: 'typedist_exam_chinese_high', subject: '语文', stage: 'high', genType: 'exam', typeDist: `现代文阅读:5-6,文言文阅读:3-4,古代诗歌鉴赏:2-3,语言文字运用:3-5,写作:1-1` },
  { id: 'typedist_exam_math_primary_low', subject: '数学', stage: 'primary_low', genType: 'exam', typeDist: `口算/直接写得数:5-6,填空题:4-5,选择题:3-4,计算题:2-3,解决问题:2-3` },
  { id: 'typedist_exam_math_primary_mid', subject: '数学', stage: 'primary_mid', genType: 'exam', typeDist: `填空题:5-6,选择题:4-5,计算题:4-5,操作题:1-2,解决问题:3-4` },
  { id: 'typedist_exam_math_primary_high', subject: '数学', stage: 'primary_high', genType: 'exam', typeDist: `填空题:5-6,选择题:4-5,计算题:5-6,操作题:1-2,解决问题:4-5` },
  { id: 'typedist_exam_math_middle', subject: '数学', stage: 'middle', genType: 'exam', typeDist: `选择题:6-8,填空题:4-6,计算题:3-4,证明/作图题:2-3,应用题/综合题:4-5` },
  { id: 'typedist_exam_math_high', subject: '数学', stage: 'high', genType: 'exam', typeDist: `单选题:8-10,多选题:2-3,填空题:4-5,解答题:5-6` },
  { id: 'typedist_exam_english_primary_low', subject: '英语', stage: 'primary_low', genType: 'exam', typeDist: `看图选词/词汇连线:5-6,选择题:5-6,填空题:4-5,连线/匹配题:3-4` },
  { id: 'typedist_exam_english_primary_mid', subject: '英语', stage: 'primary_mid', genType: 'exam', typeDist: `选择题:6-8,填空题:4-5,阅读理解:4-6,连词成句/句型转换:3-4` },
  { id: 'typedist_exam_english_primary_high', subject: '英语', stage: 'primary_high', genType: 'exam', typeDist: `选择题:6-8,填空题:4-5,阅读理解:6-8,书面表达:1-1` },
  { id: 'typedist_exam_english_middle', subject: '英语', stage: 'middle', genType: 'exam', typeDist: `单项选择:8-10,完形填空:10-10,阅读理解:10-15,任务型阅读:5-5,书面表达:1-1` },
  { id: 'typedist_exam_english_high', subject: '英语', stage: 'high', genType: 'exam', typeDist: `阅读理解:15-20,七选五/完形填空:10-15,语法填空:10-10,书面表达:1-1` },
  { id: 'typedist_exam_science_primary', subject: '科学', stage: 'primary', genType: 'exam', typeDist: `选择题:5-8,填空题:4-6,判断题:3-4,实验探究/简答题:2-3` },
  { id: 'typedist_exam_physics_middle', subject: '物理', stage: 'middle', genType: 'exam', typeDist: `选择题:6-8,填空题:4-6,作图题:2-3,实验探究题:2-3,计算题:3-4` },
  { id: 'typedist_exam_physics_high', subject: '物理', stage: 'high', genType: 'exam', typeDist: `单选题:6-8,多选题:2-3,实验题:2-2,计算题:3-4` },
  { id: 'typedist_exam_chemistry_middle', subject: '化学', stage: 'middle', genType: 'exam', typeDist: `选择题:8-10,填空题:4-6,实验探究题:2-3,计算题:2-3` },
  { id: 'typedist_exam_chemistry_high', subject: '化学', stage: 'high', genType: 'exam', typeDist: `单选题:7-10,不定项选择:2-3,填空题:4-5,实验题:2-2,计算/推断题:3-4` },
  { id: 'typedist_exam_biology_middle', subject: '生物', stage: 'middle', genType: 'exam', typeDist: `选择题:8-10,填空题:4-6,识图分析题:2-3,实验探究题:2-3` },
  { id: 'typedist_exam_history_middle', subject: '历史', stage: 'middle', genType: 'exam', typeDist: `选择题:10-12,材料解析题:2-3,简答/论述题:2-3` },
  { id: 'typedist_exam_history_high', subject: '历史', stage: 'high', genType: 'exam', typeDist: `选择题:12-16,材料解析题:2-3,论述题:1-2` },
  { id: 'typedist_exam_geo_middle', subject: '地理', stage: 'middle', genType: 'exam', typeDist: `选择题:8-10,读图分析题:2-3,综合题:2-3` },
  { id: 'typedist_exam_moral_primary_low', subject: '道德与法治', stage: 'primary_low', genType: 'exam', typeDist: `判断/选择题:4-6,情境简答:2-3` },
  { id: 'typedist_exam_moral_primary_mid', subject: '道德与法治', stage: 'primary_mid', genType: 'exam', typeDist: `选择题:5-7,判断题:3-5,情境分析/简答:2-3` },
  { id: 'typedist_exam_moral_primary_high', subject: '道德与法治', stage: 'primary_high', genType: 'exam', typeDist: `选择题:6-8,判断题:3-5,情境分析/简答:2-3,材料分析题:1-1` },
  { id: 'typedist_exam_moral_middle', subject: '道德与法治', stage: 'middle', genType: 'exam', typeDist: `选择题:8-10,简答题:3-4,材料分析题:2-3` },
  { id: 'typedist_exam_biology_high', subject: '生物', stage: 'high', genType: 'exam', typeDist: `单选题:6-8,不定项选择:2-3,填空题:4-5,识图分析题:2-3,实验探究题:2-3` },
  { id: 'typedist_exam_geo_high', subject: '地理', stage: 'high', genType: 'exam', typeDist: `选择题:8-12,读图分析题:2-3,综合题:3-4` },
  { id: 'typedist_exam_politics_high', subject: '政治,思想政治', stage: 'high', genType: 'exam', typeDist: `选择题:12-16,简答题/辨析题:2-3,材料分析题:2-3,论述题:1-2` },
  { id: 'typedist_exam_it_middle', subject: '信息科技,信息技术', stage: 'middle', genType: 'exam', typeDist: `单选题:8-10,判断题:4-6,操作描述题:2-3,程序设计题:1-2` },
  { id: 'typedist_exam_it_high', subject: '信息科技,信息技术', stage: 'high', genType: 'exam', typeDist: `单选题:8-12,判断题:4-6,操作描述/案例分析题:2-3,程序设计题:1-2` },
  { id: 'typedist_practice_chinese_primary_low', subject: '语文', stage: 'primary_low', genType: 'practice', typeDist: `基础建构任务:6-9,探究进阶任务:4-6,迁移创新任务:2-3` },
  { id: 'typedist_practice_chinese_primary_mid', subject: '语文', stage: 'primary_mid', genType: 'practice', typeDist: `基础建构任务:8-12,探究进阶任务:5-8,迁移创新任务:3-4` },
  { id: 'typedist_practice_chinese_primary_high', subject: '语文', stage: 'primary_high', genType: 'practice', typeDist: `基础建构任务:10-15,探究进阶任务:7-10,迁移创新任务:3-5` },
  { id: 'typedist_practice_chinese_secondary', subject: '语文', stage: 'middle', genType: 'practice', typeDist: `基础建构任务:8-12,探究进阶任务:5-8,迁移创新任务:3-4` },
  { id: 'typedist_practice_math_primary_low', subject: '数学', stage: 'primary_low', genType: 'practice', typeDist: `基础建构任务:6-9,探究进阶任务:4-6,迁移创新任务:2-3` },
  { id: 'typedist_practice_math_primary_mid', subject: '数学', stage: 'primary_mid', genType: 'practice', typeDist: `基础建构任务:8-12,探究进阶任务:5-8,迁移创新任务:3-4` },
  { id: 'typedist_practice_math_primary_high', subject: '数学', stage: 'primary_high', genType: 'practice', typeDist: `基础建构任务:10-15,探究进阶任务:7-10,迁移创新任务:3-5` },
  { id: 'typedist_practice_math_secondary', subject: '数学', stage: 'middle', genType: 'practice', typeDist: `基础建构任务:8-12,探究进阶任务:5-8,迁移创新任务:3-4` },
  { id: 'typedist_practice_english_primary_low', subject: '英语', stage: 'primary_low', genType: 'practice', typeDist: `基础建构任务:6-9,探究进阶任务:4-6,迁移创新任务:2-3` },
  { id: 'typedist_practice_english_primary_mid', subject: '英语', stage: 'primary_mid', genType: 'practice', typeDist: `基础建构任务:8-12,探究进阶任务:5-8,迁移创新任务:3-4` },
  { id: 'typedist_practice_english_primary_high', subject: '英语', stage: 'primary_high', genType: 'practice', typeDist: `基础建构任务:10-15,探究进阶任务:7-10,迁移创新任务:3-5` },
  { id: 'typedist_practice_english_secondary', subject: '英语', stage: 'middle', genType: 'practice', typeDist: `基础建构任务:8-12,探究进阶任务:5-8,迁移创新任务:3-4` },
  { id: 'typedist_practice_science_primary_low', subject: '科学', stage: 'primary_low', genType: 'practice', typeDist: `基础建构任务:5-7,探究进阶任务:3-5,迁移创新任务:2-3` },
  { id: 'typedist_practice_science_primary_mid', subject: '科学', stage: 'primary_mid', genType: 'practice', typeDist: `基础建构任务:6-9,探究进阶任务:4-6,迁移创新任务:2-3` },
  { id: 'typedist_practice_science_primary_high', subject: '科学', stage: 'primary_high', genType: 'practice', typeDist: `基础建构任务:8-11,探究进阶任务:5-7,迁移创新任务:3-4` },
  { id: 'typedist_practice_physics_middle', subject: '物理', stage: 'middle', genType: 'practice', typeDist: `基础建构任务:8-12,探究进阶任务:5-8,迁移创新任务:3-4` },
  { id: 'typedist_practice_physics_high', subject: '物理', stage: 'high', genType: 'practice', typeDist: `基础建构任务:10-15,探究进阶任务:7-10,迁移创新任务:3-5` },
  { id: 'typedist_practice_chemistry_middle', subject: '化学', stage: 'middle', genType: 'practice', typeDist: `基础建构任务:8-12,探究进阶任务:5-8,迁移创新任务:3-4` },
  { id: 'typedist_practice_chemistry_high', subject: '化学', stage: 'high', genType: 'practice', typeDist: `基础建构任务:10-15,探究进阶任务:7-10,迁移创新任务:3-5` },
  { id: 'typedist_practice_biology_middle', subject: '生物', stage: 'middle', genType: 'practice', typeDist: `基础建构任务:8-12,探究进阶任务:5-8,迁移创新任务:3-4` },
  { id: 'typedist_practice_biology_high', subject: '生物', stage: 'high', genType: 'practice', typeDist: `基础建构任务:10-15,探究进阶任务:7-10,迁移创新任务:3-5` },
  { id: 'typedist_practice_history_middle', subject: '历史', stage: 'middle', genType: 'practice', typeDist: `基础建构任务:8-12,探究进阶任务:5-8,迁移创新任务:3-4` },
  { id: 'typedist_practice_history_high', subject: '历史', stage: 'high', genType: 'practice', typeDist: `基础建构任务:10-15,探究进阶任务:7-10,迁移创新任务:3-5` },
  { id: 'typedist_practice_geo_middle', subject: '地理', stage: 'middle', genType: 'practice', typeDist: `基础建构任务:8-12,探究进阶任务:5-8,迁移创新任务:3-4` },
  { id: 'typedist_practice_geo_high', subject: '地理', stage: 'high', genType: 'practice', typeDist: `基础建构任务:10-15,探究进阶任务:7-10,迁移创新任务:3-5` },
  { id: 'typedist_practice_moral_primary_low', subject: '道德与法治', stage: 'primary_low', genType: 'practice', typeDist: `基础建构任务:5-7,探究进阶任务:3-5,迁移创新任务:2-3` },
  { id: 'typedist_practice_moral_primary_mid', subject: '道德与法治', stage: 'primary_mid', genType: 'practice', typeDist: `基础建构任务:6-9,探究进阶任务:4-6,迁移创新任务:2-3` },
  { id: 'typedist_practice_moral_primary_high', subject: '道德与法治', stage: 'primary_high', genType: 'practice', typeDist: `基础建构任务:8-11,探究进阶任务:5-7,迁移创新任务:3-4` },
  { id: 'typedist_practice_moral_middle', subject: '道德与法治', stage: 'middle', genType: 'practice', typeDist: `基础建构任务:8-12,探究进阶任务:5-8,迁移创新任务:3-4` },
  { id: 'typedist_practice_politics_high', subject: '政治,思想政治', stage: 'high', genType: 'practice', typeDist: `基础建构任务:10-15,探究进阶任务:7-10,迁移创新任务:3-5` },
  { id: 'typedist_practice_chinese_high', subject: '语文', stage: 'high', genType: 'practice', typeDist: `基础建构任务:10-15,探究进阶任务:7-10,迁移创新任务:3-5` },
  { id: 'typedist_practice_math_high', subject: '数学', stage: 'high', genType: 'practice', typeDist: `基础建构任务:10-15,探究进阶任务:7-10,迁移创新任务:3-5` },
  { id: 'typedist_practice_english_high', subject: '英语', stage: 'high', genType: 'practice', typeDist: `基础建构任务:10-15,探究进阶任务:7-10,迁移创新任务:3-5` },
  { id: 'typedist_practice_it_primary_low', subject: '信息科技,信息技术', stage: 'primary_low', genType: 'practice', typeDist: `基础建构任务:5-7,探究进阶任务:3-5,迁移创新任务:2-3` },
  { id: 'typedist_practice_it_primary_mid', subject: '信息科技,信息技术', stage: 'primary_mid', genType: 'practice', typeDist: `基础建构任务:6-9,探究进阶任务:4-6,迁移创新任务:2-3` },
  { id: 'typedist_practice_it_primary_high', subject: '信息科技,信息技术', stage: 'primary_high', genType: 'practice', typeDist: `基础建构任务:8-11,探究进阶任务:5-7,迁移创新任务:3-4` },
  { id: 'typedist_practice_it_middle', subject: '信息科技,信息技术', stage: 'middle', genType: 'practice', typeDist: `基础建构任务:8-12,探究进阶任务:5-8,迁移创新任务:3-4` },
  { id: 'typedist_practice_it_high', subject: '信息科技,信息技术', stage: 'high', genType: 'practice', typeDist: `基础建构任务:10-15,探究进阶任务:7-10,迁移创新任务:3-5` },
];

/**
 * 按三维度查询题型分布（与旧 getMatchingBlockInstructions 语义对齐）
 */
export function getTypeDistribution({ genType = '', subject = '', stage = '' } = {}) {
  return TYPE_DISTRIBUTIONS.filter(d =>
    (!d.genType || d.genType.split(',').includes(genType)) &&
    (!d.subject || d.subject.split(',').map(s => s.trim()).includes(subject)) &&
    (!d.stage || d.stage.split(',').some(s => {
      if (s === 'primary') return ['primary_low', 'primary_mid', 'primary_high', 'primary'].includes(stage);
      return s === stage;
    }))
  );
}

export default { TYPE_DISTRIBUTIONS, getTypeDistribution };
