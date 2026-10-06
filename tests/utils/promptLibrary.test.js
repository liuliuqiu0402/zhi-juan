import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getPromptTemplate, buildInjectionInstruction, CURRICULUM_BY_STAGE, getCurriculumLabel, SUBJECT_STAGE_EXTRAS, STAGE_EXAM_EXTRAS, STAGE_TEACHING_EXTRAS, ANSWER_ROLES, PAPER_OUTPUT_CONVENTIONS, buildAnswerFormatSpec, NUMBERING_HIERARCHY_RULE, QUESTION_NUMBERING_CALIBER, GROUP_TITLE_NUMBERING_CALIBER } from '../../src/config/promptLibrary.js';
import { TEACHING_SUBJECT_BLUEPRINTS } from '../../src/config/teachingBlueprints.js';
import { styleInstructions, styleOptions, DEFAULT_STYLE_BY_TYPE } from '../../src/config/expertKnowledge.js';
import { getValidatorRule } from '../../src/config/validatorRules.js';

const ROOT = path.resolve(__dirname, '../../');

/**
 * 课标版本按学段注入（可查可引用）：
 * 义务教育（小学低/中/高段、初中）=《义务教育课程方案和课程标准（2022年版）》
 * 高中 =《普通高中课程标准（2017年版2020年修订）》
 * 模板正文通过 {curriculum} 占位符注入，禁止写死版本号（防高中错用 2022 版、防"学习任务群"等
 * 语文课标概念套用到其他学科）。
 */
