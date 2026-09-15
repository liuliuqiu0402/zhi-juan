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
  it('practice（per-lesson-full）：题目须覆盖本课全部核心知识，不得有整项遗漏', () => {
    const t = getPromptTemplate({ genType: 'practice' });
    expect(t.template).toContain('内容与分组分开看：本课【锚点清单】所列内容须在资料中**真的练到**');
    expect(t.template).toContain('不要求逐项对应');
    expect(t.template).toContain('不以清单条目作分组或命名');
    expect(t.template).toContain('整份都没有落点的补上');
    // 🔴 2026-09-14（用户裁定·实测产物验证）：原句"本课知识层级（大概念 → 核心知识）逐点至少以一道题…"
    //    把清单的**层级**当成了**设题依据** → 模型把知识主题直接当大题标题（锚清单通道实测复现）。
    //    现锁死：覆盖要求保留，但不得再出现"按层级逐点设题"的暗示。
    expect(t.template).not.toContain('本课知识层级（大概念');
    expect(t.template).not.toContain('逐点至少以一道题');
    // 清单上下限/扩展口径（2026-09-13）已收敛到生成端【素材使用约定】按资料类型分档单源注入
    // （expand 可补清单外知识点/角度、integrate 可关联已学旧知、strict 守本课），模板只保留覆盖要求本身，
    // 不再复述"下限/上限/扩展"（防注入逐字重复）
    expect(t.template).not.toContain('覆盖下限、不是命题上限');
    expect(t.template).not.toContain('不是命题上限');
    // 声明≠覆盖（题类句）已删：由全局【质量底线】承载（罗列/声明覆盖不算覆盖，覆盖只以实际呈现计），
    // 题类模板不再重复展开
    expect(t.template).not.toContain('声明≠覆盖（题类）');
    expect(t.template).toContain('只以实际呈现的题目/条目为准');
    // 与全局 QUALITY_BASE 重复的"覆盖优先于篇幅"句已从 practice 删除（单一事实源）
    expect(t.template).not.toContain('覆盖优先于篇幅');
    expect(t.template).not.toContain('严禁删考点或改由声明代替');
  });

  it('full 型（preview/dictation）：全知识点覆盖且以锚点清单为核对锚（下限；且按类型守边界）', () => {
    const preview = getPromptTemplate({ genType: 'preview' });
    expect(preview.template).toContain('围绕本次勾选范围安排预习');
    expect(preview.template).toContain('【锚点清单】');
    expect(preview.template).toContain('为下限');
    expect(preview.template).toContain('不做清单外补充');
    const dictation = getPromptTemplate({ genType: 'dictation' });
    expect(dictation.template).toContain('以本次勾选范围为下限');
    expect(dictation.template).toContain('默写严格对应教材要求');
    expect(dictation.template).toContain('不做清单外补充');
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
      // 🔴 2026-09-14：覆盖句措辞由"不得整点遗漏"改为"不得有整项遗漏"，现统一为"都要练到"口径，负向断言随之更新
      expect(t.template, `${g} 不得注入全覆盖句`).not.toContain('都要练到');
      expect(t.template, `${g} 不得注入覆盖清单核对句`).not.toMatch(/全部考点.{0,10}不得/);
    }
  });

  // 🔴 2026-09-14（用户定版）：栏内分组依据按题类分流——题类（同步练习/专项/阅读）不以清单条目作分组
  //    （"分组逻辑仍来自清单"的根因修复）；其余类型逐字不变。
  // 🔴 2026-09-15（用户定版·去锚）：原"按本学科本学段的常规题型或任务的开展环节分组 / 标题即该组的题型/环节名 /
  //    用本学段常规写法自拟"**整条撤除**——分组与命名交模型侧自定、不作任何锚定（消除独立调用题型趋同）。
  it('栏内分组依据按题类分流：题类不按清单条目分组；分组与命名交模型自定（2026-09-15 去锚）', () => {
    for (const g of ['practice', 'special', 'reading']) {
      const tpl = getPromptTemplate({ genType: g }).template;
      expect(tpl, `${g} 分组与命名应交模型自定`).toContain('由你按内容需要分组成大题');
      expect(tpl, `${g} 须明示分组依据不是知识点清单`).toContain('分组依据不是知识点清单');
      expect(tpl, `${g} 不得再出现"常规题型/常规写法"锚定`).not.toMatch(/常规题型|常规写法/);
    }
    // 课时练另在创作要求里给了"两层分开看"的完整口径（内容层 × 结构层）
    const practice = getPromptTemplate({ genType: 'practice' }).template;
    expect(practice).toContain('不以清单条目作分组或命名');
    expect(practice).toContain('这是**内容**要求');
    expect(practice).toContain('这是**结构**要求');
    for (const g of ['exam', 'errorbook', 'summary', 'preview', 'dictation', 'review']) {
      const tpl = getPromptTemplate({ genType: g }).template;
      expect(tpl, `${g} 不应改分组依据（逐字不变）`)
        .not.toContain('由你按内容需要分组成大题');
    }
    // 原有"标题来源禁则"不得因本次改动丢失
    expect(practice)
      .toContain('不得直接搬用【锚点清单】的条目名或教材板块名充当栏目标题/大题标题');
  });
});
