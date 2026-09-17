// 🔒 2026-09-16 用户裁定（课标原则）：蓝图库与指令库的措辞判据只有一条——
//    课标原文/原义 → 留；调研/真题结构口径 → 留（试卷）；完全自编的取向与形式词 → 清。
//    本文件把这两轮清掉的自造词钉成断言，防回潮（含"作为组织口径"的层次/梯度类词）。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { EXAM_BLUEPRINTS } from '../../src/config/examPaperBlueprints.js';
import { TEACHING_BLUEPRINTS, TEACHING_SUBJECT_BLUEPRINTS } from '../../src/config/teachingBlueprints.js';
import { getPromptTemplate, SUBJECT_STAGE_EXTRAS, STAGE_EXAM_EXTRAS, STAGE_TEACHING_EXTRAS } from '../../src/config/promptLibrary.js';

const ROOT = path.resolve(__dirname, '../..');

/** 蓝图库：已清掉的自造取向/形式词（课标没有这些表述）
 *  🔴 2026-09-17 补：'情境辨析'、'情境分析'——与'情境判断'同类（自造考查/题型名）；
 *    试卷蓝图当轮已改"材料辨析/材料分析"，教辅描述与学科要点当时漏扫，现一并纳入。 */
const BP_BANNED = [
  '由浅入深', '情境游戏化', '情境具体直观', '以真实生活情境为主', '图文并茂',
  '结构化呈现', '思维环节', '变式设问', '情境判断', '情境探究', '真实问题解决', '跨学科融合',
  '设问有层次', '情境辨析', '情境分析',
  // 🔴 2026-09-17 补：'必设栏目'——通用蓝图当轮已统一为"须包含此项"，15 处学科定制漏改（本轮补齐）。
  '必设栏目',
  // 🔴 2026-09-17 补（用户裁定"三处一起清"）：'问题驱动'——通用蓝图当轮已删，15 处学科定制与
  //    预览类型模板仍在用（"以问题驱动预读"）；三处一并清掉（改由"形式由你按内容自定（…）"承载）。
  '问题驱动',
];
/** 指令库模板：同上判据（"认知层次/梯度"作为组织口径已被清） */
const TPL_BANNED = ['由浅入深', '思维环节', '设问有梯度', '认知层次'];

