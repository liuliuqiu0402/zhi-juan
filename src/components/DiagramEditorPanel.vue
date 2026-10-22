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
                @change="onType"
              >
                <option
                  v-for="t in typeOptions"
                  :key="t.value"
                  :value="t.value"
                  :disabled="!canConvertTo(t.value)"
                >
                  {{ t.label }}{{ t.hint ? `（${t.hint}）` : '' }}
                </option>
              </select>
            </label>
            <span
              v-if="isTree"
              class="de-tip"
            >拖左侧 ⠿ 到另一行上＝挂成它的子项；也可用 → 降一级 / ← 升一级（不能拖进自己的下级）</span>
            <span
              v-else
              class="de-tip"
            >该图种的文字可逐条改；结构增删请用「换图种」或重新生成</span>
          </div>
          <p
            v-if="convertNote"
            class="de-note"
          >
            {{ convertNote }}
          </p>

          <div
            v-for="(e, i) in entries"
            :key="`${e.path.join('-')}-${i}`"
            class="de-row"
            :class="{ 'drag-over': dragOverPath && dragOverPath.join('-') === e.path.join('-') }"
            :style="{ paddingLeft: `${Math.min(e.depth, 4) * 16 + 8}px` }"
            @dragover.prevent="onDragOver($event, e.path)"
            @dragleave="onDragLeave(e.path)"
            @drop.prevent="onDrop($event, e.path)"
            @dragend="clearDrag"
          >
            <span
              v-if="isTree && e.depth > 0"
              class="de-grip"
              title="拖动我，放到另一行上＝挂成它的子项"
              draggable="true"
              @dragstart="onDragStart($event, e.path)"
            >⠿</span>
            <span
              v-else
              class="de-grip de-grip-off"
            />
            <input
              :value="e.text"
              class="de-input"
              :placeholder="e.role === 'root' ? '中心主题' : '要点'"
              @change="onText(e.path, $event.target.value)"
            >
            <span class="de-ops">
              <button
                v-if="isTree"
                class="de-b"
                :class="{ on: e.bold }"
                :title="e.bold ? '取消加粗' : '加粗（打印时比颜色更清楚）'"
                @click="onBold(e.path, !e.bold)"
              >B</button>
              <label
                v-if="isTree"
                class="de-color"
                :title="e.role === 'root' ? '改中心主题的底色' : '改这条文字的颜色'"
              >
                <input
                  type="color"
                  :value="e.color || (e.role === 'root' ? '#2b3a4a' : '#2f3540')"
                  @change="onColor(e.path, $event.target.value)"
                >
                <span
                  v-if="e.color"
                  class="de-color-clear"
                  title="恢复默认色"
                  @click.prevent="onColor(e.path, '')"
                >×</span>
              </label>
              <button
                v-if="isTree && e.depth > 0 && e.path[e.path.length - 1] > 0"
                title="降一级（挂到上一个同级下面）"
                @click="onIndent(e.path)"
              >→</button>
              <button
                v-if="isTree && e.depth > 1"
                title="升一级（提到父节点的同级位）"
                @click="onOutdent(e.path)"
              >←</button>
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
                title="上移（同级内换顺序）"
                @click="onMove(e.path, -1)"
              >↑</button>
              <button
                v-if="isTree && e.depth > 0"
                title="下移（同级内换顺序）"
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
  TREE_TYPES, TREE_REBUILD_TARGETS, collectEntries, setTextAt, removeAt, addChildAt,
  moveNode, moveNodeTo, rebuildFromTree, changeTreeType, setStyleAt, indentNode, outdentNode,
} from '../utils/diagramSpecEdit.js';

const props = defineProps({
  visible: { type: Boolean, default: false },
  spec: { type: Object, default: null },
});
const emit = defineEmits(['close', 'save']);

const draft = ref(null);
const convertNote = ref('');
watch(() => [props.visible, props.spec], () => {
  if (props.visible && props.spec) {
    draft.value = JSON.parse(JSON.stringify(props.spec));
    convertNote.value = '';
  }
}, { immediate: true });

const typeOptions = [
  { value: 'mindmap', label: '思维导图' },
  { value: 'brace', label: '括号图' },
  { value: 'fishbone', label: '鱼骨图', hint: '按一级分类重建' },
  { value: 'concept', label: '概念图', hint: '按父子关系重建' },
  { value: 'flow', label: '流程图', hint: '按顺序摊平，层级不保留' },
  { value: 'timeline', label: '时间轴', hint: '需手工补时间' },
];
const isTree = computed(() => TREE_TYPES.includes((draft.value?.type) || 'mindmap'));
const entries = computed(() => (draft.value ? collectEntries(draft.value) : []));

/** 哪些图种可一键转换：树形源可以转同构（无损）与三种映射（近似/有损）；其它源只保持自身 */
const canConvertTo = (t) => {
  const cur = draft.value?.type || 'mindmap';
  if (t === cur) return true;
  if (!TREE_TYPES.includes(cur)) return false;
  return TREE_TYPES.includes(t) || TREE_REBUILD_TARGETS.includes(t);
};

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

