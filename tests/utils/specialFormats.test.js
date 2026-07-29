import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// ═══════════════════════════════════════════════════════
// 特殊格式 CSS 覆盖测试
// 确保所有 AI 可能输出的特殊格式 CSS 类在 global.css 中有样式定义
// ═══════════════════════════════════════════════════════

// 从 instructionLib 和 AI prompt 中提取的所有特殊格式 CSS 类
const REQUIRED_SPECIAL_CLASSES = [
  // 填空横线（u + span）
  'u[class*="blank-"]',
  'span[class*="blank-"]',
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

  beforeAll(() => {
    cssContent = fs.readFileSync(cssPath, 'utf-8');
  });

  REQUIRED_SPECIAL_CLASSES.forEach((selector) => {
    it(`${selector} 在 global.css 中有样式定义`, () => {
      // 简单匹配：CSS 选择器后跟 { 表示有样式规则
      // 需要转义 CSS 选择器中的特殊字符用于正则
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped + '\\s*\\{');
      expect(cssContent).toMatch(regex);
    });
  });

  // 关键：禁止 :deep() 伪选择器出现在 global.css 中
  it('global.css 中不应包含 :deep() 伪选择器（Vue SFC only，全局CSS无效）', () => {
    expect(cssContent).not.toMatch(/:deep\(/);
  });
});