describe('promptLibrary 课标版本按学段注入', () => {
  it('CURRICULUM_BY_STAGE：义务教育 5 学段统一 2022 年版，高中为 2017/2020 修订版', () => {
    expect(CURRICULUM_BY_STAGE.primary_low).toBe('2022年版义务教育课程标准');
    expect(CURRICULUM_BY_STAGE.primary_mid).toBe('2022年版义务教育课程标准');
    expect(CURRICULUM_BY_STAGE.primary_high).toBe('2022年版义务教育课程标准');
    expect(CURRICULUM_BY_STAGE.middle).toBe('2022年版义务教育课程标准');
    expect(CURRICULUM_BY_STAGE.high).toBe('《普通高中课程标准（2017年版2020年修订）》');
  });

  it('高中 exam 模板：注入《普通高中课程标准（2017年版2020年修订）》', () => {
    const tpl = getPromptTemplate({ grade: 'high', subject: '数学', genType: 'exam' });
    expect(tpl.template).toContain('依据《普通高中课程标准（2017年版2020年修订）》命题');
    expect(tpl.template).not.toContain('2022年版义务教育课程标准');
  });

  it('小学低段 exam 模板：注入 2022年版义务教育课程标准', () => {
    const tpl = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' });
    expect(tpl.template).toContain('依据2022年版义务教育课程标准命题');
    expect(tpl.template).not.toContain('2017年版2020年修订');
  });

  it('初中 practice 模板：注入 2022 版，且不含"学习任务群"（语文课标概念不套用其他学科）', () => {
    const tpl = getPromptTemplate({ grade: 'middle', subject: '数学', genType: 'practice' });
    expect(tpl.template).toContain('依据2022年版义务教育课程标准）');
    expect(tpl.template).not.toContain('学习任务群');
  });

  it('高中 practice 不出现 2022 版字样', () => {
    const tpl = getPromptTemplate({ grade: 'high', subject: '英语', genType: 'practice' });
    expect(tpl.template).not.toContain('2022版');
  });

  it('通用模板（无学段）兜底替换为"本学段最新课程标准"，无占位符残留', () => {
    const tpl = getPromptTemplate({ grade: '', subject: '', genType: 'exam' });
    const inj = buildInjectionInstruction({ template: tpl.template, grade: '', subject: '数学', unit: '第一单元', genTypeLabel: '正式考卷' });
    expect(inj).toContain('依据本学段最新课程标准命题');
    expect(inj).not.toContain('{curriculum}');
  });

  it('质量底线（QUALITY_BASE 通用一套）保留"不超出本学段课标学业质量要求"（学业质量为课标组成章节，可查）', () => {
    const tpl = getPromptTemplate({ grade: 'middle', subject: '物理', genType: 'exam' });
    expect(tpl.template).toContain('不超出本学段课标学业质量要求');
  });

  it('getCurriculumLabel：学段键/中文标签均返回对应课标版本，无法识别回退通用', () => {
    expect(getCurriculumLabel('high')).toBe('《普通高中课程标准（2017年版2020年修订）》');
    expect(getCurriculumLabel('高中')).toBe('《普通高中课程标准（2017年版2020年修订）》');
    expect(getCurriculumLabel('高一')).toBe('《普通高中课程标准（2017年版2020年修订）》');
    expect(getCurriculumLabel('middle')).toBe('2022年版义务教育课程标准');
    expect(getCurriculumLabel('初中')).toBe('2022年版义务教育课程标准');
    expect(getCurriculumLabel('小学')).toBe('2022年版义务教育课程标准');
    expect(getCurriculumLabel('二年级')).toBe('2022年版义务教育课程标准');
    expect(getCurriculumLabel('')).toBe('本学段最新课标');
    expect(getCurriculumLabel('未知学段')).toBe('本学段最新课标');
  });

  it('SUBJECT_STAGE_EXTRAS 54 cell source 可查：无"课程理念（素养名）"错配、无"幼小衔接/激发兴趣/兴趣为先"等非课标条目名、无"写作"领域名错配', () => {
    // 语文|middle：第四学段领域名是"表达与交流"（2022 义教语文课标），不是"写作"
    expect(SUBJECT_STAGE_EXTRAS['语文|middle'].source).toContain('表达与交流');
    expect(SUBJECT_STAGE_EXTRAS['语文|middle'].source).not.toContain('/写作（');
    // 语文|high：核心素养名是"语言建构与运用"，不是简称"语言运用"
    expect(SUBJECT_STAGE_EXTRAS['语文|high'].source).toContain('语言建构与运用');
    // 低段 source 均不引用非课标条目名
    for (const key of ['道德与法治|primary_low', '科学|primary_low', '信息科技|primary_low', '音乐|primary_low', '体育|primary_low']) {
      expect(SUBJECT_STAGE_EXTRAS[key].source).not.toContain('幼小衔接');
      expect(SUBJECT_STAGE_EXTRAS[key].source).not.toContain('激发兴趣');
      expect(SUBJECT_STAGE_EXTRAS[key].source).not.toContain('兴趣为先');
      expect(SUBJECT_STAGE_EXTRAS[key].source).not.toContain('数字素养与技能启蒙');
      expect(SUBJECT_STAGE_EXTRAS[key].source).not.toContain('保护好奇心');
    }
  });

  it('教辅结构库学科级学段要求："课程理念"与"学科核心素养"术语不错配', () => {
    for (const [subject, bp] of Object.entries(TEACHING_SUBJECT_BLUEPRINTS)) {
      for (const [stageKey, stageParams] of Object.entries(bp.stages || {})) {
        const note = stageParams.note || '';
        // 括注声称"课程理念"的内容必须是课标课程理念条目名，"核心素养"括注必须用素养名——
        // 防"课程理念（生命观念）"式错配（生命观念等是核心素养名，不是课程理念）
        const m = note.match(/(.+课程理念|.+核心素养)（([^）]+)）/);
        if (m) {
          const label = m[1];
          const inner = m[2];
          expect(label.endsWith('课程理念')).toBe(false);
          expect(label.endsWith('核心素养')).toBe(true);
          expect(inner.length).toBeGreaterThan(0);
        }
      }
    }
    // 化学初中：不再使用"化学启蒙、联系生产生活实际"（非 2022 义教化学课标课程理念原文）
    expect(TEACHING_SUBJECT_BLUEPRINTS['化学'].stages.middle.note).not.toContain('化学启蒙');
    expect(TEACHING_SUBJECT_BLUEPRINTS['化学'].stages.middle.note).toContain('科学探究与实践');
    // 生物初中："健康生活"非 2022 义教生物课标术语
    expect(TEACHING_SUBJECT_BLUEPRINTS['生物'].stages.middle.note).not.toContain('健康生活');
  });

  it('组织风格指令：big_unit 不含"任务群"（语文课标概念不套用全学科）', () => {
    expect(styleInstructions.big_unit).not.toContain('任务群');
    // unit_context 风格 tip 同样不使用"任务群"（曾与 big_unit 同源残留）
    const unitContextTip = styleOptions.find(s => s.value === 'unit_context')?.tip || '';
    expect(unitContextTip).not.toContain('任务群');
  });

  it('🔴 组织风格完整性：每个 styleOptions.value 都必须有 styleInstructions 注入文案（缺键=withStyle 静默跳过=风格失效）', () => {
    for (const o of styleOptions) {
      expect(styleInstructions[o.value], `风格 ${o.value} 缺 styleInstructions 文案 → 生成时静默不注入`).toBeTruthy();
      expect(String(styleInstructions[o.value]).trim().length).toBeGreaterThan(8);
    }
    // 反向：不应存在无用（无对应选项）的指令键
    const values = new Set(styleOptions.map((o) => o.value));
    for (const k of Object.keys(styleInstructions)) {
      expect(values.has(k), `styleInstructions 存在无选项的孤儿键 ${k}`).toBe(true);
    }
  });

  it('🔴 组织风格含「传统题组」（2026-09-10 用户新增）：命题组、题类资料可选、非任何类型默认', () => {
    const t = styleOptions.find((o) => o.value === 'traditional');
    expect(t).toBeTruthy();
    expect(t.group).toBe('proposition');
    for (const gt of ['practice', 'special', 'reading', 'review']) {
      expect(t.appliesTo, `traditional 应适用于 ${gt}`).toContain(gt);
    }
    expect(t.required).toBe(false);
    // 不得成为任何类型的默认（默认仍是原值）
    expect(Object.values(DEFAULT_STYLE_BY_TYPE)).not.toContain('traditional');
    // 文案不得点名具体题型枚举（防诱导）
    for (const bad of ['选择题', '填空题', '判断题', '表格', '导图']) {
      expect(`${t.desc}${t.tip}`).not.toContain(bad);
      expect(styleInstructions.traditional).not.toContain(bad);
    }
  });

  it('buildInjectionInstruction：用户自定义模板中的 {curriculum} 按学段键注入版本（全链路生效）', () => {
    const userTpl = '请依据{curriculum}命题，覆盖本单元核心知识点。';
    const high = buildInjectionInstruction({ template: userTpl, grade: '高二', stage: 'high', subject: '物理', genTypeLabel: '正式考卷' });
    expect(high).toContain('依据《普通高中课程标准（2017年版2020年修订）》命题');
    expect(high).not.toContain('{curriculum}');
    const middle = buildInjectionInstruction({ template: userTpl, grade: '初二', stage: 'middle', subject: '数学', genTypeLabel: '课时练' });
    expect(middle).toContain('依据2022年版义务教育课程标准命题');
    // 未传学段键：保持通用表述，不残留占位符
    const generic = buildInjectionInstruction({ template: userTpl, grade: '', stage: '', subject: '语文', genTypeLabel: '专项突破' });
    expect(generic).toContain('依据本学段最新课程标准命题');
    expect(generic).not.toContain('{curriculum}');
  });

  it('学段档 source 可查：低段引用课程方案原文（幼小衔接/活动化游戏化），中高段不引用非条目名', () => {
    for (const extras of [STAGE_EXAM_EXTRAS, STAGE_TEACHING_EXTRAS]) {
      // 低段："幼小衔接/活动化、游戏化、生活化"出自《义务教育课程方案（2022年版）》，不再误标为课标课程理念
      expect(extras.primary_low.source).toContain('活动化、游戏化、生活化');
      expect(extras.primary_low.source).not.toContain('课程理念（幼小衔接');
      // 中段："真实情境"非任何学科课标课程理念条目名，不得写成"课程理念（真实情境）"
      expect(extras.primary_mid.source).not.toContain('课程理念（真实情境');
      // 高段："思辨性表达"非课标学业质量条目原文，不得写成"学业质量要求（思辨性表达"
      expect(extras.primary_high.source).not.toContain('思辨性表达');
    }
  });

  it('SUBJECT_STAGE_EXTRAS 素养引用完整：物理/化学/数学高中档不遗漏课标核心素养名', () => {
    // 义教物理核心素养 4 个：物理观念/科学思维/科学探究/科学态度与责任
    expect(SUBJECT_STAGE_EXTRAS['物理|middle'].source).toContain('科学态度与责任');
    // 高中物理核心素养 4 个（含科学态度与责任）
    expect(SUBJECT_STAGE_EXTRAS['物理|high'].source).toContain('科学态度与责任');
    // 高中化学核心素养 5 个（含科学探究与创新意识/科学态度与社会责任）
    expect(SUBJECT_STAGE_EXTRAS['化学|high'].source).toContain('科学探究与创新意识');
    expect(SUBJECT_STAGE_EXTRAS['化学|high'].source).toContain('科学态度与社会责任');
    // 高中数学核心素养 6 个（含直观想象/数学运算/数据分析，text 明确对应几何/概率统计）
    expect(SUBJECT_STAGE_EXTRAS['数学|high'].source).toContain('直观想象');
    expect(SUBJECT_STAGE_EXTRAS['数学|high'].source).toContain('数学运算');
    expect(SUBJECT_STAGE_EXTRAS['数学|high'].source).toContain('数据分析');
  });
});

