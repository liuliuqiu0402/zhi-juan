// 连线题·规范为两列结构：编辑器手动行为（框选线性段落 → 两列 match-question）
// 用例取自实际产出（2026-09-30）：模型把"连一连"写成"左项 <空位> 右项"的同行段落
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import RichTextEditor from '@/components/RichTextEditor.vue';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const BROKEN = '<p class="question">33. 小水滴落进池塘、田野和花园，分别做了什么？请连一连。（4分）</p>'
  + '<p>落进池塘<u class="blank-6"> </u>花儿露出笑脸</p>'
  + '<p>落进田野<u class="blank-6"> </u>鱼儿摇着尾巴</p>'
  + '<p>落进花园<u class="blank-6"> </u>麦苗张开小嘴</p>';

const mountEditor = async (html: string) => {
  const wrapper = mount(RichTextEditor, { props: { modelValue: html, customCSS: '', editable: true } });
  await wait(400);
  return wrapper;
};

const btn = (wrapper: any) => wrapper.findAll('button')
  .find((b: any) => (b.attributes('title') || '').includes('规范为连线题'));

const colsOf = (html: string) => {
  const host = document.createElement('div');
  host.innerHTML = html;
  return [...host.querySelectorAll('.match-question .match-col')]
    .map((c) => [...c.querySelectorAll('.match-item')].map((e) => (e.textContent || '').trim()));
};

describe('连线题·规范为两列结构（编辑器手动行为）', () => {
  it('框选线性段落 → 转两列、左列保序、右列打乱、空位消失；题干不动', async () => {
    const wrapper = await mountEditor(BROKEN);
    const editor = (wrapper.vm as any).editor;
    const blocks: any[] = [];
    editor.state.doc.forEach((c: any, off: number) => blocks.push({ c, off }));
    expect(blocks.length, '题干 + 三行 = 4 个块').toBe(4);
    // 框选三行（不含题干）
    editor.commands.setTextSelection({ from: blocks[1].off, to: blocks[3].off + blocks[3].c.nodeSize });

    await btn(wrapper).trigger('click');
    await wait(50);

    const html = editor.getHTML();
    const cols = colsOf(html);
    expect(cols.length, '应转成两列').toBe(2);
    expect(cols[0], '左列保序').toEqual(['落进池塘', '落进田野', '落进花园']);
    expect([...cols[1]].sort(), '右列项集合不变（只换顺序）').toEqual(['花儿露出笑脸', '鱼儿摇着尾巴', '麦苗张开小嘴']);
    expect(cols[1], '右列须打乱（同行相邻即答案）').not.toEqual(['花儿露出笑脸', '鱼儿摇着尾巴', '麦苗张开小嘴']);
    expect(html, '空位应被去掉').not.toMatch(/blank-\d/);
    expect(html, '题干不得受损').toContain('请连一连');
    wrapper.unmount();
  });

  it('未框选（仅光标）→ 给提示、不改内容', async () => {
    const wrapper = await mountEditor(BROKEN);
    const editor = (wrapper.vm as any).editor;
    editor.commands.setTextSelection(1);
    const before = editor.getHTML();

    await btn(wrapper).trigger('click');
    await wait(30);

    expect((wrapper.vm as any).carrierPanel?.kind).toBe('notice');
    expect(editor.getHTML(), '未框选时不得改动内容').toBe(before);
    wrapper.unmount();
  });

  it('框选不足两行（仅一行）→ 给提示、不改内容', async () => {
    const wrapper = await mountEditor(BROKEN);
    const editor = (wrapper.vm as any).editor;
    const blocks: any[] = [];
    editor.state.doc.forEach((c: any, off: number) => blocks.push({ c, off }));
    editor.commands.setTextSelection({ from: blocks[1].off, to: blocks[1].off + blocks[1].c.nodeSize });
    const before = editor.getHTML();

    await btn(wrapper).trigger('click');
    await wait(30);

    expect((wrapper.vm as any).carrierPanel?.kind).toBe('notice');
    expect(editor.getHTML(), '不成题时不得改动内容').toBe(before);
    wrapper.unmount();
  });

  it('整题连题干一起框选：题干原样保留，仅连续连线行成题', async () => {
    const wrapper = await mountEditor(BROKEN);
    const editor = (wrapper.vm as any).editor;
    const blocks: any[] = [];
    editor.state.doc.forEach((c: any, off: number) => blocks.push({ c, off }));
    editor.commands.setTextSelection({ from: blocks[0].off, to: blocks[3].off + blocks[3].c.nodeSize });

    await btn(wrapper).trigger('click');
    await wait(50);

    const html = editor.getHTML();
    expect(colsOf(html).length, '仍只出一处连线题').toBe(2);
    expect(html, '题干原样保留').toContain('请连一连');
    expect((html.match(/match-question/g) || []).length, '只有一处连线题').toBe(1);
    wrapper.unmount();
  });
});

