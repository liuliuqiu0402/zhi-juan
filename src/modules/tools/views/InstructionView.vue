<template>
  <div class="tpl-page">
    <!-- 概览条（吸顶） -->
    <div class="tpl-overview">
      <div>
        <span class="lib-badge">📝 指令库</span>
        <b>模板 {{ tplList.length }} / {{ totalCount }}</b>
        <span class="ov-sep">·</span>
        <span>用户自定义 <b class="user-n">{{ userCount }}</b></span>
        <span class="ov-sep">·</span>
        <span class="st-chips">
          <button
            class="st-chip"
            :class="{ sel: statusFilter === 'all' }"
            @click="statusFilter = 'all'"
          >全部 {{ statusCounts.total }}</button>
          <button
            class="st-chip on"
            :class="{ sel: statusFilter === 'on' }"
            @click="statusFilter = 'on'"
          >启用 {{ statusCounts.on }}</button>
          <button
            class="st-chip off"
            :class="{ sel: statusFilter === 'off' }"
            @click="statusFilter = 'off'"
          >停用 {{ statusCounts.off }}</button>
        </span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div class="dim-now">
          <span
            class="dimb"
            :title="dims.stage ? STAGE_LABELS[dims.stage] : '全部学段'"
          >{{ dims.stage ? STAGE_LABELS[dims.stage] : '全部学段' }}</span>
          <span class="dimb">{{ dims.subject || '全部学科' }}</span>
          <span class="dimb">{{ dims.genType ? GEN_TYPE_LABELS[dims.genType] : '全部类型' }}</span>
        </div>
        <button
          class="btn-p"
          @click="openNew"
        >
          ＋ 新增模板
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

    <!-- 课标版本声明（新课标发布后需人工核对更新，见 promptLibrary.CURRICULUM_VERSION_INFO） -->
    <div class="tpl-curriculum">
      📚 课标版本：{{ curriculumNotice }}<span class="check-tip">💡 提示：本应用不自动检测课标版本发布，请关注教育部官网动态，新版发布后请在此人工核对并更新本库表述</span>
    </div>

    <!-- 校验结果 -->
    <div
      v-if="validateMsgs.length"
      class="tpl-validate"
    >
      <div class="v-head">
        🔍 模板完整性校验
      </div>
      <div
        v-for="(m, i) in validateMsgs"
        :key="i"
        class="v-item"
        :class="`sev-${m.severity}`"
      >
        <span class="v-code">{{ m.code }}</span> {{ m.detail }}
      </div>
    </div>
    <div
      v-else
      class="tpl-validate ok"
    >
      ✅ 模板完整性校验通过（当前筛选范围）
    </div>

    <!-- 模板列表（手风琴） -->
    <h4 class="tpl-h">
      🧾 创作模板<span class="hint">点击名称展开/收起 · 展开后可编辑</span>
    </h4>
    <div class="tpl-list">
      <div
        v-for="t in tplList"
        :key="t.key"
        class="tpl-card"
        :class="{ open: openKey === t.key, editing: editingKey === t.key, disabled: tplOff(t.key) }"
      >
        <div
          class="tpl-head"
          @click="toggle(t.key)"
        >
          <span class="arrow">{{ openKey === t.key ? '▾' : '▸' }}</span>
          <span class="lib-tag">📝 指令库</span>
          <span
            class="layer-tag"
            :class="`ly-${t.layer}`"
          >{{ layerLabel(t) }}</span>
          <span class="dim-name">{{ tplDimName(t) }}</span>
          <span
            class="key-hint"
            :title="'数据键：' + t.key"
          >{{ t.key }}</span>
          <span class="tpl-meta">{{ t.template.length }} 字</span>
          <label
            class="sw"
            :class="{ off: tplOff(t.key) }"
            title="停用后生成端不命中此模板（自动落回下一级匹配）"
            @click.stop
          >
            <input
              type="checkbox"
              :checked="!tplOff(t.key)"
              @change="toggleTpl(t.key, $event.target.checked)"
            >
            <span>{{ tplOff(t.key) ? '已停用' : '启用' }}</span>
          </label>
        </div>

        <!-- 展开态：预览 -->
        <div
          v-if="openKey === t.key && editingKey !== t.key"
          class="tpl-body"
        >
          <pre class="tpl-preview">{{ t.template }}</pre>
          <div class="tpl-ops">
            <button
              v-if="t.layer === 'cell' || t.source === 'user'"
              class="btn"
              @click="startEdit(t)"
            >
              {{ t.layer === 'cell' ? '✏️ 编辑（保存后覆盖内置，可恢复默认）' : '✏️ 编辑' }}
            </button>
            <button
              class="btn"
              @click="copyTpl(t)"
            >
              📋 复制
            </button>
            <button
              v-if="t.source === 'user'"
              class="btn danger"
              @click="removeTpl(t)"
            >
              🗑️ 删除自定义/恢复默认
            </button>
          </div>
        </div>

        <!-- 编辑态 -->
        <div
          v-if="editingKey === t.key"
          class="tpl-edit"
        >
          <div class="edit-grid">
            <label>名称 <input
              v-model="draft.name"
              placeholder="模板名称"
            ></label>
            <label>数据键 <input
              :value="editingKey"
              disabled
            ></label>
          </div>
          <textarea
            v-model="draft.template"
            rows="10"
            class="tpl-editarea"
            placeholder="模板正文（占位符 {grade}/{subject}/{unit}/{structure}/{fullScore}/{duration}/{extra} 生成时替换）"
          />
          <div class="tpl-ops">
            <button
              class="btn-p"
              @click="saveDraft(editingKey)"
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
        </div>
      </div>
      <div
        v-if="!tplList.length"
        class="tpl-empty"
      >
        当前筛选无模板（可放宽筛选）
      </div>
    </div>

    <!-- 新增模板弹层 -->
    <div
      v-if="newOpen"
      class="modal-mask"
      @click.self="newOpen = false"
    >
      <div class="modal">
        <h4>＋ 新增模板（自定义覆盖或新建）</h4>
        <div class="edit-grid modal-grid">
          <label>学段
            <select v-model="newForm.stage">
              <option value="">全部学段</option>
              <option
                v-for="(l, k) in STAGE_LABELS"
                :key="k"
                :value="k"
              >{{ l }}</option>
            </select>
          </label>
          <label>学科
            <select v-model="newForm.subject">
              <option value="">全学科</option>
              <option
                v-for="s in SUBJECT_KEYS"
                :key="s"
                :value="s"
              >{{ s }}</option>
            </select>
          </label>
          <label>资料类型
            <select v-model="newForm.genType">
              <option
                v-for="t in GEN_TYPE_LABELS"
                :key="t.key"
                :value="t.key"
              >{{ t.label }}</option>
            </select>
          </label>
        </div>
        <p class="modal-tip">
          模板键 = 学段|学科|类型（三维度精确）或 学段|类型 / 类型（降级）。生成时按 学段×学科×类型 精确匹配，用户自定义优先；可建降级模板覆盖更广范围。
        </p>
        <div class="tpl-ops">
          <button
            class="btn-p"
            @click="createTpl"
          >
            创建并编辑
          </button>
          <button
            class="btn"
            @click="newOpen = false"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue';
