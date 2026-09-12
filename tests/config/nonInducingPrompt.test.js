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

  it('H 收敛后含「板块间由浅入深」且无旧「由易到难」重复尾句', () => {
    const raw = JSON.stringify(TEACHING_SUBJECT_BLUEPRINTS);
    expect(raw).toContain('板块间由浅入深');
    expect(raw).not.toContain('板块内由易到难');
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

  it('考卷蓝本（EXAM_BLUEPRINTS）不含诱导枚举（含鉴赏路径链）', () => {
    const raw = JSON.stringify(EXAM_BLUEPRINTS);
    assertNoBanned(raw, 'EXAM_BLUEPRINTS');
  });

  it('专项结构说明（GENERIC_SPECIAL_DESC）无递进链且保留梯度原则', () => {
    const raw = GENERIC_SPECIAL_DESC;
    assertNoBanned(raw, 'GENERIC_SPECIAL_DESC');
    expect(raw).toContain('由浅入深');
    expect(raw).not.toContain('提升→拓展');
  });

  it('白名单（答题书写规范）仍保留', () => {
    const raw = JSON.stringify(TEACHING_SUBJECT_BLUEPRINTS);
    expect(raw).toContain(WHITELIST_KEEP[0]);
  });

  it('E：委托书尾含跨 9 类「资料内多样」自查句', () => {
    const srcPath = path.join(ROOT, 'src', 'composables', 'useAiGenerator.js');
    const src = fs.readFileSync(srcPath, 'utf8');
    expect(src).toContain('【尾约束·资料内多样】');
    expect(src).toContain('同一份资料内各栏目呈现形式与组织顺序应有所差异，不得全份同类版式照搬');
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
    const srcPath = path.join(ROOT, 'src', 'composables', 'useAiGenerator.js');
    const src = fs.readFileSync(srcPath, 'utf8');
    expect(src).toContain('本题作答所必需的一切内容');
    expect(src).toContain('仅凭正文自身即可完成');
    expect(src).not.toContain('题干所声明的作答要素（作答处、载体、选项、题面所用素材）');
    // 类型中性用词锁定：不得回退"卷面"，也不得改成"本题自身/题干自身"。
    // （注：源码注释会引用旧词留痕，故此处按"提示词整句"锚定，而非裸词匹配。）
    expect(src).not.toContain('使本题**仅凭卷面自身即可完成**');
    expect(src).not.toContain('凡题干提到而卷面未给出');
    expect(src).not.toContain('使本题**仅凭本题自身即可完成**');
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
    expect(value).toContain('全部栏目与题目逐项齐全后方可收尾');
    expect(value).toContain('严禁以省略、合并或提前收尾代替内容');
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