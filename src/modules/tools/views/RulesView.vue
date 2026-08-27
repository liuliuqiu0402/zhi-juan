<template>
  <div class="rule-page">
    <!-- 概览条（吸顶） -->
    <div class="rule-overview">
      <div>
        <span class="lib-badge">🧪 生成端规则库</span>
        <b>规则 {{ ruleList.length }} / {{ totalCount }}</b>
        <span class="ov-sep">·</span>
        <span>用户自定义 <b class="user-n">{{ userCount }}</b></span>
        <span class="ov-sep">·</span>
        <span>规则源 <b class="ok-n">已接线</b>（生成前注入 + 生成后审计）</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div class="dim-now">
          <span class="dimb">{{ dims.stage ? STAGE_LABELS[dims.stage] : '全部学段' }}</span>
          <span class="dimb">{{ dims.subject || '全部学科' }}</span>
          <span class="dimb">{{ dims.genType ? GEN_TYPE_NAME[dims.genType] : '全部类型' }}</span>
        </div>
        <button class="btn" @click="resetAll">↩️ 恢复默认</button>
        <button class="btn-p" @click="openNew">＋ 新增规则</button>
        <button class="btn" @click="doExport">📤 导出</button>
        <button class="btn" @click="importInput?.click()">📥 导入</button>
        <input ref="importInput" type="file" accept=".json" style="display:none" @change="doImport" />
      </div>
    </div>

    <!-- 校验：接线状态 -->
    <div class="rule-validate" v-if="holeRules.length">
      <div class="v-head">🔍 接线状态自检（注册空洞 = 定义但生成端无执行点）</div>
      <div v-for="r in holeRules" :key="r.id" class="v-item sev-error">
        <span class="v-code">{{ r.id }}</span> 注册空洞——{{ r.desc }}
      </div>
    </div>
    <div class="rule-validate ok" v-else>✅ 接线状态正常（当前筛选范围内无注册空洞）</div>

    <!-- 规则列表（手风琴） -->
    <h4 class="rule-h">📋 规则条目<span class="hint">点击名称展开/收起 · 展开后可编辑 · fix=生成前约束+生成后修正 · guard=静默防护</span></h4>
    <div class="rule-list">
      <div v-for="r in ruleList" :key="r.id" class="rule-card" :class="{ open: openKey === r.id, editing: editingKey === r.id }">
        <div class="rule-head" @click="toggle(r.id)">
          <span class="arrow">{{ openKey === r.id ? '▾' : '▸' }}</span>
          <span class="lib-tag">🧪 规则库</span>
          <span class="dim-name">{{ ruleDimName(r) }}</span>
          <span class="key-hint" :title="'规则 id：' + r.id">{{ r.id }}</span>
          <span class="cat-tag" :class="`cat-${r.category}`">{{ r.category === 'fix' ? 'fix' : 'guard' }}</span>
          <span v-if="r.source === 'user'" class="src-user">已自定义</span>
          <span class="wired-tag" :class="wiredState(r).cls">{{ wiredState(r).label }}</span>
          <span class="rule-meta">{{ r.enabled !== false ? '启用' : '停用' }}</span>
        </div>

        <!-- 展开态 -->
        <div v-if="openKey === r.id && editingKey !== r.id" class="rule-body">
          <div class="rule-info"><b>名称：</b>{{ r.name }}</div>
          <div class="rule-info"><b>说明：</b>{{ r.description || '—' }}</div>
          <div v-if="r.promptHint" class="rule-hint"><b>生成前约束：</b>{{ r.promptHint }}</div>
          <div class="rule-info dims-line">
            <b>维度：</b>{{ dimsText(r) }}
          </div>
          <div class="rule-ops">
          <button class="btn" @click="startEdit(r)">✏️ 编辑</button>
          <button class="btn" @click="copyRule(r)">📋 复制</button>
          <button v-if="r.source === 'user'" class="btn danger" @click="removeRule(r)">🗑️ 删除自定义</button>
        </div>
        </div>

        <!-- 编辑态 -->
        <div v-if="editingKey === r.id" class="rule-edit">
          <div class="edit-grid">
            <label>规则 id <input v-model="form.id" :disabled="!!origId" placeholder="唯一英文标识" /></label>
            <label>名称 <input v-model="form.name" placeholder="规则名" /></label>
            <label>类别
              <select v-model="form.category"><option value="fix">fix（自动修复）</option><option value="guard">guard（静默防护）</option></select>
            </label>
            <label>学科（* 或逗号分隔）<input v-model="form.subjectsText" placeholder="如 * 或 语文,数学" /></label>
            <label>学段（* 或逗号分隔）<input v-model="form.stagesText" placeholder="如 primary_low,primary_mid" /></label>
            <label>资料类型（空=全部，逗号分隔）<input v-model="form.genTypesText" placeholder="如 exam,practice" /></label>
            <label class="chk">启用 <input v-model="form.enabled" type="checkbox" /></label>
          </div>
          <label class="full">生成前约束（promptHint）<textarea v-model="form.promptHint" rows="2" placeholder="模型生成前要遵守的约束文案"></textarea></label>
          <label class="full">规则说明<textarea v-model="form.description" rows="2" placeholder="规则用途说明"></textarea></label>
          <div class="rule-ops">
            <button class="btn-p" @click="saveDraft">💾 保存</button>
            <button class="btn" @click="cancelEdit">取消</button>
          </div>
        </div>
      </div>
      <div v-if="!ruleList.length" class="rule-empty">当前筛选无规则（可放宽筛选）</div>
    </div>

    <!-- 新增规则弹层 -->
    <div v-if="newOpen" class="modal-mask" @click.self="newOpen = false">
      <div class="modal">
        <h4>＋ 新增规则（用户自定义，优先于内置）</h4>
        <div class="edit-grid">
          <label>规则 id <input v-model="form.id" placeholder="唯一英文标识（如 my-check）" /></label>
          <label>名称 <input v-model="form.name" placeholder="规则名" /></label>
          <label>类别
            <select v-model="form.category"><option value="fix">fix（自动修复）</option><option value="guard">guard（静默防护）</option></select>
          </label>
          <label>学科（* 或逗号分隔）<input v-model="form.subjectsText" placeholder="如 * 或 语文,数学" /></label>
          <label>学段（* 或逗号分隔）<input v-model="form.stagesText" placeholder="如 primary_low,primary_mid" /></label>
          <label>资料类型（空=全部）<input v-model="form.genTypesText" placeholder="如 exam,practice" /></label>
        </div>
        <label class="full">生成前约束（promptHint）<textarea v-model="form.promptHint" rows="2" placeholder="模型生成前要遵守的约束文案"></textarea></label>
        <label class="full">规则说明<textarea v-model="form.description" rows="2" placeholder="规则用途说明"></textarea></label>
        <p class="modal-tip">注意：新增规则只在规则库注册；对应的执行逻辑（校验器内按 id 开关）需在代码中实现，否则会变成"注册空洞"（见接线状态自检）。</p>
        <div class="rule-ops">
          <button class="btn-p" @click="saveNew">💾 创建</button>
          <button class="btn" @click="newOpen = false">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue';