/**
 * 答案区复述治理：非 exam 自包含教辅（知识总结/复习/课前预习/默写积累）正文本身即内容梳理，
 * 答案区必须只对练习/自测/例题作答，严禁把正文的知识框架/重点梳理/核心知识梳理整体复述——正文已提供，答案区不复述。
 */
describe('非exam教辅答案区不复述正文（自包含教辅防重复）', () => {
  it('ANSWER_ROLES.other：summary/review/preview/dictation 显式"严禁复述正文梳理，仅对题目作答"，典型例题已在正文讲解展示、答案区不重复', () => {
    for (const gt of ['summary', 'review', 'preview', 'dictation']) {
      const role = ANSWER_ROLES.other(gt);
      // 🔴 2026-09-18：表述加强为"仅针对**本资料正文中实际出现的**练习/自测/变式"（同义且更硬——
      //    "正文中的"曾被读成"包括随附参考原文里的教材题目"，致答案区污染；见 answerScopeAndFalsePositives 测试）
      expect(role).toContain('仅针对**本资料正文中实际出现的**练习/自测/变式逐题作答');
      expect(role).toContain('正文里没出现过的题目与栏目一律不作答');
      expect(role).toContain('典型例题的解答与解析已在正文讲解展示');
      expect(role).toContain('严禁将正文的知识框架/重点梳理/核心知识梳理/易错辨析/默写内容等梳理正文整体复述到答案区');
      expect(role).not.toContain('按栏目给出要点梳理'); // 旧文案诱导复述
    }
  });

  it('ANSWER_ROLES.other：errorbook 只附归因与解法，不复述原题', () => {
    expect(ANSWER_ROLES.other('errorbook')).toContain('错因剖析');
    expect(ANSWER_ROLES.other('errorbook')).not.toContain('按栏目给出要点梳理');
  });

  it('ANSWER_ROLES.other：普通教辅解析下限（需解析情形必须附 + 整卷不得零解析），不含复述诱导', () => {
    const role = ANSWER_ROLES.other('practice');
    expect(role).toContain('必须附');
    expect(role).toContain('不得完全没有解析');
    expect(role).toContain('点到即止');
    expect(role).not.toContain('客观题给出正确答案'); // 旧措辞被读成"客观题一律免解析"
    expect(role).not.toContain('自行判断'); // 旧"语义自决"被整卷读成"一律不写解析"（2026-09-10 用户实证）
    expect(role).not.toContain('按栏目给出要点梳理');
    expect(role).not.toContain('知识总结/预习类按栏目'); // 旧文案去净
  });

  it('PAPER_OUTPUT_CONVENTIONS.once：非自包含教辅保持"另起一部分输出参考答案"', () => {
    const conv = PAPER_OUTPUT_CONVENTIONS.once('语文', false);
    expect(conv).toContain('另起一部分输出《参考答案与评分标准》/《参考答案与解析》');
    expect(conv).not.toContain('严禁将正文的知识框架');
  });

  it('PAPER_OUTPUT_CONVENTIONS.once：自包含教辅改为"答案区仅逐题作答，严禁整体复述正文"', () => {
    const conv = PAPER_OUTPUT_CONVENTIONS.once('语文', true);
    expect(conv).toContain('严禁');
    expect(conv).toContain('整体重复输出到答案区');
    expect(conv).toContain('答案区仅逐题作答');
    expect(conv).toContain('知识框架/重点梳理/核心知识梳理/易错辨析/默写内容等正文内容整体重复输出到答案区');
  });

  it('PAPER_OUTPUT_CONVENTIONS.split：自包含教辅强调正文梳理不属于答案、无需答案区', () => {
    const conv = PAPER_OUTPUT_CONVENTIONS.split('语文', true);
    expect(conv).toContain('知识梳理部分不属于“答案”');
    expect(conv).toContain('无需为它设置答案区');
    expect(conv).toContain('参考答案由系统在正文生成后单独调用生成');
  });

  it('听力原文仅英语：自包含教辅 once 注入听力原文仅在英语时出现', () => {
    expect(PAPER_OUTPUT_CONVENTIONS.once('英语', true)).toContain('听力题的答案应附完整听力原文');
    expect(PAPER_OUTPUT_CONVENTIONS.once('数学', true)).not.toContain('听力题的答案应附完整听力原文');
  });

  it('答案委托不指定"评分标准/等级表"结构（去诱导：评分怎么写由模型能力产出）', () => {
    // 根治（2026-09-26）：委托里"评分标准/等级表除外""等级表用 <table>""作文给评分标准（等级描述+采分点）"
    // 等指定量表结构的措辞会把答案任务诱导成"产出评分量表"→ 模型只写量表、漏掉逐题答案。
    for (const s of ['语文', '英语', '数学']) {
      const once = PAPER_OUTPUT_CONVENTIONS.once(s, false);
      expect(once).not.toContain('等级表');
      expect(once).not.toContain('评分标准/等级表用');
    }
    expect(ANSWER_ROLES.exam('语文')).not.toContain('等级描述');
    expect(ANSWER_ROLES.exam('语文')).not.toContain('采分点');
    expect(buildAnswerFormatSpec('语文')).not.toContain('等级表');
    expect(buildAnswerFormatSpec('语文')).not.toContain('评分标准/等级表');
  });
});