describe('蓝图库与指令库措辞守卫（2026-09-16 课标原则）', () => {
  it('教辅蓝图（通用 8 类 + 学科定制）的**描述(note)**不得含自造取向词', () => {
    // 🔴 范围界定（用户裁定）：**栏目名（大类名）保留**，清理的是"名称后面的语义描述"——
    //    故本断言只取 note/学段 note，不扫 name（如道法默写栏目名"情境判断"属名称，保留）。
    const notes = [];
    const collect = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(collect);
      if (typeof node.note === 'string') notes.push(node.note);
      if (typeof node.volume === 'string') notes.push(node.volume);
      for (const v of Object.values(node)) collect(v);
    };
    collect(TEACHING_BLUEPRINTS);
    collect(TEACHING_SUBJECT_BLUEPRINTS);
    expect(notes.length, 'note 收集不应为空').toBeGreaterThan(50);
    for (const note of notes) {
      for (const w of BP_BANNED) {
        expect(note, `描述不得含「${w}」：${note.slice(0, 40)}`).not.toContain(w);
      }
    }
  });

  it('试卷蓝图不得含自造取向词（题型名/分值/答题规则等调研结构保留）', () => {
    const raw = JSON.stringify(EXAM_BLUEPRINTS);
    for (const w of BP_BANNED) {
      expect(raw, `试卷蓝图不得含「${w}」`).not.toContain(w);
    }
    // 🔴 调研/真题结构口径必须保留（防"清过头"把正规卷的骨架也清掉）
    expect(raw).toContain('4选1');
    expect(raw).toContain('每段材料读两遍');
    expect(raw).toContain('部分选对得部分分');
  });

  it('指令库 9 类模板不得含自造取向词（作为组织口径的层次/梯度类）', () => {
    for (const g of ['exam', 'practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review']) {
      const tpl = getPromptTemplate({ grade: 'primary_high', subject: '英语', genType: g }).template;
      for (const w of TPL_BANNED) {
        expect(tpl, `${g} 模板不得含「${w}」`).not.toContain(w);
      }
    }
  });

  it('课标口径必须保留（防清过头）：语言实践活动写法/素养名与学段要求仍在', () => {
    const raw = JSON.stringify(TEACHING_BLUEPRINTS);
    // 🔓 2026-09-17（用户裁定·课标回归）：活动类型名不再当"栏目分类标准"——改按课标原义写为
    //    "基于/深入/超越语篇的语言实践活动（活动方式…）"，故锁新口径（防回退成"以活动类型为标准"的写法）。
    expect(raw).toContain('基于语篇的语言实践活动');
    expect(raw).toContain('深入语篇的语言实践活动');
    expect(raw).toContain('超越语篇的语言实践活动');
    expect(raw).not.toContain('学习理解类活动（');
    // ⚠️ 2026-09-17 核查：原五档学段起头语（以感知与体验→…→迁移与创新为主）**非任何课标口径**，
    //    系艺术/科学/英语课标术语拼接的产品自造，且把"活动类型/素养维度"误作"学段档位"——已整批删除；
    //    此处反向锁，防回退（学段 note 应直接给该学段的操作形态描述）。
    expect(raw).not.toContain('以感知与体验为主');
    expect(raw).not.toContain('以迁移与创新为主');
    const practice = getPromptTemplate({ grade: 'primary_high', subject: '英语', genType: 'practice' }).template;
    expect(practice).toContain('按课标倡导的学习方式组织');
    expect(practice).toContain('（依据2022年版义务教育课程标准）');
  });

  it('预习/默写的内容定位保留（strict 口径按类型分档，不属"锁死原文"）', () => {
    const preview = getPromptTemplate({ grade: 'primary_high', subject: '语文', genType: 'preview' }).template;
    expect(preview).toContain('紧扣教材原文');
    const dictation = getPromptTemplate({ grade: 'primary_high', subject: '语文', genType: 'dictation' }).template;
    expect(dictation).toContain('严格对应教材要求');
    expect(dictation).toContain('内容准确无误');
  });

  // 🔴 2026-09-17 补（同一判据的覆盖缺口）：本轮复查发现"自造取向/考查名"还有三个**当时未纳入扫描**的注入源——
  //    学科×学段要点（SUBJECT_STAGE_EXTRAS）、学段表（STAGE_*_EXTRAS）、人文组分析提取规则（useAiGenerator）。
  //    当时残留：道法要点"结合情境辨析"、历史要点"辨析与情境判断"、科学要点"运用于真实问题解决"、
  //    人文组规则枚举项"情境判断"。若不清，同一条"课标没有的自造词"判据就会在这些库里留口子。
  it('学科×学段要点与学段表不得含自造取向词（课标来源的写法保留）', () => {
    // 2026-09-17：教辅学段表 primary_low 原为"情境游戏化"（另一摘法），已按用户裁定统一为**课标原摘法**
    //   "情境活动化、游戏化、生活化"（与考卷侧一致）→ 该词不再例外，一并纳入扫描。
    const words = BP_BANNED;
    const rows = [
      ...Object.entries(SUBJECT_STAGE_EXTRAS).map(([k, v]) => [`学科要点 ${k}`, v.text]),
      ...Object.entries(STAGE_EXAM_EXTRAS).map(([k, v]) => [`考卷学段特点 ${k}`, v.text]),
      ...Object.entries(STAGE_TEACHING_EXTRAS).map(([k, v]) => [`教辅学段特点 ${k}`, v.text]),
    ];
    expect(rows.length).toBeGreaterThan(50);
    for (const [label, text] of rows) {
      for (const w of words) {
        expect(text, `${label} 不得含「${w}」`).not.toContain(w);
      }
    }
    // 课标口径的"情境"写法必须保留（防清过头：道法"生活情境"、历史"创设新情境"、地理"地图"等）
    expect(SUBJECT_STAGE_EXTRAS['道德与法治|primary_low'].text).toContain('生活情境');
    expect(SUBJECT_STAGE_EXTRAS['历史|high'].text).toContain('史料');
    // 低段课标原摘法在位（考卷/教辅两侧同源同文，防再次分叉）
    expect(STAGE_EXAM_EXTRAS.primary_low.text).toContain('情境活动化、游戏化、生活化');
    expect(STAGE_TEACHING_EXTRAS.primary_low.text).toContain('情境活动化、游戏化、生活化');
  });

  it('教辅蓝图**栏目名**不得含自造考查名（名称不清的裁定只保护"功能名/内容名"）', () => {
    // 🔴 用户裁定（2026-09-17）："自造名称改为课标内的"——原道法·默写积累栏目名「情境判断」
    //    （自造考查名）改为课标核心素养名「道德修养与法治观念」（义务教育道德与法治课程标准
    //    （2022年版）核心素养：政治认同、道德修养、法治观念、健全人格、责任意识，见教育部官网答记者问）。
    //    注：「道德法律常识」「表述规范」等属功能名/内容名，不在本表范围（按"栏目名保留"裁定留着）。
    const names = [];
    const collectNames = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(collectNames);
      if (typeof node.name === 'string') names.push(node.name);
      for (const v of Object.values(node)) collectNames(v);
    };
    collectNames(TEACHING_BLUEPRINTS);
    collectNames(TEACHING_SUBJECT_BLUEPRINTS);
    expect(names.length, '栏目名收集不应为空').toBeGreaterThan(50);
    for (const w of ['情境判断', '情境辨析', '情境分析', '情境探究', '情境游戏化']) {
      for (const n of names) {
        expect(n, `栏目名不得含自造考查名「${w}」`).not.toContain(w);
      }
    }
    // 课标内名称在位（防回退成自造名）
    expect(JSON.stringify(TEACHING_SUBJECT_BLUEPRINTS)).toContain('道德修养与法治观念');
  });

  it('人文组分析提取规则的枚举项不得含自造考查名（「情境判断」类）', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/composables/useAiGenerator.js'), 'utf8');
    for (const w of ['情境判断', '情境辨析', '情境分析', '情境探究']) {
      expect(src, `分析提取规则不得含「${w}」`).not.toContain(w);
    }
    expect(src).toContain('案例分析/材料解读/材料判断'); // 中性口径在位（防回退）
  });

  it('「问题驱动」三处一并清（通用/学科定制/预览类型模板口径统一）', () => {
    const raw = JSON.stringify(TEACHING_BLUEPRINTS) + JSON.stringify(TEACHING_SUBJECT_BLUEPRINTS);
    expect(raw, '教辅蓝图不得再含"问题驱动"').not.toContain('问题驱动');
    expect(raw, '学科定制预习指引改由"形式由你按内容自定"承载').toContain('形式由你按内容自定');
    const preview = getPromptTemplate({ grade: 'primary_high', subject: '语文', genType: 'preview' }).template;
    expect(preview, '预览类型模板不得再含"问题驱动"').not.toContain('问题驱动');
    expect(preview).toContain('设计少量可操作、可检查的预读内容');
    // 预习定位与"我的疑问"仍在（防清过头）
    expect(preview).toContain('紧扣教材原文');
    expect(preview).toContain('我的疑问');
  });
});
