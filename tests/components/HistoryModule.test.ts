import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import HistoryModule from '@/modules/HistoryModule.vue';

// Mock storage
vi.mock('@/utils/storage', () => ({
  default: {
    getItem: vi.fn().mockImplementation((key) => {
      if (key === 'docHistory') return Promise.resolve([]);
      return Promise.resolve(null);
    }),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
    getAllKeys: vi.fn().mockResolvedValue([]),
    getUsage: vi.fn().mockResolvedValue(0)
  }
}));

// Mock dialog
vi.mock('@/composables/useDialog.js', () => ({
  useDialog: () => ({
    showConfirmDialogFn: vi.fn().mockResolvedValue(true),
    showAlertDialogFn: vi.fn().mockResolvedValue(undefined),
    showInputDialogFn: vi.fn().mockResolvedValue('test'),
    showConfirmDialog: { value: false },
    confirmDialogMessage: { value: '' },
    showAlertDialog: { value: false },
    alertDialogMessage: { value: '' }
  })
}));

describe('HistoryModule', () => {
  let router: ReturnType<typeof createRouter>;

  beforeEach(() => {
    setActivePinia(createPinia());
    router = createRouter({
      history: createWebHashHistory(),
      routes: [
        { path: '/history', component: HistoryModule },
        { path: '/generate', component: { template: '<div>Generate</div>' } }
      ]
    });
  });

  it('渲染空列表', async () => {
    router.push('/history');
    await router.isReady();
    const wrapper = mount(HistoryModule, {
      global: { plugins: [router, createPinia()] }
    });
    expect(wrapper.text()).toContain('暂无历史记录');
  });

  it('渲染历史列表标题', () => {
    const wrapper = mount(HistoryModule, {
      global: { plugins: [router, createPinia()] }
    });
    expect(wrapper.text()).toContain('历史记录');
  });

  it('搜索框存在', () => {
    const wrapper = mount(HistoryModule, {
      global: { plugins: [router, createPinia()] }
    });
    const input = wrapper.find('input.search-input');
    expect(input.exists()).toBe(true);
    expect(input.attributes('placeholder')).toContain('搜索');
  });

  it('清空按钮存在', () => {
    const wrapper = mount(HistoryModule, {
      global: { plugins: [router, createPinia()] }
    });
    const buttons = wrapper.findAll('button');
    const clearBtn = buttons.find(b => b.text().includes('清空全部'));
    expect(clearBtn?.exists()).toBe(true);
  });

  it('类型筛选下拉存在', () => {
    const wrapper = mount(HistoryModule, {
      global: { plugins: [router, createPinia()] }
    });
    const select = wrapper.find('select');
    expect(select.exists()).toBe(true);
    const options = select.findAll('option');
    expect(options.length).toBeGreaterThan(2);
  });
});
