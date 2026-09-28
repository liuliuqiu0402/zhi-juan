// 🔴 2026-09-28（用户裁定·大题标题命名收口为全库唯一一处规定）
// ============================================================
// 唯一规定的落点 = src/config/promptLibrary.js 的 bigTitleRule：
//   · 中学段（middle/high）：大题标题＝【卷面结构】里的块名/课标领域名**本身**，不另自拟；
//   · 小学段：按本卷实际作答方式自拟；
//   · 与卷首导语同进同退：采用统一情境时呼应导语主题，未采用时一律功能性命名。
//
// 历史冲突（本轮根治）：
//   ① promptLibrary.js EXAM_BASE【卷面结构】条原写"行首分类名与其中的知识点名只描述命题范围，
//      **卷面标题一律以你自拟的写法为准**"——无条件"自拟"，与中学段"即块名、不另自拟"相抵；
//   ② useAiGenerator.js 出稿自检原文"大类居中不带编号、**大题标题自拟带序号**…"——同为无条件自拟。
//   本轮两处均已删改（改为只引用单源规则），本文件把冲突表述钉成"全库零出现"防回潮，
//   并按学段锁死模板字面（中学段有"即块名"、无"自拟"；小学段反之）。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';

const ROOT = path.resolve(__dirname, '../..');

const SRC_FILES = [];
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(js|vue|ts)$/.test(name)) SRC_FILES.push(p);
  }
};
walk(path.join(ROOT, 'src'));

/** src 下包含该字面的文件（相对路径，正斜杠） */
const ownersOf = (phrase) => SRC_FILES
  .filter((f) => fs.readFileSync(f, 'utf8').includes(phrase))
  .map((f) => path.relative(ROOT, f).replace(/\\/g, '/'));

describe('大题标题命名：全库唯一一处规定（学段口径防回潮）', () => {
  it('冲突表述全库零出现（无条件"自拟"不得回潮）', () => {
    expect(ownersOf('卷面标题一律以你自拟的写法为准'), 'EXAM_BASE 旧冲突半句不得回潮').toEqual([]);
    expect(ownersOf('大题标题自拟带序号'), '出稿自检旧冲突表述不得回潮').toEqual([]);
  });

  it('学段口径单一事实源：两条分支字面只允许出现在 promptLibrary.js', () => {
    expect(ownersOf('大题标题即【卷面结构】里的块名本身')).toEqual(['src/config/promptLibrary.js']);
    expect(ownersOf('大题标题须你按本卷实际的作答方式自拟')).toEqual(['src/config/promptLibrary.js']);
  });

  it('中学段（middle）：标题＝【卷面结构】块名本身、不另自拟', () => {
    const t = getPromptTemplate({ grade: 'middle', subject: '语文', genType: 'exam' }).template;
    expect(t, '中学段应取"即块名"口径').toContain('大题标题即【卷面结构】里的块名本身');
    expect(t, '中学段不得再出现"按作答方式自拟"').not.toContain('大题标题须你按本卷实际的作答方式自拟');
    expect(t, '中学段不得再出现无条件"自拟"半句').not.toContain('卷面标题一律以你自拟的写法为准');
    // 【卷面结构】名字角色：中学段不再把"行首分类名"说成"只描述命题范围、不构成标题"
    expect(t, '中学段不给"行首分类名只描述命题范围"的相反口径').not.toContain('行首分类名与其中的知识点名只描述命题范围');
  });

  it('高中（high）：同中学段口径', () => {
    const t = getPromptTemplate({ grade: '高三', subject: '物理', genType: 'exam' }).template;
    expect(t).toContain('大题标题即【卷面结构】里的块名本身');
    expect(t).not.toContain('大题标题须你按本卷实际的作答方式自拟');
  });

  it('小学段（primary_high）：标题按本卷实际作答方式自拟', () => {
    const t = getPromptTemplate({ grade: 'primary_high', subject: '语文', genType: 'exam' }).template;
    expect(t, '小学段应取"自拟"口径').toContain('大题标题须你按本卷实际的作答方式自拟');
    expect(t, '小学段不得出现"即块名"口径').not.toContain('大题标题即【卷面结构】里的块名本身');
    expect(t, '小学段保留"分类名只描述命题范围"的正向角色陈述').toContain('行首分类名与其中的知识点名只描述命题范围');
  });
});
