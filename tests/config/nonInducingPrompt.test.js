import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getPromptTemplate,
  SUBJECT_STAGE_EXTRAS,
} from '../../src/config/promptLibrary.js';
import {
  TEACHING_BLUEPRINTS,
  TEACHING_SUBJECT_BLUEPRINTS,
} from '../../src/config/teachingBlueprints.js';
import {
  styleInstructions,
  styleOptionsForType,
} from '../../src/config/expertKnowledge.js';
import { EXAM_BLUEPRINTS } from '../../src/config/examPaperBlueprints.js';
import { GENERIC_SPECIAL_DESC } from '../../src/config/specialDomains.js';
import { buildAnswerSpaceInstruction, buildCarrierInstruction } from '../../src/config/layoutSpec.js';
import { buildMaterialUsageBlock, buildOrganizeBlock, buildTailBlocks } from '../../src/utils/injectionManifest.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

/**
 * 防诱导不变量（2026-09 用户定稿）：
 * 提示词不得以"待达成目标"列举具体呈现形式/组织序列/递进链名（表格/导图/条目、识记→理解→运用…），
 * 一律删成原则句。豁免且仅豁免两类：渲染/卷面契约（HTML 结构、答题书写规范如"解→公式→代入→计算→答"）、
 * 学科既定答题书写规范。本测试锁死不变量，防止回归。
 */
const BANNED_ENUM = [
  '表格/对比/分层条目优先', // CONTENT_FORMAT 旧枚举
  '识记→理解', // review/蓝本 递进链
  '概念—法则', // summary 递进链
  '基础→进阶', // practice 递进链
  '信息提取→', // reading/specialDomain 思维链
  '区域定位→', // 地理 命题路径
  '原理→材料', // 思想政治 命题路径
  '基础通读→', // preview/蓝本 递进链
  '总主题→', // mindmap 呈现风格链
  '知识框架→核心', // framework 呈现风格链
  '导图/表格/对比优先', // 知识框架栏 呈现枚举
  '地图/表格/对比优先',
  '表格/对比优先',
  '时间轴/表格/导图优先', // 历史 知识框架栏
  '导图/表格/流程图优先', // 信息技术 知识框架栏
  '板块内由易到难', // 分板块组织 重复尾句
  '结构图或表格', // 知识框架栏 固定双形式枚举
  '知识框架以表格对比为主', // 语文中段 呈现枚举
  '基础→提升→拓展', // 分板块组织 note/专项结构 递进链
  '鉴赏沿', // examPaper 语文鉴赏题 答题路径链
];

const WHITELIST_KEEP = [
  '解→公式→代入→计算→答', // 物理答题书写规范，保留
];

const GEN_TYPES = ['exam', 'practice', 'special', 'reading', 'summary', 'review', 'preview', 'dictation', 'errorbook'];
const GEN_STAGES = ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'];
const GEN_SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '道德与法治', '科学', '信息技术', '体育', '美术', '音乐'];

function assertNoBanned(str, ctx) {
  for (const w of BANNED_ENUM) {
    expect(str, `${ctx} 不应含有诱导枚举「${w}」`).not.toContain(w);
  }
}

