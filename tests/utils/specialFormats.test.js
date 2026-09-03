import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CARRIER_CSS } from '@/styles/carrierCss.js'; // 作答载体 CSS 单一事实源（main.js 全局注入 + themeConfig 导出文档共用）

// ═══════════════════════════════════════════════════════
// 特殊格式 CSS 覆盖测试
// 确保所有 AI 可能输出的特殊格式 CSS 类都有样式定义：
//   作答载体类（blank/span 括号等）→ 单一事实源 carrierCss.js；
//   其余特殊格式类 → global.css
// ═══════════════════════════════════════════════════════

// 从 instructionLib 和 AI prompt 中提取的所有特殊格式 CSS 类
const REQUIRED_SPECIAL_CLASSES = [
  // 填空横线（u + span；span 基选择器含 :not(.blank-line) 且排除数学填空圈 math-circle-blank，整行横线走 .blank-line 自有规则）
  'u[class*="blank-"]',
  'span[class*="blank-"]:not(.blank-line):not([class*="math-circle-blank"])',
  // 四线三格
  '.four-line-three',
  // 画线句子 / 波浪线 / 双线 / 单线
  '.underline-sentence',
  '.wavy-underline',
  '.double-line',
  '.single-line',
  // 加点字
  '.emphasis-dot',
  // 田字格 / 米字格
  '.tian-zi-ge',
  '.mi-zi-ge',
  // 数学专用
  '.oral-box',
  '.square-box',
  '.math-circle-blank-18',
  // 得分框
  '.score-box',
  // 笔顺
  '.stroke-order',
  // 化学条件
  '.chem-condition',
  // 上标 / 下标
  '.superscript',
  '.subscript',
];

describe('Special Format CSS Coverage', () => {
  const cssPath = path.resolve(__dirname, '../../src/styles/global.css');
  let cssContent = '';
  // 作答载体类已收敛到 carrierCss.js（main.js 注入 + themeConfig 导出共用），与 global.css 联合覆盖校验
  let combinedCss = '';

  beforeAll(() => {
    cssContent = fs.readFileSync(cssPath, 'utf-8');
    combinedCss = `${cssContent}\n${CARRIER_CSS}`;
  });

  REQUIRED_SPECIAL_CLASSES.forEach((selector) => {
    it(`${selector} 有样式定义（carrierCss.js / global.css）`, () => {
      // 简单匹配：CSS 选择器后跟 { 表示有样式规则
      // 需要转义 CSS 选择器中的特殊字符用于正则
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped + '\\s*\\{');
      expect(combinedCss).toMatch(regex);
    });
  });

  // 关键：禁止 :deep() 伪选择器出现在 global.css 与 carrierCss.js（Vue SFC only，全局CSS无效）
  it('global.css / carrierCss.js 中不应包含 :deep() 伪选择器（Vue SFC only，全局CSS无效）', () => {
    expect(combinedCss).not.toMatch(/:deep\(/);
  });

  // 关键：括号填空伪元素规则（span[class*="blank-"]::before/::after 画括号）不得命中数学填空圈
  //（.math-circle-blank-18 类名含 "blank-" 子串，宽泛属性选择器会误加 ( ) → 必须带 :not([class*="math-circle-blank"]) 排除）
  it('括号填空伪元素规则排除数学填空圈（math-circle-blank-18 不出现 ( )）', () => {
    // 取出所有画括号的伪元素行（::before content:"(" 或 ::after content:")"）
    const parenLines = CARRIER_CSS.split('\n').filter((l) => /::(before|after)\{content\s*:\s*["']\(["']/.test(l) || /::(before|after)\{content\s*:\s*["'\)]["']/.test(l));
    expect(parenLines.length).toBeGreaterThan(0); // 防空过
    for (const line of parenLines) {
      expect(line).toMatch(/:not\(\[class\*="math-circle-blank"\]\)/);
    }
    // 正向确认：确实存在排除后的括号规则（防止测试因零匹配而空过）
    expect(CARRIER_CSS).toMatch(/span\[class\*="blank-"\]:not\(\.blank-line\):not\(\[class\*="math-circle-blank"\]\)::before\{content:"\("/);
  });
});
