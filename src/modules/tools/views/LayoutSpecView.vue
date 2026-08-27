<template>
  <div class="ls-page">
    <!-- 概览条（吸顶） -->
    <div class="ls-overview">
      <div>
        <span class="lib-badge">📏 排版规格库</span>
        <b>规格组 {{ SPEC_GROUPS.length }}</b>
        <span class="ov-sep">·</span>
        <span>用户覆盖 <b class="user-n">{{ userOverrideCount }}</b> 项</span>
        <span class="ov-sep">·</span>
        <span>消费者 docxBuilder / contentCleaner / themeConfig</span>
      </div>
      <div class="ls-ops">
        <button v-if="hasOverride" class="btn danger" @click="resetAll">↩️ 恢复全部默认</button>
        <button class="btn" @click="doExport">📤 导出</button>
        <button class="btn" @click="importInput?.click()">📥 导入</button>
        <input ref="importInput" type="file" accept=".json" style="display:none" @change="doImport" />
      </div>
    </div>

    <!-- 说明 -->
    <div class="brief">
      <p>学段渲染参数（程序可读数据）：作文格宽、填空横线上限、书写载体、解答题空白区系数、方格纸规格等。消费者（docxBuilder/contentCleaner/themeConfig）调用 <code>getMergedSpec()</code> 读取合并后的值。</p>
      <p>与规则库分工：排版规格库承载格式<b>数值/参数</b>，规则库承载格式<b>逻辑/开关</b>。</p>
    </div>

    <!-- 规格组手风琴 -->
    <div class="ls-list">
      <div v-for="g in SPEC_GROUPS" :key="g.id" class="ls-card" :class="{ open: openGroup === g.id, editing: editingGroup === g.id }">
        <div class="ls-head" @click="toggleGroup(g.id)">
          <span class="arrow">{{ openGroup === g.id ? '▾' : '▸' }}</span>
          <span class="lib-tag">📏 规格</span>
          <span class="dim-name">{{ g.name }}</span>
          <span class="ls-desc">{{ g.desc }}</span>
          <span v-if="groupHasOverride(g)" class="src-user">已自定义</span>
          <span class="ls-meta">{{ g.fields.length }} 参数</span>
        </div>

        <!-- 展开态：预览表格 -->
        <div v-if="openGroup === g.id && editingGroup !== g.id" class="ls-body">
          <table class="ls-table">
            <thead><tr><th>参数</th><th>当前值</th><th>内置默认</th><th>状态</th></tr></thead>
            <tbody>
              <tr v-for="f in g.fields" :key="f.path">
                <td>{{ f.label }}</td>
                <td :class="{ modified: isModified(f.path) }">{{ formatVal(getByPath(mergedSpec, f.path), f) }}</td>
                <td>{{ formatVal(getByPath(defaults, f.path), f) }}</td>
                <td>
                  <span v-if="isModified(f.path)" class="mod-tag">已修改</span>
                  <span v-else class="ok-tag">默认</span>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="ls-ops">
            <button class="btn" @click="startEdit(g)">✏️ 编辑</button>
            <button v-if="groupHasOverride(g)" class="btn danger" @click="resetGroup(g)">↩️ 恢复此组默认</button>
          </div>
        </div>

        <!-- 编辑态 -->
        <div v-if="editingGroup === g.id" class="ls-edit">
          <div class="edit-grid">
            <div v-for="f in g.fields" :key="f.path" class="edit-field">
              <label>{{ f.label }}<span class="unit" v-if="f.unit"> ({{ f.unit }})</span></label>
              <select v-if="f.type === 'select'" v-model="editValues[f.path]">
                <option v-for="opt in f.options" :key="opt" :value="opt">{{ opt }}</option>
              </select>
              <input v-else v-model="editValues[f.path]" type="number" :step="f.step" :min="f.min" :max="f.max" />
              <span class="range-hint" v-if="f.type === 'number'">{{ f.min }}~{{ f.max }}</span>
            </div>
          </div>
          <div class="ls-ops">
            <button class="btn-p" @click="saveGroup(g)">💾 保存</button>
            <button class="btn" @click="cancelEdit">取消</button>
          </div>
          <p class="edit-tip">※ 保存后即时生效（docxBuilder/contentCleaner/themeConfig 下次生成自动读取）；恢复默认仅清除此组覆盖。</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import {
  getMergedSpec, loadLayoutSpecOverride, saveLayoutSpecOverride, resetLayoutSpecOverride,
  LAYOUT_SPEC_DEFAULTS,
} from '../../../config/layoutSpec.js';
import { exportLibrary, importLibrary, readLib, writeLib } from '../../../utils/libraryIO.js';

