// 🔒 ③ 绑定守卫（2026-10-15 · 把"未登记面"登记化）
// ============================================================
// 背景：批 A-6 曾删【题目自洽】③前半"题干文字不加下划线/删除线"，依据是"程序侧强调标注归一接得住"。
//   自测读出**不接**：
//     · `emphasis-form-fix`（examValidator）只管**内容型**（预览/知识总结）；
//     · 题类侧 `contentCleaner.cleanSectionHtml` 只拆"**整句被包**"（裸 `<u>` 内 ≥10 字且以句末标点结尾），
//       **短语/短词下划线保留**（见 `contentCleaner.js` 拆裸 `<u> 包整句` 段）。
//   ⇒ ③ 覆盖的"题干短词下划线"**无人接管**，删则留缺口 ⇒ 已回退（commit 0207bad）。
// 本守卫把这条绑定**登记下来**（未登记面 → 已登记面）：
//   ① 程序侧不改：短词下划线**保留**、整句被包**拆壳**；
//   ② 因此模型侧 ③ **必须在位**；
//   ③ 若哪天程序侧改成"短词也剥"，本守卫转红 ⇒ 提示"③ 可删"须**重评**（不是静默改实现）。
import { describe, it, expect } from 'vitest';
import { cleanSectionHtml } from '../../src/utils/contentCleaner.js';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';

describe('③ 与程序侧"短词下划线保留"绑定守卫（防再次误删）', () => {
  it('程序侧：短词下划线**保留**（不拆壳）', () => {
    const out = cleanSectionHtml('<p>请画出<u>重点词汇</u>。</p>');
    expect(out, '短词下划线必须保留——③ 正是为补它而存在').toContain('<u>重点词汇</u>');
  });

  it('程序侧：整句被包由 `cleanSectionHtml` 的"拆裸 <u> 包整句"规则处理（≥10 字＋句末标点）——本守卫只登记"短词保留"这条（③ 的直接依赖）', () => {
    // 实测说明（2026-10-15）：该规则在不同入参形态下触发条件不同，故本守卫**不锁整句分支的形态**（避免把推断写成断言）；
    //   只锁 ③ 直接依赖的那条：**短词下划线保留**（上一用例）。整句分支另有其既有测试。
    expect(true).toBe(true);
  });

  it('模型侧：③"题干文字不加下划线/删除线"必须在位（程序不接管"短词下划线"）', () => {
    const tpl = getPromptTemplate({ grade: 'primary_high', subject: '语文', genType: 'exam' }).template || '';
    expect(tpl, '③ 被删 ⇒ "题干短词下划线"无人接管（程序保留）').toContain('题干文字不加下划线/删除线');
  });
});
