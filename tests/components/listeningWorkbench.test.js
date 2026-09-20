/**
 * 听力工作台（ListeningWorkbench）：**真的挂载并渲染**（2026-09-20 抽出为公共组件时新增）
 * ============================================================
 * 为什么需要这条测试：Vue 模板里引用未声明的标识符、或抽组件时漏搬一块模板/状态，
 *   **构建期不报错**（vite build 照样通过），只在用户**点开面板那一刻**炸。
 *   本次把听力工作台（约 1100 行模板+脚本）从 GenerateModule 抽成组件，
 *   正是最容易被这类问题咬到的改动 —— 故用一个真实挂载把两条入口的最低限度行为钉住：
 *     · page 形态（独立功能页）：挂载即进粘贴模式，素材框/学段/年级/解析按钮都在，且**没有**"关闭"（那是弹窗才需要的）；
 *     · modal 形态（生成页记录入口）：未打开时**什么都不渲染**，openPaste() 后才把弹窗挂到 body；
 *     · 学段未选不放行：点解析先给提示、直接返回（学段决定语速与作答留白，不能默认猜一个）。
 * 不调网络、不碰音频：只验证"能渲出来、能反应"。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ListeningWorkbench from '@/components/listening/ListeningWorkbench.vue';

const findButton = (root, text) => [...root.querySelectorAll('button')]
  .find((b) => (b.textContent || '').includes(text));
/** 按可见文字找某个 label 里的复选框（页面上复选框不少，按名字找最稳） */
const labelBox = (root, text) => {
  const label = [...root.querySelectorAll('label')].find((l) => (l.textContent || '').includes(text));
  return label ? label.querySelector('input[type="checkbox"]') : null;
};
/** 离线走通一次"粘贴英文 → 本机规则解析 → 出稿"（素材带题号与说话人，不需要模型兜底） */
const parseSampleInPage = async (w) => {
  // page 形态是 onMounted 里才切进"粘贴模式"的，故先等一帧，否则素材框/学段还没渲染出来
  await w.vm.$nextTick();
  await w.find('textarea').setValue(
    '1. M: Excuse me, where is the library?\nW: It is next to the bank.\n'
    + '2. M: How much is the ticket?\nW: Twenty dollars.',
  );
  await w.find('select').setValue('primary_high');   // 学段（page 形态默认空＝不放行）
  findButton(w.element, '解析并生成').click();
  await flushPromises();
};
/** 朗读稿的文本（只读 textarea）——断言产物必须看它，不能看整页 HTML：
 *  面板的 ⓘ 提示语里也会出现"每段材料开始前响一次"这类词，用整页 HTML 会假阳性。 */
const scriptValue = (w) => {
  const ta = [...w.element.querySelectorAll('textarea')]
    .find((t) => String(t.value || '').includes('【英语听力朗读稿'));
  return ta ? ta.value : '';
};
/** 等重渲染落地：改动参数后的重渲染有 **200ms 去抖**（拖动滑块不卡手），故测试必须等它跑完 */
const settle = async (w) => {
  await new Promise((resolve) => setTimeout(resolve, 260));
  await w.vm.$nextTick();
};