describe('序号体系 · 层级样式（2026-09-26 补全：模型一次写对，不靠守卫兜底）', () => {
  it('「一、二、三…」汉字序号被明确纳入"层级样式"词汇表（防大类与组同用汉字序号撞车）', () => {
    expect(NUMBERING_HIERARCHY_RULE).toContain('汉字序号');
    expect(NUMBERING_HIERARCHY_RULE).toContain('上级已用「一、」，下级就不得再用「一、」');
    for (const form of ['一、二、三…', '1. 2. 3.…', '(1)(2)', '①②', '项目符号']) {
      expect(NUMBERING_HIERARCHY_RULE, `层级样式词表漏了 ${form}`).toContain(form);
    }
  });

  it('题号条款写明"小题号编法按学段"（2026-10-05 调研改准）', () => {
    const t = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' }).template;
    // 🔴 2026-10-05：经调研，**小学**正式卷小题号＝**本大题内起编、各大题各自起编**（旧"试卷一律全卷连续"已改准）
    expect(t, '小学试卷：小题号本大题内起编').toContain('在本大题内从 1 起编');
    // 🔴 2026-10-01（③啰嗦·D16 自检类补丁清除）：原"输出完成后逐题自查题号是否连续/是否中途重启、缺号即补、重启即改"
    //    已删——题号编法前置已精准（QUESTION_NUMBERING_CALIBER 单源），连续性由程序侧确定性校验并驱动重试
    //    （调用层重试附加段仍保留该动作）；模型侧"成稿后自查"属 D16 优先清除对象。
  });

  it('试卷大题只出一个标题：消除"小题标题"歧义（防 h2+h3 同号双标题）', () => {
    const t = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' }).template;
    expect(t, '歧义词"小题标题"须已消除——它在本项目另指"带题号的题目行"，模型会误读出"小组标题"层，'
      + '于是每道大题多出一个与 h2 同序号的 h3 标题（实证：一、读拼音，写词语 / 一、看拼音，把词语写在田字格里）')
      .not.toContain('小题标题');
    expect(t).toContain('每个大题只出一个标题');
    expect(t).toContain('小组标题');
  });
});

describe('🔢 题号编法口径（2026-09-28 按正规收口）：教辅按大题起编 / 试卷全卷连续', () => {
  const examTpl = () => getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' }).template;
  const practiceTpl = () => getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'practice' }).template;

  it('教辅：小题在同一栏目（组）内连续、按栏目（组）分别从 1 起编（正规编法）', () => {
    const p = practiceTpl();
    expect(p).toContain('在同一栏目（组）内连续、按栏目（组）分别从 1 起编');
    expect(p).toContain('进入新的栏目（组）即从 1 重新起编');
    // 旧禁令（教辅全卷连续、严禁重启）须已移除
    expect(p, '教辅分支不得再出现"严禁按大类/大题…重新从 1 编号"').not.toContain('严禁按大类/大题/组/栏目重新从 1 编号');
    expect(p, '教辅分支不得再声称"全卷只此一套题号"').not.toContain('全卷只此一套题号');
    // 🔴 2026-10-01（③啰嗦·D16）：原"本栏目（组）内"只在"逐题自查"句里出现——自查句已删；
    //    改断其**编法**本身（教辅按栏目（组）分别起编）。
    expect(p, '保留教辅"按栏目（组）分别起编"的编法').toContain('按栏目（组）分别从 1 起编');
  });

  it('正式考卷：小题号编法按学段分叉（小学本大题起编／中学全卷连续）', () => {
    const e = examTpl(); // 小学
    expect(e, '小学正式卷：小题号本大题内起编').toContain('在本大题内从 1 起编');
    expect(e, '试卷条款须声明与教辅口径分型、不互相否定').toContain('不得互相否定');
    // 🔴 2026-10-05（调研）：**中学**正式卷仍**全卷连续**（中考卷实证：一、…完成1~4题；二、…5~8题）
    const m = getPromptTemplate({ grade: 'middle', subject: '语文', genType: 'exam' }).template;
    expect(m, '中学正式卷：小题号全卷连续').toContain('全卷只此一套题号');
    expect(m).toContain('严禁按大题/部分/组/栏目重新从 1 编号');
    expect(m, '试卷条款须声明与教辅口径分型、不互相否定').toContain('不得互相否定');
  });

  it('答案区口径与正文同向：与正文同号同序（教辅按栏目（组）分组、试卷全卷连续）', () => {
    const once = PAPER_OUTPUT_CONVENTIONS.once('语文', false);
    expect(once).toContain('同号同序');
    expect(once).toContain('教辅正文按栏目（组）分别起编则答案区按相同栏目（组）分组、组内与正文同号同序');
    expect(once, '旧硬要求"全卷连续同序"须已按类型分型').not.toContain('全卷连续同序；仅子题');
    const ansSpec = buildAnswerFormatSpec('语文');
    expect(ansSpec).toContain('与正文同号同序');
    // 🔴 2026-10-01（⑥拼接）：ansSpec 内"同号同序"同义反复已收口（3→2），改断其**分型判据**。
    expect(ansSpec).toContain('教辅按栏目（组）分别起编时，答案区按相同栏目（组）分组');
  });

  it('回潮守卫：单源常量两口径各自成立；教辅分支不再出现"严禁…重新从 1 编号"', () => {
    expect(QUESTION_NUMBERING_CALIBER.teaching).toContain('按栏目（组）分别从 1 起编');
    expect(QUESTION_NUMBERING_CALIBER.exam).toContain('全卷连续');
    expect(practiceTpl()).not.toMatch(/严禁按(?:大类|大题)/);
  });
});

/** 🔢 组标题（大题标题）中文序号口径（2026-09-28 用户裁定·按正规收口）
 * ============================================================
 * 与小题口径 QUESTION_NUMBERING_CALIBER 呼应（两层一致）：
 *   · 正式考卷（exam）：大题序号全卷连续；· 教辅（同步练习等）：组标题逐栏目（组）起编。
 * 两种口径各自成立、不得互相否定；程序侧大题级序号判据仅 exam 生效（教辅不报）。 */