describe('防诱导不变量：提示词不枚举呈现形式/组织序列', () => {
  it('蓝图库（9 类结构 + 各学科专属）不含诱导枚举', () => {
    const raw = JSON.stringify({ TEACHING_BLUEPRINTS, TEACHING_SUBJECT_BLUEPRINTS });
    assertNoBanned(raw, '蓝图库');
  });

  it('学科定制 note 不再用「板块间由浅入深」等自造层次指向（2026-09-16 课标原则）', () => {
    const raw = JSON.stringify(TEACHING_SUBJECT_BLUEPRINTS);
    // 🔒 2026-09-16 用户裁定：课标原文/原义留、完全自编的清——
    //    "由浅入深/板块间"是我们自造的层次指向（课标只给"学习理解→应用实践→迁移创新"这类活动类型），
    //    已按同批口径删除；旧句"板块内由易到难"同样不得回潮。
    expect(raw).not.toContain('板块间由浅入深');
    expect(raw).not.toContain('板块内由易到难');
    expect(raw).not.toContain('由浅入深');
  });

  it('全部 9 类提示模板不含诱导枚举', () => {
    for (const g of GEN_TYPES) {
      const tpl = getPromptTemplate({ genType: g });
      assertNoBanned(tpl, `模板类型 ${g}`);
    }
  });

  it('学科×学段要点（SUBJECT_STAGE_EXTRAS）不含诱导枚举', () => {
    const raw = JSON.stringify(SUBJECT_STAGE_EXTRAS);
    assertNoBanned(raw, 'SUBJECT_STAGE_EXTRAS');
  });

  it('呈现风格指令（含助选 tip）去内部枚举链（G）', () => {
    const styleStr = JSON.stringify(styleInstructions);
    assertNoBanned(styleStr, 'styleInstructions');
    const options = styleOptionsForType ? JSON.stringify(styleOptionsForType('summary')) : '';
    assertNoBanned(options, 'styleOptionsForType');
  });

  // 🔴 2026-09-16（用户裁定·情境口径归课标）：
  //    ① 风格描述（desc/tip）曾残留产品自造的"贴近学生生活/生活主题"情境取向——跨学科把所有学科推向
  //       "校园/家庭"（情境同质直接推力，实证：连续两稿五情境全是"参加学校活动→遇困难→被鼓励→尽力而为"）；
  //    ② framework.desc 承诺"辨析"而注入句只讲"梳理与自测"（界面与实发不一致）；
  //    ③ traditional 注入句"题型按学科通行形态"是注入文本中最后残留的"题型"字样。
  //    ④ useAiGenerator 情境框架预生成段曾写"学生生活紧密相关/至少3个场景/suitableTypes 题型字段/
  //       知识点均匀分布"——数量、配比、题型三类诱导 + 情境取向，与 09-15 从 styleInstructions 裁掉的同源。
  it('组织风格描述与情境框架归课标：无生活取向/辨析承诺/题型词/数量配比题型诱导（2026-09-16）', () => {
    const styleStr = JSON.stringify({ ...styleInstructions, options: styleOptionsForType('practice').options });
    expect(styleStr).not.toContain('生活');
    expect(styleStr).not.toContain('辨析');
    expect(styleInstructions.context_chain).not.toContain('情境自然连贯');
    expect(styleInstructions.traditional).not.toContain('题型');
    const gen = fs.readFileSync(path.join(ROOT, 'src', 'composables', 'useAiGenerator.js'), 'utf8');
    expect(gen).not.toContain('学生生活紧密相关');
    expect(gen).not.toContain('贴近学生生活');
    expect(gen).not.toContain('至少3个场景');
    expect(gen).not.toContain('suitableTypes');
    expect(gen).not.toContain('均匀分布');
    expect(gen).not.toContain('适合的题型');
  });

  it('考卷蓝本（EXAM_BLUEPRINTS）不含诱导枚举（含鉴赏路径链）', () => {
    const raw = JSON.stringify(EXAM_BLUEPRINTS);
    assertNoBanned(raw, 'EXAM_BLUEPRINTS');
  });

  // 🔒 2026-09-17 口径升级：原断言曾锁定"由浅入深"为专项说明的"梯度原则"——与 09-16 课标原则
  //    （自造层次/梯度取向词全清，TPL_BANNED 已禁"由浅入深/设问有梯度"）冲突，属旧裁定残留。
  //    现改锁中性口径：保留结构名"分板块组织"，禁止 层级/梯度/由浅入深/递进链 回潮。
  it('专项结构说明（GENERIC_SPECIAL_DESC）无递进链、无层级梯度取向词（2026-09-16 课标原则）', () => {
    const raw = GENERIC_SPECIAL_DESC;
    assertNoBanned(raw, 'GENERIC_SPECIAL_DESC');
    expect(raw).toContain('分板块组织');
    expect(raw).not.toContain('由浅入深');
    expect(raw).not.toContain('提升→拓展');
    expect(raw).not.toContain('层级');
    expect(raw).not.toContain('梯度');
  });

  it('白名单（答题书写规范）仍保留', () => {
    const raw = JSON.stringify(TEACHING_SUBJECT_BLUEPRINTS);
    expect(raw).toContain(WHITELIST_KEEP[0]);
  });

  // 🔴 2026-09-14（用户裁定·实测产物验证）：practice 模板原写"本课知识层级（大概念 → 核心知识）**逐点**
  //    至少以一道题或任务呈现一次"，共享【质量底线】原写"逐点覆盖核心知识…逐点呈现"——把清单的**层级**
  //    当成了**设题依据**，模型据此把知识主题直接当大题标题、内容围着教材转（锚清单通道实测复现）。
  //    现锁死：三维度模板与共享块都不得用"层级/逐点"暗示设题或组织；标题来源以委托书结构+自拟概括为唯一。
  it('清单不得被当作设题/组织依据（无"按层级逐点设题"诱导，跨 5 学段 × 14 学科 × 9 类型）', () => {
    const BAD = ['知识层级（大概念', '逐点至少以一道题', '逐点覆盖核心知识', '逐点呈现所需的内容'];
    for (const stage of GEN_STAGES) {
      for (const subject of GEN_SUBJECTS) {
        for (const genType of GEN_TYPES) {
          const tpl = getPromptTemplate({ grade: stage, subject, genType })?.template || '';
          for (const bad of BAD) {
            expect(tpl, `${stage}|${subject}|${genType} 不应含诱导「${bad}」`).not.toContain(bad);
          }
        }
      }
    }
    // 🔒 2026-09-15（用户裁定·翻转点）：标题来源禁则原写"不得直接搬用【锚点清单】的条目名或教材板块名
    //    充当栏目标题/大题标题"——**已撤除**。它是"合法对象（条目名）→ 结构位置（标题）"的否定映射：
    //    要读懂必须先建立这条映射，等于反向植入（产物实证：内容条目直接成了大题标题）。
    //    功能改由正向口径承载：标题自拟 + 一句话概括该组实际在练什么（见下方断言）。
    const practice = getPromptTemplate({ grade: 'primary_high', subject: '英语', genType: 'practice' }).template;
    expect(practice, '否定式关联不得回潮').not.toMatch(/不得直接搬用|不以清单条目|分组依据不是知识点清单/);
    // 🔒 2026-09-16 用户裁定（少约束）：口径简化为"组前用 <h3> 标题（标题自拟）"
    expect(practice).toContain('组前用 <h3> 标题（标题自拟）');
    // 覆盖要求本身不得被削弱（去掉对账语言 ≠ 去掉覆盖要求）：改由清单角色说明的范围陈述承载
    expect(practice).toContain('只以实际呈现的题目/条目为准');
  });

  // 🔴 2026-09-14（用户定版）：蓝图"命题要求"（note）随【卷面结构】注入——写"（如…）"会把题目方向钉死
  //    （如"综合运用（如制作图文卡片）"→ 题目只会往"做图文卡片"走）。要求 = 不写方向性举例，保留意图即可。
  //    注意区分：**防错反例**（数量纪律"如把 2.05千米 写成 205千米"、术语口径"如 Chinese 末字母 s 发 /z/"）
  //    是确定性规则的判据，不属此类，保留。
  it('蓝图"命题要求"不写方向性举例（如…）——举例会把题目方向钉死', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'config', 'examPaperBlueprints.js'), 'utf8');
    const notes = src.match(/note:\s*'[^']*'/g) || [];
    expect(notes.length, '未扫到 note（防假绿）').toBeGreaterThan(20);
    const bad = notes.filter((n) => /（如|（例如/.test(n));
    expect(bad, `以下命题要求仍在举例：${bad.slice(0, 5).join('；')}`).toEqual([]);
  });

  // 🔴 2026-09-14（用户定版）：题干内的"要求/提示/步骤"分条此前无人管（题号规范管题目、CONTENT_FORMAT
  //    管内容型知识条目），实测模型把写作要求逐条当题（`1. 2. 3.` 与题号同构 + 每条各配作答区）。
  //    本条只定位"编号方式与作答区归属"，不涉题型、不涉覆盖；且**只进题类**（question/exam）——
  //    内容型编号口径仍由 CONTENT_FORMAT 单源给出（（1）（2）），两套口径不同时注入 → 不打架。
  it('a：题干内分条不与题号层混同（题类两分支注入、内容型不注入）', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'config', 'promptLibrary.js'), 'utf8');
    // 🔴 2026-09-28：易错题本（题内分项型）分支同样注入本条 → 题类三分支各一处
    expect(src.split('不与题号层混同').length - 1, 'question/exam/errorbook 三分支各一处').toBe(3);
    expect(src).toContain('这些分条不是子题，不为其另配作答区');
    expect(src, '与题号规范划清边界（子题才用 (1)(2)）').toContain('子题用 (1)(2)');
    expect(src, '内容型编号口径仍由 CONTENT_FORMAT 单源').toContain('条目标记与序号只取其一、严禁叠加');
  });

  // 🔴 2026-09-14：段落组织原写"每个任务（情境/活动/成果各条）独立成 <p> 段落"——
  //    "各条独立成段"会让写作要求各占一段、进一步被当成题；现限定"各条"不含要求/提示分条。
  it('段落组织限定"各条"不含题干内要求/提示分条（题类两分支）', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'config', 'promptLibrary.js'), 'utf8');
    expect(src.split('不含题干内的要求/提示分条').length - 1).toBe(2);
  });

  it('E：委托书尾含跨 9 类「资料内多样」自查句', () => {
    // ✅ A22（2026-09-14）：尾约束文本已从 useAiGenerator 内联提出到 utils/injectionManifest.js **单源**
    //    （生成端与生成面板共用），不变量不变（仍随每次请求末尾锚定注入），故断言改指单源 + 生成端引用
    const srcPath = path.join(ROOT, 'src', 'utils', 'injectionManifest.js');
    const src = fs.readFileSync(srcPath, 'utf8');
    expect(src).toContain('【尾约束·资料内多样】');
    // 🔒 2026-09-15 去诱导：原"不得全份同类版式照搬／同一组织顺序不可逐栏…反复套用"是
    //    "合法对象（上一部分版式）→ 结构位置（本部分）"的否定映射，改正向陈述（换一套版式）
    expect(src).toContain('同一份资料内各部分的形式与先后应有变化，逐部分、逐单元换一套版式');
    expect(src, '否定式关联不得回潮').not.toMatch(/不得全份同类版式照搬|不可逐栏/);
    // 🔴 2026-09-27（用户裁定·质量问题须模型侧根治、不依赖程序侧报告）：原块只管"版式多样"（形式层），
    //    而"同一考查点/情境/数据/设问反复出现"（组卷随意、同质化）**只在【质量底线】作陈述、无成稿前动作**。
    //    现按项目既有范式（复核写成成稿前动作、判据可自判）补"不重复"这一查，与"题号连续性自查""自洽三域"同址。
    expect(src, '"不重复"须落到成稿前动作').toContain('定稿前逐部分核对');
    expect(src, '不重复的判据（考查点/情境/数据/设问）').toContain('同一考查点、同一情境、同一组数据、同一种设问方式不重复出现');
    expect(src, '雷同即当场改、只输出定稿').toContain('凡有雷同即当场改');
    expect(fs.readFileSync(path.join(ROOT, 'src', 'composables', 'useAiGenerator.js'), 'utf8'))
      .toContain('buildTailBlocks()');
  });

  // 🔴 2026-09-27（用户裁定·质量问题须模型侧根治，不依赖程序侧探针/报告）："资料单薄/空洞"此前只有抽象表述
  //    （"不缩水""充实靠…"），模型难以据此自判。现给**可自判锚**——本范围该练到/该讲到的重点逐点有实际承载。
  //    这样模型侧即可自查（程序侧 teaching-volume-guard 仍**静默**兜底，不靠它出报告）。
  it('质量底线·内容充实：给可自判锚（防单薄/空洞走模型侧，不依赖程序侧探针）', () => {
    const t = getPromptTemplate({ grade: 'primary_high', subject: '语文', genType: 'practice' }).template;
    expect(t).toContain('内容充实');
    expect(t, '可自判锚：是否充实可自判').toContain('是否充实可自判');
    expect(t, '可自判锚：逐点有实际承载').toContain('逐点都有实际的题目、材料或条目承载');
  });

  // 🔴 2026-09-14（用户定版）：格式示例里点名具体题型（原为"如'填空题。（每空1分，共21分）'"）
  //    是**题型诱导**的最后残留——虽只挂在考卷分支（考卷题型由【卷面结构】给定，不产生新题型），
  //    仍改为与旁侧 `<h2>一、〈大题名〉` 同款占位，零信息损失、全库零具体题型名。
  it('考卷格式示例用占位〈题型名〉，不点具体题型名（防题型诱导）', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'config', 'promptLibrary.js'), 'utf8');
    const m = src.match(/题型名后可带分值括注（如"[^"]*"/);
    expect(m, '未扫到该示例（防假绿）').toBeTruthy();
    expect(m[0]).toContain('〈题型名〉');
    expect(m[0], '不得回退为具体题型名').not.toMatch(/填空题|选择题|判断题|简答题/);
  });

  // 🔴 2026-09-12（用户实证）：题目自洽①原为"形态名列举式"，原理上不完备（题型无限，
  //    实测漏"连线"）→ 改为**原则式**：判据=题干自身措辞，明示不存在形态清单。
  //    本用例锁死"原则式"框架，防止回退成长清单。
  //    （2026-09-12 改名：原称"卷面自洽"，因本块已注入全部 7 类题类资料、非仅"卷"，改类型中性名）
  it('题目自洽①为原则式（判据=题干措辞，明示无形态清单），不得回退为列举式', () => {
    const srcPath = path.join(ROOT, 'src', 'config', 'promptLibrary.js');
    const src = fs.readFileSync(srcPath, 'utf8');
    expect(src).toContain('题面与作答形态同义');
    expect(src).toContain('允许的形态清单');
    // 2026-09-26 判据域由"题干"扩为"题面"（含大题标题/大类名/要求行/材料引导语）——
    //   实证：模型把作答形态声明写在 h3 标题上，而旧判据只认"题干"，该声明落在判据域之外
    expect(src).toContain('题面怎么说、卷面就怎么做');
    expect(src).toContain('含题干、大题标题、大类名、要求行、材料引导语');
    // 旧"列举式"表述不得回潮
    expect(src).not.toContain('题干凡声明了作答方式或作答容器（连线/连一连、圈类');
    expect(src).not.toContain('输出载体须与题干措辞同名一致');
  });

  // 🔴 2026-09-12（用户裁定）：末尾锚定的【尾约束·全文自洽】是「题干↔内容」的通用条款，
  //    必须保持**原则式零列举**范式（判据=所声明内容是否足量存在/能否仅凭正文自足完成），
  //    不得回退为"作答要素逐项列举"（清单必不完备，且构成题型/内容诱导）。
  //    用词须类型中性：原写"仅凭卷面自身"（卷面=考卷专用语，模型易读成排版要求），
  //    2026-09-12 改"正文"；亦不得改成"本题自身/题干自身"（会被读成"仅凭题干即可作答"，语义反向）。
  it('尾约束·全文自洽为原则式（零列举）：不得回退为"作答要素逐项列举"', () => {
    // ✅ A22：本块文本已提到 utils/injectionManifest.js 单源（生成端与面板共用），断言随之改指单源
    const srcPath = path.join(ROOT, 'src', 'utils', 'injectionManifest.js');
    const src = fs.readFileSync(srcPath, 'utf8');
    expect(src).toContain('所点到的内容、形态与做法，都必须在正文中真实、足量、形式吻合地存在');
    expect(src).toContain('仅凭正文自身即可完成');
    expect(src).not.toContain('题干所声明的作答要素（作答处、载体、选项、题面所用素材）');
    // 类型中性用词锁定：不得回退"卷面"，也不得改成"本题自身/题干自身"。
    // （注：源码注释会引用旧词留痕，故此处按"提示词整句"锚定，而非裸词匹配。）
    expect(src).not.toContain('使本题**仅凭卷面自身即可完成**');
    expect(src).not.toContain('凡题干提到而卷面未给出');
    expect(src).not.toContain('使本题**仅凭本题自身即可完成**');
    // 仍随每次请求末尾锚定注入（生成端引用单源，不是只存在于库里）
    expect(fs.readFileSync(path.join(ROOT, 'src', 'composables', 'useAiGenerator.js'), 'utf8'))
      .toContain('buildTailBlocks()[0]');
  });

  // 🔴 2026-09-12（用户裁定）：篇幅纪律注入位置在【输出约定】尾部（注意力最高区），原句以"止"字收尾
  //    （篇幅纪律旧句末尾那三字），与当前失效模式（过早收尾/正文丢题）同向 → 改为显式
  //    "逐项齐全后方可收尾 + 严禁提前收尾"。本用例锁定"提示词正文"（注释留痕会引用旧词，
  //    故按 LENGTH_DISCIPLINE 取值断言，不做整文件裸词匹配）。
  it('篇幅纪律不得回退"以止收尾"的旧措辞，须显式禁提前收尾（上限意图不丢）', () => {
    const srcPath = path.join(ROOT, 'src', 'config', 'promptLibrary.js');
    const src = fs.readFileSync(srcPath, 'utf8');
    const m = src.match(/LENGTH_DISCIPLINE:\s*'([^']+)'/);
    expect(m).toBeTruthy();
    const value = m[1];
    expect(value).not.toContain('写到即止');            // 旧措辞不得回退
    expect(value).toContain('栏目与题目齐备后再收尾');
    expect(value).toContain('不以省略、合并或提前收尾代替内容');
    // 上限纪律（防注水）意图不得因改写而丢失
    expect(value).toContain('不堆砌空话套话');
    expect(value).toContain('不为凑篇幅扩写无关或编造内容');
  });

  // 🔴 2026-09-12（用户裁定）：图-题一致性改**原则式**，且图依赖词表单一事实源。
  //    背景实证：指令侧按措辞枚举（看图/读图/据图/如图/图表）、校验侧用更宽词表
  //    （多"看图形/统计图/观察…图形/格图"）——两表不同源 → 模型遇"观察下面的图形/看图形/统计图"
  //    即判"未声明图依赖"而不出图，校验侧却照报"题干要图却没出图"，多轮修不掉。
  //    本用例锁定：①指令侧不得回退措辞枚举；②校验侧引用单一事实源，不得再自写一份。
  it('图-题一致性为原则式（无措辞清单），且图依赖词表单一事实源', () => {
    const lib = fs.readFileSync(path.join(ROOT, 'src', 'config', 'promptLibrary.js'), 'utf8');
    expect(lib).toContain('不存在"图依赖措辞清单"');           // 明示无清单（原则式）
    expect(lib).not.toContain('题干声明依赖图的（看图/读图');    // 旧枚举式判据不得回退
    const ev = fs.readFileSync(path.join(ROOT, 'src', 'utils', 'examValidator.js'), 'utf8');
    expect(ev).toContain("from '../config/eduRenderContract.js'");
    expect(ev).not.toContain('看图|读图|看图形|据图|统计图');    // 校验侧不得再自维护词表
    const rc = fs.readFileSync(path.join(ROOT, 'src', 'config', 'eduRenderContract.js'), 'utf8');
    expect(rc).toContain('export const FIGURE_DEPENDENCY_RE');
  });

  // 🔴 2026-09-27（用户裁定·全局收口）：反列举（否定式点名具体串）的守卫**由"只扫 exam 模板"扩为"扫全部进提示词的注入块"**。
  //    原理：要理解"严禁 X"必须先激活 X，模型反而朝 X 生成（"别想大象"）；此前只锁 EXAM_BASE 一处，
  //    其它同样进 exam/question 的注入块（作答载体条款、素材使用、组织方式、尾约束、答案页约定）若回潮即漏网。
  //    ⚠️ 只取**无歧义的禁词**；"作答区/答："在本项目是合法用词（"不另设独立作答区""课后问答："），
  //    不进禁词表——指向它们的那句**否定式列举原文**单独锁（见下一条），防回潮。
  const REVERSE_PRIME = ['闯关', '集齐宝石', '第X关', '关卡包装'];
  const assertNoReversePrime = (str, ctx) => {
    for (const w of REVERSE_PRIME) expect(str, `${ctx} 反向植入禁词「${w}」`).not.toContain(w);
  };
  it('反列举守卫（全局·模板侧）：9 类模板 × 多学科/学段均不点名禁词', () => {
    for (const g of GEN_TYPES) {
      for (const stage of ['primary_low', 'primary_mid', 'middle', 'high']) {
        for (const subject of ['语文', '数学', '英语']) {
          const t = getPromptTemplate({ grade: stage, subject, genType: g })?.template || '';
          assertNoReversePrime(t, `模板 ${stage}|${subject}|${g}`);
        }
      }
    }
  });
  it('反列举守卫（全局·注入块侧）：素材使用/组织方式/尾约束/作答载体条款均不点名禁词', () => {
    const blocks = [
      buildMaterialUsageBlock({ genType: 'exam', materialChannel: 'auto' }),
      buildOrganizeBlock('exam'),
      ...buildTailBlocks(),
      buildAnswerSpaceInstruction('语文', 'primary_low'),
      buildAnswerSpaceInstruction('数学', 'middle'),
      buildCarrierInstruction('语文', 'primary_low'),
    ].join('\n');
    assertNoReversePrime(blocks, '注入块集合');
  });
  // 🔴 2026-09-27：作答空间条款原写「严禁用"答：""作答区"等文字充当或预置作答空间」——**否定式点名具体串**（反向植入）。
  //    已改原则式（"不得以任何文字（提示、标签、说明）充当或预置作答空间"）；本断言锁死旧列举不得回潮，且意图不丢。
  it('作答空间条款：不得回退为"点名具体串"的否定式列举', () => {
    const ls = fs.readFileSync(path.join(ROOT, 'src', 'config', 'layoutSpec.js'), 'utf8');
    expect(ls, '旧否定式列举不得回潮').not.toContain('严禁用"答：""作答区"');
    const instr = buildAnswerSpaceInstruction('语文', 'middle');
    expect(instr, '意图不得丢：作答空间只以真实留白或书写载体呈现').toContain('作答空间只以真实留白或书写载体呈现');
    expect(instr, '不得再点名"答："这类可被直接输出的字面串').not.toContain('"答："');
  });
  // 🔴 2026-09-27：EXAM_BASE 原写「不要照抄它的行首分类名…（如"听音选词/选图"…既不得原样照抄、也不得改写成近义说法）」
  //    ——既是**否定式点名具体串**（反向植入），又与【卷面格式】的"大题标题自拟"同义双写。已改**正向角色陈述**并去重。
  it('考卷大题标题：正向陈述（分类名只描述范围），不点名具体串、不否定映射', () => {
    const t = getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' }).template;
    expect(t, '旧否定式列举不得回潮').not.toContain('不要照抄它的行首分类名');
    expect(t, '旧"不得改写近义"否定映射不得回潮').not.toContain('既不得原样照抄、也不得改写成近义说法');
    expect(t, '正向角色陈述在（标题以自拟为准）').toContain('行首分类名与其中的知识点名只描述命题范围');
    expect(t, '标题自拟要求不得丢').toContain('大题标题须你按本卷实际的作答方式自拟');
  });
  // 🔴 2026-09-27：蓝图"命题要求"不写"（如…）"的规则，原只扫 examPaperBlueprints——
  //    专项领域（specialDomains）与教辅蓝本（teachingBlueprints）同属"随结构注入的 note"，同类未锁（覆盖缺口）。
  //    现扫全库：note 一律用**范围陈述**而非**举例**（举例会把题目方向钉死）。
  it('note 不写方向性举例（如…）：全部 note 来源（考卷/专项/教辅）', () => {
    for (const f of ['examPaperBlueprints.js', 'specialDomains.js', 'teachingBlueprints.js']) {
      const src = fs.readFileSync(path.join(ROOT, 'src', 'config', f), 'utf8');
      const notes = src.match(/note:\s*'[^']*'/g) || [];
      expect(notes.length, `${f} 未扫到 note（防假绿）`).toBeGreaterThan(0);
      const bad = notes.filter((n) => /（如|（例如/.test(n));
      expect(bad, `${f} 以下 note 仍在举例：${bad.slice(0, 5).join('；')}`).toEqual([]);
    }
  });
  // 🔴 2026-09-27（收口·多事实源）：用户自定义蓝本的**唯一事实源**是 blueprintProvider
  //    （saveUserBlueprint/loadUserBlueprints：键 wisdom_blueprint_library_v1；findBlueprint 第 1 步用户优先短路）。
  //    曾另建第二套用户栏目覆盖 storage 并在 getExamBlueprint 合并 → 双事实源 + 该模块无写入方（永不生效）
  //    + 面板预览（getExamBlueprint）与生成（findBlueprint）两路可能不一致。本断言锁死"不得再引入第二套"。
  it('用户蓝图单事实源：examPaperBlueprints 不得再引第二套用户覆盖存储', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'config', 'examPaperBlueprints.js'), 'utf8');
    expect(src, '不得再 import 第二套用户覆盖模块').not.toMatch(/from\s+'\.\/userBlueprintOverrides\.js'/);
    expect(
      fs.existsSync(path.join(ROOT, 'src', 'config', 'userBlueprintOverrides.js')),
      '第二套用户覆盖模块已收口删除（用户条目唯一事实源=blueprintProvider）',
    ).toBe(false);
    const bp = fs.readFileSync(path.join(ROOT, 'src', 'config', 'blueprintProvider.js'), 'utf8');
    expect(bp).toContain('saveUserBlueprint');
    expect(bp, 'findBlueprint 须用户优先').toContain('loadUserBlueprints');
  });

  // 🔴 2026-09-27（用户裁定·去数量诱导）：导图式原写死「条目 4~16 字、层级 2~4 层、每层 2~6 个分支」——
  //    数量区间与已删除的"恰好 3 个情境"同类（写死数目会致为凑区间硬拆硬并、或为省事敷衍）；
  //    用户指出这些是"当初弄导图时附带上的"，真实目的只是**要真的有导图**、内容要**真内容**。
  //    现改**可读性原则 + 按真实内容呈现**；本断言锁死数量区间不得回潮、且原意图不得丢。
  it('导图式风格：去数量区间（防凑数诱导），但"要真有导图 + 真内容"不得丢', () => {
    const mm = styleInstructions.mindmap;
    for (const q of ['4~16 字', '2~4 层', '每层 2~6', '至少 1 张', '至少1张']) {
      expect(mm, `导图式不得再写死数量「${q}」`).not.toContain(q);
    }
    expect(mm, '意图不丢：导图块是核心交付物').toContain('核心交付物');
    expect(mm, '意图不丢：仍须输出真导图块').toContain('k-diagram');
    expect(mm, '意图不丢：条目为真实知识要点').toContain('真实的知识要点');
    expect(mm, '层级/分支数量改由可读性原则承载').toContain('一眼可读');
    expect(mm, '按真实内容呈现（内容多少就呈现多少）').toContain('内容有多少就呈现多少');
  });

  // 🔴 2026-09-27（用户裁定·甲）：撤除「每学科一句惯用标题样例」（TITLE_SAMPLE_BY_SUBJECT）——
  //    把**具体标题文本**摆给模型，模型往往直接照用、同科各卷标题趋同（属"正向示例诱导"，
  //    与"举例会把题目方向钉死"的既有规矩相违——蓝图 note 连"（如…）"都不许写）。
  //    而标题**形态**句内已写明，样例对"教形态"是冗余的；只留形态范式（学科无关，未列举学科同样适用）。
  it('大题/组标题：只留形态范式，不得回退"每科具体标题样例"', () => {
    const lib = fs.readFileSync(path.join(ROOT, 'src', 'config', 'promptLibrary.js'), 'utf8');
    expect(lib, '每科标题样例表应已撤除（注释留痕不算）').not.toContain('const TITLE_SAMPLE_BY_SUBJECT');
    expect(lib).not.toContain('titleSampleFor');
    for (const g of ['exam', 'practice']) {
      const t = getPromptTemplate({ grade: 'middle', subject: '数学', genType: g }).template;
      expect(t, `${g} 应保留标题形态范式`).toContain('先说做什么、再说怎么做或选什么');
      expect(t, `${g} 不得再注入具体标题样例`).not.toContain('计算下面各题');
    }
  });

  // 🔴 2026-09-27（用户裁定·去否定映射）：教辅组标题句原留「不要照抄【锚点清单】里的知识点名，也不得把它们
  //    换个说法照搬」——与 exam 侧同期收口的是**同一类否定映射**（要读懂须先建立"清单条目 ↔ 组标题"＝反向植入）。
  //    已撤除，要求改由正向承载（组标题只说明本组作答方式 + 不写"覆盖/考查/练习"等字样 + 清单角色=覆盖范围）。
  it('教辅组标题：去否定映射（清单名↔组标题），改正向"只说明本组作答方式"', () => {
    const lib = fs.readFileSync(path.join(ROOT, 'src', 'config', 'promptLibrary.js'), 'utf8');
    expect(lib, '旧否定映射不得回潮').not.toContain('不要照抄【锚点清单】里的知识点名');
    const t = getPromptTemplate({ grade: 'primary_high', subject: '英语', genType: 'practice' }).template;
    expect(t, '正向承载：组标题只说明本组作答方式').toContain('组标题只说明本组');
    expect(t, '组标题↔题内一致的要求不得丢').toContain('组标题里写到的提示方式与作答方式');
    expect(t, '不写"覆盖/考查/练习"等字样仍保留').toContain('不写"覆盖/考查/练习"等字样');
  });

  // 🔴 2026-09-27（用户裁定）：题集/练习类须"看得出成组的层次"（防整栏平铺成题目罗列——外部复核实证的"仅题目罗列"）。
  //    但**必须守住 2026-09-16"少约束、交模型"**：该裁定撤除了"题型按常态分布/常规写法"一类锚定，题型与命名全交模型。
  //    故本句只提**存在性与可自判判据**，**分组依据与组名一律不作指定**（不点分层名，防诱导；也不把清单当分组依据）。
  it('教辅分组：要求"看得出成组的层次"，但分组依据与组名不作指定（守少约束）', () => {
    const t = getPromptTemplate({ grade: 'primary_high', subject: '语文', genType: 'practice' }).template;
    expect(t, '成组层次要求').toContain('看得出成组的层次');
    expect(t, '可自判判据：同组内相近').toContain('同组内各题在作答方式或考查角度上确实相近');
    expect(t, '守少约束：分组依据与组名不作指定').toContain('分组依据与组名都由你按本部分内容自行定（不作指定）');
    // 防回退/防诱导：不得点任何分组依据或分层名，也不得把清单当分组依据
    for (const bad of ['按难度分层', '基础→提升', '基础→进阶', '按知识点分组', '按【锚点清单】分组']) {
      expect(t, `不得指定分组依据/分层名：${bad}`).not.toContain(bad);
    }
  });
});