import { listPromptTemplates, savePromptTemplate, deletePromptTemplate, BUILTIN_TEMPLATES, CURRICULUM_VERSION_INFO, GEN_TYPE_NAMES } from '../../../config/promptLibrary.js';
import { SUBJECT_KEYS } from '../../../config/toolLibrary.js';
import { exportLibrary, importLibrary, readLib, writeLib } from '../../../utils/libraryIO.js';
import { setLibToggle, listDisabledEntries } from '../../../utils/libToggles.js';

const dims = inject('toolDims', { value: { stage: '', subject: '', genType: '' } });
const refreshLibStats = inject('refreshLibStats', () => {});

/** 课标版本声明（指令库面板展示；新课标发布后人工核对更新，见 CURRICULUM_VERSION_INFO 注释） */
const curriculumNotice = CURRICULUM_VERSION_INFO.notice;

/* ===== 全部/启用/停用 状态筛选（停用条目灰显，点击计数过滤列表） ===== */
const statusFilter = ref('all'); // all | on | off

/* ===== 条目启用/停用开关（停用 = 不命中，自动落下一级，见 getPromptTemplate） ===== */
const disabledTpl = ref(new Set(listDisabledEntries('instruction')));
const tplOff = (key) => disabledTpl.value.has(key);
const toggleTpl = (key, on) => {
  setLibToggle('instruction', key, on);
  const next = new Set(disabledTpl.value);
  if (on) next.delete(key); else next.add(key);
  disabledTpl.value = next;
};

