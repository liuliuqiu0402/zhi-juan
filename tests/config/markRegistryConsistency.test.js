/**
 * 🏷 标记载体注册表 · 五方一致守卫
 * ============================================================
 * 教训（2026-10-30 属主实测"题干写着加点、画线，正文却没有标记"）：
 *   同一条标记约定原先散在 5 处各写一份——指令 / 渲染 CSS（5 个文件）/ Word 导出 / 校验 / 清洗。
 *   任一处漏跟，模型写了也白写（看不见、导不出、或被清洗掉）。
 * 本测试锁死：注册表里的每一条，**其余四方都必须有**；新增/改名标记时漏一处即转红。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { MARK_RULES, buildMarkCarrierClause, auditMarkBlocks, markRulesFor } from '../../src/config/markRegistry.js';
import { buildRenderContract } from '../../src/config/eduRenderContract.js';

const read = (rel) => readFileSync(path.join(process.cwd(), rel), 'utf8');
const CSS_FILES = [
  'src/themeConfig.js',
  'src/styles/global.css',
  'src/components/RichTextEditor.vue',
  'src/modules/TypesetModule.vue',
  'src/modules/GenerateModule.vue',
];

describe('标记载体 · 五方一致', () => {
  it('每条标记在 5 个渲染入口都有同名 class（生成页/排版页/编辑器/主题/全局）', () => {
    for (const rule of MARK_RULES) {
      for (const f of CSS_FILES) {
        expect(read(f), `${f} 缺 .${rule.cls} 的渲染样式`).toContain(`.${rule.cls}`);
      }
    }
  });

  it('每条标记在 Word 导出里都有对应分支（否则预览有、导出丢）', () => {
    const src = read('src/utils/docxBuilder.js');
    for (const rule of MARK_RULES) {
      expect(src, `docxBuilder 缺 ${rule.cls} 的导出分支`).toContain(`cls.contains('${rule.cls}')`);
    }
  });

  it('每条标记在编辑器里不会被 Tiptap 剥掉（PRESERVE_CLASSES 或专属 mark/节点）', () => {
    const src = read('src/components/RichTextEditor.vue');
    for (const rule of MARK_RULES) {
      const preserved = src.includes(`'${rule.cls}'`) || src.includes(`span.${rule.cls}`);
      expect(preserved, `RichTextEditor 未保留 ${rule.cls}（载入编辑器后 class 会被剥掉）`).toBe(true);
    }
  });

  it('注入文本（渲染契约段）含每条标记的触发词与写法，且按学科裁剪', () => {
    const zh = buildMarkCarrierClause('语文');
    expect(zh).toContain('【标记载体】');
    for (const rule of markRulesFor('语文')) {
      expect(zh, `注入文本缺 ${rule.cls}`).toContain(rule.cls);
      expect(zh, `注入文本缺触发词 ${rule.trigger}`).toContain(rule.trigger.split('／')[0]);
    }
    // 非适用学科不注入（防跨学科诱导）
    expect(buildMarkCarrierClause('数学')).toBe('');
  });

  it('逐题对账能认出"题干要求了但该题没有"（作者侧标记逐一验证）', () => {
    for (const rule of markRulesFor('语文')) {
      const html = `<p class="question">1. 请${rule.trigger.split('／')[0]}下面的内容。（2分）</p><p>冬天来了。</p>`;
      const miss = auditMarkBlocks(html, { subject: '语文' });
      expect(miss.map((m) => m.id), `${rule.cls} 漏检`).toContain(rule.id);
    }
  });

  it('学生动作类（圈出/划去）不参与对账——"圈出加点字正确的读音"不该被判缺 circle-mark', () => {
    const html = '<p class="question">2. 圈出加点字正确的读音。（4分）</p>'
      + '<p>（1）<span class="emphasis-dot">行</span>（háng xíng）白鹭飞上青天。</p>';
    const miss = auditMarkBlocks(html, { subject: '语文' });
    expect(miss, '圈出是学生动作，不该要求作者预置 circle-mark').toEqual([]);
  });

  it('渲染契约段真的带上【标记载体】（语文有、数学没有）——确保它在实发里，而不只是"存在"', () => {
    const zh = buildRenderContract({ subject: '语文', stage: 'primary_high' });
    expect(zh, '语文卷的 system 附加段里没有标记载体段').toContain('【标记载体】');
    expect(zh).toContain('emphasis-dot');
    const math = buildRenderContract({ subject: '数学', stage: 'primary_high' });
    expect(math, '数学不该出现语文标记载体').not.toContain('【标记载体】');
  });
});
