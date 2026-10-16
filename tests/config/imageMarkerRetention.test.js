// 🔒 图标记原文不丢 · 守卫（2026-10-16 属主裁定 **B**）
// ============================================================
// 裁定背景（M5 张力，登记于 `docs/design/三维度逐条重造-台账.md`〔426〕）：
//   《修复准则》旧字面写"正文与导出**保留标记原样即正确**／不得转换解释成占位说明／不得在排版通道补转换"，
//   而实现自 **v43** 起即"预览渲染为占位框、导出落〔配图位置：…〕占位文本"，两者正面冲突。
//   2026-10-16 属主裁定 **B**：**保留占位框/占位说明（既定产品形态），改准标准措辞**，
//   并把真正的硬约束立为——**【标记原文（`[IMAGE]…[/IMAGE]` 整段，含 PROMPT/TYPE/KEYWORDS）不得丢失】**。
//
// 本守卫锁"原文不丢"的三条链路 + 导出允许形态 + 标准与实现对齐（四类，任一断则红）：
//   ① 保存侧：写 `rawContent`（未处理的原文）；`content` 才是占位框版
//   ② 读取侧：`docSourceText` 优先 `rawContent`
//   ③ 载体侧：占位框以 `data-image-raw`／`data-graph-raw` 承载标准化标记（可还原）
//   ④ 导出侧：落"配图位置／图形位置"占位文本（**允许形态**，v43 起；行为测试见 `tests/utils/imagePlaceholderExport.test.js`）
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('图标记原文不丢（属主裁定 B）', () => {
  const gm = read('src/modules/GenerateModule.vue');
  const db = read('src/utils/docxBuilder.js');

  it('① 保存侧：写 rawContent（未处理原文）＋content＝占位框版', () => {
    expect(gm, 'content 须为占位框版（renderImagePlaceholders 之后）').toContain('content: renderImagePlaceholders(titledContent)');
    expect(gm, 'rawContent 须存未处理原文（标记原文的落点）').toContain('rawContent: titledContent');
  });

  it('② 读取侧：docSourceText 优先 rawContent（旧文档才回退 content）', () => {
    expect(gm).toContain('doc?.rawContent || doc?.content');
  });

  it('③ 载体侧：占位框以 data-*-raw 承载标准化标记（可还原）', () => {
    expect(gm, '配图占位框须带 data-image-raw').toContain('data-image-raw');
    expect(gm, '图形占位框须带 data-graph-raw').toContain('data-graph-raw');
  });

  it('④ 导出侧：落"配图位置／图形位置"占位文本（B 允许形态）', () => {
    expect(db).toContain('〔配图位置：');
    expect(db).toContain('〔图形位置（');
  });

  it('标准与实现对齐：修复准则已记 B 口径，且旧字面不得回潮', () => {
    const fix = read('docs/design/修复准则-检查清单.md');
    expect(fix, '硬约束＝标记原文不得丢失').toContain('标记原文不得丢失');
    expect(fix, '占位说明须被记为允许形态').toContain('允许且既定的呈现形态');
    expect(fix, '旧的"保留标记原样即正确"字面须已改准（防回潮）').not.toContain('正文与导出**保留标记原样即正确**');
  });
});
