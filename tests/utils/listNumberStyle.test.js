/**
 * 有序列表编号形式 · 单一事实源单测
 * ============================================================
 * 一个编号形式要同时活在四处：编辑器显示、编辑器"转文本"、HTML/PDF 导出、Word 导出。
 * 此前只有原生 1/a/A/i/I，且判断散落在 docxBuilder / RichTextEditor / themeConfig 各一份；
 * 现全部收进 `src/utils/listNumberStyle.js`，本文件锁住"表 + 前缀 + CSS"三者自洽，
 * 以及"谁都不许再自建第二份编号表"（源码守卫）。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  NUMBER_FORMS, isOrderedNumberStyle, orderedPrefix, LIST_NUMBER_CSS,
  LIST_NUMBER_STYLE_ID, ensureListNumberStyleInjected, toRoman, toCircled, toChineseNumeral,
} from '../../src/utils/listNumberStyle.js';

describe('NUMBER_FORMS —— 形式表本体', () => {
  it('八种形式齐备且 value 唯一（1/a/A/i/I/（1）/一、/①）', () => {
    expect(NUMBER_FORMS.map((f) => f.value)).toEqual(['1', 'a', 'A', 'i', 'I', 'paren', 'cjk', 'circled']);
    expect(new Set(NUMBER_FORMS.map((f) => f.value)).size).toBe(NUMBER_FORMS.length);
    for (const f of NUMBER_FORMS) {
      expect(f.label).toBeTruthy();
      expect(f.sample).toBeTruthy();
    }
  });

  it('样本与第 1 项前缀一致（下拉里显示什么，用起来就是什么；前后空白不算差异）', () => {
    for (const f of NUMBER_FORMS) {
      expect(orderedPrefix(f.value, 1).trim()).toBe(f.sample);
    }
  });

  it('isOrderedNumberStyle 只认表内 value（无序符号字符不冒充编号）', () => {
    for (const f of NUMBER_FORMS) expect(isOrderedNumberStyle(f.value)).toBe(true);
    expect(isOrderedNumberStyle('• ')).toBe(false);
    expect(isOrderedNumberStyle('√ ')).toBe(false);
    expect(isOrderedNumberStyle(null)).toBe(false);
    expect(isOrderedNumberStyle(undefined)).toBe(false);
  });
});

describe('orderedPrefix —— 字面前缀（Word 导出与"转文本"共用）', () => {
  it('阿拉伯 / 字母（含超过 26 位循环）', () => {
    expect(orderedPrefix('1', 1)).toBe('1. ');
    expect(orderedPrefix('1', 12)).toBe('12. ');
    expect(orderedPrefix('a', 1)).toBe('a. ');
    expect(orderedPrefix('a', 26)).toBe('z. ');
    expect(orderedPrefix('a', 27)).toBe('a. '); // 循环
    expect(orderedPrefix('A', 2)).toBe('B. ');
  });

  it('罗马数字（大小写）', () => {
    expect(orderedPrefix('i', 4)).toBe('iv. ');
    expect(orderedPrefix('I', 4)).toBe('IV. ');
    expect(orderedPrefix('I', 9)).toBe('IX. ');
  });

  it('括号数字 / 中文数字 / 圈号数字（本次新增的三类）', () => {
    expect(orderedPrefix('paren', 3)).toBe('（3）');
    expect(orderedPrefix('cjk', 1)).toBe('一、');
    expect(orderedPrefix('cjk', 3)).toBe('三、');
    expect(orderedPrefix('cjk', 11)).toBe('十一、');
    expect(orderedPrefix('cjk', 20)).toBe('二十、');
    expect(orderedPrefix('circled', 1)).toBe('①');
    expect(orderedPrefix('circled', 10)).toBe('⑩');
    expect(orderedPrefix('circled', 12)).toBe('⑫');
  });

  it('异常输入安全（0/负/NaN/未知形式回落阿拉伯数字）', () => {
    expect(orderedPrefix('1', 0)).toBe('1. ');
    expect(orderedPrefix('1', -5)).toBe('1. ');
    expect(orderedPrefix('1', NaN)).toBe('1. ');
    expect(orderedPrefix('不存在', 3)).toBe('3. ');
    // 圈号超出 ①②…⑳ 范围 → 回落阿拉伯（宁降级不画错）
    expect(orderedPrefix('circled', 21)).toBe('21');
  });

  it('辅助转换函数（罗马/圈号/中文）', () => {
    expect(toRoman(1987)).toBe('MCMLXXXVII');
    expect(toCircled(3)).toBe('③');
    expect(toCircled(0)).toBe('0');
    expect(toChineseNumeral(1)).toBe('一');
    expect(toChineseNumeral(10)).toBe('十');
    expect(toChineseNumeral(21)).toBe('二十一');
    expect(toChineseNumeral(200)).toBe('200'); // 超范围回落
  });
});

describe('LIST_NUMBER_CSS —— 导出/编辑器共用样式', () => {
  it('三种自定义形式都有 @counter-style（HTML 没有这些原生 type，只能靠 counter-style）', () => {
    expect(LIST_NUMBER_CSS).toContain('@counter-style k-paren');
    expect(LIST_NUMBER_CSS).toContain('@counter-style k-cjk');
    expect(LIST_NUMBER_CSS).toContain('@counter-style k-circled');
  });

  it('八种形式都有 ol[type] 规则（原生形式也显式写出，四处口径一致）', () => {
    for (const f of NUMBER_FORMS) {
      expect(LIST_NUMBER_CSS, `${f.value} 缺 CSS 规则`).toContain(`ol[type="${f.value}"]`);
    }
  });

  it('圈号 symbols 覆盖 ①…⑳（与前缀表同范围：20 项）', () => {
    const line = LIST_NUMBER_CSS.split('@counter-style k-circled')[1] || '';
    for (const ch of ['①', '⑩', '⑪', '⑳']) expect(line).toContain(ch);
  });

  it('CSS 使用前缀/后缀（（1）与一、才拼得出来）', () => {
    expect(LIST_NUMBER_CSS).toContain('prefix: "（"');
    expect(LIST_NUMBER_CSS).toContain('suffix: "）"');
    expect(LIST_NUMBER_CSS).toContain('suffix: "、"');
  });
});

describe('ensureListNumberStyleInjected —— 编辑器注入（幂等）', () => {
  it('注入一次后可重复调用（同 id 不重复插）', () => {
    document.getElementById(LIST_NUMBER_STYLE_ID)?.remove();
    expect(ensureListNumberStyleInjected(document)).toBe(true);
    expect(ensureListNumberStyleInjected(document)).toBe(false);
    expect(document.getElementById(LIST_NUMBER_STYLE_ID)).toBeTruthy();
    expect(document.getElementById(LIST_NUMBER_STYLE_ID).textContent).toContain('k-circled');
  });

  it('无 document 时安全返回 false（node 环境不炸）', () => {
    expect(ensureListNumberStyleInjected(null)).toBe(false);
  });
});

describe('编号形式 · 单一事实源守卫（四处不得再各写一份）', () => {
  const ROOT = process.cwd();
  const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

  it('Word 导出用 orderedPrefix，且不再自建罗马数字表', () => {
    const src = read('src/utils/docxBuilder.js');
    expect(src).toContain("import { orderedPrefix } from './listNumberStyle.js'");
    expect(src).toContain('orderedPrefix(listType');
    expect(src, 'docxBuilder 又长出一份罗马数字表').not.toContain('const romanize =');
  });

  it('编辑器用同一张表，且不再自建罗马数字表 / 字母分支', () => {
    const src = read('src/components/RichTextEditor.vue');
    expect(src).toContain("from '../utils/listNumberStyle.js'");
    expect(src).toContain('orderedPrefix(t, idx + 1)');
    expect(src, '编辑器又长出一份罗马数字表').not.toContain('const toRoman =');
  });

  it('HTML/PDF 导出内联同一份 CSS（无主题与有主题两条分支都要有）', () => {
    const src = read('src/themeConfig.js');
    expect(src).toContain("import { LIST_NUMBER_CSS } from './utils/listNumberStyle.js'");
    const hits = (src.match(/\$\{LIST_NUMBER_CSS\}/g) || []).length;
    expect(hits, '导出 CSS 未内联编号形式（少一条分支就会出现"编辑器有、导出退化"）').toBeGreaterThanOrEqual(2);
  });
});
