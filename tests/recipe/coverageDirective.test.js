// 前瞻覆盖指令契约（2026-09：覆盖要求前移到模板创作要求，不依赖事后对账/重生成）
// ============================================================
// 🔴 教训：考点清单（【本资料考查知识点】）注入素材区，但模板创作要求缺"按资料类型覆盖"句——
//    模型拿到清单却不知 practice 须逐项覆盖、full 型须全层级 → 覆盖不全只能事后对账。
// 契约（与 coverageContract 模式同源）：
//   · per-lesson-full（practice 课时练）→ "覆盖全部核心知识…不得有整项遗漏"（🔴 2026-09-14：不再带"按层级逐点设题"暗示）
//   · full（preview/dictation/summary/review）→ 全知识点覆盖且指向清单核对锚（summary/review 原有"全部知识点"保留）
//   · focus（special/reading）→ 按主题聚焦（不加"全覆盖"句，防诱导硬塞）
//   · sampled（exam）/ none（errorbook）→ 不加全覆盖句
// ============================================================
import { describe, it, expect } from 'vitest';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';

describe('前瞻覆盖指令（模板层按资料类型注入）', () => {
  it('practice（per-lesson-full）：覆盖要求由范围陈述承载（对账段已撤除且不得回潮）', () => {
    const t = getPromptTemplate({ genType: 'practice' });
    // 🔒 2026-09-15 用户裁定·去诱导（本文件为翻转点·整类问题）：原"内容与分组分开看：本课【锚点清单】所列内容
    //    须在资料中**真的练到**…这是**内容**要求；题组的分组与命名由你按内容需要自定，**不以清单条目作分组或命名**
    //    ——这是**结构**要求。定稿前对着清单过一遍，整份都没有落点的补上"**整段撤除**。
    //    它是"对账语言（下限/落点/逐条对账）+ 否定式关联（不以清单条目作分组或命名）+ 强调标签（这是XX要求）"
    //    三合一句；要读懂否定半句必须先建立"内容条目 ↔ 分组/命名"映射 = 反向植入。
    //    实证：产物把内容条目直接当了六个大题标题（六年级英语上册 Unit 1 同步练习）。
    //    功能改由两处正向承载：① 清单角色说明的内容范围陈述；② 题类分组正向口径（标题自拟+一句话概括）。
    expect(t.template, '对账段不得回潮').not.toMatch(/内容与分组分开看|这是\*\*内容\*\*要求|这是\*\*结构\*\*要求|整份都没有落点的补上|不以清单条目|不要求逐项对应/);
    // 🔴 2026-09-14（用户裁定·实测产物验证）：原句"本课知识层级（大概念 → 核心知识）逐点至少以一道题…"
    //    把清单的**层级**当成了**设题依据** → 模型把知识主题直接当大题标题（锚清单通道实测复现）。
    //    现锁死：不得再出现"按层级逐点设题"的暗示。
    expect(t.template).not.toContain('本课知识层级（大概念');
    expect(t.template).not.toContain('逐点至少以一道题');
    // 范围上下限/扩展口径（2026-09-13）在生成端【素材使用约定】按资料类型分档单源注入，模板只保留正向口径
    expect(t.template).not.toContain('不是命题上限');
    expect(t.template).not.toContain('覆盖下限、不是命题上限');
    // 声明≠覆盖由全局【质量底线】承载（覆盖只以实际呈现计）
    expect(t.template).toContain('只以实际呈现的题目/条目为准');
    expect(t.template).not.toContain('覆盖优先于篇幅');
    expect(t.template).not.toContain('严禁删考点或改由声明代替');
  });

  it('full 型（preview/dictation）：按本次范围安排（范围陈述，不写"下限/不做清单外补充"）', () => {
    const preview = getPromptTemplate({ genType: 'preview' });
    expect(preview.template).toContain('围绕本次范围安排预习');
    expect(preview.template, '对账语不得回潮').not.toMatch(/为下限|不做清单外补充|【锚点清单】/);
    const dictation = getPromptTemplate({ genType: 'dictation' });
    expect(dictation.template).toContain('默写严格对应教材要求，按本次范围安排');
    expect(dictation.template, '对账语不得回潮').not.toMatch(/以本次勾选范围为下限|不做清单外补充/);
    // 悬空块名已收敛（2026-09-13）：模板引用统一为实际注入的【锚点清单】，不再引用无生产者的旧块名
    for (const g of ['practice', 'preview', 'dictation']) {
      expect(getPromptTemplate({ genType: g }).template, `${g} 不应再引用悬空块名`)
        .not.toContain('【本资料须覆盖的核心知识】');
    }
    // summary/review 覆盖句已随术语统一为"核心知识"（不回归）
    expect(getPromptTemplate({ genType: 'summary' }).template).toContain('在本次勾选范围的基础上全面细致地汇总知识');
    expect(getPromptTemplate({ genType: 'review' }).template).toContain('在本次勾选范围的基础上汇总核心知识');
    // 全局层（QUALITY_BASE）：声明≠覆盖 + 覆盖完整优先——required 各型（含 exam 模板）均注入
    for (const g of ['practice', 'summary', 'review', 'preview', 'dictation', 'exam']) {
      const t = getPromptTemplate({ genType: g });
      expect(t.template, `${g} 缺"声明不算练到"全局句`).toContain('只以实际呈现的题目/条目为准');
      expect(t.template, `${g} 缺"要点落到优先"全局句`).toContain('要点落到优先');
    }
  });

  it('focus/sampled/none 型不加"全覆盖/不得遗漏"句（防诱导硬塞无关考点）', () => {
    for (const g of ['special', 'reading', 'exam', 'errorbook']) {
      const t = getPromptTemplate({ genType: g });
      expect(t.template, `${g} 不得注入全覆盖句`).not.toContain('都要练到');
      expect(t.template, `${g} 不得注入覆盖清单核对句`).not.toMatch(/全部考点.{0,10}不得/);
    }
  });

  // 🔴 2026-09-14（用户定版）：栏内分组依据按题类分流——题类（同步练习/专项/阅读）不以清单条目作分组
  // 🔴 2026-09-15（用户定版·去锚）：原"按本学科本学段的常规题型或任务的开展环节分组 / 标题即该组的题型/环节名 /
  //    用本学段常规写法自拟"**整条撤除**——分组与命名交模型侧自定、不作任何锚定（消除独立调用题型趋同）。
  // 🔒 2026-09-15（用户定版·去诱导，第二次翻转）：本条原锁定的三句**否定式关联**——"分组依据不是知识点清单"
  //    "不以清单条目作分组或命名""不得直接搬用【锚点清单】的条目名或教材板块名充当栏目标题/大题标题"
  //    ——**全部撤除**。它们要读懂必须先建立"内容条目 ↔ 分组/命名/标题"这条映射，等于把错误做法反向植入；
  //    实证：产物把内容条目直接当了六个大题标题。功能改由正向口径承载（标题自拟 + 一句话概括该组在练什么）。
  it('栏内分组：题类给正向自拟口径；否定式关联句已撤除且不得回潮', () => {
    for (const g of ['practice', 'special', 'reading']) {
      const tpl = getPromptTemplate({ genType: g }).template;
      // 🔒 2026-09-16 用户裁定（少约束）：组织方式块对教辅整类撤除；分组/命名授权改由【输出格式】承载，
      //    举例式分组描述（"同一知识点可分布在多个大题里…"）同批删掉。
      expect(tpl, `${g} 应给正向标题自拟授权`).toContain('组前用 <h3> 标题（标题自拟）');
      expect(tpl, `${g} 举例式分组描述应已删除`).not.toContain('同一知识点可分布在多个大题里');
      expect(tpl, `${g} 不得再出现"常规题型/常规写法"锚定`).not.toMatch(/常规题型|常规写法/);
      expect(tpl, `${g} 否定式关联不得回潮`).not.toMatch(/不以清单条目|分组依据不是知识点清单|不得直接搬用|这是\*\*结构\*\*要求/);
    }
    for (const g of ['exam', 'errorbook', 'summary', 'preview', 'dictation', 'review']) {
      const tpl = getPromptTemplate({ genType: g }).template;
      expect(tpl, `${g} 不应注入题类分组口径`)
        .not.toContain('标题自拟，一句话概括该组在练什么');
    }
  });
});
