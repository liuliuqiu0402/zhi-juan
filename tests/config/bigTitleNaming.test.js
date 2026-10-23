// 🔴 2026-09-28（用户裁定·大题标题命名收口为全库唯一一处规定）
// ============================================================
// 唯一规定的落点 = src/config/promptLibrary.js 的 bigTitleRule：
//   · 中学段（middle/high）：大题标题**按本大题实际的作答方式命名**，块名只作命题范围标识、不得照搬
//     （2026-10-18 属主真机"告警②"后由"以块名为底"改准）；
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

// 🔴 2026-09-28（用户裁定·扫描面扩到 docs/design）：文档不得把"大题标题命名"规则再写一份。
//    历史审计报告（文件名含"只读"）= 只读记录，允许引用原文字面，不作为规则所有者。
const DOC_FILES = [];
const walkDocs = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walkDocs(p);
    else if (/\.(md|html?)$/i.test(name)) DOC_FILES.push(p);
  }
};
walkDocs(path.join(ROOT, 'docs/design'));
const isHistoricalReport = (f) => /只读/.test(path.basename(f));
const rel = (f) => path.relative(ROOT, f).replace(/\\/g, '/');

/** src + docs/design（历史只读报告除外）下包含该字面的文件（相对路径，正斜杠） */
const ownersOf = (phrase) => SRC_FILES.concat(DOC_FILES.filter((f) => !isHistoricalReport(f)))
  .filter((f) => fs.readFileSync(f, 'utf8').includes(phrase))
  .map(rel);

describe('大题标题命名：全库唯一一处规定（学段口径防回潮；扫描面含 docs/design）', () => {
  it('冲突表述全库（src + docs/design，历史只读报告除外）零出现（无条件"自拟"不得回潮）', () => {
    expect(ownersOf('卷面标题一律以你自拟的写法为准'), 'EXAM_BASE 旧冲突半句不得回潮').toEqual([]);
    expect(ownersOf('大题标题自拟带序号'), '出稿自检旧冲突表述不得回潮').toEqual([]);
  });

  it('学段口径单一事实源：两条分支字面只允许出现在 promptLibrary.js（含 docs/design 扫描）', () => {
    expect(ownersOf('大题标题按本大题实际的作答方式命名')).toEqual(['src/config/promptLibrary.js']);
    expect(ownersOf('大题标题须你按本卷实际的作答方式自拟')).toEqual(['src/config/promptLibrary.js']);
    // 🔴 2026-10-18（属主真机"告警②：标题声称看图而题内无图"）：原中学段口径"以【卷面结构】块名为底"
    //    是**许可式**（"可以改、可以自拟"）→ 模型默认照搬块名，块名含图词即照搬成标题 ⇒ 全库零出现（防回潮）。
    expect(ownersOf('大题标题以【卷面结构】里的块名为底'), '照搬式旧口径不得回潮').toEqual([]);
  });

  it('中学段（middle）：标题按本大题实际的作答方式命名；块名只作范围标识、不得照搬', () => {
    const t = getPromptTemplate({ grade: 'middle', subject: '语文', genType: 'exam' }).template;
    expect(t, '中学段应取"按本大题实际的作答方式命名"口径').toContain('大题标题按本大题实际的作答方式命名');
    expect(t, '中学段须写明块名只作范围标识、不得照搬').toContain('块名只作**命题范围标识**');
    expect(t, '中学段不得回潮"以块名为底"的照搬式口径').not.toContain('大题标题以【卷面结构】里的块名为底');
    expect(t, '中学段不得再出现"按作答方式自拟"').not.toContain('大题标题须你按本卷实际的作答方式自拟');
    expect(t, '中学段不得再出现无条件"自拟"半句').not.toContain('卷面标题一律以你自拟的写法为准');
    // 【卷面结构】名字角色：中学段不再把"行首分类名"说成"只描述命题范围、不构成标题"
    expect(t, '中学段不给"行首分类名只描述命题范围"的相反口径').not.toContain('行首分类名与其中的知识点名只描述命题范围');
  });

  it('高中（high）：同中学段口径', () => {
    const t = getPromptTemplate({ grade: '高三', subject: '物理', genType: 'exam' }).template;
    expect(t).toContain('大题标题按本大题实际的作答方式命名');
    expect(t).not.toContain('大题标题须你按本卷实际的作答方式自拟');
    expect(t).not.toContain('大题标题以【卷面结构】里的块名为底');
  });

  it('小学段（primary_high）：标题按本卷实际作答方式自拟', () => {
    const t = getPromptTemplate({ grade: 'primary_high', subject: '语文', genType: 'exam' }).template;
    expect(t, '小学段应取"自拟"口径').toContain('大题标题须你按本卷实际的作答方式自拟');
    expect(t, '小学段不得出现"以块名为底"口径').not.toContain('大题标题以【卷面结构】里的块名为底');
    expect(t, '小学段不得出现中学段"按本大题实际的作答方式命名"口径').not.toContain('大题标题按本大题实际的作答方式命名');
    expect(t, '小学段保留"分类名只描述命题范围"的正向角色陈述').toContain('行首分类名与其中的知识点名只描述命题范围');
  });

  // 🔴 2026-10-10（〔346〕产物实证）：题目标题命名补两条**可自判**判据——
  //   ①"只写一个空泛的类别名不算点明作答方式"（治"四、判断"只给题型名、没写怎么答；全学段）；
  //   ②小学段"大题标题删去情境词后须仍是完整的作答要求"（治"一、游园会'识字加油站'：读拼音写词语"情境包装标题）。
  it('〔346〕题目标题须作答方式：类别名不算；情境须可从标题剥离', () => {
    const t = getPromptTemplate({ grade: 'primary_high', subject: '语文', genType: 'exam' }).template;
    expect(t, '只写类别名不算点明作答方式（防"四、判断"）').toContain('只写一个空泛的类别名');
    expect(t, '情境须可剥离（防情境包装标题）').toContain('大题标题本身须是完整的作答要求');
  });

  // 🔴 2026-10-19（属主"看图告警总在飘忽"）：标题里的**提示方式**必须由题内实给决定——
  //   病根＝蓝图块名含"看图/图片"，模型照搬进标题，题内给的却是文字/中文/首字母提示 ⇒ 告警反复。
  //   本锁：可自判判据在位（写"看图"就得真有图），且**不得回退**成只靠"图-题一致性"那条否定句兜。
  it('标题提示方式：以题内实给为准（看图/文字/首字母同一种）', () => {
    for (const stage of ['primary_low', 'middle']) {
      const t = getPromptTemplate({ grade: stage, subject: '语文', genType: 'exam' }).template;
      expect(t, `${stage}：提示方式须与题内实给同一种`).toContain('标题里写到的提示方式，必须是题内真实给出的那一种');
    }
    expect(getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' }).template,
      '旧否定句不得再管标题（单源已归标题条）').not.toContain('题干与标题');
  });

  // 🔴 2026-10-19（真机："一、直接写出得数（共14分）"下又出现"1. 直接写出得数。（每题1分，共14分）"）：
  //   大题级要求被写成**带题号的题干**（题号被要求行占用）。判据补死：题号只给要单独点名的题。
  it('大题要求不得写成带题号的题干（题号只给要单独点名的题）', () => {
    for (const stage of ['primary_low', 'middle']) {
      const t = getPromptTemplate({ grade: stage, subject: '语文', genType: 'exam' }).template;
      expect(t, `${stage}：要求行不得带题号`).toContain('不得把这条要求写成带题号的题干');
      expect(t, `${stage}：题号只给要单独点名的题`).toContain('题号只给要单独点名的题');
    }
  });
});
