// 规范块不可覆盖（2026-10-24 真机"全卷不标任何分"根因锁）
// ============================================================
// 病根：用户指令库里存过旧版模板（或整份自定义模板里没有【分值标注】）时，
//   getPromptTemplate 原样返回该模板 ⇒ 内置的编号/标分判据被整份挤掉 ⇒ 模型收不到任何标分要求。
// 契约：【分值标注】是规范块——用户其余自定义原样保留，该块一律以**内置现行文本**为准
//   （同名块原地替换；旧块名【编号与分值】按旧名替换；完全没有则插到【输出格式】之前）。
// ============================================================
import { describe, it, expect, afterEach } from 'vitest';
import {
  getPromptTemplate, savePromptTemplate, deletePromptTemplate, ANSWER_STEM_CALIBER,
} from '../../src/config/promptLibrary.js';

const KEY = '语文|exam';
const clear = () => {
  deletePromptTemplate(KEY);
  localStorage.removeItem('wisdom_prompt_library_v1');
};

afterEach(clear);

describe('规范块（【分值标注】）不可被用户模板覆盖', () => {
  it('内置模板本身含【分值标注】与现行编号判据', () => {
    const tpl = getPromptTemplate({ grade: 'primary_mid', subject: '语文', genType: 'exam' });
    expect(tpl.source).toBe('builtin');
    expect(tpl.template).toContain('【分值标注】');
    expect(tpl.template).toContain(ANSWER_STEM_CALIBER);
  });

  it('旧自定义模板的【编号与分值】→ 原地换成内置【分值标注】，其余自定义原样保留', () => {
    savePromptTemplate(KEY, {
      name: '旧版模板',
      template: [
        '【我的自定义段】',
        '· 这是用户自己写的一条',
        '【编号与分值】',
        '· 旧版：大题标题只写总分（已过时）',
        '【输出格式】',
        '· 自定义输出格式',
      ].join('\n'),
    });
    const tpl = getPromptTemplate({ grade: 'primary_mid', subject: '语文', genType: 'exam' });
    expect(tpl.source).toBe('user');
    expect(tpl.normativeMerged).toBe(true);
    expect(tpl.template).toContain('【分值标注】');
    expect(tpl.template).toContain(ANSWER_STEM_CALIBER);
    expect(tpl.template, '旧块名不得残留').not.toContain('【编号与分值】');
    expect(tpl.template, '用户其余自定义保留').toContain('【我的自定义段】');
    expect(tpl.template, '用户其余自定义保留').toContain('【输出格式】');
  });

  it('自定义模板完全没有该块 → 插在【输出格式】之前（不是丢弃整份模板）', () => {
    savePromptTemplate(KEY, {
      name: '无分值块模板',
      template: ['【我的自定义段】', '· 只有这一段', '【输出格式】', '· 自定义输出格式'].join('\n'),
    });
    const tpl = getPromptTemplate({ grade: 'primary_mid', subject: '语文', genType: 'exam' });
    expect(tpl.normativeMerged).toBe(true);
    const merged = tpl.template;
    expect(merged).toContain('【分值标注】');
    expect(merged.indexOf('【分值标注】')).toBeLessThan(merged.indexOf('【输出格式】'));
    expect(merged).toContain('【我的自定义段】');
  });

  it('用户模板已是现行块 → 仍以内置文本为准（旧措辞不得借自定义留存）', () => {
    savePromptTemplate(KEY, {
      name: '带旧判据的同名块',
      template: [
        '【分值标注】',
        '· 旧判据：成题区／直答区（已废）',
        '【输出格式】',
        '· 自定义输出格式',
      ].join('\n'),
    });
    const tpl = getPromptTemplate({ grade: 'primary_mid', subject: '语文', genType: 'exam' });
    expect(tpl.normativeMerged).toBe(true);
    expect(tpl.template).toContain(ANSWER_STEM_CALIBER);
    expect(tpl.template, '旧判据不得残留').not.toContain('成题区');
  });

  it('旧模板【卷面结构】里的"不是标题里要填的数字"→ 整块换成内置现行版（全卷不标分根因）', () => {
    savePromptTemplate(KEY, {
      name: '旧卷面结构',
      template: [
        '【卷面结构（依{curriculum}）】',
        '· 旧版：**所标分值只是份量参考，不是标题里要填的数字、也不下发到各题**（标题的分值说明按该大题实际内容得出，与它不同属正常）',
        '{structure}',
        '【分值标注】',
        '· 旧判据',
        '【输出格式】',
        '· 自定义输出格式',
      ].join('\n'),
    });
    const tpl = getPromptTemplate({ grade: 'primary_mid', subject: '语文', genType: 'exam' });
    expect(tpl.normativeMerged).toBe(true);
    expect(tpl.template, '旧措辞不得残留').not.toContain('不是标题里要填的数字');
    expect(tpl.template, '换成内置现行版（参考分不得当作标题或各题要写的分）').toContain('不当作标题或各题要写的分');
    expect(tpl.template, '旧"不下发到各题"不得残留（会被读成别给各题标分）').not.toContain('也不下发到各题');
    expect(tpl.template, '结构占位符保留').toContain('{structure}');
    expect(tpl.template, '用户其余自定义保留').toContain('【输出格式】');
  });

  it('同名块与旧块名并存 → 旧块整段清掉（不留两套判据）', () => {
    savePromptTemplate(KEY, {
      name: '并存',
      template: [
        '【分值标注】',
        '· 旧判据',
        '【编号与分值】',
        '· 更旧的判据',
        '【输出格式】',
        '· 自定义输出格式',
      ].join('\n'),
    });
    const tpl = getPromptTemplate({ grade: 'primary_mid', subject: '语文', genType: 'exam' });
    expect(tpl.template).toContain(ANSWER_STEM_CALIBER);
    expect(tpl.template, '旧块名不得残留').not.toContain('【编号与分值】');
    expect(tpl.template, '旧判据不得残留').not.toContain('更旧的判据');
  });

  it('用户的【卷面结构】没有 {structure} 占位符（另一套自定义块）→ 不动它', () => {
    savePromptTemplate(KEY, {
      name: '自定义结构块',
      template: [
        '【卷面结构】',
        '· 用户自己的结构说明（无占位符）',
        '【输出格式】',
        '· 自定义输出格式',
      ].join('\n'),
    });
    const tpl = getPromptTemplate({ grade: 'primary_mid', subject: '语文', genType: 'exam' });
    expect(tpl.template).toContain('用户自己的结构说明（无占位符）');
    expect(tpl.template, '不得塞入内置结构块').not.toContain('板块参考');
  });

  it('短自定义模板没有【卷面结构】→ 不插入该块（只并入【分值标注】）', () => {
    savePromptTemplate(KEY, {
      name: '短文模板',
      template: ['【我的自定义段】', '· 只有这一段', '【输出格式】', '· 自定义输出格式'].join('\n'),
    });
    const tpl = getPromptTemplate({ grade: 'primary_mid', subject: '语文', genType: 'exam' });
    expect(tpl.normativeMerged).toBe(true);
    expect(tpl.template, '不得把整段结构说明塞进短文').not.toContain('【卷面结构');
    expect(tpl.template).toContain('【分值标注】');
  });

  it('短自定义模板缺【卷首】→ 必并入卷首固定顺序（真机"卷首固定结构消失"）', () => {
    savePromptTemplate(KEY, {
      name: '短文模板',
      template: ['【我的自定义段】', '· 只有这一段', '【输出格式】', '· 自定义输出格式'].join('\n'),
    });
    const tpl = getPromptTemplate({ grade: 'primary_mid', subject: '语文', genType: 'exam' });
    expect(tpl.template).toContain('【卷首】');
    expect(tpl.template).toContain('卷首固定顺序');
    expect(tpl.template.indexOf('【卷首】'), '卷首应在【分值标注】之前').toBeLessThan(tpl.template.indexOf('【分值标注】'));
    expect(tpl.template, '用户其余自定义保留').toContain('【我的自定义段】');
  });

  it('旧版【卷面格式】单块 → 原位置展开为现行拆分块，旧分值例外句零残留（真机"整卷不标分"）', () => {
    savePromptTemplate(KEY, {
      name: '旧版单块',
      template: [
        '【卷面格式】（正式卷面必备）',
        '· 卷首固定顺序：占位标题 → 时间行 → 密封线 → 第一大题',
        '· 分值（**两处都要标**）：大题级必须给分值说明；**小题级在每道题题干后给"（X分）"**',
        '· **例外**：**同型客观小题**（每题分值相同、作答只需在选项/括号处勾选或打√×）——**只在大题级标"（每题X分，共Y分）"一次、小题后不再逐个标**',
        '【卷面结构（依{curriculum}）】',
        '· 旧版：**所标分值只是份量参考，不是标题里要填的数字、也不下发到各题**',
        '{structure}',
        '【输出格式】',
        '· 自定义输出格式',
      ].join('\n'),
    });
    const tpl = getPromptTemplate({ grade: 'primary_mid', subject: '语文', genType: 'exam' });
    expect(tpl.normativeMerged).toBe(true);
    expect(tpl.template, '旧块名不得残留').not.toContain('【卷面格式】');
    expect(tpl.template, '旧分值例外句不得残留').not.toContain('小题后不再逐个标');
    expect(tpl.template, '旧块内旧分值句不得残留').not.toContain('两处都要标');
    for (const b of ['【卷首】', '【卷面层级】', '【卷面自洽】', '【情境与页码】', '【分值标注】']) {
      expect(tpl.template, `现行拆分块缺 ${b}`).toContain(b);
    }
    expect(tpl.template, '卷首固定顺序在').toContain('卷首固定顺序');
    expect(tpl.template, '旧卷面结构措辞被换掉').not.toContain('不是标题里要填的数字');
  });
});

