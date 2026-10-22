<template>
  <div
    v-if="visible"
    class="diagram-editor-mask"
    @click.self="$emit('close')"
  >
    <div class="diagram-editor">
      <div class="de-head">
        <span>🧩 编辑导图</span>
        <button
          class="de-x"
          title="关闭"
          @click="$emit('close')"
        >
          ✕
        </button>
      </div>

      <div class="de-body">
        <div class="de-list">
          <div class="de-toolbar">
            <label>
              图种
              <select
                :value="draft.type || 'mindmap'"
                :disabled="!isTree"
                @change="onType"
              >
                <option
                  v-for="t in typeOptions"
                  :key="t.value"
                  :value="t.value"
                >
                  {{ t.label }}
                </option>
              </select>
            </label>
            <span
              v-if="!isTree"
              class="de-tip"
            >该图种的文字可逐条改；增删结构请用「换图种」或重新生成</span>
          </div>

          <div
            v-for="(e, i) in entries"
            :key="`${e.path.join('-')}-${i}`"
            class="de-row"
            :style="{ paddingLeft: `${Math.min(e.depth, 4) * 16 + 8}px` }"
          >
            <input
              :value="e.text"
              class="de-input"
              :placeholder="e.role === 'root' ? '中心主题' : '要点'"
              @change="onText(e.path, $event.target.value)"
            >
            <span class="de-ops">
              <button
                v-if="e.addable"
                title="在此项下加一个子项"
                @click="onAddChild(e.path)"
              >＋</button>
              <button
                v-if="e.removable"
                title="删除该项"
                @click="onRemove(e.path)"
              >－</button>
              <button
                v-if="isTree && e.depth > 0"
                title="上移"
                @click="onMove(e.path, -1)"
              >↑</button>
              <button
                v-if="isTree && e.depth > 0"
                title="下移"
                @click="onMove(e.path, 1)"
              >↓</button>
            </span>
          </div>
        </div>

        <div class="de-preview">
          <div class="de-preview-title">实时预览（改完点保存才写回正文）</div>
          <div
            class="de-preview-box"
            v-html="previewSvg"
          />
        </div>
      </div>

      <div class="de-foot">
        <button
          class="de-btn"
          @click="$emit('close')"
        >
          取消
        </button>
        <button
          class="de-btn de-primary"
          @click="onSave"
        >
          保存到正文
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * 🧩 导图编辑面板（2026-10-22 属主："模型生成的内容如果错了，可以改"）
 * 只改**规格 JSON**（data-k-spec），再由纯函数重画 —— 不重新调模型、不碰渲染内核。
 * 编辑范围（最小版）：
 *   · 逐条改文字（所有图种）；
 *   · 树形图种（思维导图／括号图）：加子项、删项、上移下移、两图种互转；
 *   · 其他图种：逐条改文字 + 删项（结构增删请换图种或重生成）。
 */
import { computed, ref, watch } from 'vue';
import { buildDiagramSvg } from '../utils/diagrams/index.js';
import { getCanvasMeasurer, PRINT_SAFE_WIDTH } from '../utils/diagramBlock.js';
import {
  TREE_TYPES, collectEntries, setTextAt, removeAt, addChildAt, moveNode, changeTreeType,
} from '../utils/diagramSpecEdit.js';

const props = defineProps({
  visible: { type: Boolean, default: false },
  spec: { type: Object, default: null },
});
const emit = defineEmits(['close', 'save']);

const draft = ref(null);
watch(() => [props.visible, props.spec], () => {
  if (props.visible && props.spec) draft.value = JSON.parse(JSON.stringify(props.spec));
}, { immediate: true });

const typeOptions = [
  { value: 'mindmap', label: '思维导图' },
  { value: 'brace', label: '括号图' },
];
const isTree = computed(() => TREE_TYPES.includes((draft.value?.type) || 'mindmap'));
const entries = computed(() => (draft.value ? collectEntries(draft.value) : []));

const previewSvg = computed(() => {
  if (!draft.value) return '';
  try {
    const m = getCanvasMeasurer();
    const { svg } = buildDiagramSvg(draft.value, {
      ...(m ? { measurer: m } : {}),
      fitWidth: PRINT_SAFE_WIDTH,
    });
    // SVG 直接内联：只读展示，不参与点击/编辑
    return String(svg).replace('<svg ', '<svg style="max-width:100%;height:auto" ');
  } catch {
    return '<p style="color:#c00">规格无法渲染（请检查内容）</p>';
  }
});

const onText = (path, val) => { draft.value = setTextAt(draft.value, path, val); };
const onRemove = (path) => { const n = removeAt(draft.value, path); if (n) draft.value = n; };
const onAddChild = (path) => { const n = addChildAt(draft.value, path); if (n) draft.value = n; };
const onMove = (path, dir) => { const n = moveNode(draft.value, path, dir); if (n) draft.value = n; };
const onType = (ev) => { const n = changeTreeType(draft.value, ev.target.value); if (n) draft.value = n; };
const onSave = () => { if (draft.value) emit('save', draft.value); };
</script>

<style scoped>
.diagram-editor-mask {
  position: fixed; inset: 0; z-index: 3000;
  background: rgba(15, 23, 42, 0.45);
  display: flex; align-items: center; justify-content: center;
}
.diagram-editor {
  width: min(980px, 94vw); max-height: 88vh;
  background: #fff; border-radius: 10px; display: flex; flex-direction: column;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
}
.de-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-weight: 600;
}
.de-x { border: none; background: transparent; cursor: pointer; font-size: 15px; }
.de-body { display: flex; gap: 12px; padding: 12px 14px; overflow: hidden; }
.de-list { flex: 1 1 52%; overflow: auto; max-height: 62vh; }
.de-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 12px; }
.de-tip { color: #8a6d3b; }
.de-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.de-input {
  flex: 1; padding: 5px 8px; border: 1px solid #d9dee5; border-radius: 5px; font-size: 13px;
}
.de-ops { display: flex; gap: 2px; }
.de-ops button {
  width: 22px; height: 22px; line-height: 1; border: 1px solid #d9dee5; background: #f8fafc;
  border-radius: 4px; cursor: pointer; font-size: 12px;
}
.de-preview { flex: 1 1 48%; border-left: 1px solid #eef1f5; padding-left: 12px; overflow: auto; max-height: 62vh; }
.de-preview-title { font-size: 12px; color: #6b7280; margin-bottom: 6px; }
.de-preview-box { background: #fff; }
.de-foot {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 10px 14px; border-top: 1px solid #e5e7eb;
}
.de-btn { padding: 6px 14px; border: 1px solid #d9dee5; background: #fff; border-radius: 6px; cursor: pointer; }
.de-primary { background: #2563eb; border-color: #2563eb; color: #fff; }
</style>
