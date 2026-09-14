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
    expect(t.template).toContain('核心知识覆盖：题目须覆盖本课');
    expect(t.template).toContain('每一项都要有实际呈现它的题目或任务');
    expect(t.template).toContain('不得有整项遗漏');
    expect(t.template).toContain('不依赖事后对账');
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
    expect(t.template).toContain('覆盖只以实际呈现的题目/条目计');
    // 与全局 QUALITY_BASE 重复的"覆盖优先于篇幅"句已从 practice 删除（单一事实源）
    expect(t.template).not.toContain('覆盖优先于篇幅');
    expect(t.template).not.toContain('严禁删考点或改由声明代替');
  });

  it('full 型（preview/dictation）：全知识点覆盖且以锚点清单为核对锚（下限；且按类型守边界）', () => {
    const preview = getPromptTemplate({ genType: 'preview' });
    expect(preview.template).toContain('覆盖本课全部新知');
    expect(preview.template).toContain('【锚点清单】');
    expect(preview.template).toContain('（下限）');
    expect(preview.template).toContain('不做清单外补充');
    const dictation = getPromptTemplate({ genType: 'dictation' });
    expect(dictation.template).toContain('覆盖本课时/单元全部要求掌握内容');
    expect(dictation.template).toContain('【锚点清单】');
    expect(dictation.template).toContain('（下限）');
    expect(dictation.template).toContain('不做清单外补充');
    // 悬空块名已收敛（2026-09-13）：模板引用统一为实际注入的【锚点清单】，不再引用无生产者的旧块名
    for (const g of ['practice', 'preview', 'dictation']) {
      expect(getPromptTemplate({ genType: g }).template, `${g} 不应再引用悬空块名`)
        .not.toContain('【本资料须覆盖的核心知识】');
    }
    // summary/review 覆盖句已随术语统一为"核心知识"（不回归）
    expect(getPromptTemplate({ genType: 'summary' }).template).toContain('覆盖{unit}全部核心知识');
    expect(getPromptTemplate({ genType: 'review' }).template).toContain('覆盖本单元全部核心知识');
    // 全局层（QUALITY_BASE）：声明≠覆盖 + 覆盖完整优先——required 各型（含 exam 模板）均注入
    for (const g of ['practice', 'summary', 'review', 'preview', 'dictation', 'exam']) {
      const t = getPromptTemplate({ genType: g });
      expect(t.template, `${g} 缺"声明不算覆盖"全局句`).toContain('覆盖只以实际呈现的题目/条目计');
      expect(t.template, `${g} 缺"覆盖完整优先"全局句`).toContain('覆盖完整优先');
    }
  });

  it('focus/sampled/none 型不加"全覆盖/不得遗漏"句（防诱导硬塞无关考点）', () => {
    for (const g of ['special', 'reading', 'exam', 'errorbook']) {
      const t = getPromptTemplate({ genType: g });
      // 🔴 2026-09-14：覆盖句措辞由"不得整点遗漏"改为"不得有整项遗漏"（去粒度量词），负向断言随之更新
      expect(t.template, `${g} 不得注入全覆盖句`).not.toContain('不得有整项遗漏');
      expect(t.template, `${g} 不得注入覆盖清单核对句`).not.toMatch(/全部考点.{0,10}不得/);
    }
  });
});