describe('🔢 组标题（大题标题）中文序号口径：教辅逐栏目（组）起编 / 试卷全卷连续（两层一致）', () => {
  const examTpl = () => getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' }).template;
  const practiceTpl = () => getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'practice' }).template;
  const readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

  it('教辅组标题：同一栏目（组）内 一、二、三…顺排、进入下一栏目（组）即从「一、」重新起编（跨栏目（组）不接续）', () => {
    const p = practiceTpl();
    expect(p).toContain(GROUP_TITLE_NUMBERING_CALIBER.teaching);
    expect(p, '组标题口径须为"逐栏目（组）起编"').toContain('逐栏目（组）起编');
    expect(p, '进入下一栏目（组）即重新起编').toContain('进入下一栏目（组）即从「一、」重新起编');
    expect(p, '跨栏目（组）不接续').toContain('跨栏目（组）不接续');
    // 两层一致：组标题（汉字序号）与小题（阿拉伯题号）在同一份教辅模板内同源呼应
    expect(p).toContain(QUESTION_NUMBERING_CALIBER.teaching);
  });

  it('旧口径字面（教辅组标题"汉字序号（全卷连续、跨大类顺延不重复"）须已移除', () => {
    const p = practiceTpl();
    expect(p, '旧口径不得回潮').not.toContain('汉字序号（全卷连续、跨大类顺延不重复');
    expect(p).not.toContain('跨大类顺延不重复');
  });

  it('正式考卷：大题序号仍全卷连续、不得重新从「一、」开始（与教辅分型）', () => {
    const e = examTpl();
    expect(e).toContain('大题序号**全卷连续**（一、二、三…）');
    expect(e).toContain('不得重新从「一、」开始');
  });

  it('两口径单源常量各自成立，且条款显式声明"各自成立、不得互相否定"', () => {
    expect(GROUP_TITLE_NUMBERING_CALIBER.exam).toContain('全卷连续');
    expect(GROUP_TITLE_NUMBERING_CALIBER.teaching).toContain('逐栏目（组）起编');
    expect(GROUP_TITLE_NUMBERING_CALIBER.teaching).toContain('进入下一栏目（组）即从「一、」重新起编');
    // 教辅条款与试卷条款都须显式声明（不得互相否定）
    expect(practiceTpl()).toContain('不得互相否定');
    expect(examTpl()).toContain('不得互相否定');
  });

  it('答案区同构：教辅按相同栏目（组）分组、组内与正文同号同序；试卷全卷连续同序', () => {
    const once = PAPER_OUTPUT_CONVENTIONS.once('语文', false);
    expect(once).toContain('教辅正文按栏目（组）分别起编则答案区按相同栏目（组）分组、组内与正文同号同序');
    expect(once).toContain('正式考卷：正文题号全卷连续（中学）或各大题各自起编（小学），答案区按相同编排逐题对应');
    const ansSpec = buildAnswerFormatSpec('语文');
    // 🔴 2026-10-01（⑥拼接）：同义反复已收口，改断分型判据（教辅分组 / 试卷全卷连续）。
    expect(ansSpec).toContain('教辅按栏目（组）分别起编时，答案区按相同栏目（组）分组');
    expect(ansSpec).toContain('正式考卷：正文全卷连续（中学）或各大题各自起编（小学）时，答案区按相同编排逐题对应');
  });

  it('程序侧同向：大题级序号判据仅 exam 生效（教辅不报）', () => {
    // 汉字序号大题级守卫：genTypes 仅 exam（教辅组标题"逐栏目（组）起编"是常态、非缺陷）
    const g = getValidatorRule('cn-ordinal-guard')?.genTypes || [];
    expect(g).toContain('exam');
    expect(g).not.toContain('practice');
    expect(g).not.toContain('special');
    // 数字题号"重启"判据：调用点按 genType 分型（仅 exam 判）
    expect(readSrc('src/composables/useAiGenerator.js'))
      .toMatch(/genType === 'exam'[\s\S]{0,60}detectBodyNumberingRestart\(content\)/);
  });

  it('回潮守卫：src 内"教辅…组标题…全卷连续"旧口径字面零出现', () => {
    const files = [];
    const walk = (dir) => {
      for (const n of fs.readdirSync(dir)) {
        const p = path.join(dir, n);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (/\.(js|vue|ts)$/.test(n)) files.push(p);
      }
    };
    walk(path.join(ROOT, 'src'));
    const offenders = files.filter((f) => /汉字序号（全卷连续、跨大类顺延不重复/.test(fs.readFileSync(f, 'utf8')));
    expect(offenders, '旧口径字面须已清除').toEqual([]);
  });

  it('回潮守卫：本次新增文本不出现"课时"（单位名用既有"栏目/同步练习"）', () => {
    // 新增加的单源常量（含其头注）不得含"课时"
    const lib = readSrc('src/config/promptLibrary.js');
    const start = lib.indexOf('🔢 组标题（大题标题）中文序号口径');
    const end = lib.indexOf('};', lib.indexOf('export const GROUP_TITLE_NUMBERING_CALIBER'));
    const newBlock = lib.slice(start, end);
    expect(newBlock.length).toBeGreaterThan(100);
    expect(newBlock, '新增文本不得出现"课时"').not.toContain('课时');
    // 教辅组标题子句用既有单位名（栏目），且不含"课时"；教辅模板角色句用"同步练习"
    const p = practiceTpl();
    const seg = p.slice(p.indexOf('汉字序号（'), p.indexOf('同组小题共用语境递进或并列'));
    expect(seg, '组标题子句须用"栏目"').toContain('栏目');
    expect(seg, '组标题子句不得出现"课时"').not.toContain('课时');
    expect(p, '教辅模板须用"同步练习"').toContain('同步练习');
  });
});