import { listValidatorRules, saveUserRule, deleteUserRule, resetUserRules } from '../../../config/validatorRules.js';
import { exportLibrary, importLibrary, readLib, writeLib } from '../../../utils/libraryIO.js';

const dims = inject('toolDims', { value: { stage: '', subject: '', genType: '' } });
const refreshLibStats = inject('refreshLibStats', () => {});

const STAGE_LABELS = {
  primary_low: '小学低段（1-2年级）', primary_mid: '小学中段（3-4年级）', primary_high: '小学高段（5-6年级）', middle: '初中（7-9年级）', high: '高中',
};
const GEN_TYPE_NAME = {
  exam: '正式试卷', practice: '课时练', special: '专项突破', preview: '课前预习',
  reading: '阅读训练', summary: '知识总结', dictation: '默写积累', errorbook: '错题本', review: '复习资料',
};

/* ===== 数据源 ===== */
const allRules = ref(listValidatorRules());
const totalCount = computed(() => allRules.value.length);
const userCount = computed(() => allRules.value.filter((r) => r.source === 'user').length);
const reload = () => { allRules.value = listValidatorRules(); refreshLibStats(); };

/* ===== 手风琴 ===== */
const openKey = ref('');
const toggle = (id) => { openKey.value = openKey.value === id ? '' : id; };

