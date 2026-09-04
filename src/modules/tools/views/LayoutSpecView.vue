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
        <span class="st-chips">
          <button
            class="st-chip"
            :class="{ sel: specFilter === 'all' }"
            @click="specFilter = 'all'"
          >全部 {{ specCounts.total }}</button>
          <button
            class="st-chip on"
            :class="{ sel: specFilter === 'on' }"
            @click="specFilter = 'on'"
          >启用 {{ specCounts.on }}</button>
          <button
            class="st-chip off"
            :class="{ sel: specFilter === 'off' }"
            @click="specFilter = 'off'"
          >停用 {{ specCounts.off }}</button>
        </span>
        <span class="ov-sep">·</span>
        <span>消费者 docxBuilder / contentCleaner / themeConfig</span>
      </div>
      <div class="ls-ops">
        <button
          v-if="hasOverride"
          class="btn danger"
          @click="resetAll"
        >
          ↩️ 恢复全部默认
        </button>
        <button
          class="btn"
          @click="doExport"
        >
          📤 导出
        </button>
        <button
          class="btn"
          @click="importInput?.click()"
        >
          📥 导入
        </button>
        <input
          ref="importInput"
          type="file"
          accept=".json"
          style="display:none"
          @change="doImport"
        >
      </div>
    </div>

    <!-- 说明 -->
    <div class="brief">
      <p>学段渲染参数（程序可读数据）：作文格宽、填空横线上限、书写载体、解答题空白区系数、方格纸规格等。消费者（docxBuilder/contentCleaner/themeConfig）调用 <code>getMergedSpec()</code> 读取合并后的值。</p>
      <p>与规则库分工：排版规格库承载格式<b>数值/参数</b>，规则库承载格式<b>逻辑/开关</b>。</p>
      <p>每组可独立启停：停用后该组用户覆盖不生效（按内置默认渲染），重新启用即恢复，不影响已保存的覆盖数据。</p>
    </div>

    <!-- 规格组手风琴 -->
    <div class="ls-list">
      <div
        v-if="!specShowList.length"
        class="ls-empty"
      >
        当前筛选无规格组（可切换上方状态筛选）
      </div>
      <div
        v-for="g in specShowList"
        :key="g.id"
        class="ls-card"
        :class="{ open: openGroup === g.id, editing: editingGroup === g.id, disabled: groupOff(g.id) }"
      >
        <div
          class="ls-head"
          @click="toggleGroup(g.id)"
        >
          <span class="arrow">{{ openGroup === g.id ? '▾' : '▸' }}</span>
          <span class="lib-tag">📏 规格</span>
          <span class="dim-name">{{ g.name }}</span>
          <span class="ls-desc">{{ g.desc }}</span>
          <span
            v-if="groupHasOverride(g)"
            class="src-user"
          >已自定义</span>
          <span class="ls-meta">{{ g.fields.length }} 参数</span>
          <label
            class="sw"
            :class="{ off: groupOff(g.id) }"
            title="停用后该组用户覆盖不生效（按内置默认渲染），可随时切回"
            @click.stop
          >
            <input
              type="checkbox"
              :checked="!groupOff(g.id)"
              @change="toggleGroupEnabled(g.id, $event.target.checked)"
            >
            <span>{{ groupOff(g.id) ? '已停用' : '启用' }}</span>
          </label>
        </div>

        <!-- 展开态：预览表格 -->
        <div
          v-if="openGroup === g.id && editingGroup !== g.id"
          class="ls-body"
        >
          <div
            v-if="groupOff(g.id)"
            class="off-banner"
          >
            ⏸ 已停用：本组用户覆盖不生效，按内置默认值渲染（重新启用即恢复）
          </div>
          <template v-if="g.matrix">
            <div
              v-for="s in g.matrix.subjects"
              :key="s.key"
              class="matrix-block"
            >
              <div class="matrix-title">
                {{ s.label }}<span
                  v-if="s.key === '*'"
                  class="matrix-tip"
                >通配默认（未显式定义的学科）</span>
              </div>
              <table class="ls-table matrix-table">
                <thead>
                  <tr>
                    <th>学段</th><th
                      v-for="p in g.matrix.params"
                      :key="p.key"
                    >
                      {{ p.label }}<span v-if="p.unit"> ({{ p.unit }})</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="st in g.matrix.stages"
                    :key="st.key"
                  >
                    <td class="matrix-stage">
                      {{ st.label }}
                    </td>
                    <td
                      v-for="p in g.matrix.params"
                      :key="p.key"
                      :class="{ modified: isModified(`ANSWER_REGION.${s.key}.${st.key}.${p.key}`) }"
                    >
                      {{ formatVal(getByPath(mergedSpec, `ANSWER_REGION.${s.key}.${st.key}.${p.key}`), p) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
          <table
            v-else
            class="ls-table"
          >
            <thead><tr><th>参数</th><th>当前值</th><th>内置默认</th><th>状态</th></tr></thead>
            <tbody>
              <tr
                v-for="f in g.fields"
                :key="f.path"
              >
                <td>{{ f.label }}</td>
                <td :class="{ modified: isModified(f.path) }">
                  {{ formatVal(getByPath(mergedSpec, f.path), f) }}
                </td>
                <td>{{ formatVal(getByPath(defaults, f.path), f) }}</td>
                <td>
                  <span
                    v-if="groupOff(g.id)"
                    class="off-tag"
                  >已停用</span>
                  <span
                    v-else-if="isModified(f.path)"
                    class="mod-tag"
                  >已修改</span>
                  <span
                    v-else
                    class="ok-tag"
                  >默认</span>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="ls-ops">
            <button
              class="btn"
              @click="startEdit(g)"
            >
              ✏️ 编辑
            </button>
            <button
              v-if="groupHasOverride(g)"
              class="btn danger"
              @click="resetGroup(g)"
            >
              ↩️ 恢复此组默认
            </button>
          </div>
        </div>

        <!-- 编辑态 -->
        <div
          v-if="editingGroup === g.id"
          class="ls-edit"
        >
          <div
            v-for="grp in editGroups(g)"
            :key="grp.title || 'all'"
            class="edit-grid"
          >
            <div
              v-if="grp.title"
              class="edit-sec-title"
            >
              {{ grp.title }}<span
                v-if="grp.title === '通配默认'"
                class="matrix-tip"
              >通配默认（未显式定义的学科）</span>
            </div>
            <div
              v-for="f in grp.fields"
              :key="f.path"
              class="edit-field"
            >
              <label>{{ f.label }}<span
                v-if="f.unit"
                class="unit"
              > ({{ f.unit }})</span></label>
              <template v-if="f.type === 'carrier'">
                <div class="carrier-chips">
                  <span
                    v-for="opt in (f.chipOptions || CARRIER_OPTIONS)"
                    :key="opt.value"
                    class="chip-sel"
                    :class="{ sel: (editValues[f.path] || []).includes(opt.value) }"
                    @click="toggleCarrier(f.path, opt.value)"
                  >{{ opt.label }}</span>
                </div>
              </template>
              <select
                v-else-if="f.type === 'ansCarrier'"
                v-model="editValues[f.path]"
              >
                <option
                  v-for="opt in ANS_CARRIER_OPTIONS"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
              <select
                v-else-if="f.type === 'select'"
                v-model="editValues[f.path]"
              >
                <option
                  v-for="opt in f.options"
                  :key="opt"
                  :value="opt"
                >
                  {{ opt }}
                </option>
              </select>
              <input
                v-else
                v-model="editValues[f.path]"
                :type="f.type === 'number' ? 'number' : 'text'"
                :step="f.step"
                :min="f.min"
                :max="f.max"
                :placeholder="f.placeholder"
              >
              <span
                v-if="f.type === 'number'"
                class="range-hint"
              >{{ f.min }}~{{ f.max }}</span>
            </div>
          </div>
          <div class="ls-ops">
            <button
              class="btn-p"
              @click="saveGroup(g)"
            >
              💾 保存
            </button>
            <button
              class="btn"
              @click="cancelEdit"
            >
              取消
            </button>
          </div>
          <p class="edit-tip">
            ※ 保存后即时生效（docxBuilder/contentCleaner/themeConfig 下次生成自动读取）；恢复默认仅清除此组覆盖。
          </p>
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
import { setLibToggle, listDisabledEntries } from '../../../utils/libToggles.js';

// ==================== 规格组定义 ====================
// 解答区参数矩阵（学科 × 学段）：通配默认/语文/英语/科学 × 5 学段 × (行分系数/行高/载体)
const ANSWER_SUBJECTS = [
  { key: '*', label: '通配默认' },
  { key: '语文', label: '语文' },
  { key: '英语', label: '英语' },
  { key: '科学', label: '科学' },
];
const ANSWER_STAGES = [
  { key: 'primary_low', label: '低段' },
  { key: 'primary_mid', label: '中段' },
  { key: 'primary_high', label: '高段' },
  { key: 'middle', label: '初中' },
  { key: 'high', label: '高中' },
];
/** 学段键 → 中文（预览 textArr 字段用，输入仍填英文键） */
const STAGE_LABEL_MAP = Object.fromEntries(ANSWER_STAGES.map((s) => [s.key, s.label]));
const ANSWER_MATRIX_PARAMS = [
  { key: 'linePerScore', label: '行/分', unit: '', type: 'number', min: 0.3, max: 3, step: 0.1 },
  { key: 'lineHeightMm', label: '行高', unit: 'mm', type: 'number', min: 4, max: 15, step: 0.5 },
  { key: 'carrier', label: '载体', unit: '', type: 'ansCarrier', options: ['line', 'blank'] },
];
const ANSWER_FIELDS = [];
for (const s of ANSWER_SUBJECTS) {
  for (const st of ANSWER_STAGES) {
    for (const p of ANSWER_MATRIX_PARAMS) {
      ANSWER_FIELDS.push({
        path: `ANSWER_REGION.${s.key}.${st.key}.${p.key}`,
        label: `${s.label}·${st.label} ${p.label}`,
        unit: p.unit, type: p.type, min: p.min, max: p.max, step: p.step, options: p.options,
        subject: s.key, subjectLabel: s.label, stageKey: st.key, stageLabel: st.label,
      });
    }
  }
}
const ANSWER_MATRIX = { subjects: ANSWER_SUBJECTS, stages: ANSWER_STAGES, params: ANSWER_MATRIX_PARAMS };

// 载体×题型规则（CARRIER_RULES）编辑用常量
const SUBJECT_OPTIONS = ['语文', '数学', '英语', '物理', '化学', '生物', '科学', '道法', '政治', '历史', '地理', '音乐', '美术', '体育', '信息'];
const GRID_OPTIONS = [
  { value: 'tian-zi-ge', label: '田字格' },
  { value: 'pinyin-line', label: '拼音格' },
  { value: 'four-line-three', label: '四线三格' },
  { value: 'mi-zi-ge', label: '米字格' },
  { value: 'square', label: '方格' },
];
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
      { path: 'ZUOWEN_DEFAULT_SPAN', label: '空格默认补全', unit: '格', type: 'number', min: 1, max: 10, step: 1 },
      { path: 'ZUOWEN_CELLS_PER_SCORE.primary_low', label: '低段每分格数', unit: '格/分', type: 'number', min: 2, max: 20, step: 1 },
      { path: 'ZUOWEN_CELLS_PER_SCORE.primary_mid', label: '中段每分格数', unit: '格/分', type: 'number', min: 2, max: 25, step: 1 },
      { path: 'ZUOWEN_CELLS_PER_SCORE.primary_high', label: '高段每分格数', unit: '格/分', type: 'number', min: 2, max: 30, step: 1 },
      { path: 'ZUOWEN_CELLS_PER_SCORE.middle', label: '初中每分格数', unit: '格/分', type: 'number', min: 2, max: 35, step: 1 },
      { path: 'ZUOWEN_CELLS_PER_SCORE.high', label: '高中每分格数', unit: '格/分', type: 'number', min: 2, max: 40, step: 1 },
    ],
  },
  {
    id: 'blank',
    name: '填空规格',
    desc: '横线宽度/字数换算（contentCleaner · normalizeBlankMarkers）',
    fields: [
      { path: 'BLANK.maxCap', label: '宽度上限', unit: 'em', type: 'number', min: 8, max: 24, step: 1 },
      { path: 'BLANK.wordGap', label: '1字位≈N em', unit: 'em', type: 'number', min: 1, max: 4, step: 0.5 },
      { path: 'BLANK.minBlank', label: '最小 blank-N', unit: '', type: 'number', min: 1, max: 24, step: 1 },
      { path: 'BLANK.maxBlank', label: '最大 blank-N', unit: '', type: 'number', min: 10, max: 24, step: 1 },
    ],
  },
  {
    id: 'carrier',
    name: '书写载体',
    desc: '学科×学段允许载体（examValidator writing-grid-fix 读取；未定义的学科不检测）',
    fields: [
      { path: 'WRITING_CARRIER.语文.primary_low', label: '语文·低段', type: 'carrier' },
      { path: 'WRITING_CARRIER.语文.primary_mid', label: '语文·中段', type: 'carrier' },
      { path: 'WRITING_CARRIER.语文.primary_high', label: '语文·高段', type: 'carrier' },
      { path: 'WRITING_CARRIER.语文.middle', label: '语文·初中', type: 'carrier' },
      { path: 'WRITING_CARRIER.语文.high', label: '语文·高中', type: 'carrier' },
      { path: 'WRITING_CARRIER.英语.primary_low', label: '英语·低段', type: 'carrier' },
      { path: 'WRITING_CARRIER.英语.primary_mid', label: '英语·中段', type: 'carrier' },
      { path: 'WRITING_CARRIER.英语.primary_high', label: '英语·高段', type: 'carrier' },
      { path: 'WRITING_CARRIER.英语.middle', label: '英语·初中', type: 'carrier' },
      { path: 'WRITING_CARRIER.英语.high', label: '英语·高中', type: 'carrier' },
      { path: 'GRID_CELL.tian-zi-ge.primary.widthMm', label: '田字格·小学宽', unit: 'mm', type: 'number', min: 6, max: 20, step: 0.5 },
      { path: 'GRID_CELL.tian-zi-ge.primary.heightMm', label: '田字格·小学高', unit: 'mm', type: 'number', min: 6, max: 20, step: 0.5 },
    ],
  },
  {
    id: 'answer',
    name: '解答区',
    desc: '学科×学段：行数=分值×系数 · 行高 · 载体（examValidator answer-area-fix 读取；语文/英语/科学横线、其余空白）',
    matrix: ANSWER_MATRIX,
    fields: ANSWER_FIELDS,
  },
  {
    id: 'square',
    name: '方格纸/括号格',
    desc: '作图方格纸（小学段；SQUARE_GRID）+ 竖式括号格（BRACKET_GRID）· themeConfig/RichTextEditor/docxBuilder 读取',
    fields: [
      { path: 'SQUARE_GRID.primary.cols', label: '方格纸 列数', unit: '', type: 'number', min: 6, max: 20, step: 1 },
      { path: 'SQUARE_GRID.primary.rows', label: '方格纸 行数', unit: '', type: 'number', min: 4, max: 20, step: 1 },
      { path: 'SQUARE_GRID.primary.cellMm', label: '方格纸 格边长', unit: 'mm', type: 'number', min: 4, max: 12, step: 0.5 },
      { path: 'BRACKET_GRID.rowHeightMm', label: '括号格 行高', unit: 'mm', type: 'number', min: 5, max: 20, step: 0.5 },
      { path: 'BRACKET_GRID.widthMm', label: '括号格 宽度', unit: 'mm', type: 'number', min: 30, max: 100, step: 1 },
      { path: 'ZUOWEN_FILL_CELLS', label: '作文格自动补全数', unit: '格', type: 'number', min: 50, max: 400, step: 10 },
    ],
  },
  {
    id: 'carrier-rules',
    name: '载体×题型规则',
    desc: '必备规则（must）=写字/抄写类该用格子却没用→提示抽检；禁用规则（forbid）=表达/写话类禁混入格子→出现自动剥离。examValidator writing-grid-fix 读取',
    fields: [
      { path: 'CARRIER_RULES.must.0.subject', label: '必备规则1·学科', type: 'select', options: SUBJECT_OPTIONS },
      { path: 'CARRIER_RULES.must.0.stages', label: '必备规则1·学段（逗号分隔）', type: 'textArr', stageArr: true, placeholder: '学段键，如 primary_low（小学低段）' },
      { path: 'CARRIER_RULES.must.0.keywords', label: '必备规则1·题型关键词（|分隔）', type: 'text' },
      { path: 'CARRIER_RULES.must.0.carrier', label: '必备规则1·必须载体', type: 'select', options: GRID_OPTIONS.map((o) => o.value) },
      { path: 'CARRIER_RULES.must.1.subject', label: '必备规则2·学科', type: 'select', options: SUBJECT_OPTIONS },
      { path: 'CARRIER_RULES.must.1.stages', label: '必备规则2·学段（逗号分隔）', type: 'textArr', stageArr: true, placeholder: '学段键，如 primary_low（小学低段）' },
      { path: 'CARRIER_RULES.must.1.keywords', label: '必备规则2·题型关键词（|分隔）', type: 'text' },
      { path: 'CARRIER_RULES.must.1.carrier', label: '必备规则2·必须载体', type: 'select', options: GRID_OPTIONS.map((o) => o.value) },
      { path: 'CARRIER_RULES.must.2.subject', label: '必备规则3·学科', type: 'select', options: SUBJECT_OPTIONS },
      { path: 'CARRIER_RULES.must.2.stages', label: '必备规则3·学段（逗号分隔）', type: 'textArr', stageArr: true, placeholder: '学段键，如 primary_mid（小学中段）' },
      { path: 'CARRIER_RULES.must.2.keywords', label: '必备规则3·题型关键词（|分隔）', type: 'text' },
      { path: 'CARRIER_RULES.must.2.carrier', label: '必备规则3·必须载体', type: 'select', options: GRID_OPTIONS.map((o) => o.value) },
      { path: 'CARRIER_RULES.forbid.0.keywords', label: '禁用规则·题型关键词（|分隔）', type: 'text' },
      { path: 'CARRIER_RULES.forbid.0.carriers', label: '禁用规则·禁用的载体（多选）', type: 'carrier', chipOptions: GRID_OPTIONS },
    ],
  },
];