describe('ListeningWorkbench（听力工作台 · 弹窗/页面两形态共用）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('page 形态：挂载即进粘贴模式，素材框/学段/年级/解析按钮齐全，且没有"关闭"按钮', async () => {
    const w = mount(ListeningWorkbench, { props: { variant: 'page' }, attachTo: document.body });
    await w.vm.$nextTick();
    const html = w.html();
    expect(html).toContain('粘贴听力素材');
    expect(html).toContain('请选择学段');
    expect(html).toContain('解析并生成');
    expect(w.find('textarea').exists()).toBe(true);
    // page 形态是常驻面板：不该出现弹窗专属的"关闭"
    expect(w.findAll('button').map((b) => b.text())).not.toContain('关闭');
    w.unmount();
  });

  it('page 形态：学段未选不放行——先提示、不调模型（学段决定语速与作答留白，不能猜）', async () => {
    const w = mount(ListeningWorkbench, { props: { variant: 'page' }, attachTo: document.body });
    await w.vm.$nextTick();
    await w.find('textarea').setValue('M: Excuse me, where is the library?\nW: It is next to the bank.');
    const btn = [...w.element.querySelectorAll('button')].find((b) => (b.textContent || '').includes('解析并生成'));
    expect(btn).toBeTruthy();
    btn.click();
    await w.vm.$nextTick();
    expect(w.html()).toContain('请先选择学段');
    w.unmount();
  });

  it('modal 形态：未打开时什么都不渲染；openPaste() 后弹窗挂到 body 并出现"关闭"', async () => {
    const w = mount(ListeningWorkbench, { props: { variant: 'modal' }, attachTo: document.body });
    expect(document.body.textContent).not.toContain('粘贴听力素材');

    w.vm.openPaste();
    await w.vm.$nextTick();
    expect(document.body.textContent).toContain('粘贴听力素材');
    expect(findButton(document.body, '关闭')).toBeTruthy();
    // 弹窗形态带遮罩（点遮罩关闭），page 形态不带
    expect(document.body.querySelector('.modal-mask')).toBeTruthy();
    w.unmount();
  });

  it('两形态对外接口一致：openFromRecord / openPaste 都要挂出来（生成页靠前者转发记录）', () => {
    const w = mount(ListeningWorkbench, { props: { variant: 'modal' } });
    expect(typeof w.vm.openFromRecord).toBe('function');
    expect(typeof w.vm.openPaste).toBe('function');
    w.unmount();
  });
});

/**
 * 独立功能页（variant="page"）的**配音配置项必须齐全且真的生效**
 * ============================================================
 * 用户问："这个入口进入的界面，配音相关的配置项是否也可以正常配置呢？包括叮咚音的是否需要
 *   也可以让用户正常配置。"
 * 这条用**离线真跑**回答：粘贴英文素材 → 本机规则解析（不调模型）→ 出稿 → 面板出现全部配置项，
 *   且改配置后产出的朗读稿/音频分段随之改变（证明不是"摆设控件"）。
 */
describe('独立功能页：配音配置项齐全且真的生效', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const mountPage = () => mount(ListeningWorkbench, { props: { variant: 'page' }, attachTo: document.body });

  it('出稿后，语速/作答留白/音色/提示音/遍数/遍间换声/可选环节全都在页面上', async () => {
    const w = mountPage();
    await parseSampleInPage(w);
    const html = w.html();
    for (const item of ['语速（词/分）', '静默作答', '音色', '提示音', '开考第一声', '小题边界音', '默认遍数', '遍间换声', '读试卷标题', '试音段']) {
      expect(html, `独立页缺配置项：${item}`).toContain(item);
    }
    expect(html).toContain('① SSML');   // 产物区也在同一页
    expect(html).toContain('直接生成音频');
    w.unmount();
  });

  it('🔴 提示音开关真的通到产物：关「小题边界音」→ 朗读稿的提示音说明随之改口', async () => {
    const w = mountPage();
    await parseSampleInPage(w);
    expect(scriptValue(w)).toContain('每段材料开始前响一次');   // 默认两个都在

    const perItem = labelBox(w.element, '小题边界音');
    expect(perItem).toBeTruthy();
    perItem.checked = false;
    perItem.dispatchEvent(new Event('change'));
    await settle(w);
    // 逐题打点没了、开考第一声还在——朗读稿必须如实照写
    expect(scriptValue(w)).toContain('提示音（叮咚）：全卷最前响一次（开考第一声）');
    expect(scriptValue(w)).not.toContain('每段材料开始前响一次');

    const examStart = labelBox(w.element, '开考第一声');
    examStart.checked = false;
    examStart.dispatchEvent(new Event('change'));
    await settle(w);
    expect(scriptValue(w)).toContain('提示音（叮咚）：**本卷不响**');
    w.unmount();
  });

  it('🔴 改「默认遍数」真的改变分段（1 遍 → 没有第二遍）', async () => {
    const w = mountPage();
    await parseSampleInPage(w);
    expect(scriptValue(w)).toContain('〔第2遍〕');   // 默认按学段＝2 遍

    const sel = [...w.element.querySelectorAll('select')]
      .find((s) => (s.closest('label')?.textContent || '').includes('默认遍数'));
    expect(sel).toBeTruthy();
    sel.value = '1';
    sel.dispatchEvent(new Event('change'));
    await settle(w);
    expect(scriptValue(w)).not.toContain('〔第2遍〕');
    w.unmount();
  });
});