// 🎨 加粗／改色（2026-10-22 属主："文字能编辑，但不能加粗、修改颜色等操作吗"）
//   写的是规格里的节点字段（bold / color），渲染侧照它出字重与颜色——所见即所得，且**打印友好**
//   （加粗在黑白打印下仍可区分，颜色不会）。
const onBold = (path, bold) => { const n = setStyleAt(draft.value, path, { bold }); if (n) draft.value = n; };
const onColor = (path, color) => { const n = setStyleAt(draft.value, path, { color }); if (n) draft.value = n; };

// ⬇️⬆️ 升降层级（确定性按钮：真机上从输入框起拖常常拖不动，故不只依赖拖拽）
const onIndent = (path) => {
  const n = indentNode(draft.value, path);
  if (n) { draft.value = n; convertNote.value = ''; }
};
const onOutdent = (path) => {
  const n = outdentNode(draft.value, path);
  if (n) { draft.value = n; convertNote.value = ''; }
};

/** 换图种：同构互转（无损）／按映射重建（近似或有损）／不可转则退回原值并说明原因 */
const onType = (ev) => {
  const t = ev.target.value;
  const cur = draft.value?.type || 'mindmap';
  if (t === cur) return;
  if (TREE_TYPES.includes(t) && TREE_TYPES.includes(cur)) {
    const n = changeTreeType(draft.value, t);
    if (n) { draft.value = n; convertNote.value = ''; return; }
  }
  if (TREE_REBUILD_TARGETS.includes(t) && TREE_TYPES.includes(cur)) {
    const n = rebuildFromTree(draft.value, t);
    if (n) {
      draft.value = n;
      convertNote.value = t === 'flow'
        ? '已按先序摊平成顺序步骤：流程图不保留层级，请核对顺序与首尾'
        : '已按映射规则重建结构（可能需人工微调），点保存写回正文';
      return;
    }
    convertNote.value = '当前内容不足以重建该图种（至少需要一个一级要点）';
    ev.target.value = cur;
    return;
  }
  convertNote.value = '该图种需人工补字段（如时间轴的“时间”），请重新生成或手工改 JSON';
  ev.target.value = cur;
};

// 🖱 面板内拖拽：拖一行到另一行上＝挂成它的子项（纯函数 moveNodeTo 已做防环/防越界）
const dragFrom = ref(null);
const dragOverPath = ref(null);
const onDragStart = (e, path) => {
  if (!isTree.value || !path.length) { e.preventDefault(); return; }
  dragFrom.value = path;
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', path.join('/')); } catch { /* 某些环境只读 */ }
};
const onDragOver = (e, path) => {
  if (!dragFrom.value) return;
  dragOverPath.value = path;
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
};
const onDragLeave = (path) => {
  if (dragOverPath.value && dragOverPath.value.join('-') === path.join('-')) dragOverPath.value = null;
};
const clearDrag = () => { dragFrom.value = null; dragOverPath.value = null; };
const onDrop = (e, path) => {
  const from = dragFrom.value;
  clearDrag();
  if (!from) return;
  const n = moveNodeTo(draft.value, from, path);
  if (n) { draft.value = n; convertNote.value = ''; }
  else convertNote.value = '不能拖进自己或自己的下级（会成环）';
};

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
.de-note {
  margin: 0 0 8px; padding: 6px 8px; border-radius: 5px;
  background: #fff7e6; border: 1px solid #ffe0a3; color: #8a5a00; font-size: 12px;
}
.de-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; border-radius: 5px; }
.de-grip {
  width: 14px; flex: 0 0 14px; text-align: center; color: #9aa4b2;
  cursor: grab; user-select: none; font-size: 13px;
}
.de-grip:active { cursor: grabbing; }
.de-grip-off { cursor: default; visibility: hidden; }
.de-row.drag-over { outline: 2px dashed #2563eb; outline-offset: 1px; background: #eff6ff; }
.de-input {
  flex: 1; padding: 5px 8px; border: 1px solid #d9dee5; border-radius: 5px; font-size: 13px;
}
.de-ops { display: flex; gap: 2px; align-items: center; }
.de-ops button {
  width: 22px; height: 22px; line-height: 1; border: 1px solid #d9dee5; background: #f8fafc;
  border-radius: 4px; cursor: pointer; font-size: 12px;
}
.de-ops button.on { background: #2563eb; border-color: #2563eb; color: #fff; font-weight: 700; }
.de-b { font-weight: 700; }
.de-color { position: relative; width: 22px; height: 22px; flex: 0 0 22px; }
.de-color input[type="color"] {
  width: 22px; height: 22px; padding: 0; border: 1px solid #d9dee5; border-radius: 4px;
  background: #f8fafc; cursor: pointer;
}
.de-color-clear {
  position: absolute; top: -6px; right: -6px; width: 13px; height: 13px; line-height: 12px;
  text-align: center; border-radius: 50%; background: #64748b; color: #fff; font-size: 10px; cursor: pointer;
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