// ==================== 规格组定义 ====================
const SPEC_GROUPS = [
  {
    id: 'zuowen',
    name: '作文格规格',
    desc: '格宽/格高/标注步长（docxBuilder · themeConfig · contentCleaner）',
    fields: [
      { path: 'ZUOWEN_CELL.primary.widthMm', label: '小学格宽', unit: 'mm', type: 'number', min: 6, max: 20, step: 0.5 },
      { path: 'ZUOWEN_CELL.primary.heightMm', label: '小学格高', unit: 'mm', type: 'number', min: 6, max: 20, step: 0.5 },
      { path: 'ZUOWEN_CELL.middle.widthMm', label: '初中格宽', unit: 'mm', type: 'number', min: 6, max: 20, step: 0.5 },
      { path: 'ZUOWEN_CELL.middle.heightMm', label: '初中格高', unit: 'mm', type: 'number', min: 6, max: 20, step: 0.5 },
      { path: 'ZUOWEN_CELL.high.widthMm', label: '高中格宽', unit: 'mm', type: 'number', min: 5, max: 15, step: 0.5 },
      { path: 'ZUOWEN_CELL.high.heightMm', label: '高中格高', unit: 'mm', type: 'number', min: 5, max: 15, step: 0.5 },
      { path: 'ZUOWEN_MARK_STEP.primary', label: '小学标注步长', unit: '格/标', type: 'number', min: 10, max: 200, step: 10 },
      { path: 'ZUOWEN_MARK_STEP.middle', label: '初中标注步长', unit: '格/标', type: 'number', min: 10, max: 200, step: 10 },
      { path: 'ZUOWEN_MARK_STEP.high', label: '高中标注步长', unit: '格/标', type: 'number', min: 10, max: 200, step: 10 },
      { path: 'ZUOWEN_DEFAULT_SPAN', label: '空格默认补全', unit: 'span', type: 'number', min: 1, max: 10, step: 1 },
    ],
  },
  {
    id: 'blank',
    name: '填空规格',
    desc: '横线宽度/字数换算（contentCleaner · normalizeBlankMarkers）',
    fields: [
      { path: 'BLANK.maxCap', label: '宽度上限', unit: 'em', type: 'number', min: 8, max: 30, step: 1 },
      { path: 'BLANK.wordGap', label: '1字≈N格', unit: '格', type: 'number', min: 1, max: 4, step: 0.5 },
      { path: 'BLANK.minBlank', label: '最小 blank-N', unit: '', type: 'number', min: 1, max: 6, step: 1 },
      { path: 'BLANK.maxBlank', label: '最大 blank-N', unit: '', type: 'number', min: 10, max: 40, step: 1 },
    ],
  },
  {
    id: 'carrier',
    name: '书写载体',
    desc: '学段×书写格式（writing-grid-fix 读取）',
    fields: [
      { path: 'WRITING_CARRIER.primary_low', label: '小学低段', unit: '', type: 'select', options: ['tian-zi-ge', 'square', 'line', 'four-line-three'] },
      { path: 'WRITING_CARRIER.primary_mid', label: '小学中段', unit: '', type: 'select', options: ['tian-zi-ge', 'square', 'line', 'four-line-three'] },
      { path: 'WRITING_CARRIER.primary_high', label: '小学高段', unit: '', type: 'select', options: ['tian-zi-ge', 'square', 'line', 'four-line-three'] },
      { path: 'WRITING_CARRIER.middle', label: '初中', unit: '', type: 'select', options: ['tian-zi-ge', 'square', 'line', 'four-line-three'] },
      { path: 'WRITING_CARRIER.high', label: '高中', unit: '', type: 'select', options: ['tian-zi-ge', 'square', 'line', 'four-line-three'] },
    ],
  },
  {
    id: 'answer',
    name: '解答区',
    desc: '行数=分值×系数 · 行高（骨架编译器读取）',
    fields: [
      { path: 'ANSWER_REGION.primary_low.linePerScore', label: '低段 行/分', unit: '', type: 'number', min: 0.3, max: 3, step: 0.1 },
      { path: 'ANSWER_REGION.primary_low.lineHeightMm', label: '低段 行高', unit: 'mm', type: 'number', min: 4, max: 15, step: 0.5 },
      { path: 'ANSWER_REGION.primary_mid.linePerScore', label: '中段 行/分', unit: '', type: 'number', min: 0.3, max: 3, step: 0.1 },
      { path: 'ANSWER_REGION.primary_mid.lineHeightMm', label: '中段 行高', unit: 'mm', type: 'number', min: 4, max: 15, step: 0.5 },
      { path: 'ANSWER_REGION.primary_high.linePerScore', label: '高段 行/分', unit: '', type: 'number', min: 0.3, max: 3, step: 0.1 },
      { path: 'ANSWER_REGION.primary_high.lineHeightMm', label: '高段 行高', unit: 'mm', type: 'number', min: 4, max: 15, step: 0.5 },
      { path: 'ANSWER_REGION.middle.linePerScore', label: '初中 行/分', unit: '', type: 'number', min: 0.3, max: 3, step: 0.1 },
      { path: 'ANSWER_REGION.middle.lineHeightMm', label: '初中 行高', unit: 'mm', type: 'number', min: 4, max: 15, step: 0.5 },
      { path: 'ANSWER_REGION.high.linePerScore', label: '高中 行/分', unit: '', type: 'number', min: 0.3, max: 3, step: 0.1 },
      { path: 'ANSWER_REGION.high.lineHeightMm', label: '高中 行高', unit: 'mm', type: 'number', min: 4, max: 15, step: 0.5 },
    ],
  },
  {
    id: 'square',
    name: '方格纸',
    desc: '小学段专用（square-grid；初中以上为 null）',
    fields: [
      { path: 'SQUARE_GRID.primary.cols', label: '列数', unit: '', type: 'number', min: 6, max: 20, step: 1 },
      { path: 'SQUARE_GRID.primary.rows', label: '行数', unit: '', type: 'number', min: 4, max: 20, step: 1 },
    ],
  },
];