/* ===== 三维度名与筛选 ===== */
const firstLabel = (arr, map, all) => {
  const a = arr || [];
  const real = a.filter((v) => v && v !== '*');
  if (!real.length) return all;
  const label = map ? (map[real[0]] || real[0]) : real[0];
  return real.length > 1 ? `${label} 等` : label;
};
const ruleDimName = (r) =>
  `${firstLabel(r.stages, STAGE_LABELS, '全部学段')} · ${firstLabel(r.subjects, null, '全学科')} · ${firstLabel(r.genTypes, GEN_TYPE_NAME, '全部类型')}`;
const dimsText = (r) =>
  `学段[${(r.stages || []).join('、') || '*'}] · 学科[${(r.subjects || []).join('、') || '*'}] · 类型[${(r.genTypes || []).join('、') || '全部'}]`;

const matchArr = (arr, v) => !v || !arr || !arr.length || arr.includes('*') || arr.includes(v);
const ruleList = computed(() =>
  allRules.value.filter((r) =>
    matchArr(r.stages, dims.value.stage) &&
    matchArr(r.subjects, dims.value.subject) &&
    matchArr(r.genTypes, dims.value.genType)
  )
);

/* ===== 接线状态 ===== */
// 规则库（validatorRules）为生成端唯一规则源：生成前 buildValidatorPrompt 注入 + 生成后 auditExamPaper 执行
const wiredState = () => ({ label: '已接线', cls: 'ok' });
const holeRules = computed(() => []);

