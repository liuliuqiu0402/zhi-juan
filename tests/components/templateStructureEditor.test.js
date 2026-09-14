// 📋 模板结构分析编辑器（2026-09-14 用户同意：模板抽屉的"结构分析"改为可编辑）
// 背景：模板分析结果（结构分析/总分/总题数）落在 `tpl.analysis`，模板库抽屉原先绑的是
//   `viewingChapter.结构分析` —— 模板分析从不写章节节点 → 那块**一直渲染不出来**（失效绑定）。
//   同时生成模块抽屉里同一份数据是"只读展示"，改判不了的字段只能靠重新分析。
// 口径（本次只改"可编辑性"，不改生成端任何口径）：
//   ① 两个抽屉共用**同一个组件**（两处各写一份必漂移 —— 知识层级就是这么漏改的）；
//   ② 字段集 = 生成端真正消费的那几个（大题/题型/小题数量/大题分值/每小题分值/设问风格/难度 + 总分/总题数）；
//   ③ 难度是文本输入 + 三档候选（datalist），**不是固定下拉**：分析规范允许沿用原文标注
//      （"提高题""拓展题"），固定三档会把合法取值挡掉（把路走窄）；
//   ④ 编辑即保存（@change → persist → saveTemplates）：改完不落盘、关掉就丢 = 假修改。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { mount } from '@vue/test-utils';
import TemplateStructureEditor from '@/components/TemplateStructureEditor.vue';

const ROOT = path.resolve(__dirname, '../..');

describe('TemplateStructureEditor（模板结构分析编辑器）', () => {
  it('旧字段名归一：structure→结构分析 / totalScore→总分 / questionCount→总题数（只补不覆盖）', () => {
    // 历史数据形态：只有旧字段名
    const a = {
      structure: [{ 大题: '一、看拼音写词语', 题型: '看拼音写词语', 小题数量: 5, 大题分值: 10, 每小题分值: 2, 设问风格: '看拼音写词语', 难度: '基础' }],
      totalScore: 100,
      questionCount: 20,
    };
    const w = mount(TemplateStructureEditor, { props: { analysis: a } });
    // 归一后编辑落在生成端真正读取的键上（生成端读 `结构分析 || structure`、`总分 || totalScore`）
    expect(Array.isArray(a.结构分析)).toBe(true);
    expect(a.结构分析).toHaveLength(1);
    expect(a.总分).toBe(100);
    expect(a.总题数).toBe(20);
    // 旧字段名不被删除（单向补齐，无信息损失；若被清掉就是"改了别人的数据"）
    expect(a.structure).toHaveLength(1);
    expect(w.findAll('input').map((i) => i.element.value)).toContain('一、看拼音写词语');
  });

  it('字段集 = 生成端真正消费的那几个（不多不少）', () => {
    const w = mount(TemplateStructureEditor, { props: { analysis: { 结构分析: [{ 大题: '一' }] } } });
    const html = w.html();
    for (const f of ['大题', '题型', '小题数量', '大题分值', '每小题分值', '设问风格', '难度', '总分', '总题数']) {
      expect(html, `须含字段 ${f}`).toContain(f);
    }
  });

  it('难度：文本输入 + 三档候选（不窄化——原文标注如"提高题"必须能保留）', () => {
    const w = mount(TemplateStructureEditor, { props: { analysis: { 结构分析: [{ 大题: '一', 难度: '提高题' }] } } });
    expect(w.find('select').exists(), '不得用固定下拉（会把原文标注挡掉）').toBe(false);
    expect(w.html()).toContain('<datalist');
    for (const v of ['基础', '中等', '较难']) expect(w.html()).toContain(`value="${v}"`);
    // 原文标注值原样保留在输入框里（不被三档吞掉）
    expect(w.findAll('input').some((i) => i.element.value === '提高题')).toBe(true);
  });

  it('编辑即保存：改动字段 / 添加大题 / 删除大题都 emit persist', async () => {
    const a = { 结构分析: [{ 大题: '一', 题型: 't', 设问风格: 's', 难度: '基础' }] };
    const w = mount(TemplateStructureEditor, { props: { analysis: a } });

    const first = w.findAll('input')[0];
    await first.setValue('二、阅读理解');
    await first.trigger('change');
    expect(a.结构分析[0].大题).toBe('二、阅读理解');
    expect(w.emitted('persist')).toBeTruthy();
    const n1 = w.emitted('persist').length;

    const addBtn = w.findAll('button').find((b) => b.text().includes('添加大题'));
    await addBtn.trigger('click');
    expect(a.结构分析).toHaveLength(2);
    expect(w.emitted('persist').length).toBe(n1 + 1);

    const delBtn = w.findAll('button').find((b) => b.text().includes('🗑️'));
    await delBtn.trigger('click');
    expect(a.结构分析).toHaveLength(1);
    expect(w.emitted('persist').length).toBe(n1 + 2);
  });

  it('一大题一行：每题 7 个字段 + 全局 总分/总题数', () => {
    const w = mount(TemplateStructureEditor, {
      props: { analysis: { 结构分析: [{ 大题: 'A节', 题型: '选择题' }, { 大题: 'B节', 题型: '填空题' }] } },
    });
    // 输入框的 value 是 DOM property（不反映到属性），故按 element.value 检查
    const values = w.findAll('input').map((i) => i.element.value);
    expect(values).toContain('A节');
    expect(values).toContain('B节');
    expect(w.findAll('input')).toHaveLength(2 * 7 + 2);
  });

  it('未提供分析对象时不炸（父级另有 v-if 控制显隐）', () => {
    const w = mount(TemplateStructureEditor, { props: { analysis: null } });
    expect(w.findAll('input')).toHaveLength(0);
  });
});

describe('接线锁死：两个抽屉共用同一编辑器（不得各写一份）', () => {
  const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

  it('模板库 / 生成模块都挂同一个组件，且都"编辑即保存"落盘', () => {
    for (const m of ['src/modules/TemplateModule.vue', 'src/modules/GenerateModule.vue']) {
      const s = read(m);
      expect(s, `${m} 须挂共用编辑器`).toContain('<TemplateStructureEditor');
      expect(s, `${m} 须接编辑即保存`).toContain('@persist="persistTemplateAnalysis"');
      expect(s, `${m} 须有落盘实现`).toContain('await templateStore.saveTemplates();');
    }
  });

  it('失效绑定已纠正：模板库不再绑 viewingChapter.结构分析（模板分析只落在 tpl.analysis）', () => {
    const tm = read('src/modules/TemplateModule.vue');
    // 旧失效绑定形态（v-if / v-for 直接读章节节点）不得回归
    expect(tm).not.toContain('v-if="viewingChapter.结构分析');
    expect(tm).not.toContain('v-for="(section, si) in viewingChapter.结构分析"');
    expect(tm).toContain(':analysis="tplAnalysis"');
    // 生成模块不再保留旧的只读结构分析块
    expect(read('src/modules/GenerateModule.vue')).not.toContain('模板分析结果 - 只读显示');
  });

  it('原分析规范未改（本次只改可编辑性，不动任何生成口径与提取要求）', () => {
    // 分析规范（指令库源）：除难度/小题数外逐字复制 + 分值不估 —— 本次一个字未动
    const lib = read('src/config/analysisPrompts.js');
    expect(lib).toContain('除【难度】判断与【小题数量】统计外，其余字段');
    expect(lib).toContain('必须逐字复制原文');
    // 生成端硬编码兜底同样保留（防两处口径不一致）
    expect(read('src/composables/useAiGenerator.js')).toContain('严禁自己估算');
  });
});