// 2026-09-30 用户实测：样例在编辑器里点"规范为连线题"报"未识别到可规范的连线行"。
// 根因是识别只扫**顶层块**——真实内容里连线行常被包在 <div> 里，或几行同处一段用 <br> 分行，
// 于是整块被当成"无空位"。以下四种真实形态都必须能转。
describe('连线题·规范（真实形态兼容：嵌套容器 / <br> 分行 / 空位形态）', () => {
  const selectAll = (editor: any) => {
    editor.commands.setTextSelection({ from: 1, to: editor.state.doc.content.size - 1 });
  };

  it('连线行被包在 <div> 里 → 仍能识别并规范', async () => {
    const wrapper = await mountEditor('<div class="question-block">'
      + '<p class="question">33. 请连一连。（4分）</p>'
      + '<p>落进池塘<u class="blank-6"> </u>花儿露出笑脸</p>'
      + '<p>落进田野<u class="blank-6"> </u>鱼儿摇着尾巴</p>'
      + '<p>落进花园<u class="blank-6"> </u>麦苗张开小嘴</p>'
      + '</div>');
    const editor = (wrapper.vm as any).editor;
    selectAll(editor);
    await btn(wrapper).trigger('click');
    await wait(50);

    const html = editor.getHTML();
    const cols = colsOf(html);
    expect(cols.length, '应转成两列').toBe(2);
    expect(cols[0], '左列保序').toEqual(['落进池塘', '落进田野', '落进花园']);
    expect([...cols[1]].sort(), '右列项集合不变').toEqual(['花儿露出笑脸', '鱼儿摇着尾巴', '麦苗张开小嘴']);
    expect(html, '空位应被去掉').not.toMatch(/blank-\d/);
    expect(html, '题干不得受损').toContain('请连一连');
    wrapper.unmount();
  });

  it('三行同处一段、以 <br> 分行 → 仍能识别并规范', async () => {
    const wrapper = await mountEditor('<p>落进池塘<u class="blank-6"> </u>花儿露出笑脸<br>'
      + '落进田野<u class="blank-6"> </u>鱼儿摇着尾巴<br>'
      + '落进花园<u class="blank-6"> </u>麦苗张开小嘴</p>');
    const editor = (wrapper.vm as any).editor;
    selectAll(editor);
    await btn(wrapper).trigger('click');
    await wait(50);

    const html = editor.getHTML();
    const cols = colsOf(html);
    expect(cols.length, '应转成两列').toBe(2);
    expect(cols[0], '左列保序').toEqual(['落进池塘', '落进田野', '落进花园']);
    expect([...cols[1]].sort(), '右列项集合不变').toEqual(['花儿露出笑脸', '鱼儿摇着尾巴', '麦苗张开小嘴']);
    expect(html, '空位应被去掉').not.toMatch(/blank-\d/);
    wrapper.unmount();
  });

  it('空位 class 丢失（裸 <u> 单个空白）→ 按"带下划线的纯空白"识别', async () => {
    const wrapper = await mountEditor('<p>落进池塘<u> </u>花儿露出笑脸</p>'
      + '<p>落进田野<u> </u>鱼儿摇着尾巴</p>');
    const editor = (wrapper.vm as any).editor;
    selectAll(editor);
    await btn(wrapper).trigger('click');
    await wait(50);

    const cols = colsOf(editor.getHTML());
    expect(cols.length, '应转成两列').toBe(2);
    expect(cols[0], '左列保序').toEqual(['落进池塘', '落进田野']);
    wrapper.unmount();
  });

  it('空位写作空白括号（　）→ 也能识别', async () => {
    const wrapper = await mountEditor('<p>落进池塘（\u3000\u3000）花儿露出笑脸</p>'
      + '<p>落进田野（\u3000\u3000）鱼儿摇着尾巴</p>');
    const editor = (wrapper.vm as any).editor;
    selectAll(editor);
    await btn(wrapper).trigger('click');
    await wait(50);

    const cols = colsOf(editor.getHTML());
    expect(cols.length, '应转成两列').toBe(2);
    expect(cols[0], '左列保序').toEqual(['落进池塘', '落进田野']);
    wrapper.unmount();
  });
});

