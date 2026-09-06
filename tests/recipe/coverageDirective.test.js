// 前瞻覆盖指令契约（2026-09：覆盖要求前移到模板创作要求，不依赖事后对账/重生成）
// ============================================================
// 🔴 教训：考点清单（【本资料考查知识点】）注入素材区，但模板创作要求缺"按资料类型覆盖"句——
//    模型拿到清单却不知 practice 须逐点覆盖、full 型须全层级 → 覆盖不全只能事后对账。
// 契约（与 coverageContract 模式同源）：
//   · per-lesson-full（practice 课时练）→ "覆盖全部考点…不得整点遗漏"
//   · full（preview/dictation/summary/review）→ 全知识点覆盖且指向清单核对锚（summary/review 原有"全部知识点"保留）
//   · focus（special/reading）→ 按主题聚焦（不加"全覆盖"句，防诱导硬塞）
//   · sampled（exam）/ none（errorbook）→ 不加全覆盖句
// ============================================================
import { describe, it, expect } from 'vitest';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';

describe('前瞻覆盖指令（模板层按资料类型注入）', () => {
  it('practice（per-lesson-full）：题目须覆盖本课全部核心知识，不得整点遗漏', () => {
    const t = getPromptTemplate({ genType: 'practice' });
    expect(t.template).toContain('核心知识覆盖（per-lesson-full 契约');
    expect(t.template).toContain('本课知识层级（大概念 → 核心知识）');
    expect(t.template).toContain('不得整点遗漏');
    expect(t.template).toContain('不依赖事后对账');
  });

  it('full 型（preview/dictation）：全知识点覆盖且以核心知识清单为核对锚', () => {
    const preview = getPromptTemplate({ genType: 'preview' });
    expect(preview.template).toContain('覆盖本课全部新知');
    expect(preview.template).toContain('【本资料须覆盖的核心知识】');
    const dictation = getPromptTemplate({ genType: 'dictation' });
    expect(dictation.template).toContain('覆盖本课时/单元全部要求掌握内容');
    expect(dictation.template).toContain('【本资料须覆盖的核心知识】');
    // summary/review 覆盖句已随术语统一为"核心知识"（不回归）
    expect(getPromptTemplate({ genType: 'summary' }).template).toContain('覆盖{unit}全部核心知识');
    expect(getPromptTemplate({ genType: 'review' }).template).toContain('覆盖本单元全部核心知识');
  });

  it('focus/sampled/none 型不加"全覆盖/不得遗漏"句（防诱导硬塞无关考点）', () => {
    for (const g of ['special', 'reading', 'exam', 'errorbook']) {
      const t = getPromptTemplate({ genType: g });
      expect(t.template, `${g} 不得注入全覆盖句`).not.toContain('不得整点遗漏');
      expect(t.template, `${g} 不得注入覆盖清单核对句`).not.toMatch(/全部考点.{0,10}不得/);
    }
  });
});
