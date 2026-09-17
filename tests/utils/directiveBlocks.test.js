import { describe, it, expect } from 'vitest';
import {
  DIRECTIVE_TAGS,
  extractDirectiveBlocks,
  hasDirectiveBlocks,
  parseDirectiveFields,
  buildImagePromptList,
  buildGraphDirectiveList,
  buildGraphClipboardText,
  buildImageClipboardText,
} from '../../src/utils/directiveBlocks.js';

const DOC = `1. 观察下面的图形。
[GRAPH]
TYPE:SHAPES
XLIM:-5,5
YLIM:-1,1
SHAPES:
  FUNCTION:2x+1 | COLOR:red | DOMAIN:-5,5
[/GRAPH]
2. 三只熊猫在竹林中吃竹子，请据此回答问题。
[IMAGE]
PROMPT:三只熊猫在竹林中吃竹子
[/IMAGE]
3. 读图回答：
[IMAGE]
TYPE:ICON
KEYWORDS:熊猫,竹子,卡通
STYLE:flat
[/IMAGE]
4. 再画一个函数。
[GRAPH]
TYPE:SHAPES
XLIM:-3,3
SHAPES:
  FUNCTION:x**2-2*x-3 | COLOR:blue
[/GRAPH]`;

describe('directiveBlocks / extractDirectiveBlocks', () => {
  it('只允许 GRAPH / IMAGE 两种标记', () => {
    expect(DIRECTIVE_TAGS).toEqual(['GRAPH', 'IMAGE']);
    expect(extractDirectiveBlocks(DOC, 'TABLE')).toEqual([]);
    expect(extractDirectiveBlocks(DOC, '')).toEqual([]);
  });

  it('抽出全部图形指令（含标记本身，可整段粘回渲染端）', () => {
    const blocks = extractDirectiveBlocks(DOC, 'GRAPH');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].startsWith('[GRAPH]')).toBe(true);
    expect(blocks[0].endsWith('[/GRAPH]')).toBe(true);
    expect(blocks[0]).toContain('FUNCTION:2x+1');
    expect(blocks[1]).toContain('x**2-2*x-3');
  });

  it('抽出全部配图指令（大小写不敏感）', () => {
    expect(extractDirectiveBlocks(DOC, 'IMAGE')).toHaveLength(2);
    expect(extractDirectiveBlocks(DOC.toLowerCase(), 'image')).toHaveLength(2);
  });

  it('没有指令时返回空数组（不抛错）', () => {
    expect(extractDirectiveBlocks('', 'GRAPH')).toEqual([]);
    expect(extractDirectiveBlocks('纯粹的文字，没有指令', 'GRAPH')).toEqual([]);
  });
});

describe('directiveBlocks / hasDirectiveBlocks（按钮"有才出现"的门控口径）', () => {
  it('含 [GRAPH] 的文档 → 显示图形指令按钮', () => {
    expect(hasDirectiveBlocks(DOC, 'GRAPH')).toBe(true);
  });

  it('含 [IMAGE] 的文档 → 显示配图稿按钮', () => {
    expect(hasDirectiveBlocks(DOC, 'IMAGE')).toBe(true);
  });

  it('只有图形的文档不该出现配图稿按钮', () => {
    const graphOnly = DOC.slice(0, DOC.indexOf('2. 三只熊猫'));
    expect(hasDirectiveBlocks(graphOnly, 'GRAPH')).toBe(true);
    expect(hasDirectiveBlocks(graphOnly, 'IMAGE')).toBe(false);
  });

  it('纯文字 / 空值 → 两个按钮都不出现', () => {
    expect(hasDirectiveBlocks('纯文字，没有任何指令', 'GRAPH')).toBe(false);
    expect(hasDirectiveBlocks('纯文字，没有任何指令', 'IMAGE')).toBe(false);
    expect(hasDirectiveBlocks('', 'GRAPH')).toBe(false);
    expect(hasDirectiveBlocks(null, 'IMAGE')).toBe(false);
  });

  it('非法标记名不通过（防误开按钮）', () => {
    expect(hasDirectiveBlocks(DOC, 'TABLE')).toBe(false);
    expect(hasDirectiveBlocks(DOC, '')).toBe(false);
  });

  it('大小写不敏感', () => {
    expect(hasDirectiveBlocks('[graph]\nTYPE:SHAPES\n[/graph]', 'GRAPH')).toBe(true);
  });

  it('占位框 HTML 里虽然还留着裸标记，但抽出来的是转义后的废数据（故调用方必须传 rawContent）', () => {
    const placeholderHtml = '<div class="graph-placeholder" data-graph-raw="[GRAPH]&lt;TYPE:SHAPES&gt;[/GRAPH]">[图形占位]</div>';
    // 标记本身还在属性里 → 存在性判断仍会为真（所以门控可以用 content 判断"有没有"）
    expect(hasDirectiveBlocks(placeholderHtml, 'GRAPH')).toBe(true);
    // 但抽出来的是被转义的 HTML，粘到渲染端解析不出东西（所以**复制**必须用 rawContent）
    const block = extractDirectiveBlocks(placeholderHtml, 'GRAPH')[0];
    expect(block).toContain('&lt;');
    expect(block).toContain('&gt;');
  });
});