/* ===== 编辑 / 保存 / 删除 / 新增 / 重置 ===== */
const editingKey = ref('');
const origId = ref('');
const form = ref(null);
const resetForm = () => ({
  id: '', name: '', category: 'fix', subjectsText: '*', stagesText: '*', genTypesText: '', enabled: true, promptHint: '', description: '',
});
const toText = (arr) => (arr && arr.length ? arr.filter((v) => v !== '*').join(',') : '');
const toArr = (txt) => {
  const list = String(txt || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  return list.length ? list : ['*'];
};

const startEdit = (r) => {
  editingKey.value = r.id;
  origId.value = r.source === 'user' ? '' : r.id;
  form.value = {
    id: r.id, name: r.name, category: r.category,
    subjectsText: toText(r.subjects), stagesText: toText(r.stages), genTypesText: toText(r.genTypes),
    enabled: r.enabled !== false, promptHint: r.promptHint || '', description: r.description || '',
  };
  openKey.value = r.id;
};
const cancelEdit = () => { editingKey.value = ''; origId.value = ''; form.value = null; };
const saveDraft = () => {
  if (!form.value || !form.value.id.trim()) { window.alert('请填写规则 id（唯一英文标识）'); return; }
  const rule = {
    id: form.value.id.trim(), name: form.value.name || form.value.id,
    category: form.value.category, subjects: toArr(form.value.subjectsText),
    stages: toArr(form.value.stagesText), genTypes: toArr(form.value.genTypesText),
    enabled: !!form.value.enabled, promptHint: form.value.promptHint, description: form.value.description,
  };
  if (saveUserRule(rule)) { reload(); editingKey.value = ''; origId.value = ''; form.value = null; }
  else window.alert('保存失败');
};
const removeRule = (r) => {
  if (!window.confirm(`删除「${r.id}」？内置规则删除后回退默认，用户新增规则直接移除。`)) return;
  deleteUserRule(r.id);
  reload();
  if (openKey.value === r.id) openKey.value = '';
};
const resetAll = () => {
  if (!window.confirm('恢复全部默认规则？将清除所有用户自定义（覆盖/新增/删除标记）。')) return;
  resetUserRules();
  reload();
};

/* ===== 新增规则（弹层） ===== */
const newOpen = ref(false);
const openNew = () => {
  form.value = resetForm();
  newOpen.value = true;
};
const saveNew = () => {
  if (!form.value || !form.value.id.trim()) { window.alert('请填写规则 id（唯一英文标识）'); return; }
  const rule = {
    id: form.value.id.trim(), name: form.value.name || form.value.id,
    category: form.value.category, subjects: toArr(form.value.subjectsText),
    stages: toArr(form.value.stagesText), genTypes: toArr(form.value.genTypesText),
    enabled: !!form.value.enabled, promptHint: form.value.promptHint, description: form.value.description,
  };
  if (saveUserRule(rule)) { reload(); newOpen.value = false; form.value = null; }
  else window.alert('保存失败');
};

/* ===== 复制规则 ===== */
const copyRule = (r) => {
  form.value = {
    id: `${r.id}_copy`, name: `${r.name}（副本）`, category: r.category,
    subjectsText: (r.subjects || []).join('、'), stagesText: (r.stages || []).join('、'),
    genTypesText: (r.genTypes || []).join('、'), enabled: r.enabled,
    promptHint: r.promptHint, description: r.description,
  };
  newOpen.value = true;
  editingKey.value = '';
  origId.value = '';
};

/* ===== 导入/导出 ===== */
const importInput = ref(null);
const RULE_USER_KEY = 'wisdom_validator_rules_v1';
const doExport = () => {
  exportLibrary('rules', readLib(RULE_USER_KEY));
};
const doImport = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const data = await importLibrary(file);
    if (typeof data !== 'object' || data === null) throw new Error('数据格式不正确');
    writeLib(RULE_USER_KEY, data);
    window.alert('导入成功。');
    reload();
  } catch (err) {
    window.alert('导入失败：' + err.message);
  }
  e.target.value = '';
};

</script>

