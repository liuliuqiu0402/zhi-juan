import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getPromptTemplate, buildInjectionInstruction, CURRICULUM_BY_STAGE, getCurriculumLabel, SUBJECT_STAGE_EXTRAS, STAGE_EXAM_EXTRAS, STAGE_TEACHING_EXTRAS, ANSWER_ROLES, PAPER_OUTPUT_CONVENTIONS, buildAnswerFormatSpec, NUMBERING_HIERARCHY_RULE, GROUP_TITLE_NUMBERING_CALIBER, QUESTION_OBJECT_CALIBER } from '../../src/config/promptLibrary.js';
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

  it('质量底线（QUALITY_BASE 通用一套）保留"不超学段、不超学业质量要求"（学业质量为课标组成章节，可查）', () => {
    const tpl = getPromptTemplate({ grade: 'middle', subject: '物理', genType: 'exam' });
    // 🔴 2026-10-11（T10·G29）：原字面"不超出本学段课标学业质量要求"——同一判据原在【质量底线】与学段表 10 处并存
    //   （同一判据多套＝多源）→ 现**单源收进本条**；学段表只留各档特有侧重（反向锁见 tests/config/stageExtrasNeutral.test.js）。
    expect(tpl.template).toContain('不超学段、不超学业质量要求');
    expect(tpl.template, '学段表不得再复述该通用判据').not.toContain('不超学段：');
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
    // 🔴 2026-10-09（面8 答案区镜像·补缺态）：once·自包含分支原缺"编号对象与正文一致"前件
    //    （其余四处皆有）——正文未编号的题，`每题以与正文相同的题号起头`无前件约束 ⇒ 反向强化编号。
    //    补前件（收窄）；并删同处题号形态示例"正文用 1. 2. 3.… 则答案同用同一套题号"（示例即默认·诱导源）。
    expect(conv, '自包含 once 须带"编号对象与正文一致"前件').toContain('正文未编号的题，答案同样不编号');
    expect(conv, '题号形态示例须已删（去诱导）').not.toContain('正文用 1. 2. 3.…');
  });

  it('PAPER_OUTPUT_CONVENTIONS.split：自包含教辅强调正文梳理不属于答案、无需答案区', () => {
    const conv = PAPER_OUTPUT_CONVENTIONS.split('语文', true);
    // 🔴 2026-10-13（第 1 批核证·F2／F3 合修·锁字面同步）：原锁字面为"知识梳理部分不属于“答案”"。
    //   因"知识梳理"是**具体栏目名**，而自包含教辅（dictation/errorbook/preview/summary/review）并无此栏
    //   ⇒ 声明无对应对象、且各科对其"算不算缺口"划线不一（一类两判）。改为**泛称"知识内容"**（等长 4 字·净零），
    //   对 5 类一律成立。**本条防回潮意图不变**：仍是"正文部分不属于答案、无需为它设答案区"。
    expect(conv).toContain('知识内容部分不属于“答案”');
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
    // 🔴 2026-10-12（S4 差集·禁令分诊 A15）：原句末两处反例（"上级已用「1.」…不得再用「1.」／「一、」…就不得再用「一、」"）
    //    属**举例当边界＋与正向重复** ⇒ 删；本用例判据不变（汉字序号被明确纳入"层级样式"）。
    expect(NUMBERING_HIERARCHY_RULE).toContain('「一、二、三…」汉字序号同样是一种样式');
    expect(NUMBERING_HIERARCHY_RULE, '反例式旧句不得回潮').not.toContain('下级就不得再用「一、」');
    // 🔴 2026-10-18（属主质询·删 4 项枚举）：原句列举 5 种样式（含"项目符号"）——枚举把注意力钉在
    //    "给每层挑一个样式"上，反过来**逼模型先把层级造出来**（＝造层级＋补小题号），且属**许可式**。
    //    ⇒ 删枚举、只留判据（同一层级只用一种样式／若确有不同层级各用不同样式）＋汉字序号澄清。
    //    本处改准为**反向锁**：判据仍在、枚举不得回潮。
    expect(NUMBERING_HIERARCHY_RULE, '判据仍在（同一层级只用一种样式）').toContain('同一层级只用一种样式');
    expect(NUMBERING_HIERARCHY_RULE, '"多层"须为条件式、不得预设').toContain('若确有不同层级');
    for (const form of ['1. 2. 3.…', '(1)(2)', '①②', '项目符号']) {
      expect(NUMBERING_HIERARCHY_RULE, `样式枚举不得回潮（${form}）`).not.toContain(form);
    }
  });

  // ⛔ 2026-10-10（属主裁定·**删编法规定·去约束**）：原"题号条款写明'小题号编法按学段'"**整档撤除**——
  //   小题号**编法**（小学本大题起编／中学全卷连续）已随 `QUESTION_NUMBERING_CALIBER` **整块删除**；
  //   "哪些题该编号"由【编号对象口径】单源承载，"号怎么排"**不作规定即最正规**。

  it('试卷大题只出一个标题：消除"小题标题"歧义（防 h2+h3 同号双标题）', () => {
    const t = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' }).template;
    expect(t, '歧义词"小题标题"须已消除——它在本项目另指"带题号的题目行"，模型会误读出"小组标题"层，'
      + '于是每道大题多出一个与 h2 同序号的 h3 标题（实证：一、读拼音，写词语 / 一、看拼音，把词语写在田字格里）')
      .not.toContain('小题标题');
    expect(t).toContain('每个大题只出一个标题');
    expect(t).toContain('小组标题');
  });
});