// ==================== 辅助函数 ====================
const getByPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const setByPath = (obj, path, val) => {
  const keys = path.split('.');
  const last = keys.pop();
  const clone = JSON.parse(JSON.stringify(obj));
  let cur = clone;
  for (const k of keys) { cur[k] = cur[k] || {}; cur = cur[k]; }
  cur[last] = val;
  return clone;
};

const formatVal = (v, f) => {
  if (v == null) return '—';
  if (f.unit) return `${v}${f.unit}`;
  return String(v);
};

// ==================== 数据源 ====================
const userOverride = ref(loadLayoutSpecOverride());
const defaults = LAYOUT_SPEC_DEFAULTS;
const mergedSpec = computed(() => getMergedSpec());

const isModified = (path) => {
  const userVal = getByPath(userOverride.value, path);
  return userVal !== undefined;
};

const groupHasOverride = (g) => g.fields.some((f) => isModified(f.path));

const userOverrideCount = computed(() => {
  let n = 0;
  for (const g of SPEC_GROUPS) for (const f of g.fields) if (isModified(f.path)) n++;
  return n;
});

const hasOverride = computed(() => userOverrideCount.value > 0);

// ==================== 手风琴 ====================
const openGroup = ref('');
const toggleGroup = (id) => { openGroup.value = openGroup.value === id ? '' : id; };

// ==================== 编辑态 ====================
const editingGroup = ref('');
const editValues = ref({});

const startEdit = (g) => {
  editingGroup.value = g.id;
  const spec = mergedSpec.value;
  for (const f of g.fields) {
    editValues.value[f.path] = getByPath(spec, f.path);
  }
};

const cancelEdit = () => { editingGroup.value = ''; };

const saveGroup = (g) => {
  // 校验范围
  for (const f of g.fields) {
    const v = editValues.value[f.path];
    if (f.type === 'number') {
      const num = Number(v);
      if (isNaN(num) || num < f.min || num > f.max) {
        window.alert(`「${f.label}」值 ${v} 超出范围 ${f.min}~${f.max}，请修正后再保存。`);
        return;
      }
    }
  }
  // 写入 localStorage 覆盖
  let override = loadLayoutSpecOverride();
  for (const f of g.fields) {
    let val = editValues.value[f.path];
    if (f.type === 'number') val = Number(val);
    override = setByPath(override, f.path, val);
  }
  saveLayoutSpecOverride(override);
  userOverride.value = override;
  editingGroup.value = '';
  openGroup.value = g.id;
};

const resetGroup = (g) => {
  if (!window.confirm(`恢复「${g.name}」的内置默认？用户覆盖将被清除。`)) return;
  let override = loadLayoutSpecOverride();
  for (const f of g.fields) {
    override = setByPath(override, f.path, undefined);
  }
  // 清理 undefined 的路径
  const cleaned = JSON.parse(JSON.stringify(override, (k, v) => v === undefined ? undefined : v));
  saveLayoutSpecOverride(cleaned);
  userOverride.value = loadLayoutSpecOverride();
};

const resetAll = () => {
  if (!window.confirm('恢复全部排版规格为内置默认？所有用户覆盖将被清除。')) return;
  resetLayoutSpecOverride();
  userOverride.value = {};
};