const STAGE_LABELS = {
  primary_low: '小学低段（1-2年级）', primary_mid: '小学中段（3-4年级）', primary_high: '小学高段（5-6年级）', middle: '初中（7-9年级）', high: '高中',
};
// 🔴 类型中文名单一事实源 = promptLibrary.GEN_TYPE_NAMES（曾本地写"正式试卷"等异名，与正式考卷等漂移）
const GEN_TYPE_KEYS_ALL = ['exam', 'practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review'];
const GEN_TYPE_LABELS = GEN_TYPE_KEYS_ALL.map((k) => ({ key: k, label: GEN_TYPE_NAMES[k] || k }));
const GEN_TYPE_NAME = Object.fromEntries(GEN_TYPE_LABELS.map((t) => [t.key, t.label]));

/* ===== 数据源 ===== */
const allTpl = ref(listPromptTemplates());
const totalCount = computed(() => Object.keys(BUILTIN_TEMPLATES).filter((k) => k.includes('|')).length); // 内置三维度 cell（学段×学科×类型，仅实际开设组合）
const userCount = computed(() => allTpl.value.filter((t) => t.source === 'user').length);
const reload = () => { allTpl.value = listPromptTemplates(); refreshLibStats(); };

/* ===== 手风琴 ===== */
const openKey = ref('');
const toggle = (key) => { openKey.value = openKey.value === key ? '' : key; };

/* ===== key 三维度解析 ===== */
const parseKey = (key) => {
  const parts = String(key || '').split('|');
  const genType = parts[parts.length - 1] || '';
  const stage = parts.length >= 3 ? parts[0] : parts.length === 2 ? parts[0] : '';
  const subject = parts.length >= 3 ? parts[1] : '';
  return { stage, subject, genType };
};
/** 条目名称：三维度中文（学段 · 学科 · 类型） */
const tplDimName = (t) => {
  const { stage, subject, genType } = parseKey(t.key);
  const parts = [];
  if (stage) parts.push(STAGE_LABELS[stage]);
  if (subject) parts.push(subject);
  if (genType && GEN_TYPE_NAME[genType]) parts.push(GEN_TYPE_NAME[genType]);
  return parts.join(' · ') || t.key;
};
const layerLabel = (t) => (t.source === 'user' ? '已自定义' : '内置');

/* ===== 三维度筛选（按 key 解析匹配） ===== */
const dimList = computed(() =>
  allTpl.value.filter((t) => {
    const { stage, subject, genType } = parseKey(t.key);
    if (dims.value.stage && stage && stage !== dims.value.stage) return false;
    if (dims.value.subject && subject && subject !== dims.value.subject) return false;
    if (dims.value.genType && genType && genType !== dims.value.genType) return false;
    return true;
  })
);
/* 状态计数（基于三维度筛选结果，点击计数可过滤列表） */
const statusCounts = computed(() => {
  let on = 0, off = 0;
  for (const t of dimList.value) { if (tplOff(t.key)) off++; else on++; }
  return { total: dimList.value.length, on, off };
});
const tplList = computed(() => dimList.value.filter((t) => {
  if (statusFilter.value === 'on' && tplOff(t.key)) return false;
  if (statusFilter.value === 'off' && !tplOff(t.key)) return false;
  return true;
}));

/* ===== 轻量校验：模板非空 + 数据键格式 ===== */
const validateMsgs = computed(() => {
  const msgs = [];
  for (const t of tplList.value) {
    if (!t.template || !String(t.template).trim()) {
      msgs.push({ code: 'T1', severity: 'error', detail: `${t.key}: 模板内容为空（生成时会退到通用模板）` });
    }
    const { genType } = parseKey(t.key);
    if (!genType || !GEN_TYPE_NAME[genType]) {
      msgs.push({ code: 'T2', severity: 'warning', detail: `${t.key}: 数据键资料类型无法识别` });
    }
  }
  return msgs;
});

/* ===== 编辑 / 保存 / 删除 / 新增 ===== */
const editingKey = ref('');
const draft = ref({ name: '', template: '' });

const startEdit = (t) => {
  editingKey.value = t.key;
  draft.value = { name: t.name || t.key, template: t.template || '' };
  openKey.value = t.key;
};
const cancelEdit = () => { editingKey.value = ''; draft.value = null; };
const saveDraft = (key) => {
  if (!draft.value || !String(draft.value.template || '').trim()) { window.alert('模板内容不能为空'); return; }
  const ok = savePromptTemplate(key, { name: draft.value.name || key, template: draft.value.template });
  if (ok) { reload(); editingKey.value = ''; draft.value = null; }
  else window.alert('保存失败');
};
const removeTpl = (t) => {
  if (!window.confirm(`删除「${t.key}」的自定义版本？删除后回退内置默认。`)) return;
  deletePromptTemplate(t.key);
  reload();
  if (openKey.value === t.key) openKey.value = '';
};

