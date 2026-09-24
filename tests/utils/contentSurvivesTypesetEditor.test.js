/**
 * 🧭 内容存活矩阵：各类生成内容过「排版页编辑器」后是否还在
 * ============================================================
 * 用户原话（2026-09-24）："排版页不再丢导图，其他的内容也都不会丢吧？"
 * —— 这句话不能靠推断回答。这里把生成端会产出的各类内容各放一份，过**真编辑器**往返，
 *    逐类断言"还在"。发现哪类会丢，就是必须修的缺口（导图当初就是这么发现的）。
 *
 * 判定口径：
 *   · 结构性内容（表/图/分页/作区块/上下标/列表）→ 断言其结构标记仍在；
 *   · 会被**有意转换**的内容（公式 → KaTeX 渲染、ruby → span）→ 断言"原文 或 转换后的标记"
 *     至少有一种在（转换是设计行为，丢才是事故）。
 * ============================================================
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { createDiagramFigureNode } from '../../src/utils/tiptapDiagramFigure.js';
import { renderDiagramBlocks } from '../../src/utils/diagramBlock.js';

/**
 * 与 RichTextEditor.vue 完全一致的图片配置。
 * 🔴 少了 `allowBase64: true` 会静默丢弃 data: 图片（Tiptap 默认 parseHTML 是
 *    `img[src]:not([src^="data:"])`），而本项目的图片恰恰都是 data URL 插入的
 *    （RichTextEditor 用 readAsDataURL → setImage）。这里必须与真实配置同源，
 *    否则测试会给出"图会丢"的假警报。
 */
const IMAGE_CONFIG = { inline: false, allowBase64: true };

/** 各类内容的代表性片段（模拟生成端产出） */
const KINDS = {
  '标题与段落': '<h2>一、知识梳理</h2><p>本节的要点如下。</p>',
  '有序/无序列表': '<ol><li>第一点</li><li>第二点</li></ol><ul><li>补充</li></ul>',
  '表格': '<table><tbody><tr><th>类别</th><th>数量</th></tr><tr><td>甲</td><td>15</td></tr></tbody></table>',
  '上标下标': '<p>10<sup>2</sup> 与 H<sub>2</sub>O</p>',
  '图片（data URL）': '<p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==" alt="示意图"></p>',
  '导图（已渲染）': renderDiagramBlocks('<div class="k-diagram" data-type="mindmap">{"title":"根","children":[{"title":"枝"}]}</div>').html,
};

const EXPECT = {
  '标题与段落': ['一、知识梳理', '本节的要点如下'],
  '有序/无序列表': ['<ol', '<ul', '第一点', '补充'],
  '表格': ['<table', '类别', '数量'],
  '上标下标': ['<sup', '<sub', '10'],
  '图片（data URL）': ['<img', 'data:image/png;base64'],
  '导图（已渲染）': ['<svg', 'data-k-spec'],
};

const makeEditor = (html) => new Editor({
  element: document.createElement('div'),
  extensions: [
    StarterKit, Image.configure(IMAGE_CONFIG),
    Table.configure({ resizable: false }), TableRow, TableHeader, TableCell,
    Subscript, Superscript,
    createDiagramFigureNode(),
  ],
  content: html,
});

describe('内容存活矩阵（生成内容 → 排版页编辑器 → 导出用的 HTML）', () => {
  for (const [name, html] of Object.entries(KINDS)) {
    it(`${name}：过编辑器后仍在`, () => {
      const ed = makeEditor(html);
      const out = ed.getHTML();
      ed.destroy();
      const missing = (EXPECT[name] || []).filter((needle) => !out.includes(needle));
      expect(missing, `${name} 丢失/被改坏：${missing.join('、')}\n实际输出：${out.slice(0, 300)}`).toEqual([]);
    });
  }

  it('公式：原文 $…$ 或 KaTeX 渲染产物至少留一种（转换是设计行为，丢才是事故）', () => {
    const ed = makeEditor('<p>由 $a^2+b^2=c^2$ 可得。</p>');
    const out = ed.getHTML();
    ed.destroy();
    const kept = out.includes('$a^2+b^2=c^2$') || /katex|math-render|data-math/i.test(out);
    expect(kept, `公式既没保留原文也没渲染产物：${out.slice(0, 300)}`).toBe(true);
  });
});

/**
 * 结构性守卫：分页块 / AI 版面容器（div）/ 作图区这三类，由 RichTextEditor.vue 里的
 * **自定义节点**承担（那边没有导出，隔离测试无法 import）。所以改为直接核对真实源码里
 * 确实注册了承担它们的节点与配置 —— 谁删了，这里立刻红，比"内容静默消失、用户才发现"好得多。
 */
describe('结构性守卫：真编辑器里承担各类内容的节点/配置都还在', () => {
  const src = readFileSync(path.join(process.cwd(), 'src/components/RichTextEditor.vue'), 'utf-8');

  it('分页块 / AI 版面容器 / 作图区 / 图片 base64 / 导图 —— 一个都不能少', () => {
    expect(src, '分页块节点不见了（分页会失效）').toContain("tag: 'div[data-page-break]'");
    expect(src, 'AI 版面容器（div）节点不见了（AI 的底色/边框会全丢）').toMatch(/name: 'divWrapper'/);
    expect(src, '作图区节点不见了').toMatch(/DrawArea/);
    expect(src, '图片未开启 allowBase64（data: 图片会被静默丢弃）').toContain('allowBase64: true');
    expect(src, '导图透传节点未注册（导图会被静默丢弃）').toContain('createDiagramFigureNode');
  });
});