// ⛔ 2026-10-10（属主裁定·**删编法规定·去约束**）：原 `describe('🔢 题号编法口径…')` **整块撤除**——
//   `QUESTION_NUMBERING_CALIBER`（小题号编法：教辅按栏目起编／试卷全卷连续／小学各大题各自起编）已**整块删除**，
//   连同"不得跳号""同号同序""不得互相否定"等**约束性字面**一并从题号条与答案区条款移除。
//   理由（属主）："连续"这类字眼会被模型读成"每处都要有小顺序号才算连续" → 反过来**逼出硬编小题号**；
//   "哪些题该编号"由【编号对象口径】单源承载，"号怎么排"**不作规定即最正规**。
//   （原 6 档断言见 git 历史；其"相抵尾句已移除""编号对象由 QOC 单源承载"两条精神改由 `questionObjectCaliber.test.js` 承载。）

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
    // 🔴 2026-10-10（属主删编法规定）：`QUESTION_NUMBERING_CALIBER.teaching` 已整块删除，该"两层一致"断言随之撤除。
  });

  it('旧口径字面（教辅组标题"汉字序号（全卷连续、跨大类顺延不重复"）须已移除', () => {
    const p = practiceTpl();
    expect(p, '旧口径不得回潮').not.toContain('汉字序号（全卷连续、跨大类顺延不重复');
    expect(p).not.toContain('跨大类顺延不重复');
  });

  it('正式考卷：大题序号全卷连续（口径单源＝常量，模板只引用；与教辅分型）', () => {
    const e = examTpl();
    // 🔴 2026-10-11（T02·G31）：口径**单源＝GROUP_TITLE_NUMBERING_CALIBER.exam**，模板改成引用它；
    //   原模板内联的"不得重新从「一、」开始"（否定式）＋"（正式考卷口径）"（元话语）已删——
    //   同一判据由常量的**正向**表述"跨大类/部分继续递增"承载。另：结构块（buildStructureText）里的
    //   "大题序号按【编号与组织】全卷连续"半句已删（同一字面在注入文本里出现两次＝违"一处"）。
    expect(e).toContain(GROUP_TITLE_NUMBERING_CALIBER.exam);
    expect(e, '大题序号条仍在').toContain('大题序号');
    expect(e, '否定式不得回潮').not.toContain('不得重新从「一、」开始');
    expect(e, '元话语"（正式考卷口径）"不得回潮').not.toContain('（**正式考卷口径**）');
  });

  it('两口径单源常量各自成立，且条款显式声明"各自成立、不得互相否定"', () => {
    expect(GROUP_TITLE_NUMBERING_CALIBER.exam).toContain('跨大类/部分接着编');
    expect(GROUP_TITLE_NUMBERING_CALIBER.teaching).toContain('逐栏目（组）起编');
    expect(GROUP_TITLE_NUMBERING_CALIBER.teaching).toContain('进入下一栏目（组）即从「一、」重新起编');
    // 🔴 2026-10-10（属主删编法规定）：题号条/组标题条里"不得互相否定"（两口径分型尾句）已删，本条断言随之撤除。
  });

  // ⛔ 2026-10-10（属主裁定·**删编法规定·去约束**）：原"答案区同构（教辅按栏目（组）分组、与正文同号同序／
  //   试卷全卷连续）"**整档撤除**——答案区条款的"同号同序/全卷连续/按栏目（组）分组"已按同一裁定改为
  //   **"与正文同一套号（正文怎么编、答案就怎么对应）"**（不作编排规定）。

  it('程序侧同向：大题级序号判据仅 exam 生效（教辅不报）', () => {
    // 汉字序号大题级守卫：genTypes 仅 exam（教辅组标题"逐栏目（组）起编"是常态、非缺陷）
    const g = getValidatorRule('cn-ordinal-guard')?.genTypes || [];
    expect(g).toContain('exam');
    expect(g).not.toContain('practice');
    expect(g).not.toContain('special');
    // 🔴 2026-10-10（用户裁定·彻底砍"编号连续性"拦截·**先解后锁**）：原此条系**前向锁**（"重启"判据须在调用点按
    //    genType 分型）；该拦截已整体砍除（含"小学豁免"——无拦截即无误拦）⇒ 改为**反向锁**：调用点不得再出现
    //    "重启拦截"接线（编号连续性不得再代模型定卷面形态；编号对象口径见【题号与分值】，此处不复述其字面）。
    expect(readSrc('src/composables/useAiGenerator.js'),
      '重启拦截接线须已移除（编号连续性不得再代模型定卷面形态）')
      .not.toMatch(/genType === 'exam'[\s\S]{0,60}detectBodyNumberingRestart\(content\)/);
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
    expect(t, '归并依据以块名为参考（语义族断言，不锁字面）').toMatch(/【卷面结构】块名.{0,6}归并/);
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
    // 🔴 2026-10-15（属主裁定·域型名不加作答要求）：口径改准——原句"领域名直接作大题标题"并入
    //    bigTitleRule 新表述"按块名本身分两种：域型名→保持真卷样式、只作范围标识、不加作答要求"，
    //    此处锁同一口径的新落点（仍为【大题标题命名】bigTitleRule 单源）。
    expect(mid, '中学段领域名直接作大题标题（命名单源）').toContain('域型名（课标内容领域名／实践活动名');
    expect(mid, '域型名不加作答要求（属主裁定·保持真卷样式）').toContain('保持真卷样式、只作范围标识、不加作答要求');
    expect(mid, '中学段不作"大类名不得充当大题标题"（域型名即大题标题）').not.toContain('不得充当大题标题');
    const low = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' }).template;
    expect(low, '小学段不得被中学口径覆盖').not.toContain('中学段（初中/高中）不设大类层');
  });

  it('大类层之下层级：大类（居中无编号）→ 大题标题（一、、分值）→ 题号层（随该大题构成而定，**可以只有一层**）', () => {
    const t = examTpl();
    // 🔴 2026-10-16（连通组·编号组·就地展开）：原锚"大类层下两层展开…其下应编号的题用题号"——
    //    "应"的条件在别块（编号对象口径）。现就地给**正面出口**（"可以只有大题标题一层"），
    //    并删掉句尾元话语＋双指向。本锚随新口径改锁（判据本体仍单源在编号对象口径，未复述）。
    expect(t, '层级形态：大题标题用 h2').toContain('大类层之下');
    expect(t, '正面出口：可以只有大题标题一层（不为连续性补号）').toContain('可以只有大题标题一层');
    // 🔴 2026-09-27：原句「不是照抄它行首的调研分类名、也不得改写成近义说法」是**否定映射**
    //    （要读懂须先建立"分类名 ↔ 标题"这条映射 = 反向植入）；改**正向角色陈述**，口径不放松（标题仍自拟）。
    expect(t, '大题标题仍自拟（分类名只描述范围）').toContain('行首分类名与其中的知识点名只描述命题范围');
    expect(t, '标题自拟要求不得丢').toContain('大题标题须你按本卷实际的作答方式自拟');
    expect(t, '否定映射不得回潮').not.toContain('不是照抄它行首的调研分类名');
    // 🔴 2026-10-10（属主裁定·**删编法规定**）：原两条"小题号编法（小学本大题起编／中学全卷连续）"断言
    //   **撤除**——小题号**编法**已整块删除（不再规定"号怎么排"，也不作学段分叉）；"哪些题该编号"由
    //   【编号对象口径】单源承载。
    // 🔴 2026-10-01（结构清晰·分值集中）：大类级账目闭合已并入【分值】条的算式判据（原在"大类层下两层展开"
    //    条末——同判据跨两条），措辞随之改准为"…＝该大类在【卷面结构】的总分"。
    // 🔴 2026-10-16（属主裁定·**分值只做参考**）：结构行分值改标"参考"⇒ 大类级的对标物不再是"结构里的总分"
    //    （那已是参考值），改为**该大类层自身所标总分**（其下各大题分值合计须等于它——同一份卷面内部自洽）。
    // 🔴 2026-10-16（属主"要的"·**部分层一并纳入**）：原句只写"设大类层时"，**英语的"部分层"（听力部分/笔试部分）
    //    从来不在其管辖**（部分小计无账目判据）⇒ 改"**设大类层或部分层时，该层下各大题分值合计＝该层所标总分**"。
    // 🔴 2026-10-17（属主：逐层对账是**模型侧要求**，程序侧不校验不改写）⇒ 三层加总式在位
    expect(t, '逐层加总判据在位').toContain('大题总分＝其下各带号题分之和');
    expect(t, '旧「大类（或部分）总分＝…」层级账目不得回潮').not.toContain('大类（或部分）总分＝');
    expect(t, '旧句"＝该大类在【卷面结构】的总分"不得回潮（对标参考值）').not.toContain('该大类在【卷面结构】的总分');
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
    // 🔴 2026-10-11（属主·自洽体检）：措辞改中性（去"小题"预设）——"大题标题与**题面**不得同文或近义重复"。
    expect(t, '禁止题面重复大题标题').toContain('大题标题与题面不得同文或近义重复');
    // 🔴 2026-10-05（用户实测·判据改精准）：原落点"说清本组怎么做或选什么"太松——产物「读一读，选一选」字面即满足；
    //    改锚到「考查点」，并要求不得泛说（情境词由【情境边界】"结构层一律不出现情境词"另行约束）。
    expect(t, '大题标题须点明考查点与作答方式（不泛说）').toContain('这组考什么、怎么答、答在什么载体上');
  });

  it('分值两处都标 + 大题内分值账目闭合 + 大题序号全卷连续', () => {
    const t = examTpl();
    // 🔴 2026-10-10（〔347〕促规范·去约束）：原"大题级必须给分值说明、不得省略"（约束语气）改促规范式"大题标题带分值说明"。
    expect(t, '大题标题带分值说明（促规范式）').toContain('标题写"（共X分）"');
    // 🔴 2026-10-10（〔347〕）：原"不等分时，逐题标"（分设两态）收敛为一句。
    // 🔴 2026-10-16（N3 句内自相矛盾）：原句"各题分值不一时只写总数，不等分时该题分值随该题标出"——
    //    同一条件（不等分）先给"只写总数"再给"随该题标出"，字面自相矛盾 ⇒ 合一。
    // 🔴 2026-10-17：文本措辞收短（"大题标题"→"标题"，因同句前半已限定大题标题）⇒ 断言改语义族。
    expect(t, '该题分写在该独立题干后（逐题累加＝大题总分）').toContain('每条末写"（每〈单位〉X分，共X分）"');
    // 🔴 2026-10-09（面5·去"小题"预载）：分值条对象锚改中性词"题"（与 QOC 中性口径一致），防"小题"回潮——
    //    "小题"作预载会把"必配小题号"写进前提（〔281〕#2 已点名），与 QOC"题号只给独立作答单位"不同口径。
    expect(t, '去"小题"预载（改中性词"题"）').not.toContain('有独立设问的小题在其题干后逐题标分');
    expect(t).toContain('**大题总分＝其下各带号题分之和');
    // 🔴 2026-10-06（A5 账目·第二次命中·补前提）：原式无前提——对"整栏一题（无小题号）"的大题，
    //    "小题分之和=大题总分"无从成立 → 反拉模型逐项编号凑小题分（实测：比一比再组词 长出 1./2./3./4.，
    //    且一~八无小题分、九+有）。补前提"无小题分则不涉"，与分值条"号分同源（无小题号即不再逐项标）"自洽。
    expect(t, '分值只约束写法（标题共X分＋每题干单价）').toContain('每条末写"（每〈单位〉X分，共X分）"');
    // 🔴 2026-10-10（面5·去"小题"预载·用户裁定收口）：分值条/账目条的"小题级按需""未分设小题"等**预载**
    //    会把"必配小题号"写进前提 ⇒ 一律改中性词"题"。本条为锁：不得回潮。
    expect(t, '去"小题"预载（分值条/账目条改中性词"题"）').not.toContain('小题级按需');
    expect(t, '去"小题"预载（账目前件改中性词"题"）').not.toContain('大题未分设小题时不涉');
    // 🔴 2026-10-03（口径改准·分值根治）：原句"题量与分值都要写出真实数字（不得照抄占位字面）"已收口为
    //    **锚定式**——分值取【卷面结构】给定值，题数/空数/单价据之定妥（乘积恒等于该分值）：
    //    真实数字由**构造**保证（题数、单价被给定分值唯一确定），不再以"真实数字"泛述+括注兜底。
    // 🔴 2026-10-17（作废旧分值表述·单源到 576）：原「分值说明＝本大题实际多少分」已删（与 576"标题写（共X分）"重复）
    expect(t, '标题分值说明单源＝（共X分）').toContain('标题写"（共X分）"');
    expect(t, '旧「分值说明＝本大题实际多少分」不得回潮').not.toContain('分值说明＝本大题实际多少分');
    // 🔴 2026-10-04（逐块通读·第3组 账目两处合一）：大题标题条尾原含「（乘积恒等于该分值）」＝下方「账目算式判据」条的
    //    复述 → 已删；账目闭合的**正句**在「账目算式判据」条。此处锁两条：① 定妥顺序判据仍在 ② 账目闭合正句在位。
    // 🔴 2026-10-10（〔347〕消逆序·立正序）：原"作答位数与单价据之定妥，再据之生成内容"＝**以分为前提定内容**（逆序、
    //    逼凑）→ 删；改**正序正句**"分值由内容如实产出、事后与给定值对账"。
    // 🔴 2026-10-16（F 根治·消方向相抵）：本条原锁 2026-10-15 的"分值以【卷面结构】给定值为准、内容按分值给足"
    //    （分值←结构），与同块后来落地的"【卷面结构】各处所标的分**不采纳**／各大题多少分按实际内容分配"
    //    （分值←内容，属主 2026-10-16 裁定）**同句两个方向** ⇒ 模型照抄结构分值、内容却随手产出
    //    ⇒ 实测"（每空1分，共24分）"而实贴 21 处。现按最新裁定收单方向。本条为锁：旧正句不得回潮。
    // 🔴 2026-10-17（逐层验归位）：原"本大题分值＝单价×该大题实际判分处数"是**整大题一次乘法**（需先有"整大题判分处总数"，
    //    等于又逼模型去数/编号）；现改为**逐题**：各独立题干分＝该题单价×该题判分处数，大题总分由其累加。
    expect(t, '正序：先定单价、再乘个数').toContain('先定单价、再乘个数');
    // 🔴 2026-10-16（属主"填空题按小题标分"）：计分自证由**大题级除法**（共Y分÷单价＝总数）下沉为**题级**
    //    （该小题分值＝该小题判分处数×单价）。大题级除法正是"空与分值对不上"的来源——模型数不准整大题的空；
    //    改成题级后只需数本小题的空（属主："模型数一个小题的空，是好数的"），且不产生"总分÷单价除不尽"。
    // 🔴 2026-10-17（作废旧分值表述·单源到 577）：计分对象口径里原「由它自证：逐题…逐题累加（不在整大题上做除法）」
    //    与 577 的四层账目重复 → 已删；自证口径**只在 577** 承载（逐题：该题分＝该题单价×该题判分处数）。
    expect(t, '逐层加总单源＝577').toContain('大题总分＝其下各带号题分之和');
    expect(t, '旧自证句不得回潮（与 577 重复）').not.toContain('逐题数出各小题的判分处数');
    expect(t, '旧"不在整大题上做除法"随之删除（方向由 576"先定单价、再乘个数"承载）').not.toContain('不在整大题上做除法');
    expect(t, '旧大题级除法自证不得回潮（"共Y分"÷X＝该判分处的实际个数）').not.toContain('该判分处的实际个数');
    expect(t, '分值标注：该题分写在该独立题干后（逐题累加＝大题总分）').toContain('每条末写"（每〈单位〉X分，共X分）"');
    // 🔴 2026-10-16（属主"真题惯例每空1分，能不能把空和分对应上"）：对应关系靠**逐题正推**成立——先逐题数出
    //    各小题的判分处数、逐题累加（粒度＝本小题的 3~4 空，属主："模型数一个小题的空，是好数的"）；
    //    旧口径的"共Y分÷单价＝实际个数"是**反向**自证（先有总分再要求产出个数），正是"空与分对不上"的来源。
    expect(t, '旧反向自证"共Y分÷单价＝实际个数"不得回潮').not.toContain('该判分处的实际个数');
    expect(t, '编号与组织：不得预设子层（"子题用 (1)(2)"须已删，改为层级式）').not.toContain('子题用 (1)(2)');
    expect(t, '旧"内容按分值给足"不得回潮（与"结构所标不采纳"相抵）').not.toContain('内容按分值给足');
    // 🔴 2026-10-16（属主"参考意图再明示"·真机仍倾向抄）：明示落点须在**【卷面结构】块头**（紧邻数据，
    //    比跨块的账目条更近使用点），且措辞须直白到不可误读（"不是标题里要填的数字"）＋给正向出口。
    expect(t, '结构分值的"参考"意图须在块头明示（"不是标题里要填的数字"）').toContain('所标分值只是份量参考，不是标题里要填的数字');
    expect(t, '须给正向出口（标题分值按该大题实际内容得出）').toContain('标题的分值说明按该大题实际内容得出');
    expect(t, '旧弱表述"只作各板块的份量参考"不得回潮（离使用点太远）').not.toContain('所标分值只作各板块的份量参考');
    // 🔴 2026-10-16（属主"**结构与分值都是参考，两者都要明示**"·模型两者都在抄、且为贴合结构硬凑题）：
    //    结构侧明示＝① 板块构成也是参考、可增可减；② 内容与板块不合时不必硬凑题（可去掉/另立板块）。
    // 2026-10-19（§30 结构/要求注降为参考）：原句"板块构成与所标分值都只是参考、可增可减"扩到
    //   "行内每条要求注写到的呈现形态"，并给"按等效形态落实、标题随实际形态写"的出口 ⇒ 断言改准（语义族）。
    expect(t, '结构侧"参考"意图须明示（板块构成/分值/要求注的呈现形态都是参考、可增可减可换）')
      .toContain('板块构成、所标分值、行内每条要求注写到的呈现形态都只是参考、可增可减可换');
    expect(t, '给不出该形态时的出口须在位').toContain('按等效形态落实、标题随实际形态写');
    expect(t, '内容与板块不合时不得硬凑题（可去掉/另立板块）').toContain('不得为贴合结构硬凑题');
    expect(t, '另立板块的出口仍在').toContain('可增设或另立更贴切的板块');
    expect(t, '旧弱表述"不得为填满结构而硬凑"不得回潮（只管"填满"、盖不住"贴合"）').not.toContain('不得为填满结构而硬凑');
    expect(t, '逆序句不得回潮（不得再以分为前提定内容）').not.toContain('作答位数与单价据之定妥');
    expect(t, '账目闭合正句在位（单源）').toContain('试卷总分＝各大类分之和');
    // 🔴 2026-10-05（用户裁定·分值标注统一）：原分型（"逐个作答位计分写共N单位每单位X分／整栏一次计分只写总分"）
    //    +"同型客观小题只在大题级标一次"的例外 → 统一为「大题标题只写总分＋有独立设问的小题逐题标分＋整除」。
    // 🔴 2026-10-10（用户裁定·分值标注统一·含单价）：2026-10-05 曾因"单价无法精准落点"退让为「大题标题只写总分」；
    //    现账目判据可精准派生单价 ⇒ 大题标题**含单价**（全大题为一题时写"（每题X分，共Y分）"、分设多题时"（共Y分）"）。
    // 🔴 2026-10-17（单价落点归位）：原文本误落"写在该大题各独立题干后"（与本节注释"标题含单价"相反，
    //    真机实证 A+B"没生效"）⇒ 已改回标题承载；断言按语义族锁。
    expect(t, '分值标注统一：标题写共X分（单价写各独立题干后）').toContain('标题写"（共X分）"');
    expect(t, '该题分写在该独立题干后（逐题累加＝大题总分）').toContain('每条末写"（每〈单位〉X分，共X分）"');
    // 🔴 2026-10-06（面5 账目·消相抵·用户纠正对象）：原"**总分须被小题数整除**"**对象选错**——
    //   分值是落在"空"上的（"3空2分不好算"＝分÷空除不尽），与"小题个数"无关；且大题级一律"÷作答位"
    //   会把混合分值的真题大题（"二、阅读（35分）"4 小题=8+9+8+10、8 个作答位）判死（作用域过宽）。
    //   正解：**对象＝该级分值所辖的计分对象**，**作用域＝"所辖的"已表达**（同型并列统一计分的那批）。
    // 🔴 2026-10-09（面4 账目·联动精准化）：对象锚由"作答位"提为"**计分对象**"——作答位只含"空/格"，
    //   盖不住"连线组/线"（程序链 `fixScoreLabel` 认 空/线/组/题/字/词 六种）；改关系式锚后 cell↔程序**同口径**。
    //   同步补**联动闭合式**"计分对象数×单价＝该题分"（单向：分值取给定、不返改分值），删主观词"好算"。
    // 🔴 2026-10-10（〔347〕促规范·去过度约束）：原"该级分值须被其所辖的计分对象数整除"＝把"整除"当**要求**去满足
    //    ⇒ 逼模型凑数量/拉平单价（以数为前提）；整除本是"单价×数量＝总分"的**结果**，删该要求（本条改锁为"不得回潮"）。
    expect(t, '账目不再以"整除"为要求（改为结果/对账）').not.toContain('该级分值须被其所辖的计分对象数整除');
    expect(t, '该题分写在该独立题干后（逐题累加＝大题总分）').toContain('每条末写"（每〈单位〉X分，共X分）"');
    // 🔴 2026-10-10（〔347〕）："未分设题时÷本大题计分对象数"随"整除"一并删（不得回潮）。
    expect(t, '整除两态正句不得回潮').not.toContain('未分设题时÷本大题计分对象数');
    // 🔴 2026-10-10（〔347〕去重·单源）：原"计分对象数×单价＝该题分"与【计分对象】口径条"单价单位须与实际判分处一致"**同义复述**
    //    ⇒ 删；该约束由【计分对象】口径条单源承载。本条为锁：不得回潮。
    expect(t, '账目联动闭合式不得与计分对象口径条重复（单源）').not.toContain('计分对象数×单价＝该题分');
    // 🔴 2026-10-09（面4 账目·去主观残渣）：旧句尾"除得尽、好算"——"好算"无判法（方向词）→ 删。
    expect(t, '账目判据不得残留主观方向词"好算"').not.toContain('好算');
    // 🔴 2026-10-06（面5·消"小题号"诱导源）：原"题号与分值同源：有小题号就有小题分"以"小题号"为先决条件
    //    （诱导模型编小题号）、"账目里的小题数"同源 → 改锚"是否独立设问"、改"题量"。本处为**反向锁**，防回潮。
    expect(t, '以"小题号"为先决的诱导句须已移出').not.toContain('有小题号就有小题分');
    expect(t, '账目"小题数"字面须已改"题量"').not.toContain('账目里的**小题数**');
    // 🔴 2026-10-05（用户裁定）：原"同型客观小题只在大题级标一次"的例外（真题：武平县「一、选择题。（每题2分，共20分。）」）
    //    与"整卷标注方式统一"相抵 → 已删；选择/判断同样逐题标分，全卷一种标注方式。
    // 🔴 2026-10-17（单价落点归位：标题承载）：本条原锁"全大题按同一单价计分时含单价"（旧文本把它落在各独立题干后）。
    //    现文本＝同单价时**标题**写"（每〈单位〉X分，共Y分）"、题内不逐条复述；判据延用：全卷一种标注方式、不按题型分型。
    expect(t, '分值标注统一（例外已删、不再按题型分型）').toContain('标题写"（共X分）"');
    expect(t).toContain('大题序号');
    expect(t, '口径单源＝常量，模板只引用').toContain(GROUP_TITLE_NUMBERING_CALIBER.exam);
    expect(t, '否定式不得回潮').not.toContain('不得重新从「一、」开始');
    expect(t, '旧的"跨部分不顺延不重复"自相矛盾句须已移除').not.toContain('跨部分不顺延不重复');
  });

  it('🔴 题号对象唯一主键（2026-10-05 用户报障·根治）：题号只给"独立设问的题"；计分单位不改变题号对象', () => {
    const t = examTpl();
    // 报障：大题＝一题时仍长出"1. 直接写出得数。"（又给小题号＋复述题干）。根因＝题号条句首**无条件**要求
    //   "题目…带题号"，与编号对象口径（同型并列整栏算一题）相抵；模型二选一→选了给号。锁四处收口后的判据。
    expect(t, '题号对象：每个独立题干都用 question 包裹（给不给号都包裹）').toContain('每道要作答的题用 <p class="question"> 包裹');
    expect(t, '层级形态：题号层随该大题实际构成而定').toContain('**题号层随该大题实际构成而定**');
    // 🔴 2026-10-09（〔286〕根因·清双源相抵）：原卷面层级条自定判词"有独立设问的小题"与 QOC"逐项设问不同才编号"
    //    对"题干同文、只换材料"态**给相反答案**（模型倒向给号）。现卷面层级**不再自定判词**、改指【题号与分值】，
    //    编号对象判词唯一源＝QOC。本处锁：该自定判词不得回潮。
    expect(t, '卷面层级不再自定编号对象判词（防与 QOC 双源相抵）').not.toContain('**有独立设问的小题**用 1. 2. 3.…');
    expect(t, '题数 X 已废（结构不再给题数；题量＝命题设计结果）').not.toContain('题数 X');
    // 🔴 2026-10-05（实测二轮）：只写"不再另起小题号"还不够——题号条句首"每个…题以 <p class="question"> 包裹"
    //    是格式硬要求，模型仍造一条 <p class="question"> 行（实测产物「1. 看拼音，写词语。」＝号＋复述）。
    //    故把"题干行"一并点掉；【卷面自洽】里同义的"不另起小题号"由本条单源承载（已收口）。
    // 🔴 2026-10-11（属主·自洽体检）：判词改中性（去"小题"预设）——"其下不再另起**题号**与题干行"。
    expect(t, '唯一题不再另起题干行（治「1. 直接写出得数。」）').toContain('其下不再另起题号与题干行');
    // 答案区不得再"特指阿拉伯题号"（否则大字序号、小学分段号一律违令）
    expect(PAPER_OUTPUT_CONVENTIONS.once('语文', false)).not.toContain('阿拉伯题号');
  });

  it('自洽①判据域=题面（凡卷面上出现的说明性文字都算），不再只认"题干"', () => {
    const t = examTpl();
    expect(t).toContain('凡卷面上出现的说明性文字都算');
    expect(t).toContain('题面怎么说、卷面就怎么做');
    expect(t, '旧判据域"只认题干"须已扩为"题面"').not.toContain('判据只有题干自身措辞');
    // 🔴 2026-10-18（属主质询·删枚举）：原括注枚举"含题干、标题行、要求行、材料引导语"——枚举被读成
    //    "照这些项去造"（＝补小题号／重复标题的诱导源之一）⇒ 删枚举、只留外延判据"凡…说明性文字都算"。
    expect(t, '题面枚举不得回潮').not.toContain('含题干、标题行、要求行、材料引导语');
  });

  it('📐 面10（载体↔所填内容）复诊：形态按所填内容定 + 性质不同者各自成形（治"整卷清一色括号"）', () => {
    const t = examTpl();
    // 🔴 2026-10-06（面10 复诊·用户实证"整份内容全是括号、该是横线的地方也是括号"）：
    //   面10 正句（layoutSpec 作答位条款）本身在位且判据式（按所填内容定）；缺的是**跨空/跨题**那一态——
    //   ⑧ 原只写"性质相同→整份统一"（正句），**"性质不同→各自成形"整支缺** ⇒ 模型/程序（块级单向→括号）
    //   把"一处声明"外溢成"一卷一种形态"。本轮在 ⑧ 补该态（与"同性质统一"对称，仍是唯一正句），口子堵死。
    expect(t, '形态按所填内容定（面10 判据式在位）').toContain('具体形态**按所填内容定**');
    expect(t, '同性质→整份统一（正句在位）').toContain('在整份卷内用同一种形态');
    expect(t, '性质不同→不得整卷同形（本轮补的缺态）').toContain('性质不同者不得整卷同形');
    expect(t, '该是括号就括号、该是横线就横线（用户口径落字面）').toContain('该是括号就括号、该是横线就横线');
    // 反向锁：旧枚举半句（"以√×作答的位、以选项字母作答的位等同类作答位同样统一"）与"同类统一"正句同义复述 → 已删，不得回潮
    expect(t).not.toContain('以选项字母作答的位等同类作答位同样统一');
  });

  it('大题级分值说明为必须项（**仅试卷**，不得外溢到教辅）', () => {
    const t = examTpl();
    expect(t, '大题标题带分值说明（促规范式）').toContain('标题写"（共X分）"');
    expect(t, '该题分写在该独立题干后（逐题累加＝大题总分）').toContain('每条末写"（每〈单位〉X分，共X分）"');
    const practice = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'practice' }).template;
    expect(practice, '分值说明条款只针对试卷类型（教辅不注入）').not.toContain('大题标题带分值说明');
  });

  it('情境边界：情境不改写卷面结构层 + 正式卷禁游戏化包装（**仅试卷**）', () => {
    const t = examTpl();
    expect(t).toContain('情境边界');
    expect(t).toContain('不得替代或改写卷面结构层');
    // 🔴 2026-09-27 改**原则式**：原写"严禁'第X关/闯关/集齐宝石'"＝否定式列举（会把禁词反向植入、反而引模型往那去）
    expect(t, '严肃卷面：原则式表述').toContain('按正规考试的严肃卷面呈现');
    expect(t, '情境只作真实/拟真语境承载、不作形式化包装').toContain('不作任何形式化包装');
    // 🔴 2026-10-06（面6·用户追问"只在标题里硬用情境包装"）：把"采用态"的**判定来源**写成正面判据——
    //   原只靠"开关块为空则未采用"的**缺席推理**，叠加同段课标"以情境为载体"的正向推力，
    //   模型会**自拟情境名/关卡名**（实测：大题标题带"游园会…闯关"而内容并无该情境）。
    // 🔴 2026-10-12（S4 差集·属主方向「情境是交给模型按所选教材内容定的」）：原句"**只由用户设置给定…不得自拟**"
    //    与产品意图相反（情境**内容**本就该由模型按所选教材定）；且与【卷首】"以注入的组织风格为准"**双单源相抵**。
    //    ⇒ 单源化：**有无** 只由【卷首】定（组织风格）；【情境与页码】只留**内容侧**正向判据。
    expect(t, '有无统一情境：单源在【卷首】（以注入的组织风格为准）').toContain('以随本委托注入的组织风格为准');
    expect(t, '情境内容：由模型按所选教材范围与内容确定（正向）').toContain('采用时由你按所选教材范围与内容确定情境');
    expect(t, '旧"不得自拟"否定式 + 双来源不得回潮').not.toContain('只由用户设置给定');
    // 🔴 2026-10-06（用户追问"非空时＝真实情境内容？"）：**非空态**原只被"落点限制＋标题侧相符"覆盖——
    //   "情境名另起一行、内容里毫无该情境"仍可钻过。补**正面判据**：采用时情境须真落进题目与材料。
    // 🔴 2026-10-10（〔348〕促规范·去否定式并置）：原句尾"不得只在标题或栏名上贴标签"——**否定式把"标题"与情境并置**
    //    （与〔345〕已从运行时块删掉的"不得只在卷首或标题提一句"同型）⇒ 删；只留正向"采用时情境须真实落进题目与材料"。
    expect(t, '采用态：情境须真落进题目与材料').toContain('并真实落进题目与材料');
    expect(t, '否定式"不得只在标题…"不得回潮').not.toContain('不得只在标题');
    // 🔴 2026-10-10（〔348〕旧锚改正向）：原锚"情境名/关卡名/情境词另起一行"——"另起一行"＝一次**结构层动作**，
    //    与同句"不得替代或改写卷面结构层"**相抵**（模型据此把情境名并进大题标题）⇒ 删；改**正向**
    //    "大类层、大题标题与题干行…一律不出现情境词"。本条为锁：旧锚不得回潮、正向锚须在位。
    // 🔴 2026-10-16（属主"抓本质"·位点级收口 X1）：原锚"结构层一律不出现情境词"是**为对冲"前后呼应"而生的禁令**
    //    （同一位点一邀一禁、方向相反）⇒ 本轮**两条一起撤**，只留正向分工句。改锁正向，并防旧禁令回潮
    //    （禁令与邀请同源：回来一个必带另一个）。
    expect(t, '情境词抑制改正向：情境由题目与材料承载、不靠标题承载').toContain('情境由题目与材料承载，不靠标题承载');
    expect(t, '旧禁令"一律不出现情境词"不得回潮').not.toContain('一律不出现情境词');
    expect(t, '情境名"另起一行"式旧锚不得回潮').not.toContain('情境名/关卡名/情境词另起一行');
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
    // 🔴 2026-10-16（位点级收口 X1）：删"卷首导语与大题标题**同进同退**"这层关系——它就是**"教模型包装标题"的邀请**。
    //    卷首导语条款本体保留（是否采用＝以组织风格为准／采用时即统一情境／未采用时不写）。
    expect(t, '未采用统一情境时不写卷首导语').toContain('不写卷首导语');
    expect(t, '旧"同进同退"关系不得回潮').not.toContain('同进同退');
    expect(t, '有导语＝全卷统一情境').toContain('统一情境');
    expect(t, '无导语＝大题标题走严肃功能性命名').toContain('功能性');
    // 🔴 2026-09-30（用户裁定·去指向性诱导）：原断言锁"不得使用情境化/主题化/故事化命名（…如"云朵出发"这类）"，
    //    该写法是**否定式举例**（要读懂须先激活"云朵出发"这个形象＝反向植入，且样例自造）→ 已改正向陈述；
    //    本断言随之改锁**正向表述**，意图不变（无导语时标题是功能性名称、不写场景名或故事名），并防样例回潮。
    expect(t, '无导语时标题为功能性名称（正向）').toContain('功能性名称');
    // 🔴 2026-10-12（S4 差集·禁令分诊 A9）：同 nonInducingPrompt——删否定式、意图由正向锚承载。
    expect(t, '标题命名意图须由正向锚承载（功能性名称）').toMatch(/标题只写功能性名称|功能性名称，不得泛说/);
    expect(t, '否定式旧句不得回潮').not.toContain('不写成场景名或故事名');
    // 🔴 2026-10-09（〔291〕情境词锚族·扩锚＋消相抵）：原锚只禁"场景名/故事名"，对**情境词（修饰语）**（如"春日"）够不着；
    //    且 bigTitleRule"与卷首导语主题情境前后呼应"× 情境条"不并入其名"**同对象反方向相抵**（模型据"呼应"把情境词
    //    塞进题名，实测"一、春日词语我会认…"）。现① 扩锚到"情境词"；② 明写"呼应由题目与材料承载、标题只写功能性名称"
    //    以消相抵。本处锁：扩锚与消相抵均不得回退。
    // 🔴 2026-10-12（S4 差集·禁令分诊 A9）：原锁的否定式"也不得在标题上叠加情境词"已删（与正向重复）
    //    ⇒ 改锁**正向可判法**（扩锚到"情境词"的意图不变、且更可判）。
    expect(t, '标题不得叠加情境词（扩锚·正向可判法）').toContain('大题标题本身须是完整的作答要求');
    expect(t, '否定式旧句不得回潮').not.toContain('也不得在标题上叠加情境词');
    // 🔴 2026-10-16（属主"抓本质"）：2026-10-09 那次处置是**加括注软化**（"呼应由题目与材料承载"）——
    //    括注敌不过主句，本次真机复发（"一、小水滴口算接力"）⇒ 本轮改为**删邀请本身**（"前后呼应"整句删）。
    expect(t, '旧"前后呼应"邀请不得回潮').not.toContain('前后呼应');
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
