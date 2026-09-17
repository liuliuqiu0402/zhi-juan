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
    expect(src.split('不与题号层混同').length - 1, 'question/exam 两分支各一处').toBe(2);
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
    expect(fs.readFileSync(path.join(ROOT, 'src', 'composables', 'useAiGenerator.js'), 'utf8'))
      .toContain('buildTailBlocks()');
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
    expect(src).toContain('题干怎么说、卷面就怎么做');
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
});