/* ===== 新增模板 ===== */
const newOpen = ref(false);
const newForm = ref({ stage: '', subject: '', genType: 'exam' });
const openNew = () => { newForm.value = { stage: '', subject: '', genType: 'exam' }; newOpen.value = true; };
const createTpl = () => {
  const { stage, subject, genType } = newForm.value;
  if (!genType) { window.alert('请选择资料类型'); return; }
  const key = [stage, subject, genType].filter(Boolean).join('|');
  const label = `${stage ? STAGE_LABELS[stage] + '·' : ''}${subject || '全学科'}·${GEN_TYPE_NAME[genType]}`;
  savePromptTemplate(key, { name: `${label}（自定义）`, template: '' });
  newOpen.value = false;
  reload();
  openKey.value = key;
  const t = allTpl.value.find((x) => x.key === key);
  if (t) startEdit(t);
};

/* ===== 复制模板 ===== */
const copyTpl = (t) => {
  const newKey = `${t.key}_副本`;
  savePromptTemplate(newKey, { name: `${t.name}（副本）`, template: t.template });
  reload();
  openKey.value = newKey;
  const nt = allTpl.value.find((x) => x.key === newKey);
  if (nt) startEdit(nt);
};

/* ===== 导入/导出 ===== */
const importInput = ref(null);
const TPL_USER_KEY = 'wisdom_prompt_library_v1';
const doExport = () => {
  exportLibrary('instruction', readLib(TPL_USER_KEY));
};
const doImport = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const data = await importLibrary(file);
    if (typeof data !== 'object' || data === null) throw new Error('数据格式不正确');
    writeLib(TPL_USER_KEY, data);
    window.alert(`导入成功（${Object.keys(data).length} 条自定义模板）。`);
    reload();
  } catch (err) {
    window.alert('导入失败：' + err.message);
  }
  e.target.value = '';
};

</script>

