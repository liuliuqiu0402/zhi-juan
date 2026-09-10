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
});