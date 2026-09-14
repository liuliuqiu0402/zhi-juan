<template>
  <div
    v-if="analysis"
    class="tpl-struct-editor"
  >
    <div style="font-size:12px;font-weight:600;color:#34495e;margin-bottom:4px;">
      📋 结构分析（对标核心，进生成提示词）
      <span style="font-weight:400;color:#8a94a6;">（可编辑 · 编辑即保存）</span>
    </div>

    <div
      v-for="(section, si) in sections"
      :key="si"
      style="margin-bottom:6px;border:1px solid var(--border-light);border-radius:4px;padding:6px;"
    >
      <div style="display:flex;gap:4px;margin-bottom:3px;">
        <input
          v-model="section.大题"
          type="text"
          placeholder="大题（原文逐字，如一、看拼音写词语）"
          title="大题名：原文怎么写就怎么填，不做归纳/改写（生成端按此对标栏目名）"
          style="flex:1;min-width:0;padding:4px 6px;border:1px solid #ddd;border-radius:3px;font-size:11px;"
          @change="persist"
        >
        <input
          v-model="section.题型"
          type="text"
          placeholder="题型"
          title="题型：原文原话，不做标准化归类"
          style="width:110px;flex-shrink:0;padding:4px 6px;border:1px solid #ddd;border-radius:3px;font-size:11px;"
          @change="persist"
        >
        <button
          class="btn-small"
          style="color:var(--danger);flex-shrink:0;padding:2px 4px;font-size:10px;"
          title="删除该大题"
          @click="removeSection(si)"
        >
          🗑️
        </button>
      </div>

      <div style="display:flex;gap:4px;">
        <input
          v-model.number="section.小题数量"
          type="number"
          placeholder="小题数"
          title="小题数量：按原文实际有几小题填（生成端按此对标题量）"
          style="width:64px;padding:4px 6px;border:1px solid #ddd;border-radius:3px;font-size:11px;"
          @change="persist"
        >
        <input
          v-model.number="section.大题分值"
          type="number"
          placeholder="大题分"
          title="大题分值：该大题总分；原文标注了才填，没标就填 0（不要估）"
          style="width:64px;padding:4px 6px;border:1px solid #ddd;border-radius:3px;font-size:11px;"
          @change="persist"
        >
        <input
          v-model.number="section.每小题分值"
          type="number"
          placeholder="每小题分"
          title="每小题分值：原文标注了才填，没标就填 0（不要估）"
          style="width:70px;padding:4px 6px;border:1px solid #ddd;border-radius:3px;font-size:11px;"
          @change="persist"
        >
        <!-- 难度：文本输入 + 候选三档（datalist），**不用固定下拉**——
             分析规范允许沿用原文标注（"提高题""拓展题"等），固定三档会把合法取值挡掉（把路走窄） -->
        <input
          v-model="section.难度"
          :list="uid"
          type="text"
          placeholder="难度"
          title="难度：原文有明目标注（如“提高题”“拓展题”）时沿用原文标注；没有则用 基础 / 中等 / 较难"
          style="width:76px;padding:4px 6px;border:1px solid #ddd;border-radius:3px;font-size:11px;"
          @change="persist"
        >
        <datalist :id="uid">
          <option value="基础" />
          <option value="中等" />
          <option value="较难" />
        </datalist>
      </div>

      <input
        v-model="section.设问风格"
        type="text"
        placeholder="设问风格（原文原句逐字）"
        title="设问风格：该题型在原文里是怎么问的，原文用什么词就填什么词"
        style="width:100%;margin-top:3px;padding:4px 6px;border:1px solid #ddd;border-radius:3px;font-size:11px;"
        @change="persist"
      >
    </div>

    <button
      class="btn-small"
      style="margin-top:3px;font-size:10px;"
      @click="addSection"
    >
      ➕ 添加大题
    </button>

    <div style="display:flex;gap:8px;margin-top:6px;">
      <label style="flex:1;font-size:11px;color:#555;">
        总分
        <input
          v-model.number="analysis.总分"
          type="number"
          style="width:100%;padding:4px 6px;border:1px solid #ddd;border-radius:3px;font-size:11px;"
          @change="persist"
        >
      </label>
      <label style="flex:1;font-size:11px;color:#555;">
        总题数
        <input
          v-model.number="analysis.总题数"
          type="number"
          style="width:100%;padding:4px 6px;border:1px solid #ddd;border-radius:3px;font-size:11px;"
          @change="persist"
        >
      </label>
    </div>

    <div style="font-size:10px;color:#8a94a6;margin-top:4px;">
      字段口径与原分析一致（分析规范未改）：大题 / 题型 / 设问风格照原文逐字；分值与小(大)题数只填原文已标注的，没标填 0 不估；难度为原文标注或基础 / 中等 / 较难。
    </div>
  </div>