/* ===== 导入/导出 ===== */
const importInput = ref(null);
const LAYOUT_USER_KEY = 'wisdom_layout_spec_v1';
const doExport = () => {
  exportLibrary('layout_spec', readLib(LAYOUT_USER_KEY));
};
const doImport = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const data = await importLibrary(file);
    if (typeof data !== 'object' || data === null) throw new Error('数据格式不正确');
    writeLib(LAYOUT_USER_KEY, data);
    userOverride.value = loadLayoutSpecOverride();
    window.alert('导入成功。');
  } catch (err) {
    window.alert('导入失败：' + err.message);
  }
  e.target.value = '';
};
</script>

<style scoped>
.ls-page { padding: 18px 22px 30px; max-width: 960px; }
.ls-overview { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-size: 13px; background: var(--bg); border: 1px solid var(--border-light); border-radius: 10px; padding: 10px 14px; box-shadow: 0 2px 6px rgba(30,58,111,.06); }
.lib-badge { display: inline-block; font-size: 12px; font-weight: 700; color: #fff; background: var(--primary); border-radius: 6px; padding: 3px 10px; margin-right: 10px; }
.ov-sep { margin: 0 8px; color: #c2ccda; }
.user-n { color: var(--accent); }
.ls-ops { display: flex; gap: 8px; }

.brief { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 10px; padding: 12px 16px; font-size: 12.5px; color: #445; margin-top: 12px; }
.brief p { margin: 4px 0; }
.brief code { background: var(--primary-lighter); color: var(--primary); padding: 1px 6px; border-radius: 4px; font-size: 11.5px; }

.ls-list { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
.ls-card { background: #fff; border: 1px solid var(--border-light); border-radius: 10px; overflow: hidden; }
.ls-card.open { border-color: var(--primary-light); box-shadow: 0 2px 10px rgba(30,58,111,.08); }
.ls-head { display: flex; align-items: center; gap: 8px; padding: 10px 14px; cursor: pointer; flex-wrap: wrap; }
.ls-head:hover { background: var(--primary-lighter); }
.arrow { color: var(--accent); font-weight: 700; }
.lib-tag { display: inline-block; font-size: 11px; font-weight: 700; color: #fff; background: var(--primary); border-radius: 6px; padding: 2px 8px; }
.dim-name { font-weight: 700; font-size: 13.5px; color: #26303e; }
.ls-desc { font-size: 12px; color: #667; flex: 1; }
.ls-meta { font-size: 12px; color: var(--text-muted); }
.src-user { font-size: 10.5px; font-weight: 600; color: #a06a10; background: #fdf3e2; border: 1px solid #f3d9a8; border-radius: 999px; padding: 1px 8px; }

.ls-body { border-top: 1px dashed var(--border-light); padding: 10px 14px 14px; }
.ls-table { border-collapse: collapse; width: 100%; font-size: 12.5px; }
.ls-table th { text-align: left; background: var(--primary-lighter, #eef4ff); color: var(--primary); font-weight: 600; padding: 6px 10px; border-bottom: 1px solid var(--border-light); white-space: nowrap; }
.ls-table td { padding: 6px 10px; border-bottom: 1px solid var(--border-light); }
.ls-table tr:last-child td { border-bottom: none; }
.modified { color: var(--accent); font-weight: 600; }
.mod-tag { font-size: 10.5px; font-weight: 700; color: #a06a10; background: #fdf3e2; border-radius: 999px; padding: 1px 8px; }
.ok-tag { font-size: 10.5px; color: var(--text-muted); }

.ls-edit { border-top: 1px dashed var(--border-light); padding: 12px 14px 14px; background: var(--primary-lighter); }
.edit-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px 16px; }
.edit-field { display: flex; flex-direction: column; gap: 4px; }
.edit-field label { font-size: 12.5px; color: var(--primary); font-weight: 600; }
.edit-field .unit { font-weight: 400; font-size: 11px; color: var(--text-muted); }
.edit-field input, .edit-field select { border: 1px solid var(--border); border-radius: 6px; padding: 5px 8px; font-size: 13px; width: 100%; box-sizing: border-box; }
.edit-field input:focus, .edit-field select:focus { border-color: var(--primary); outline: none; }
.range-hint { font-size: 10.5px; color: var(--text-muted); }
.edit-tip { font-size: 11.5px; color: var(--text-muted); margin: 8px 0 0; }

.btn { border: 1px solid var(--border); background: #fff; border-radius: 6px; padding: 5px 12px; font-size: 12.5px; cursor: pointer; }
.btn:hover { background: var(--primary-lighter); color: var(--primary); }
.btn.danger { color: var(--danger); border-color: var(--danger-light); }
.btn-p { border: none; background: var(--primary); color: #fff; border-radius: 6px; padding: 6px 14px; font-size: 13px; cursor: pointer; }
.btn-p:hover { background: var(--primary-light); }
</style>
