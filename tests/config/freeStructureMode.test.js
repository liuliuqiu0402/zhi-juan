// 🔒 结构来源·自由组织（2026-10-16 属主裁定）守卫
// ============================================================
// 属主三条口径：
//   ① **9 类资料全开放**（含正式考卷）；
//   ② 自由模式下栏目级课标要求**改由内容层面承载**（属主已认可）；
//   ③ **既有判据一字不动、不与原来的混** —— 本线是**纯增量**：
//      默认（'blueprint'）＝既有线，实发逐字不变；仅显式选 'free' 才改道。
// 本守卫锁四件事：默认＝既有线 / 两侧新线文本齐备 / 新线不自带诱导 / 源登记在册。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildFreeStructureInstruction } from '../../src/config/promptLibrary.js';

const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('结构来源·自由组织（纯增量新线）', () => {
  const gm = read('src/modules/GenerateModule.vue');

  it('① 默认＝既有线：开关默认 blueprint，且注入点仅"free 才改道"（共 4 处）', () => {
    expect(gm, '结构来源开关默认须为 blueprint').toContain("const structureMode = ref('blueprint')");
    const hits = gm.split("structureMode.value === 'free'").length - 1;
    expect(hits, '改道点应为 4 处（exam×2 ＋ 非 exam×2）').toBe(4);
    // 既有两侧的默认分支必须原样保留（防"新线把老线覆盖掉"）
    expect(gm, 'exam 默认分支须仍是蓝图').toContain('buildStructureText(applyScoreAdjust(bp), { withScore:');
    expect(gm, '非 exam 默认分支须仍是教辅栏目').toContain('composeSpecialTeachingText({ genType, stageKey, subject, domainKeys: specialSubType.value })');
  });

  it('② exam 新线：结构自定，但分值账目与考点覆盖照旧（判据不放松）', () => {
    const t = buildFreeStructureInstruction('exam');
    expect(t).toContain('卷面结构由你按本次课标范围与考点自定');
    expect(t, '分值账目判据不得放松').toContain('分值账目自洽');
    expect(t, '须覆盖锚点清单').toContain('覆盖【锚点清单】');
    expect(t, '课标要求改由内容层面承载').toContain('内容层面');
  });

  it('③ 非 exam 新线：栏目自定，但考点覆盖与栏目名要素照旧', () => {
    const t = buildFreeStructureInstruction('practice');
    expect(t).toContain('栏目标题、栏目数量与顺序由你按本次课标范围与考点自定');
    expect(t, '须覆盖锚点清单').toContain('覆盖【锚点清单】');
    expect(t, '课标要求改由内容层面承载').toContain('内容层面');
  });

  it('④ 新线文本自身不自带诱导：逐行 ·／无路径链／无题型名样例／无 emoji', () => {
    for (const g of ['exam', 'practice']) {
      const t = buildFreeStructureInstruction(g);
      expect(t.split('\n').every((l) => l.startsWith('· ')), `${g}：每条须以"· "起头`).toBe(true);
      expect(t, `${g}：不得出现路径链`).not.toContain('→');
      for (const bad of ['直接写出得数', '列竖式计算', '选择题', '填空题']) {
        expect(t, `${g}：不得枚举题型名（${bad}）`).not.toContain(bad);
      }
      expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t), `${g}：不得含 emoji`).toBe(false);
    }
  });

  it('⑤ 源登记：新 builder 已在 E 表在册（实发每句有主）', () => {
    expect(read('src/config/caliberRegistry.js')).toContain("'buildFreeStructureInstruction'");
  });
});
