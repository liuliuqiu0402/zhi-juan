// 编辑器主题 CSS 转换回归测试：编辑区视觉 = 导出视觉（所见即所得）
//  - 导出页面的全局重置（*）范围化到 .ProseMirror 内（不污染编辑器工具栏）
//  - body 基础样式（字体/字号/行距/颜色）映射到 .ProseMirror（margin/padding/background 丢弃，
//    纸张与内容边距由 .paper-page 壳提供，避免双重留白）
//  - 密封线/试卷布局规则（sealed-wrapper padding、seal-zone 绝对定位、得分表）完整保留
import { describe, it, expect } from 'vitest';
import { applyThemeToContent } from '@/themeConfig.js';

// 复刻 TypesetModule themeCSS 的转换逻辑
const transform = (fullHtml) => {
  const match = fullHtml.match(/<style>([\s\S]*?)<\/style>/i);
  let css = match ? match[1].trim() : '';
  const bodyMatch = css.match(/body\s*\{([^}]*)\}/);
  if (bodyMatch) {
    const keepDecls = bodyMatch[1]
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s && !/^(margin|padding|background|width|min-width|max-width|height)/i.test(s));
    if (keepDecls.length) css += `\n.ProseMirror { ${keepDecls.join('; ')} }\n`;
  }
  css = css.replace(/^\s*\*\s*\{/, '.ProseMirror * {');
  css = css.replace(/body\s*\{[^}]*\}/g, '');
  return css;
};

describe('编辑器 themeCSS 转换（编辑区 = 导出视觉）', () => {
  const full = applyThemeToContent('<div></div>', 'sealed_exam', { isHtmlContent: true, forceImportant: true });
  const css = transform(full);

  it('全局重置范围化到 .ProseMirror 内（不污染工具栏）', () => {
    expect(css).toContain('.ProseMirror * {');
    expect(css).not.toMatch(/^\s*\*\s*\{/m);
  });

  it('body 基础样式映射到 .ProseMirror，丢弃 margin/background', () => {
    expect(css).toMatch(/\.ProseMirror \{[^}]*font-family:[^}]*\}/);
    expect(css).toMatch(/\.ProseMirror \{[^}]*font-size:[^}]*\}/);
    expect(css).not.toContain('body {');
    expect(css).not.toMatch(/\.ProseMirror \{[^}]*margin:/);
  });

  it('保留密封线与试卷布局规则', () => {
    expect(css).toMatch(/\.sealed-wrapper\s*\{[^}]*padding:\s*20mm\s+25mm/);
    expect(css).toMatch(/\.seal-zone\s*\{[^}]*position:\s*absolute/);
    expect(css).toMatch(/\.exam-score-table/);
  });

  it('书写格尺寸按学段 GRID_CELL mm 渲染（不再硬编码 1.8em/em 随字号）', () => {
    expect(css).toMatch(/\.tian-zi-ge\s*\{[^}]*width:\s*\d+(\.\d+)?mm/);
    expect(css).toMatch(/\.tian-zi-ge\s*\{[^}]*height:\s*\d+(\.\d+)?mm/);
    expect(css).toMatch(/\.mi-zi-ge\s*\{[^}]*width:\s*\d+(\.\d+)?mm/);
    expect(css).toMatch(/:root\s*\{\s*--flt-h:\s*\d+(\.\d+)?mm/); // 四线三格行高变量：单一事实源 carrierCss（按学段注入）
    expect(css).toMatch(/\.four-line-three::before,\s*\.sixian-ge::before\s*\{[^}]*height:\s*var\(--flt-h,\s*9mm\)/);
    expect(css).not.toContain('.tian-zi-ge { display: inline-block; position: relative; width: 1.8em');
  });

  it('作答载体规则随独立导出文档自带（span 括号伪元素/blank-line/行尾延伸/宽度档位 1..24）', () => {
    expect(css).toMatch(/span\[class\*="blank-"\][^{]*::before\s*\{\s*content:\s*"\("/);
    expect(css).toMatch(/span\[class\*="blank-"\][^{]*::after\s*\{\s*content:\s*"\)"/);
    expect(css).toMatch(/\.blank-line\s*\{[^}]*border-bottom:/);
    expect(css).toMatch(/p:has\(> u\[class\*="blank-"\]:last-child\)\s*\{[^}]*display:\s*flex/);
    expect(css).toMatch(/u\.blank-24\s*\{\s*min-width:\s*24em/);
    expect(css).toMatch(/span\.blank-24\s*\{[^}]*minmax\(24em,\s*1fr\)/); // 括号内书写空间 = 24em（与 Word 口径一致）
  });
});
