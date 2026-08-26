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
        <span>待修问题 <b class="issue-n">{{ openIssues.length }}</b></span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div class="dim-now">
          <span class="dimb">{{ dims.stage ? STAGE_LABELS[dims.stage] : '全部学段' }}</span>
          <span class="dimb">{{ dims.subject || '全部学科' }}</span>
          <span class="dimb">{{ dims.genType ? GEN_TYPE_LABELS[dims.genType] : '全部类型' }}</span>
        </div>
        <button class="btn-p" @click="openNew">＋ 新增模板</button>
      </div>
    </div>

    <!-- 校验结果 -->
    <div class="tpl-validate" v-if="validateMsgs.length">
      <div class="v-head">🔍 模板完整性校验</div>
      <div v-for="(m, i) in validateMsgs" :key="i" class="v-item" :class="`sev-${m.severity}`">
        <span class="v-code">{{ m.code }}</span> {{ m.detail }}
      </div>
    </div>
    <div class="tpl-validate ok" v-else>✅ 模板完整性校验通过（当前筛选范围）</div>

    <!-- 模板列表（手风琴） -->
    <h4 class="tpl-h">🧾 创作模板<span class="hint">点击名称展开/收起 · 展开后可编辑</span></h4>
    <div class="tpl-list">
      <div v-for="t in tplList" :key="t.key" class="tpl-card" :class="{ open: openKey === t.key, editing: editingKey === t.key }">
        <div class="tpl-head" @click="toggle(t.key)">
          <span class="arrow">{{ openKey === t.key ? '▾' : '▸' }}</span>
          <span class="lib-tag">📝 指令库</span>
          <span class="layer-tag" :class="`ly-${t.layer}`">{{ layerLabel(t) }}</span>
          <span class="dim-name">{{ tplDimName(t) }}</span>
          <span class="key-hint" :title="'数据键：' + t.key">{{ t.key }}</span>
          <span v-if="t.source === 'user'" class="src-user">已自定义</span>
          <span class="tpl-meta">{{ t.template.length }} 字</span>
        </div>

        <!-- 展开态：预览 -->
        <div v-if="openKey === t.key && editingKey !== t.key" class="tpl-body">
          <pre class="tpl-preview">{{ t.template }}</pre>
          <div class="tpl-ops">
            <button v-if="t.layer === 'type' || t.source === 'user'" class="btn" @click="startEdit(t)">
              {{ t.layer === 'type' && t.source === 'builtin' ? '✏️ 编辑（保存后覆盖内置，可恢复默认）' : '✏️ 编辑' }}
            </button>
            <button v-if="t.layer === 'user'" class="btn danger" @click="removeTpl(t)">🗑️ 删除自定义/恢复默认</button>
            <span v-if="t.layer === 'subject' || t.layer === 'stage'" class="readonly-tip">📌 内置要点（只读），请在「学科要点库」维护</span>
          </div>
        </div>

        <!-- 编辑态 -->
        <div v-if="editingKey === t.key" class="tpl-edit">
          <div class="edit-grid">
            <label>名称 <input v-model="draft.name" placeholder="模板名称" /></label>
            <label>数据键 <input :value="editingKey" disabled /></label>
          </div>
          <textarea v-model="draft.template" rows="10" class="tpl-editarea" placeholder="模板正文（占位符 {grade}/{subject}/{unit}/{structure}/{fullScore}/{duration}/{extra} 生成时替换）"></textarea>
          <div class="tpl-ops">
            <button class="btn-p" @click="saveDraft(editingKey)">💾 保存</button>
            <button class="btn" @click="cancelEdit">取消</button>
          </div>
        </div>
      </div>
      <div v-if="!tplList.length" class="tpl-empty">当前筛选无模板（可放宽筛选）</div>
    </div>

    <!-- 待修问题 -->
    <h4 class="tpl-h">🧹 迁移待修问题（过度约束 × 自相矛盾 × 跨库重复）</h4>
    <div class="issue-list">
      <div v-for="it in filteredIssues" :key="it.code" class="issue-item" :class="`tp-${it.type}`">
        <span class="issue-code">{{ it.code }}</span>
        <span class="issue-tag">{{ TYPE_LABELS[it.type] }}</span>
        <span class="issue-desc">{{ it.desc }}</span>
        <span class="issue-action">{{ it.action }}</span>
      </div>
      <div v-if="!filteredIssues.length" class="tpl-empty">当前筛选无待修问题</div>
    </div>

    <!-- 新增模板弹层 -->
    <div v-if="newOpen" class="modal-mask" @click.self="newOpen = false">
      <div class="modal">
        <h4>＋ 新增模板（自定义覆盖或新建）</h4>
        <div class="edit-grid modal-grid">
          <label>学段
            <select v-model="newForm.stage">
              <option value="">全部学段</option>
              <option v-for="(l, k) in STAGE_LABELS" :key="k" :value="k">{{ l }}</option>
            </select>
          </label>
          <label>学科
            <select v-model="newForm.subject">
              <option value="">全学科</option>
              <option v-for="s in SUBJECT_KEYS" :key="s" :value="s">{{ s }}</option>
            </select>
          </label>
          <label>资料类型
            <select v-model="newForm.genType">
              <option v-for="t in GEN_TYPE_LABELS" :key="t.key" :value="t.key">{{ t.label }}</option>
            </select>
          </label>
        </div>
        <p class="modal-tip">模板键 = 学段|学科|类型（三维度精确）或 学段|类型 / 类型（降级）。生成时按 学段×学科×类型 精确匹配，用户自定义优先；可建降级模板覆盖更广范围。</p>
        <div class="tpl-ops">
          <button class="btn-p" @click="createTpl">创建并编辑</button>
          <button class="btn" @click="newOpen = false">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue';
