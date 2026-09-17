// 🔒 2026-09-16 用户裁定（课标原则）：蓝图库与指令库的措辞判据只有一条——
//    课标原文/原义 → 留；调研/真题结构口径 → 留（试卷）；完全自编的取向与形式词 → 清。
//    本文件把这两轮清掉的自造词钉成断言，防回潮（含"作为组织口径"的层次/梯度类词）。
import { describe, it, expect } from 'vitest';
import { EXAM_BLUEPRINTS } from '../../src/config/examPaperBlueprints.js';
import { TEACHING_BLUEPRINTS, TEACHING_SUBJECT_BLUEPRINTS } from '../../src/config/teachingBlueprints.js';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';

/** 蓝图库：已清掉的自造取向/形式词（课标没有这些表述） */
const BP_BANNED = [
  '由浅入深', '情境游戏化', '情境具体直观', '以真实生活情境为主', '图文并茂',
  '结构化呈现', '思维环节', '变式设问', '情境判断', '情境探究', '真实问题解决', '跨学科融合',
  '设问有层次',
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
    // ⚠️ 2026-09-17 核查更正：五档学段语义（感知与体验→理解与运用→…→迁移与创新）经核**非任何课标口径**，
    //    系艺术/科学/英语课标术语拼接的产品自造（处置方案待定，故此处仅更正注释、暂不改值）。
    expect(raw).toContain('感知与体验');
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
});