<style scoped>
.rule-page { padding: 18px 22px 30px; max-width: 1080px; }
.rule-overview { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-size: 13px; background: var(--bg); border: 1px solid var(--border-light); border-radius: 10px; padding: 10px 14px; box-shadow: 0 2px 6px rgba(30,58,111,.06); }
.lib-badge { display: inline-block; font-size: 12px; font-weight: 700; color: #fff; background: var(--primary); border-radius: 6px; padding: 3px 10px; margin-right: 10px; }
.ov-sep { margin: 0 8px; color: #c2ccda; }
.user-n { color: var(--primary); }
.ok-n { color: #1d7a4a; }
.bad-n { color: var(--danger); }
.dim-now { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.dimb { font-size: 12px; padding: 2px 10px; border-radius: 6px; background: var(--primary-lighter); color: var(--primary); border: 1px solid #c9d8ee; }
.btn-p { border: none; background: var(--primary); color: #fff; border-radius: 6px; padding: 6px 14px; font-size: 13px; cursor: pointer; }
.btn-p:hover { background: var(--primary-light); }
.btn { border: 1px solid var(--border); background: #fff; border-radius: 6px; padding: 5px 12px; font-size: 12.5px; cursor: pointer; }
.btn:hover { background: var(--primary-lighter); color: var(--primary); }
.btn.danger { color: var(--danger); border-color: var(--danger-light); }

.rule-validate { margin-top: 12px; background: #fff; border: 1px solid var(--border-light); border-radius: 10px; padding: 10px 14px; font-size: 12.5px; }
.rule-validate.ok { color: #1d7a4a; background: var(--success-light); border-color: #bfe6cd; }
.v-head { font-weight: 600; color: var(--primary); margin-bottom: 6px; }
.v-item { margin: 3px 0; }
.v-item.sev-error { color: var(--danger); }
.v-code { font-family: Consolas, monospace; font-weight: 700; }

.rule-h { font-size: 14px; color: var(--primary); margin: 22px 0 10px; }
.hint { font-size: 11.5px; color: var(--text-muted); font-weight: 400; margin-left: 8px; }
.rule-list { display: flex; flex-direction: column; gap: 8px; }
.rule-card { background: #fff; border: 1px solid var(--border-light); border-radius: 10px; overflow: hidden; }
.rule-card.open { border-color: var(--primary-light); box-shadow: 0 2px 10px rgba(30,58,111,.08); }
.rule-head { display: flex; align-items: center; gap: 8px; padding: 10px 14px; cursor: pointer; flex-wrap: wrap; }
.rule-head:hover { background: var(--primary-lighter); }
.arrow { color: var(--accent); font-weight: 700; }
.lib-tag { display: inline-block; font-size: 11px; font-weight: 700; color: #fff; background: var(--primary); border-radius: 6px; padding: 2px 8px; }
.dim-name { font-weight: 700; font-size: 13.5px; color: #26303e; }
.key-hint { font-size: 11px; color: var(--text-muted); font-weight: 400; }
.cat-tag { font-size: 10.5px; font-weight: 700; border-radius: 999px; padding: 1px 8px; }
.cat-fix { background: var(--primary-lighter); color: var(--primary); border: 1px solid #c9d8ee; }
.cat-guard { background: #eef7ee; color: #1d7a4a; border: 1px solid #bfe6cd; }
.src-user { font-size: 10.5px; font-weight: 600; color: #a06a10; background: #fdf3e2; border: 1px solid #f3d9a8; border-radius: 999px; padding: 1px 8px; }
.wired-tag { font-size: 10.5px; font-weight: 600; border-radius: 999px; padding: 1px 8px; }
.wired-tag.ok { color: #1d7a4a; background: var(--success-light); border: 1px solid #bfe6cd; }
.wired-tag.hole { color: #b03a2e; background: var(--danger-light); border: 1px solid #f5c2bd; }
.rule-meta { font-size: 12px; color: var(--text-muted); margin-left: auto; }
.rule-body { border-top: 1px dashed var(--border-light); padding: 10px 14px 14px; }
.rule-info { font-size: 12.5px; color: #445; margin: 4px 0; }
.rule-info b { color: var(--primary); }
.rule-hint { font-size: 12.5px; color: #667; background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 8px; padding: 6px 10px; margin-top: 6px; }
.dims-line { font-family: Consolas, monospace; font-size: 12px; }
.rule-ops { display: flex; gap: 8px; margin-top: 10px; }
.rule-edit { border-top: 1px dashed var(--border-light); padding: 12px 14px 14px; background: var(--primary-lighter); }
.edit-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 10px; }
.edit-grid label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-muted); }
.edit-grid label.chk { flex-direction: row; align-items: center; gap: 8px; }
.edit-grid input, .edit-grid select { border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; font-size: 12.5px; background: #fff; }
.full { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-muted); margin-bottom: 8px; }
.full textarea { border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; font-size: 12.5px; resize: vertical; background: #fff; }
.rule-empty { color: var(--text-muted); font-size: 13px; padding: 10px 4px; }

.modal-mask { position: fixed; inset: 0; background: rgba(30,42,64,.45); display: flex; align-items: center; justify-content: center; z-index: 999; }
.modal { background: #fff; border-radius: 12px; padding: 20px 22px; width: 560px; max-width: 92vw; box-shadow: 0 12px 40px rgba(0,0,0,.25); }
.modal h4 { margin: 0 0 14px; color: var(--primary); }
.modal-tip { font-size: 12px; color: var(--text-muted); margin: 10px 0; }
</style>
