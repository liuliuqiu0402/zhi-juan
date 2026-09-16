// 🔒 2026-09-16 用户裁定（少约束）：委托书里不再给模型"题型／栏目／层次／结构／序列"这类组织描述。
//    判据：教材分析出来的内容颗粒只是**参考依据**，不得被读成题组骨架
//    （实证：六年级英语 Unit 1 产物 12 个大题逐个对上教材板块与学习目标 → 颗粒被逐点翻译成题）。
//    本文件是**方向守卫**：这些词以"组织描述"身份回潮即红。
import { describe, it, expect } from 'vitest';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';
import { buildOrganizeBlock } from '../../src/utils/injectionManifest.js';
import { buildTeachingInjection } from '../../src/config/teachingBlueprints.js';

const TYPES = ['exam', 'practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review'];
/** 组织形态词（产品自造 / 指向形式）：不得出现在任何类型的委托正文里 */
const FORM_WORDS = ['题型结构', '知识板块', '技能环节', '蓝图结构', '栏目序列', '栏目框架', '名称与先后', '题组'];

describe('少约束·委托书不再给组织形态描述（教材颗粒只作参考依据）', () => {
  it('九类模板都不含组织形态词', () => {
    for (const genType of TYPES) {
      for (const grade of ['primary_high', 'middle']) {
        const t = getPromptTemplate({ grade, subject: '英语', genType });
        for (const w of FORM_WORDS) {
          expect(t.template, `${genType}(${grade}) 不得出现「${w}」`).not.toContain(w);
        }
      }
    }
  });

  it('材料段头只讲"参考内容颗粒生成本资料"，不再讲题型结构', () => {
    // 只有带括注的段头需要改口径（practice/special/errorbook 一句、exam 一句）
    for (const genType of ['practice', 'special', 'errorbook']) {
      expect(getPromptTemplate({ subject: '英语', genType }).template).toContain('（参考以上内容颗粒生成本资料）');
    }
    expect(getPromptTemplate({ subject: '英语', genType: 'exam' }).template).toContain('（参考以上内容颗粒命制本卷）');
    // summary/preview/dictation/review 段头本就不带括注（只写教材依据），无需改
    expect(getPromptTemplate({ subject: '英语', genType: 'summary' }).template).toContain('【{materialHead}】');
    // reading 段头本就只讲"单元主题与相关语料风格"（无题型词），不在本次改动面内
    expect(getPromptTemplate({ subject: '英语', genType: 'reading' }).template).toContain('单元主题与相关语料风格');
  });

  it('角色句都带课标依据（删掉结构词后模型手上的正当依据）', () => {
    for (const genType of TYPES) {
      expect(getPromptTemplate({ subject: '英语', genType }).template, `${genType} 角色句缺课标依据`).toContain('{curriculum}');
    }
  });

  it('教辅注入：只给栏目名（作大类标题用），不给"栏目序列／框架／认知层次"', () => {
    for (const genType of ['practice', 'special', 'reading', 'summary', 'preview', 'dictation', 'errorbook', 'review']) {
      const t = buildTeachingInjection({ genType, stage: 'primary_high', subject: '英语', columnStyle: 'a' });
      expect(t, `${genType} 应注入栏目块`).toContain('【本次栏目（作大类标题用');
      for (const w of ['栏目序列', '栏目框架', '认知层次', '教辅结构']) {
        expect(t, `${genType} 注入不得出现「${w}」`).not.toContain(w);
      }
      // 🔴 栏目名必须照旧注入：a/b/c/d 轮换依赖模型照用注入的栏目名（动它=轮换失效）
      expect(t, `${genType} 栏目名不得丢`).toMatch(/· .+——/);
    }
  });

  it('组织方式块：教辅整类不注入（形式全交模型）；试卷逐字守卷面结构', () => {
    for (const t of ['practice', 'special', 'reading', 'summary', 'preview', 'dictation', 'errorbook', 'review']) {
      expect(buildOrganizeBlock(t), `${t} 不得再注入组织方式`).toBe('');
    }
    expect(buildOrganizeBlock('exam')).toBe('【组织方式】输出一律以委托书【卷面结构】的大题序列组织（大题名、顺序、题量以委托书为准）；开头【锚点清单】只声明要练到的范围，不是组织方式，不得据此替代委托书结构。\n\n');
  });

  it('题型授权仍保留在输出格式里（删了组织方式块，不能把 <h3> 授权一起删掉）', () => {
    const t = getPromptTemplate({ subject: '英语', genType: 'practice' }).template;
    expect(t).toContain('组前用 <h3> 标题（标题自拟）');
    expect(t).toContain('栏目标题用注入给出的栏目名');
    // 渲染端硬需求：标记层级与题号连续（真正的约束，不许被"少约束"顺手删掉）
    expect(t).toContain('大标题用 <h1>');
    expect(t).toContain('题目以 <p class="question"> 包裹并带题号');
    expect(t).toContain('答案/解析/评分标准');
  });
});