import { listPromptTemplates, savePromptTemplate, deletePromptTemplate } from '../../../config/promptLibrary.js';
import { SUBJECT_KEYS } from '../../../config/toolLibrary.js';

const dims = inject('toolDims', { value: { stage: '', subject: '', genType: '' } });

const STAGE_LABELS = {
  primary_low: '小学低段（1-2年级）', primary_mid: '小学中段（3-4年级）', primary_high: '小学高段（5-6年级）', middle: '初中（7-9年级）', high: '高中',
};
const GEN_TYPE_LABELS = [
  { key: 'exam', label: '正式试卷' }, { key: 'practice', label: '课时练' }, { key: 'special', label: '专项突破' },
  { key: 'preview', label: '课前预习' }, { key: 'reading', label: '阅读训练' }, { key: 'summary', label: '知识总结' },
  { key: 'dictation', label: '默写积累' }, { key: 'errorbook', label: '错题本' }, { key: 'review', label: '复习资料' },
];
const TYPE_LABELS = { over: '过度约束', contra: '自相矛盾', dup: '跨库重复' };
const GEN_TYPE_NAME = Object.fromEntries(GEN_TYPE_LABELS.map((t) => [t.key, t.label]));

/* ===== 数据源 ===== */
const allTpl = ref(listPromptTemplates());
const totalCount = computed(() => 29); // 29 条基础（类型层9 + 学科层15 + 学段层5）
const userCount = computed(() => allTpl.value.filter((t) => t.source === 'user').length);
const reload = () => { allTpl.value = listPromptTemplates(); };

/* ===== 手风琴 ===== */
const openKey = ref('');
const toggle = (key) => { openKey.value = openKey.value === key ? '' : key; };

/* ===== key 三维度解析（仅用户自定义条目用；内置按 layer 展示） ===== */
const parseKey = (key) => {
  const parts = String(key || '').split('|');
  const genType = parts[parts.length - 1] || '';
  const stage = parts.length >= 3 ? parts[0] : parts.length === 2 ? parts[0] : '';
  const subject = parts.length >= 3 ? parts[1] : '';
  return { stage, subject, genType };
};
/** 全中文三维度名（按 layer：类型模板 / 学科要点 / 学段要点 / 用户自定义） */
const tplDimName = (t) => {
  if (t.layer === 'type') return `全部学段 · 全学科 · ${GEN_TYPE_NAME[t.key] || t.key}`;
  if (t.layer === 'subject') return `全部学段 · ${t.key} · 全部类型`;
  if (t.layer === 'stage') return `${STAGE_LABELS[t.key] || t.key} · 全学科 · 全部类型`;
  const { stage, subject, genType } = parseKey(t.key);
  return `${stage ? STAGE_LABELS[stage] : '全部学段'} · ${subject || '全学科'} · ${GEN_TYPE_NAME[genType] || genType}`;
};
const layerLabel = (t) => (
  { type: '类型模板', subject: '学科要点', stage: '学段要点', user: '自定义' }[t.layer] || '模板'
);

/* ===== 三维度筛选（内置按 layer 匹配；用户自定义按 key 解析匹配） ===== */
const tplList = computed(() =>
  allTpl.value.filter((t) => {
    const { stage, subject, genType } = parseKey(t.key);
    if (t.layer === 'type') {
      if (dims.value.genType && t.key !== dims.value.genType) return false;
      return true;
    }
    if (t.layer === 'subject') {
      if (dims.value.subject && t.key !== dims.value.subject) return false;
      return true;
    }
    if (t.layer === 'stage') {
      if (dims.value.stage && t.key !== dims.value.stage) return false;
      return true;
    }
    // user
    if (dims.value.stage && stage && stage !== dims.value.stage) return false;
    if (dims.value.subject && subject && subject !== dims.value.subject) return false;
    if (dims.value.genType && genType && genType !== dims.value.genType) return false;
    return true;
  })
);

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