describe('试卷大类层 / 部分标题 / 自洽判据域（2026-09-26 用户定版）', () => {
  const examTpl = () => getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' }).template;

  it('层级按【卷面结构】块名归并（**非全学科、不按学科名判**）：可归并出上层名时设大类层，否则不设', () => {
    const t = examTpl();
    expect(t).toContain('按【卷面结构】块名归并，非全学科、不按学科名判');
    expect(t).toContain('课标内容领域/实践活动型名称');
    expect(t, '部分前缀也是归并来源之一（英语听力/笔试）').toContain('"部分"前缀');
    expect(t, '无上游名时不设大类层（块名本身即大题标题）').toContain('无可归并上层名的卷不设大类层');
    // 🔴 2026-09-28（用户裁定·去一刀切）：原"大类一律不带编号"是**一刀切**——真题小学段大类（部分）层
    //    普遍**带序号**（部编六上"第一部分 积累与阅读（55分）"、武冈四年级"活动一：…（31分）"）→
    //    改为**小学段自带序号、样式与大题「一、」相区分**；中学段不设大类层（见下一用例）。
    expect(t, '小学段大类自带序号').toContain('小学段大类（部分）层自带序号');
    expect(t, '序号样式须与大题相区分').toContain('序号样式须与其下大题「一、」');
    expect(t, '旧的"大类一律不带编号"一刀切须已移除').not.toContain('大类一律不带编号');
  });

  it('🔴 2026-09-28 去一刀切：中学段（初/高）不设大类层——课标领域名直接作大题标题', () => {
    const mid = getPromptTemplate({ grade: 'middle', subject: '语文', genType: 'exam' }).template;
    expect(mid).toContain('中学段（初中/高中）不设大类层');
    // 🔴 2026-09-28（E1 收口·大题标题命名单源）："中学段领域名直接作大题标题"口径移到【卷面结构】条的
    //    "大题标题命名"单源（bigTitleRule），不再在【层级归并】条并行复述——此处锁同一口径的新落点。
    expect(mid, '中学段领域名直接作大题标题（命名单源）').toContain('领域名直接作大题标题');
    expect(mid, '中学段不作"大类名不得充当大题标题"（域型名即大题标题）').not.toContain('不得充当大题标题');
    const low = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' }).template;
    expect(low, '小学段不得被中学口径覆盖').not.toContain('中学段（初中/高中）不设大类层');
  });

  it('大类层下三层展开：大类（居中无编号）→ 大题标题（自拟、一、、分值）→ 小题（1.2.3. 连续）', () => {
    const t = examTpl();
    expect(t).toContain('大类层下两层展开');
    // 🔴 2026-09-27：原句「不是照抄它行首的调研分类名、也不得改写成近义说法」是**否定映射**
    //    （要读懂须先建立"分类名 ↔ 标题"这条映射 = 反向植入）；改**正向角色陈述**，口径不放松（标题仍自拟）。
    expect(t, '大题标题仍自拟（分类名只描述范围）').toContain('行首分类名与其中的知识点名只描述命题范围');
    expect(t, '标题自拟要求不得丢').toContain('大题标题须你按本卷实际的作答方式自拟');
    expect(t, '否定映射不得回潮').not.toContain('不是照抄它行首的调研分类名');
    // 🔴 2026-10-05（指令侧同族收口·按学段分叉）：小学正式卷小题号＝各大题各自起编（正句在小学分支）；
    //    原"全卷连续（跨大类、大题、部分逐题递增）"单源常量改挂**中学**分支（正句仍在，判据未丢）。
    expect(t, '小学正式卷：小题号在本大题内从 1 起编').toContain('在本大题内从 1 起编');
    expect(getPromptTemplate({ grade: 'middle', subject: '语文', genType: 'exam' }).template,
      '中学正句=编号与组织·单源常量').toContain('跨大类、大题、部分逐题递增');
    // 🔴 2026-10-01（结构清晰·分值集中）：大类级账目闭合已并入【分值】条的算式判据（原在"大类层下两层展开"
    //    条末——同判据跨两条），措辞随之改准为"…＝该大类在【卷面结构】里的总分"。
    expect(t, '大类下分值账目闭合').toContain('该大类下各大题分值合计＝该大类在【卷面结构】里的总分');
  });

  it('自洽（层级↔内容）：大类名 ↔ 其下各题内容相符；大类名与大题标题不重复、不顶替', () => {
    const t = examTpl();
    // 🔴 2026-10-04（⑤内容自洽）：口径扩为"大类名与大题标题都须与其下各题实际考查的内容、作答方式相符"——
    //    大题标题声明的作答方式（写出/选出…）须与其下小题的实际作答形态一致。
    expect(t).toContain('大类名与大题标题都须与其下各题实际考查的内容、作答方式相符');
    // 🔴 2026-10-01（①三维度）：原举例"（不得挂'积累与运用'之名而行阅读之实）"含语文领域名，
    //    注入数学卷即学科越界 → 删举例；改断其判据本体（大类名与其下内容相符由上行断言覆盖）。
    expect(t, '大类名与大题标题不得互相重复/顶替').toContain('不得互相重复、也不得互相顶替');
    expect(t).toContain('不得互相重复、也不得互相顶替');
    // 🔴 2026-09-28：大类名不得充当大题标题（注入侧已不再输出同名大题行，条款侧同步钉住）
    expect(t, '大类名不得充当大题标题').toContain('不得充当大题标题');
    // 🔴 2026-09-28：大题标题不得被小题题干同文/近义重复（用户报障：大题标题下再用小题标题重复一遍）
    expect(t, '禁止小题题干重复大题标题').toContain('大题标题与小题题干不得同文或近义重复');
    // 🔴 2026-10-05（用户实测·判据改精准）：原落点"说清本组怎么做或选什么"太松——产物「读一读，选一选」字面即满足；
    //    改锚到「考查点」，并要求不得泛说（关卡名由【情境边界】"另起一行、不并入其名"另行约束）。
    expect(t, '大题标题须点明考查点与作答方式（不泛说）').toContain('点明本组的考查点与作答方式');
  });

  it('分值两处都标 + 大题内分值账目闭合 + 大题序号全卷连续', () => {
    const t = examTpl();
    expect(t).toContain('大题级必须给分值说明、不得省略');
    expect(t).toContain('有独立设问的小题在其题干后逐题标分"（X分）"');
    expect(t).toContain('**小题分之和=大题总分、各大题分之和=满分**');
    // 🔴 2026-10-06（A5 账目·第二次命中·补前提）：原式无前提——对"整栏一题（无小题号）"的大题，
    //    "小题分之和=大题总分"无从成立 → 反拉模型逐项编号凑小题分（实测：比一比再组词 长出 1./2./3./4.，
    //    且一~八无小题分、九+有）。补前提"无小题分则不涉"，与分值条"号分同源（无小题号即不再逐项标）"自洽。
    expect(t, '账目算式须带前提（无小题分的大题不被拉去编号凑分）').toContain('无小题分则不涉');
    // 🔴 2026-10-03（口径改准·分值根治）：原句"题量与分值都要写出真实数字（不得照抄占位字面）"已收口为
    //    **锚定式**——分值取【卷面结构】给定值，题数/空数/单价据之定妥（乘积恒等于该分值）：
    //    真实数字由**构造**保证（题数、单价被给定分值唯一确定），不再以"真实数字"泛述+括注兜底。
    expect(t, '分值锚定【卷面结构】给定值').toContain('分值取【卷面结构】的给定值');
    // 🔴 2026-10-04（逐块通读·第3组 账目两处合一）：大题标题条尾原含「（乘积恒等于该分值）」＝下方「账目算式判据」条的
    //    复述 → 已删；账目闭合的**正句**在「账目算式判据」条。此处锁两条：① 定妥顺序判据仍在 ② 账目闭合正句在位。
    expect(t, '题数/作答位数/单价据分值定妥、再据之生成内容（顺序判据）').toContain('题数、作答位数与单价据之定妥，再据之生成内容');
    expect(t, '账目闭合正句在位（单源）').toContain('须精确成立');
    // 🔴 2026-10-05（用户裁定·分值标注统一）：原分型（"逐个作答位计分写共N单位每单位X分／整栏一次计分只写总分"）
    //    +"同型客观小题只在大题级标一次"的例外 → 统一为「大题标题只写总分＋有独立设问的小题逐题标分＋整除」。
    expect(t, '分值标注统一：大题只写总分').toContain('大题标题只写总分"（共Y分）"');
    // 🔴 2026-10-06（面5 账目·消相抵·用户纠正对象）：原"**总分须被小题数整除**"**对象选错**——
    //   分值是落在"空"上的（"3空2分不好算"＝分÷空除不尽），与"小题个数"无关；且大题级一律"÷作答位"
    //   会把混合分值的真题大题（"二、阅读（35分）"4 小题=8+9+8+10、8 个作答位）判死（作用域过宽）。
    //   正解：**对象＝作答位**，**作用域＝按空统一计分的那批（同型并列）**。
    expect(t, '分值条：整除以作答位为对象、作用域收窄到同型并列').toContain('同型并列的小题：分值须一致、且被该小题的作答位数整除');
    expect(t, '分值标注统一：小题逐题标分').toContain('有独立设问的小题在其题干后逐题标分');
    // 🔴 2026-10-05（用户裁定）：原"同型客观小题只在大题级标一次"的例外（真题：武平县「一、选择题。（每题2分，共20分。）」）
    //    与"整卷标注方式统一"相抵 → 已删；选择/判断同样逐题标分，全卷一种标注方式。
    expect(t, '分值标注统一（例外已删、不再按题型分型）').toContain('大题标题只写总分"（共Y分）"');
    expect(t).toContain('大题序号**全卷连续**');
    expect(t).toContain('不得重新从「一、」开始');
    expect(t, '旧的"跨部分不顺延不重复"自相矛盾句须已移除').not.toContain('跨部分不顺延不重复');
  });

  it('🔴 题号对象唯一主键（2026-10-05 用户报障·根治）：题号只给"独立设问的题"；计分单位不改变题号对象', () => {
    const t = examTpl();
    // 报障：大题＝一题时仍长出"1. 直接写出得数。"（又给小题号＋复述题干）。根因＝题号条句首**无条件**要求
    //   "题目…带题号"，与编号对象口径（同型并列整栏算一题）相抵；模型二选一→选了给号。锁四处收口后的判据。
    expect(t, '题号对象＝各自独立设问的题（呼应 QOC）').toContain('**每个独立设问的题**以 <p class="question"> 包裹并带题号');
    expect(t, '小题号只给有独立设问的小题（卷面层级）').toContain('**有独立设问的小题**用 1. 2. 3.…');
    expect(t, '题数 X 按编号对象口径计（不再按实际命制题数泛述）').toContain('【卷面结构】里的"题数 X"按**编号对象口径**（同型并列整栏算一题）计');
    // 🔴 2026-10-05（实测二轮）：只写"不再另起小题号"还不够——题号条句首"每个…题以 <p class="question"> 包裹"
    //    是格式硬要求，模型仍造一条 <p class="question"> 行（实测产物「1. 看拼音，写词语。」＝号＋复述）。
    //    故把"题干行"一并点掉；【卷面自洽】里同义的"不另起小题号"由本条单源承载（已收口）。
    expect(t, '唯一题不再另起题干行（治「1. 直接写出得数。」）').toContain('其下不再另起小题号与题干行');
    // 答案区不得再"特指阿拉伯题号"（否则大字序号、小学分段号一律违令）
    expect(PAPER_OUTPUT_CONVENTIONS.once('语文', false)).not.toContain('阿拉伯题号');
  });

  it('自洽①判据域=题面（含标题/要求行/材料引导语），不再只认"题干"', () => {
    const t = examTpl();
    expect(t).toContain('含题干、大题标题、大类名、要求行、材料引导语');
    expect(t).toContain('题面怎么说、卷面就怎么做');
    expect(t, '旧判据域"只认题干"须已扩为"题面"').not.toContain('判据只有题干自身措辞');
  });

  it('大题级分值说明为必须项（**仅试卷**，不得外溢到教辅）', () => {
    const t = examTpl();
    expect(t).toContain('大题级必须给分值说明、不得省略');
    expect(t).toContain('有独立设问的小题在其题干后逐题标分"（X分）"');
    const practice = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'practice' }).template;
    expect(practice, '大题级分值说明必须项只针对试卷类型').not.toContain('大题级必须给分值说明');
  });

  it('情境边界：情境不改写卷面结构层 + 正式卷禁游戏化包装（**仅试卷**）', () => {
    const t = examTpl();
    expect(t).toContain('情境边界');
    expect(t).toContain('不得替代或改写卷面结构层');
    // 🔴 2026-09-27 改**原则式**：原写"严禁'第X关/闯关/集齐宝石'"＝否定式列举（会把禁词反向植入、反而引模型往那去）
    expect(t, '严肃卷面：原则式表述').toContain('按正规考试的严肃卷面呈现');
    expect(t, '情境只作真实/拟真语境承载、不作形式化包装').toContain('不作任何形式化包装');
    // 反列举守卫：这些具体词不得再出现在指令里（否则＝反向植入）
    // 🔴 2026-10-05 先解后锁：'第X部分' **移出禁词表**——经调研（正规卷如"第一部分 识字与写字（40分）"），
    //    它已是**大类层的正规形态**（旧列为禁词是防"关卡名"式反向植入，与正规卷面形式冲突）。
    for (const banned of ['闯关', '集齐宝石', '第X关', '关卡包装']) {
      expect(t, `不得把「${banned}」这类禁词写进指令（否定式列举＝反向植入）`).not.toContain(banned);
    }
    expect(t, '大类层正规形态：序号与名称间用空格、不加冒号').toContain('序号与名称间用空格、不加冒号');
    const practice = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'practice' }).template;
    expect(practice, '情境边界（正式卷）不得广播到教辅').not.toContain('情境边界');
  });

  // 🔴 2026-09-28 卷首导语与大题标题同进同退（用户口径）：卷首导语**可有可无**；
  //    存在时＝全卷统一情境（各大题标题同属该情境）；不存在时大题标题必须走严肃/功能性命名
  //    （如"看拼音写词语"），不得出现情境化名。主标题（程序拼装）不许改动。**仅 exam**。
  it('卷首导语↔大题标题同进同退（**仅试卷**，不广播教辅）', () => {
    const t = examTpl();
    expect(t, '条款存在（仅 exam）').toContain('卷首导语');
    expect(t, '同进同退：二者必居其一').toContain('同进同退');
    expect(t, '有导语＝全卷统一情境').toContain('统一情境');
    expect(t, '无导语＝大题标题走严肃功能性命名').toContain('功能性');
    // 🔴 2026-09-30（用户裁定·去指向性诱导）：原断言锁"不得使用情境化/主题化/故事化命名（…如"云朵出发"这类）"，
    //    该写法是**否定式举例**（要读懂须先激活"云朵出发"这个形象＝反向植入，且样例自造）→ 已改正向陈述；
    //    本断言随之改锁**正向表述**，意图不变（无导语时标题是功能性名称、不写场景名或故事名），并防样例回潮。
    expect(t, '无导语时标题为功能性名称（正向）').toContain('功能性名称');
    expect(t, '不得写成场景名或故事名（意图锁定）').toContain('不写成场景名或故事名');
    expect(t, '自造样例不得回潮').not.toContain('云朵出发');
    // 2026-10-02（项4·以结果反推）：原锁"程序拼装"（**机制描述**）——已按结果式收口为"（主标题由系统替换）"；
    //   断言随新口径改锁（判据"卷首留占位＋正文不得改动/覆盖/另拟"未变），且下条"不得广播到教辅"的标记词同步替换。
    expect(t, '主标题由系统替换、正文不得改动').toContain('由系统替换');
    const practice = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'practice' }).template;
    expect(practice, '该条款仅针对试卷、不得广播到教辅').not.toContain('同进同退');
    expect(practice, '主标题替换条款不得广播到教辅').not.toContain('由系统替换');
  });

  // 🔴 2026-09-28 卷面不输出分隔线（与内容清洗层 stripDecorRuleLines 同源）：指令端禁产出、
  //    清洗端兜底剥离（`---` 与标题同行曾是漏网形态）。**仅 exam**。
  it('卷面不输出分隔线（**仅试卷**）：大类层/大题标题/题干一律不加 ---/***/___/<hr>', () => {
    const t = examTpl();
    expect(t, '条款存在（仅 exam）').toContain('卷面不输出分隔线');
    expect(t).toContain('不加分隔线或装饰性水平线');
    const practice = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'practice' }).template;
    expect(practice, '该条款仅针对试卷、不得广播到教辅').not.toContain('卷面不输出分隔线');
  });

  // 🔴 2026-09-27（用户裁定·课标原文为首要）：低段课标原词＝课程方案"**活动化、游戏化、生活化的学习设计**"（原样、不得削弱），
  //    只补一句**作用域界定**——取向管"情境取材与难度起点"。
  //    为什么必须界定：同一次注入里既有课标取向词、又有"严肃卷面/不作形式化包装"，不界定作用域，
  //    模型可能把课标取向读成"卷面可以游戏化"——正是上条"正式卷禁游戏化包装"被**正向驱动项抵消**的路径。
  // 🔴 2026-10-03（②课标）：原字面把课标词前挂了"情境"（"情境活动化…"）≠ 课程方案原文（学习设计）→ **去前置**、回归课标原词。
  // 🔴 2026-09-30（用户裁定·界定改准 + 同词同缺陷）：① 界定由"不涉卷面形式"改为**"不涉题目与卷面的呈现形态"**
  //    ——"卷面形式"只管到卷面，管不到"每道题都套活动化包装"这条实际走偏的路径；② 原界定**仅 exam** 才补，
  //    而 STAGE_TEACHING_EXTRAS 低段含**同一个词**、注入教辅时无界定（同一缺陷在 6 类教辅里原样存在）
  //    → 改为**凡含该词即补**（故本用例一并扫教辅类型）。
  it('低段情境取向：课标原词保留（首要）+ 作用域界定（只管情境取材与难度起点，不涉题目与卷面的呈现形态）', () => {
    const t = examTpl(); // primary_low | 语文 | exam
    expect(t, '课标原词要求保留、不得削弱').toContain('活动化、游戏化、生活化的学习设计');
    expect(t, '界定：取向只管情境取材与难度起点').toContain('只作用于情境取材与难度起点');
    expect(t, '界定：课标要求为首要').toContain('课标对该学段学习设计的要求');
    expect(t, '界定：声明首要遵从').toContain('首要遵从');
    expect(t, '界定：不涉题目与卷面的呈现形态').toContain('不涉题目与卷面的呈现形态');
    // 教辅模板同词同界定（2026-09-30 扩面）
    const practice = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'practice' }).template;
    expect(practice, '教辅模板含低段取向词').toContain('活动化、游戏化、生活化的学习设计');
    expect(practice, '教辅模板同样须带作用域界定').toContain('不涉题目与卷面的呈现形态');
    // 界定句只在**含取向词的学段**补——中高段不注入（不把"游戏化"这类词广播到本没有它的学段，也不添噪音）
    for (const st of ['primary_mid', 'middle', 'high']) {
      const tm = getPromptTemplate({ grade: st, subject: '语文', genType: 'exam' }).template;
      expect(tm, `${st} 学段要点无取向词 → 不应注入作用域界定句`).not.toContain('不涉题目与卷面的呈现形态');
      expect(tm, `${st} 不得被广播"游戏化"`).not.toContain('游戏化');
    }
  });
});