</template>

<script setup>
/**
 * 📋 模板结构分析编辑器（2026-09-14 用户同意：模板抽屉的"结构分析"改为可编辑）
 * ============================================================
 * 为什么单独抽一个组件：这份编辑器要在**两个抽屉**里出现（模板库、生成模块的模板分析抽屉），
 *   而模板结构是同一份数据（`tpl.analysis`）。两处各写一份 = 迟早漂移，正是本项目反复治理的模式
 *   （教材库/生成模块的知识层级就曾各写一份 → 一处漏改）。故此处单一实现，两处共用。
 * 字段集 = **生成端真正消费的那几个**（不多不少，防"改了没用的字段"）：
 *   大题名 / 选题数量 / 每小题分值 / 大题分值 / 设问风格 / 难度（见 useAiGenerator 的 templateInfo 组装），
 *   外加 总分 / 总题数（exam 对标用）。
 * 只报读、不改生成：本组件只写回 `tpl.analysis`，不改任何生成期口径（措辞仍是"供风格/结构参考，不限制命题"）。
 * 编辑即保存：@change 触发 `persist` → 父级落盘（saveTemplates）。为什么不是只靠"保存"按钮——
 *   抽屉里改了不落盘、关掉就丢，等于"看起来改了其实没改"（同类坑本项目已出过）。
 * 难度用文本 + 候选（datalist）而非固定下拉：分析规范允许沿用原文标注（"提高题""拓展题"），
 *   固定三档会把合法取值挡掉（把路走窄）。
 */
import { computed, onMounted } from 'vue';

const props = defineProps({
  /** 模板分析结果对象（tpl.analysis；缺省则不渲染，由父级 v-if 控制） */
  analysis: { type: Object, default: null },
});
const emit = defineEmits(['persist']);

const uid = `tpl-diff-${Math.random().toString(36).slice(2, 8)}`;

/** 结构分析数组：新字段名优先，旧字段名（structure）兜底——两处同名同义，不做两份数据 */
const sections = computed(() => {
  const a = props.analysis;
  if (!a) return [];
  if (Array.isArray(a.结构分析) && a.结构分析.length) return a.结构分析;
  if (Array.isArray(a.structure) && a.structure.length) return a.structure;
  return [];
});

/** 旧字段名一次性归一（只补不覆盖）：让编辑落在生成端真正读取的键上
 *  （生成端读 `结构分析 || structure`、`总分 || totalScore`，故归一是单向补齐，无信息损失） */
const normalizeAliases = (a) => {
  if (!a) return;
  if ((!Array.isArray(a.结构分析) || !a.结构分析.length) && Array.isArray(a.structure) && a.structure.length) {
    a.结构分析 = a.structure;
  }
  if ((a.总分 === undefined || a.总分 === null) && a.totalScore) a.总分 = a.totalScore;
  if ((a.总题数 === undefined || a.总题数 === null) && a.questionCount) a.总题数 = a.questionCount;
};
onMounted(() => normalizeAliases(props.analysis));

const persist = () => emit('persist');

const addSection = () => {
  const a = props.analysis;
  if (!a) return;
  if (!Array.isArray(a.结构分析)) a.结构分析 = Array.isArray(a.structure) ? a.structure : [];
  a.结构分析.push({ 大题: '', 题型: '', 小题数量: 0, 大题分值: 0, 每小题分值: 0, 设问风格: '', 难度: '基础' });
  persist();
};

const removeSection = (si) => {
  const a = props.analysis;
  if (!a) return;
  const list = Array.isArray(a.结构分析) && a.结构分析.length ? a.结构分析 : a.structure;
  if (!Array.isArray(list)) return;
  list.splice(si, 1);
  persist();
};
</script>

<style scoped>
.tpl-struct-editor input {
  box-sizing: border-box;
  font-family: inherit;
}
</style>