// ==================== 辅助函数 ====================
const CARRIER_OPTIONS = [
  { value: 'tian-zi-ge', label: '田字格' },
  { value: 'pinyin-line', label: '拼音格' },
  { value: 'four-line-three', label: '四线三格' },
  { value: 'square', label: '方格' },
  { value: 'line', label: '横线' },
  { value: 'mi-zi-ge', label: '米字格' },
];
const CARRIER_LABEL = Object.fromEntries(CARRIER_OPTIONS.map((o) => [o.value, o.label]));
const ANS_CARRIER_OPTIONS = [
  { value: 'line', label: '横线' },
  { value: 'blank-area', label: '空白' },
];

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
  if (f.type === 'textArr') {
    const arr = Array.isArray(v) ? v : String(v || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    if (!arr.length) return '—';
    return arr.map((x) => (f.stageArr ? (STAGE_LABEL_MAP[x] || x) : x)).join('、');
  }
  if (Array.isArray(v)) {
    if (!v.length) return '（无，默认横线）';
    return v.map((x) => CARRIER_LABEL[x] || x).join('、');
  }
  if (f.type === 'ansCarrier') return v === 'line' ? '横线' : v === 'blank-area' ? '空白' : String(v);
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

// ==================== 规格组启停开关 ====================
// 停用 = 该组用户覆盖不生效（回退内置默认），见 getMergedSpec 的 LAYOUT_SPEC_GROUPS 过滤
const disabledGroups = ref(new Set(listDisabledEntries('layout-spec')));
const groupOff = (gid) => disabledGroups.value.has(gid);
const toggleGroupEnabled = (gid, on) => {
  setLibToggle('layout-spec', gid, on);
  const next = new Set(disabledGroups.value);
  if (on) next.delete(gid); else next.add(gid);
  disabledGroups.value = next;
};

/* ===== 状态筛选（全部/启用/停用，点击计数过滤列表） ===== */
const specFilter = ref('all'); // all | on | off
const specCounts = computed(() => {
  let on = 0, off = 0;
  for (const g of SPEC_GROUPS) { if (groupOff(g.id)) off++; else on++; }
  return { total: SPEC_GROUPS.length, on, off };
});
const specShowList = computed(() => SPEC_GROUPS.filter((g) => {
  if (specFilter.value === 'on' && groupOff(g.id)) return false;
  if (specFilter.value === 'off' && !groupOff(g.id)) return false;
  return true;
}));

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
    const v = getByPath(spec, f.path);
    editValues.value[f.path] = f.type === 'textArr'
      ? (Array.isArray(v) ? v.join(',') : (v ?? ''))
      : (Array.isArray(v) ? [...v] : v);
  }
};