// 2026-09-30 追加：模型输出"连一连"的**分隔位形态五花八门**，且常常整行只是**一个文本节点**，
// 分隔位藏在节点内部。以下每种形态都必须能转；同时给两类反例加锁，确保不误伤普通段落。
describe('连线题·规范（模型输出分隔位形态兼容）', () => {
  const selectAll = (editor: any) => {
    editor.commands.setTextSelection({ from: 1, to: editor.state.doc.content.size - 1 });
  };
  const runOn = async (html: string) => {
    const wrapper = await mountEditor(html);
    const editor = (wrapper.vm as any).editor;
    selectAll(editor);
    await btn(wrapper).trigger('click');
    await wait(50);
    return { wrapper, editor };
  };

  it('全角空格（≥2）分隔、且嵌在文本节点内部 → 能识别', async () => {
    const { wrapper, editor } = await runOn('<p>落进池塘\u3000\u3000花儿露出笑脸</p>'
      + '<p>落进田野\u3000\u3000鱼儿摇着尾巴</p>'
      + '<p>落进花园\u3000\u3000麦苗张开小嘴</p>');
    const cols = colsOf(editor.getHTML());
    expect(cols.length, '应转成两列').toBe(2);
    expect(cols[0], '左列保序').toEqual(['落进池塘', '落进田野', '落进花园']);
    expect([...cols[1]].sort()).toEqual(['花儿露出笑脸', '鱼儿摇着尾巴', '麦苗张开小嘴']);
    wrapper.unmount();
  });

  it('半角连续空格会被编辑器折叠成单个空格 → 不当作分隔位（已知限制，如实加锁）', async () => {
    const { wrapper, editor } = await runOn('<p>落进池塘    花儿露出笑脸</p>'
      + '<p>落进田野    鱼儿摇着尾巴</p>');
    expect((wrapper.vm as any).carrierPanel?.kind).toBe('notice');
    expect(colsOf(editor.getHTML()).length, '不得产出连线题').toBe(0);
    wrapper.unmount();
  });

  it('下划线 ____ 分隔 → 能识别', async () => {
    const { wrapper, editor } = await runOn('<p>落进池塘____花儿露出笑脸</p>'
      + '<p>落进田野____鱼儿摇着尾巴</p>');
    const cols = colsOf(editor.getHTML());
    expect(cols.length, '应转成两列').toBe(2);
    expect(cols[0], '左列保序').toEqual(['落进池塘', '落进田野']);
    expect(editor.getHTML(), '分隔位应被去掉').not.toContain('____');
    wrapper.unmount();
  });

  it('箭头 → 分隔 → 能识别', async () => {
    const { wrapper, editor } = await runOn('<p>落进池塘 → 花儿露出笑脸</p>'
      + '<p>落进田野 → 鱼儿摇着尾巴</p>');
    const cols = colsOf(editor.getHTML());
    expect(cols.length, '应转成两列').toBe(2);
    expect(cols[0], '左列保序').toEqual(['落进池塘', '落进田野']);
    wrapper.unmount();
  });

  it('破折号 —— 分隔 → 能识别', async () => {
    const { wrapper, editor } = await runOn('<p>落进池塘——花儿露出笑脸</p>'
      + '<p>落进田野——鱼儿摇着尾巴</p>');
    const cols = colsOf(editor.getHTML());
    expect(cols.length, '应转成两列').toBe(2);
    expect(cols[0], '左列保序').toEqual(['落进池塘', '落进田野']);
    wrapper.unmount();
  });

  it('同一题内混用不同分隔位（括号 + 全角空格）→ 仍按连续行成一组', async () => {
    const { wrapper, editor } = await runOn('<p>落进池塘（\u3000）花儿露出笑脸</p>'
      + '<p>落进田野\u3000\u3000鱼儿摇着尾巴</p>');
    const cols = colsOf(editor.getHTML());
    expect(cols.length, '应转成两列').toBe(2);
    expect(cols[0], '左列保序').toEqual(['落进池塘', '落进田野']);
    wrapper.unmount();
  });

  it('两组连线行被题干行隔开 → 各成一题', async () => {
    const { wrapper, editor } = await runOn('<p>落进池塘（\u3000\u3000）花儿露出笑脸</p>'
      + '<p>落进田野（\u3000\u3000）鱼儿摇着尾巴</p>'
      + '<p>4. 请再连一连。</p>'
      + '<p>春天（\u3000\u3000）桃花开了</p>'
      + '<p>夏天（\u3000\u3000）荷花开了</p>');
    const html = editor.getHTML();
    expect((html.match(/match-question/g) || []).length, '应出两处连线题').toBe(2);
    expect(html, '中间题干行保留').toContain('请再连一连');
    wrapper.unmount();
  });

  it('反例：普通段落每行有多个分隔位 → 不改内容、给提示', async () => {
    const src = '<p>落进池塘\u3000\u3000花儿\u3000\u3000露出笑脸</p>'
      + '<p>落进田野（\u3000）鱼儿（\u3000）摇着尾巴</p>';
    const { wrapper, editor } = await runOn(src);
    expect((wrapper.vm as any).carrierPanel?.kind).toBe('notice');
    expect(editor.getHTML(), '不得改动内容').toBe(src);
    expect(colsOf(editor.getHTML()).length, '不得产出连线题').toBe(0);
    wrapper.unmount();
  });

  it('反例：填空题干含「（　　）」且右句以句末标点收尾 → 不误转', async () => {
    const src = '<p>31. 短文中的"我"是什么（\u3000\u3000），请填在横线上。</p>'
      + '<p>32. "我"会变成什么（\u3000\u3000），请写下来。</p>';
    const { wrapper, editor } = await runOn(src);
    expect((wrapper.vm as any).carrierPanel?.kind).toBe('notice');
    expect(editor.getHTML(), '不得改动内容').toBe(src);
    expect(colsOf(editor.getHTML()).length, '不得产出连线题').toBe(0);
    wrapper.unmount();
  });

  it('反例：仅一行含分隔位（题干含「（　）」不算题）→ 不改内容、给提示', async () => {
    const src = '<p>33. 小水滴落进池塘、田野和花园，分别做了什么？请连一连。（4分）</p>'
      + '<p>落进池塘（\u3000\u3000）花儿露出笑脸</p>';
    const { wrapper, editor } = await runOn(src);
    expect((wrapper.vm as any).carrierPanel?.kind).toBe('notice');
    expect(editor.getHTML(), '不得改动内容').toBe(src);
    expect(colsOf(editor.getHTML()).length, '不得产出连线题').toBe(0);
    wrapper.unmount();
  });
});
