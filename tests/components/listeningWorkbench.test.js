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
import { mount } from '@vue/test-utils';
import ListeningWorkbench from '@/components/listening/ListeningWorkbench.vue';

const findButton = (root, text) => [...root.querySelectorAll('button')]
  .find((b) => (b.textContent || '').includes(text));

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