<style scoped>
.tpl-page { padding: 18px 22px 30px; max-width: 1080px; }
/* 条目启用/停用开关（停用卡片灰显） */
.sw { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; font-size: 12px; color: #2e7d32; user-select: none; white-space: nowrap; }
.sw.off { color: #c0392b; }
.sw input { accent-color: var(--primary); cursor: pointer; }
.tpl-card.disabled .tpl-head { opacity: .55; }
.tpl-overview { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-size: 13px; background: var(--bg); border: 1px solid var(--border-light); border-radius: 10px; padding: 10px 14px; box-shadow: 0 2px 6px rgba(30,58,111,.06); }
/* 状态计数 chip（全部/启用/停用，点击过滤列表） */
.st-chips { display: inline-flex; gap: 6px; margin-left: 6px; }
.st-chip { border: 1px solid var(--border); background: #fff; border-radius: 999px; padding: 2px 10px; font-size: 11.5px; cursor: pointer; color: var(--text-muted); }
.st-chip:hover { border-color: var(--primary-light); color: var(--primary); }
.st-chip.on { color: #2e7d32; }
.st-chip.off { color: #c0392b; }
.st-chip.sel { background: var(--primary); color: #fff; border-color: var(--primary); font-weight: 600; }
.st-chip.sel:hover { color: #fff; }
.st-chip.on.sel { background: #2e7d32; border-color: #2e7d32; }
.st-chip.off.sel { background: #c0392b; border-color: #c0392b; }
/* 课标版本声明条（含静态提示：系统不自动检测课标发布，需人工关注官方动态） */
.tpl-curriculum { margin-top: 10px; font-size: 12.5px; line-height: 1.7; color: #5b4005; background: #fdf3e2; border: 1px solid #f3d9a8; border-radius: 8px; padding: 8px 12px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.check-tip { font-size: 12px; color: #8a6d1c; }
.lib-badge { display: inline-block; font-size: 12px; font-weight: 700; color: #fff; background: var(--primary); border-radius: 6px; padding: 3px 10px; margin-right: 10px; }
.ov-sep { margin: 0 8px; color: #c2ccda; }
.user-n { color: var(--primary); }
.dim-now { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.dimb { font-size: 12px; padding: 2px 10px; border-radius: 6px; background: var(--primary-lighter); color: var(--primary); border: 1px solid #c9d8ee; max-width: 132px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.btn-p { border: none; background: var(--primary); color: #fff; border-radius: 6px; padding: 6px 14px; font-size: 13px; cursor: pointer; }
.btn-p:hover { background: var(--primary-light); }
.btn { border: 1px solid var(--border); background: #fff; border-radius: 6px; padding: 5px 12px; font-size: 12.5px; cursor: pointer; }
.btn:hover { background: var(--primary-lighter); color: var(--primary); }
.btn.danger { color: var(--danger); border-color: var(--danger-light); }

.tpl-validate { margin-top: 12px; background: #fff; border: 1px solid var(--border-light); border-radius: 10px; padding: 10px 14px; font-size: 12.5px; }
.tpl-validate.ok { color: #1d7a4a; background: var(--success-light); border-color: #bfe6cd; }
.v-head { font-weight: 600; color: var(--primary); margin-bottom: 6px; }
.v-item { margin: 3px 0; }
.v-item.sev-error { color: var(--danger); }
.v-item.sev-warning { color: #a06a10; }
.v-code { font-family: Consolas, monospace; font-weight: 700; }

.tpl-h { font-size: 14px; color: var(--primary); margin: 22px 0 10px; }
.hint { font-size: 11.5px; color: var(--text-muted); font-weight: 400; margin-left: 8px; }
.tpl-list { display: flex; flex-direction: column; gap: 8px; }
.tpl-card { background: #fff; border: 1px solid var(--border-light); border-radius: 10px; overflow: hidden; }
.tpl-card.open { border-color: var(--primary-light); box-shadow: 0 2px 10px rgba(30,58,111,.08); }
.tpl-head { display: flex; align-items: center; gap: 8px; padding: 10px 14px; cursor: pointer; flex-wrap: wrap; }
.tpl-head:hover { background: var(--primary-lighter); }
.arrow { color: var(--accent); font-weight: 700; }
.lib-tag { display: inline-block; font-size: 11px; font-weight: 700; color: #fff; background: var(--primary); border-radius: 6px; padding: 2px 8px; }
.dim-name { font-weight: 700; font-size: 13.5px; color: #26303e; }
.key-hint { font-size: 11px; color: var(--text-muted); font-weight: 400; }
.src-user { font-size: 10.5px; font-weight: 600; color: #a06a10; background: #fdf3e2; border: 1px solid #f3d9a8; border-radius: 999px; padding: 1px 8px; }
.layer-tag { font-size: 10.5px; font-weight: 700; border-radius: 999px; padding: 1px 8px; }
.ly-cell { background: var(--primary-lighter); color: var(--primary); border: 1px solid #c9d8ee; }
.ly-user { background: #fdf3e2; color: #a06a10; border: 1px solid #f3d9a8; }
.readonly-tip { font-size: 11.5px; color: var(--text-muted); }
.tpl-meta { font-size: 12px; color: var(--text-muted); margin-left: auto; }
.tpl-body { border-top: 1px dashed var(--border-light); padding: 10px 14px 14px; }
.tpl-preview { white-space: pre-wrap; word-break: break-all; font-size: 12px; line-height: 1.7; color: #445; background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 8px; padding: 10px 12px; max-height: 260px; overflow: auto; margin: 0; }
.tpl-ops { display: flex; gap: 8px; margin-top: 10px; }
.tpl-edit { border-top: 1px dashed var(--border-light); padding: 12px 14px 14px; background: var(--primary-lighter); }
.edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
.edit-grid label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-muted); }
.edit-grid input, .edit-grid select { border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; font-size: 13px; background: #fff; }
.tpl-editarea { width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 10px; font-size: 12.5px; font-family: inherit; line-height: 1.7; resize: vertical; background: #fff; }
.tpl-empty { color: var(--text-muted); font-size: 13px; padding: 10px 4px; }

.modal-mask { position: fixed; inset: 0; background: rgba(30,42,64,.45); display: flex; align-items: center; justify-content: center; z-index: 999; }
.modal { background: #fff; border-radius: 12px; padding: 20px 22px; width: 480px; max-width: 92vw; box-shadow: 0 12px 40px rgba(0,0,0,.25); }
.modal h4 { margin: 0 0 14px; color: var(--primary); }
.modal-grid { grid-template-columns: 1fr 1fr 1fr; }
.modal-tip { font-size: 12px; color: var(--text-muted); margin: 10px 0; }
</style>