/** 编辑态分节（矩阵组按学科分节渲染，其余组整组一栏） */
const editGroups = (g) => {
  if (!g.matrix) return [{ title: '', fields: g.fields }];
  return g.matrix.subjects.map((s) => ({ title: s.label, fields: g.fields.filter((f) => f.subject === s.key) }));
};

const cancelEdit = () => { editingGroup.value = ''; };

const toggleCarrier = (path, val) => {
  const arr = editValues.value[path] || [];
  const i = arr.indexOf(val);
  if (i >= 0) arr.splice(i, 1);
  else arr.push(val);
  editValues.value[path] = [...arr];
};

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
    if (f.type === 'textArr') val = String(val || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    if (f.type === 'carrier') {
      // 空数组 = 移除该覆盖（回退内置）
      if (Array.isArray(val) && !val.length) {
        override = setByPath(override, f.path, undefined);
        continue;
      }
    }
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
.ls-empty { font-size: 12.5px; color: var(--text-muted); background: var(--bg-card); border: 1px dashed var(--border-light); border-radius: 8px; padding: 14px; text-align: center; }

/* 状态计数 chips（与指令/蓝图/规则/渲染契约视图同款） */
.st-chips { display: inline-flex; gap: 6px; }
.st-chip { border: 1px solid var(--border); background: #fff; border-radius: 999px; padding: 2px 10px; font-size: 11.5px; cursor: pointer; color: var(--text-muted); }
.st-chip:hover { border-color: var(--primary-light); color: var(--primary); }
.st-chip.on { color: #2e7d32; }
.st-chip.off { color: #c0392b; }
.st-chip.sel { background: var(--primary); color: #fff; border-color: var(--primary); font-weight: 600; }
.st-chip.sel:hover { color: #fff; }
.st-chip.on.sel { background: #2e7d32; border-color: #2e7d32; }
.st-chip.off.sel { background: #c0392b; border-color: #c0392b; }
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

/* 启停开关（与蓝图/指令/渲染契约视图同款） */
.sw { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: #2e7d32; cursor: pointer; user-select: none; }
.sw input { width: 13px; height: 13px; accent-color: #2e7d32; cursor: pointer; }
.sw.off { color: #c0392b; }
.sw.off input { accent-color: #c0392b; }
.ls-card.disabled .ls-head { opacity: .55; }
.off-banner { font-size: 12px; color: #a06a10; background: #fdf3e2; border: 1px solid #f3d9a8; border-radius: 6px; padding: 6px 10px; margin-bottom: 8px; }
.off-tag { font-size: 10.5px; font-weight: 700; color: #c0392b; background: #fdeeee; border-radius: 999px; padding: 1px 8px; }

.ls-body { border-top: 1px dashed var(--border-light); padding: 10px 14px 14px; }
.ls-table { border-collapse: collapse; width: 100%; font-size: 12.5px; }
.ls-table th { text-align: left; background: var(--primary-lighter, #eef4ff); color: var(--primary); font-weight: 600; padding: 6px 10px; border-bottom: 1px solid var(--border-light); white-space: nowrap; }
.ls-table td { padding: 6px 10px; border-bottom: 1px solid var(--border-light); }
.ls-table tr:last-child td { border-bottom: none; }
/* 矩阵化：学科分节 × 学段/参数二维表 */
.matrix-block { margin-bottom: 10px; border: 1px solid var(--border-light); border-radius: 8px; padding: 8px 10px; }
.matrix-block:last-child { margin-bottom: 0; }
.matrix-title { font-size: 12.5px; font-weight: 700; color: #26303e; margin-bottom: 6px; }
.matrix-tip { font-size: 11px; font-weight: 400; color: var(--text-muted); margin-left: 8px; }
.matrix-table td { text-align: center; }
.matrix-table td:first-child { font-weight: 600; color: var(--primary); }
.matrix-stage { white-space: nowrap; }
/* 编辑态分节标题 */
.edit-sec-title { grid-column: 1 / -1; font-size: 12.5px; font-weight: 700; color: #26303e; border-bottom: 1px dashed var(--border-light); padding-bottom: 4px; margin-top: 4px; }
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
.carrier-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip-sel { font-size: 11.5px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border); cursor: pointer; background: #fff; color: #556; }
.chip-sel.sel { background: var(--primary); color: #fff; border-color: var(--primary); }
.edit-tip { font-size: 11.5px; color: var(--text-muted); margin: 8px 0 0; }

.btn { border: 1px solid var(--border); background: #fff; border-radius: 6px; padding: 5px 12px; font-size: 12.5px; cursor: pointer; }
.btn:hover { background: var(--primary-lighter); color: var(--primary); }
.btn.danger { color: var(--danger); border-color: var(--danger-light); }
.btn-p { border: none; background: var(--primary); color: #fff; border-radius: 6px; padding: 6px 14px; font-size: 13px; cursor: pointer; }
.btn-p:hover { background: var(--primary-light); }
</style>