/* ===== 指令库迁移待修问题 ===== */
const AUDIT_ISSUES = [
  { code: 'I1', type: 'over', key: '', desc: 'FORMAT_RULES 整段（格宽/括号空格数/连接符/HTML标签/留白行数）为微观格式，模型执行必然不稳，应归规则库/渲染层，prompt 只留"作答载体由系统按题型渲染"。', action: '迁移时删除 D 类格式约束，保留模型语义类。' },
  { code: 'I2', type: 'contra', key: '', desc: '简答留白 EXAM_BASE 说"不少于4行"、OUTPUT_FORMAT_BLOCK 说"不少于3行"，自相矛盾。', action: '统一为"留足作答区"，行数由排版规格库按分值×学段生成。' },
  { code: 'I3', type: 'contra', key: '', desc: '连线"系统会自动打乱右列"与蓝图"右列必须打乱"冲突；"用——连接"又被规则库替换为空格。', action: '统一：模型只给配对，右列乱序与布局归 match-format-fix。' },
  { code: 'I4', type: 'contra', key: '', desc: 'FORMAT_RULES 要求"模型精确给出横线宽度"，又承认"系统后处理只按现有宽度归类、无法代算答案长度"——要求模型做系统做不到的事。', action: '只留"宽度与答案字数匹配（1字≈2格）"一句语义。' },
  { code: 'I5', type: 'contra', key: '', desc: 'EXAM_BASE"禁止无情境的孤立堆题"与"若不需要统一情境，删除本行即可"自相矛盾；且情境框架生成依赖此字面量正则。', action: '情境改由资料类型显式驱动，废除指令字面量控制代码行为。' },
  { code: 'I6', type: 'over', key: '', desc: '小题标题规范硬编码 8 个题型名+"严禁自创"，压制模型自主命名。', action: '精简为"小题标题准确描述作答形式"。' },
  { code: 'I7', type: 'dup', key: '', desc: '"严禁 Markdown/代码块"在 OUTPUT_FORMAT_BLOCK 与 ANSWER_FORMAT_SPEC 重复；代码层已能拦截。', action: '删除重复句，代码层拦截。' },
  { code: 'I8', type: 'dup', key: '', desc: 'STAGE_EXAM_EXTRAS 与 EXAM_STAGE_STANDARDS 大面积重复（难度6:3:1 等），exam 生成时两组同时注入。', action: 'STAGE_EXAM_EXTRAS 删重复句，学段条款为唯一事实源。' },
  { code: 'I9', type: 'dup', key: '', desc: 'SUBJECT_EXAM_EXTRAS 与 EXAM_SUBJECT_STANDARDS 底线高度重复（禁挖空/听力原文/禁孤立考进率等）。', action: 'SUBJECT_EXAM_EXTRAS 保留教辅适用要点，删重复底线句。' },
];
const filteredIssues = computed(() => {
  const su = dims.value.subject, st = dims.value.stage;
  return AUDIT_ISSUES.filter((it) => {
    if (su && !it.key.includes(su)) return false;
    if (st && !it.key.includes(st)) return false;
    return true;
  });
});
const openIssues = computed(() => filteredIssues.value.length);
</script>

<style scoped>
.tpl-page { padding: 18px 22px 30px; max-width: 1080px; }
.tpl-overview { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-size: 13px; background: var(--bg); border: 1px solid var(--border-light); border-radius: 10px; padding: 10px 14px; box-shadow: 0 2px 6px rgba(30,58,111,.06); }
.lib-badge { display: inline-block; font-size: 12px; font-weight: 700; color: #fff; background: var(--primary); border-radius: 6px; padding: 3px 10px; margin-right: 10px; }
.ov-sep { margin: 0 8px; color: #c2ccda; }
.user-n { color: var(--primary); }
.issue-n { color: var(--danger); }
.dim-now { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.dimb { font-size: 12px; padding: 2px 10px; border-radius: 6px; background: var(--primary-lighter); color: var(--primary); border: 1px solid #c9d8ee; }
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
.ly-type { background: var(--primary-lighter); color: var(--primary); border: 1px solid #c9d8ee; }
.ly-subject { background: var(--success-light); color: #1d7a4a; border: 1px solid #bfe6cd; }
.ly-stage { background: #eef7ee; color: #1d7a4a; border: 1px solid #bfe6cd; }
.ly-user { background: var(--accent-soft, #fdf3e2); color: #a06a10; border: 1px solid #f3d9a8; }
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

.issue-list { display: flex; flex-direction: column; gap: 8px; }
.issue-item { display: flex; align-items: flex-start; gap: 10px; font-size: 12.5px; background: #fff; border: 1px solid var(--border-light); border-left: 4px solid var(--border); border-radius: 8px; padding: 8px 12px; flex-wrap: wrap; }
.issue-item.tp-over { border-left-color: var(--accent); }
.issue-item.tp-contra { border-left-color: var(--danger); }
.issue-item.tp-dup { border-left-color: var(--primary-light); }
.issue-code { font-family: Consolas, monospace; font-weight: 700; color: var(--primary); }
.issue-tag { font-size: 10.5px; padding: 1px 8px; border-radius: 999px; background: var(--primary-lighter); color: var(--primary); white-space: nowrap; }
.issue-desc { flex: 1; min-width: 200px; color: #445; }
.issue-action { font-size: 12px; color: var(--text-muted); }
</style>