describe('directiveBlocks / parseDirectiveFields', () => {
  it('解析单行键值', () => {
    const f = parseDirectiveFields('\nPROMPT:三只熊猫\nSTYLE:flat\n');
    expect(f.PROMPT).toBe('三只熊猫');
    expect(f.STYLE).toBe('flat');
  });

  it('键名统一大写并去空白', () => {
    const f = parseDirectiveFields('prompt:  内容  ');
    expect(f.PROMPT).toBe('内容');
  });

  it('缩进行接到上一个键上（多行块）', () => {
    const f = parseDirectiveFields('SHAPES:\n  FUNCTION:2x+1 | COLOR:red\n  FUNCTION:x**2 | COLOR:blue\n');
    expect(f.SHAPES.split('\n')).toHaveLength(2);
    expect(f.SHAPES).toContain('FUNCTION:2x+1');
    expect(f.SHAPES).toContain('FUNCTION:x**2');
  });
});

describe('directiveBlocks / buildImagePromptList', () => {
  it('每条配图一条记录，PROMPT 优先、KEYWORDS 兜底', () => {
    const list = buildImagePromptList(DOC);
    expect(list).toHaveLength(2);
    expect(list[0].prompt).toBe('三只熊猫在竹林中吃竹子');
    expect(list[0].desc).toBe('三只熊猫在竹林中吃竹子');
    expect(list[1].prompt).toBe('');
    expect(list[1].keywords).toBe('熊猫,竹子,卡通');
    expect(list[1].desc).toBe('熊猫,竹子,卡通');
    expect(list[1].style).toBe('flat');
  });

  it('带出位置对照（该图前面的题干），且不含指令标记噪音', () => {
    const list = buildImagePromptList(DOC);
    expect(list[0].where).toContain('三只熊猫在竹林中吃竹子');
    expect(list[0].where).not.toContain('[GRAPH]');
    expect(list[0].where).not.toContain('[/IMAGE]');
  });

  it('contextChars 可裁剪位置对照长度', () => {
    const list = buildImagePromptList(DOC, { contextChars: 8 });
    expect(list[0].where.length).toBeLessThanOrEqual(8);
  });

  it('raw 保留原始块（便于核对/回填）', () => {
    const list = buildImagePromptList(DOC);
    expect(list[0].raw.startsWith('[IMAGE]')).toBe(true);
    expect(list[0].raw).toContain('PROMPT:三只熊猫在竹林中吃竹子');
  });

  it('没有配图时返回空数组', () => {
    expect(buildImagePromptList('只有文字')).toEqual([]);
    expect(buildImagePromptList('')).toEqual([]);
    expect(buildImagePromptList(null)).toEqual([]);
  });
});

// 🔴 2026-09-17 用户实证：卡片上「📐 图形指令」「🖼️ 配图稿」原为"盲复制"（点完只弹"已复制 N 条"，
//    看不到内容，只能粘到外部工具才知道复制了什么）→ 改为**先预览再复制**。
//    本组锁定：① 图形指令清单（预览用）字段/位置对照/原文；② 剪贴板文本与原一键复制**逐字一致**（防改版走样）；
//    ③ 预览与复制**同源**（同一函数出清单与文本，杜绝"看到的≠复制的"）。
describe('directiveBlocks / 指令预览与复制同源（2026-09-17 先预览再复制）', () => {
  it('图形指令清单：逐条带类型/字段/位置对照/原文', () => {
    const list = buildGraphDirectiveList(DOC);
    expect(list).toHaveLength(extractDirectiveBlocks(DOC, 'GRAPH').length); // DOC 含 2 条图形指令（SHAPES×2）
    expect(list).toHaveLength(2);
    expect(list[0].type).toBe('SHAPES');
    expect(list[0].fields.XLIM).toBe('-5,5');
    expect(list[0].where).toContain('观察下面的图形');
    expect(list[0].raw.startsWith('[GRAPH]')).toBe(true);
    expect(list[0].raw.endsWith('[/GRAPH]')).toBe(true);
    expect(list[1].type).toBe('SHAPES');
    expect(buildGraphDirectiveList('只有文字')).toEqual([]);
  });

  it('图形指令剪贴板文本：与原一键复制逐字一致（表头 + 用法 + 空行 + 块）', () => {
    const items = buildGraphDirectiveList(DOC);
    const text = buildGraphClipboardText(items, '六年级数学');
    expect(text.startsWith(`【图形指令·共 ${items.length} 条】六年级数学\n`)).toBe(true);
    expect(text).toContain('用法：整段粘贴到 EduRender Studio 编辑区 → 点「解析指令」→ 点「渲染全部」→ 导出 Word。');
    expect(text).toContain('\n\n[GRAPH]\nTYPE:SHAPES');
    expect(text.trimEnd().endsWith('[/GRAPH]')).toBe(true);
    expect(buildGraphClipboardText([], 'x')).toBe('');
  });

  it('配图稿剪贴板文本：逐条编号 + 风格/位置对照（与原一键复制逐字一致）', () => {
    const items = buildImagePromptList(DOC);
    const text = buildImageClipboardText(items, '六年级语文');
    expect(text.startsWith('【配图稿·共 2 处】六年级语文\n')).toBe(true);
    expect(text).toContain('1. 画面描述：三只熊猫在竹林中吃竹子');
    expect(text).toContain('2. 画面描述：熊猫,竹子,卡通');
    expect(text).toContain('   风格：flat');
    expect(text).toContain('   位置对照（该图前面的题干）：…');
    expect(buildImageClipboardText([], 'x')).toBe('');
  });

  it('同源不变量：预览条数 === 剪贴板文本条数（两侧读同一份清单）', () => {
    const graphItems = buildGraphDirectiveList(DOC);
    const imageItems = buildImagePromptList(DOC);
    expect(buildGraphClipboardText(graphItems, 't')).toContain(`共 ${graphItems.length} 条`);
    expect(buildImageClipboardText(imageItems, 't')).toContain(`共 ${imageItems.length} 处`);
  });
});
