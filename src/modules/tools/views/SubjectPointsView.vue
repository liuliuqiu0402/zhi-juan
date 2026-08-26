<template>
  <div class="sp-page">
    <!-- 概览条（吸顶） -->
    <div class="sp-overview">
      <div>
        <span class="lib-badge">📚 学科要点库</span>
        <b>学科要点 {{ subjectList.length }} / {{ SUBJECT_KEYS.length }}</b>
        <span class="ov-sep">·</span>
        <b>学段要点 {{ stageList.length }} / 5</b>
        <span class="ov-sep">·</span>
        <span>用户自定义 <b class="user-n">{{ userCount }}</b></span>
        <span class="ov-sep">·</span>
        <span>待修问题 <b class="issue-n">{{ openIssues.length }}</b></span>
      </div>
      <div class="dim-now">
        <span class="dimb">{{ dims.subject || '全部学科' }}</span>
        <span class="dimb">{{ dims.stage ? STAGE_LABELS[dims.stage] : '全部学段' }}</span>
        <span class="dimb">{{ dims.genType ? GEN_TYPE_NAME[dims.genType] : '全部类型' }}</span>
      </div>
    </div>

    <!-- 校验 -->
    <div class="sp-validate" v-if="validateMsgs.length">
      <div class="v-head">🔍 学科要点覆盖自检</div>
      <div v-for="(m, i) in validateMsgs" :key="i" class="v-item" :class="`sev-${m.severity}`">
        <span class="v-code">{{ m.code }}</span> {{ m.detail }}
      </div>
    </div>
    <div class="sp-validate ok" v-else>✅ 学科/学段要点覆盖完整（当前筛选范围）</div>

    <!-- 学科要点（手风琴） -->
    <h4 class="sp-h">📖 学科命题要点（15 学科）<span class="hint">点击学科展开全文 · 展开后可编辑</span></h4>
    <div class="sp-list">
      <div v-for="s in subjectList" :key="s.subject" class="sp-card" :class="{ open: openSub === s.subject, editing: editingSub === s.subject }">
        <div class="sp-head" @click="toggleSub(s.subject)">
          <span class="arrow">{{ openSub === s.subject ? '▾' : '▸' }}</span>
          <span class="lib-tag">📚 要点库</span>
          <span class="dim-name">{{ s.subject }}</span>
          <span class="key-hint" :title="'学科'">{{ s.subject }}</span>
          <span v-if="s.missing" class="gap-tag">缺要点</span>
          <span v-if="s.user" class="src-user">已自定义</span>
          <span class="sp-meta">{{ s.stages.length }} 个学段 · {{ s.stagesLabel }}</span>
        </div>
        <div v-if="openSub === s.subject && editingSub !== s.subject" class="sp-body">
          <pre class="sp-text">{{ s.text || '（暂无要点，点「编辑」添加）' }}</pre>
          <div class="sp-ops">
            <button class="btn" @click="startEdit(s, 'subject')">✏️ 编辑</button>
            <button v-if="s.user" class="btn danger" @click="removeUser('subject', s.subject)">🗑️ 删除自定义</button>
          </div>
        </div>
        <div v-if="editingSub === s.subject && editKind === 'subject'" class="sp-edit">
          <textarea v-model="editText" rows="6" class="sp-editarea" placeholder="学科命题要点（每行一条，含「底线」质量线）"></textarea>
          <div class="sp-ops">
            <button class="btn-p" @click="saveUser('subject', s.subject)">💾 保存</button>
            <button class="btn" @click="cancelEdit">取消</button>
          </div>
        </div>
      </div>
      <div v-if="!subjectList.length" class="sp-empty">当前筛选无学科要点</div>
    </div>

    <!-- 学段要点（手风琴） -->
    <h4 class="sp-h">🎓 学段命题要点（5 学段）<span class="hint">点击学段展开全文 · 展开后可编辑</span></h4>
    <div class="sp-list">
      <div v-for="st in stageList" :key="st.stage" class="sp-card" :class="{ open: openStage === st.stage, editing: editingStage === st.stage }">
        <div class="sp-head" @click="toggleStage(st.stage)">
          <span class="arrow">{{ openStage === st.stage ? '▾' : '▸' }}</span>
          <span class="lib-tag">📚 要点库</span>
          <span class="dim-name">{{ STAGE_LABELS[st.stage] }}</span>
          <span class="key-hint" :title="'学段'">{{ st.stage }}</span>
          <span v-if="st.user" class="src-user">已自定义</span>
          <span class="sp-meta">{{ st.subjects.length }} 学科 · {{ st.subjects.join('、') }}</span>
        </div>
        <div v-if="openStage === st.stage && editingStage !== st.stage" class="sp-body">
          <pre class="sp-text">{{ st.text || '（暂无要点）' }}</pre>
          <div class="sp-ops">
            <button class="btn" @click="startEdit(st, 'stage')">✏️ 编辑</button>
            <button v-if="st.user" class="btn danger" @click="removeUser('stage', st.stage)">🗑️ 删除自定义</button>
          </div>
        </div>
        <div v-if="editingStage === st.stage && editKind === 'stage'" class="sp-edit">
          <textarea v-model="editText" rows="5" class="sp-editarea" placeholder="学段命题要点（每行一条，含认知底线）"></textarea>
          <div class="sp-ops">
            <button class="btn-p" @click="saveUser('stage', st.stage)">💾 保存</button>
            <button class="btn" @click="cancelEdit">取消</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 待修问题 -->
    <h4 class="sp-h">🧹 迁移待修问题（跨库重复 × 接线待办）</h4>
    <div class="issue-list">
      <div v-for="it in filteredIssues" :key="it.code" class="issue-item" :class="`tp-${it.type}`">
        <span class="issue-code">{{ it.code }}</span>
        <span class="issue-tag">{{ TYPE_LABELS[it.type] }}</span>
        <span class="issue-desc">{{ it.desc }}</span>
        <span class="issue-action">{{ it.action }}</span>
      </div>
      <div v-if="!filteredIssues.length" class="sp-empty">当前筛选无待修问题</div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue';
import { SUBJECT_EXAM_EXTRAS, STAGE_EXAM_EXTRAS, STAGE_SUBJECTS } from '../../../config/promptLibrary.js';
import { SUBJECT_KEYS, STAGE_KEYS } from '../../../config/toolLibrary.js';

const dims = inject('toolDims', { value: { stage: '', subject: '', genType: '' } });

const STAGE_LABELS = {
  primary_low: '小学低段（1-2年级）', primary_mid: '小学中段（3-4年级）', primary_high: '小学高段（5-6年级）', middle: '初中（7-9年级）', high: '高中',
};
const GEN_TYPE_NAME = {
  exam: '正式试卷', practice: '课时练', special: '专项突破', preview: '课前预习',
  reading: '阅读训练', summary: '知识总结', dictation: '默写积累', errorbook: '错题本', review: '复习资料',
};
const TYPE_LABELS = { dup: '跨库重复', wiring: '接线待办' };

/* ===== 用户自定义存储 ===== */
const USER_KEY = 'wisdom_subject_points_v1';
const loadUser = () => { try { return JSON.parse(localStorage.getItem(USER_KEY) || '{}'); } catch { return {}; } };

/** 某学科出现在哪些学段（从 STAGE_SUBJECTS 反查） */
const stagesOfSubject = (subject) => STAGE_KEYS.filter((st) => (STAGE_SUBJECTS[st] || []).includes(subject));

/* ===== 数据：内置 + 用户自定义 ===== */
const subjectList = computed(() => {
  const user = loadUser().subjectExtras || {};
  return SUBJECT_KEYS
    .map((subject) => ({
      subject,
      text: user[subject] ?? SUBJECT_EXAM_EXTRAS[subject] ?? '',
      user: !!user[subject],
      missing: !SUBJECT_EXAM_EXTRAS[subject],
      stages: stagesOfSubject(subject),
      stagesLabel: stagesOfSubject(subject).map((s) => STAGE_LABELS[s].replace(/（.*）/, '')).join('、') || '无',
    }))
    .filter((s) => {
      if (dims.value.subject && s.subject !== dims.value.subject) return false;
      if (dims.value.stage && !s.stages.includes(dims.value.stage)) return false;
      return true;
    });
});

const stageList = computed(() => {
  const user = loadUser().stageExtras || {};
  return STAGE_KEYS
    .map((stage) => ({
      stage,
      text: user[stage] ?? STAGE_EXAM_EXTRAS[stage] ?? '',
      user: !!user[stage],
      subjects: STAGE_SUBJECTS[stage] || [],
    }))
    .filter((s) => {
      if (dims.value.stage && s.stage !== dims.value.stage) return false;
      if (dims.value.subject && !s.subjects.includes(dims.value.subject)) return false;
      return true;
    });
});
const userCount = computed(() => {
  const u = loadUser();
  return Object.keys(u.subjectExtras || {}).length + Object.keys(u.stageExtras || {}).length;
});

/* ===== 手风琴 ===== */
const openSub = ref('');
const openStage = ref('');
const toggleSub = (s) => { openSub.value = openSub.value === s ? '' : s; };
const toggleStage = (s) => { openStage.value = openStage.value === s ? '' : s; };

/* ===== 校验 ===== */
const validateMsgs = computed(() => {
  const msgs = [];
  const missing = subjectList.value.filter((s) => s.missing);
  if (missing.length) {
    msgs.push({ code: 'S1', severity: 'warning', detail: `学科要点缺失：${missing.map((s) => s.subject).join('、')}` });
  }
  return msgs;
});

/* ===== 编辑 / 保存 / 删除 ===== */
const editingSub = ref('');
const editingStage = ref('');
const editKind = ref('');
const editText = ref('');
const startEdit = (item, kind) => {
  if (kind === 'subject') { editingSub.value = item.subject; editingStage.value = ''; }
  else { editingStage.value = item.stage; editingSub.value = ''; }
  editKind.value = kind;
  editText.value = item.text || '';
  if (kind === 'subject') openSub.value = item.subject; else openStage.value = item.stage;
};
const cancelEdit = () => { editingSub.value = ''; editingStage.value = ''; editKind.value = ''; };
const saveUser = (kind, key) => {
  const lib = loadUser();
  if (kind === 'subject') {
    lib.subjectExtras = lib.subjectExtras || {};
    lib.subjectExtras[key] = editText.value;
  } else {
    lib.stageExtras = lib.stageExtras || {};
    lib.stageExtras[key] = editText.value;
  }
  try { localStorage.setItem(USER_KEY, JSON.stringify(lib)); } catch { window.alert('保存失败'); return; }
  cancelEdit();
  window.location.reload();
};
const removeUser = (kind, key) => {
  if (!window.confirm(`删除「${key}」的自定义要点？删除后回退内置。`)) return;
  const lib = loadUser();
  if (kind === 'subject' && lib.subjectExtras) delete lib.subjectExtras[key];
  if (kind === 'stage' && lib.stageExtras) delete lib.stageExtras[key];
  try { localStorage.setItem(USER_KEY, JSON.stringify(lib)); } catch {}
  window.location.reload();
};

/* ===== 待修问题 ===== */
const AUDIT_ISSUES = [
  { code: 'S1', type: 'dup', key: '', desc: 'SUBJECT_EXAM_EXTRAS 与 EXAM_SUBJECT_STANDARDS（examPaperBlueprints）高度重复：语文"禁止原句挖空/孤立罗列"、英语"听力原文放答案页"、数学"禁止孤立考进率"、物理/化学"实验探究过程"等底线句几乎同文；exam 生成时两组同时注入。', action: '定唯一事实源：学科条款（EXAM_SUBJECT_STANDARDS）承载质量底线；SUBJECT_EXAM_EXTRAS 删重复底线句，只留教辅（非 exam）适用的排版/呈现要点。' },
  { code: 'S2', type: 'dup', key: '', desc: 'STAGE_EXAM_EXTRAS 与 EXAM_STAGE_STANDARDS 重复：难度分布"6:3:1"、题量/情境要求等大面积重叠；exam 生成时两组同时注入。', action: '学段条款（EXAM_STAGE_STANDARDS）为唯一事实源；STAGE_EXAM_EXTRAS 删重复，保留教辅适用认知底线。' },
  { code: 'S3', type: 'wiring', key: '', desc: '学科要点当前为"学科级"（全学段通用）；部分学科低/高段要点应有差异（如语文低段识字写字 vs 高段阅读写作），未按三维度细化。', action: '迁移完善阶段：对有学段差异的学科补"学段×学科"细化要点（用户可在本页自定义覆盖）。' },
  { code: 'S4', type: 'wiring', key: '', desc: '用户自定义要点当前仅存储展示；buildInjectionInstruction 注入 SUBJECT_EXAM_EXTRAS/STAGE_EXAM_EXTRAS 处未接用户覆盖。', action: '代码读取落实阶段：注入时合并用户自定义（用户优先）。' },
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
.sp-page { padding: 18px 22px 30px; max-width: 1080px; }
.sp-overview { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-size: 13px; background: var(--bg); border: 1px solid var(--border-light); border-radius: 10px; padding: 10px 14px; box-shadow: 0 2px 6px rgba(30,58,111,.06); }
.lib-badge { display: inline-block; font-size: 12px; font-weight: 700; color: #fff; background: var(--primary); border-radius: 6px; padding: 3px 10px; margin-right: 10px; }
.ov-sep { margin: 0 8px; color: #c2ccda; }
.user-n { color: var(--primary); }
.issue-n { color: var(--danger); }
.dim-now { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.dimb { font-size: 12px; padding: 2px 10px; border-radius: 6px; background: var(--primary-lighter); color: var(--primary); border: 1px solid #c9d8ee; }

.sp-validate { margin-top: 12px; background: #fff; border: 1px solid var(--border-light); border-radius: 10px; padding: 10px 14px; font-size: 12.5px; }
.sp-validate.ok { color: #1d7a4a; background: var(--success-light); border-color: #bfe6cd; }
.v-head { font-weight: 600; color: var(--primary); margin-bottom: 6px; }
.v-item { margin: 3px 0; }
.v-item.sev-error { color: var(--danger); }
.v-item.sev-warning { color: #a06a10; }
.v-code { font-family: Consolas, monospace; font-weight: 700; }

.sp-h { font-size: 14px; color: var(--primary); margin: 22px 0 10px; }
.hint { font-size: 11.5px; color: var(--text-muted); font-weight: 400; margin-left: 8px; }
.sp-list { display: flex; flex-direction: column; gap: 8px; }
.sp-card { background: #fff; border: 1px solid var(--border-light); border-radius: 10px; overflow: hidden; }
.sp-card.open { border-color: var(--primary-light); box-shadow: 0 2px 10px rgba(30,58,111,.08); }
.sp-head { display: flex; align-items: center; gap: 8px; padding: 10px 14px; cursor: pointer; flex-wrap: wrap; }
.sp-head:hover { background: var(--primary-lighter); }
.arrow { color: var(--accent); font-weight: 700; }
.lib-tag { display: inline-block; font-size: 11px; font-weight: 700; color: #fff; background: var(--primary); border-radius: 6px; padding: 2px 8px; }
.dim-name { font-weight: 700; font-size: 13.5px; color: #26303e; }
.key-hint { font-size: 11px; color: var(--text-muted); font-weight: 400; }
.gap-tag { font-size: 10.5px; font-weight: 700; color: #b03a2e; background: var(--danger-light); border: 1px solid #f5c2bd; border-radius: 999px; padding: 1px 8px; }
.src-user { font-size: 10.5px; font-weight: 600; color: #a06a10; background: #fdf3e2; border: 1px solid #f3d9a8; border-radius: 999px; padding: 1px 8px; }
.sp-meta { font-size: 11.5px; color: var(--text-muted); margin-left: auto; }
.sp-body { border-top: 1px dashed var(--border-light); padding: 10px 14px 14px; }
.sp-text { white-space: pre-wrap; word-break: break-all; font-size: 12.5px; line-height: 1.8; color: #445; background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 8px; padding: 10px 12px; margin: 0; }
.sp-ops { display: flex; gap: 8px; margin-top: 10px; }
.btn { border: 1px solid var(--border); background: #fff; border-radius: 6px; padding: 5px 12px; font-size: 12.5px; cursor: pointer; }
.btn:hover { background: var(--primary-lighter); color: var(--primary); }
.btn.danger { color: var(--danger); border-color: var(--danger-light); }
.btn-p { border: none; background: var(--primary); color: #fff; border-radius: 6px; padding: 6px 14px; font-size: 13px; cursor: pointer; }
.btn-p:hover { background: var(--primary-light); }
.sp-edit { border-top: 1px dashed var(--border-light); padding: 12px 14px 14px; background: var(--primary-lighter); }
.sp-editarea { width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 10px; font-size: 12.5px; line-height: 1.7; resize: vertical; background: #fff; }
.sp-empty { color: var(--text-muted); font-size: 13px; padding: 10px 4px; }

.issue-list { display: flex; flex-direction: column; gap: 8px; }
.issue-item { display: flex; align-items: flex-start; gap: 10px; font-size: 12.5px; background: #fff; border: 1px solid var(--border-light); border-left: 4px solid var(--border); border-radius: 8px; padding: 8px 12px; flex-wrap: wrap; }
.issue-item.tp-dup { border-left-color: var(--primary-light); }
.issue-item.tp-wiring { border-left-color: var(--accent); }
.issue-code { font-family: Consolas, monospace; font-weight: 700; color: var(--primary); }
.issue-tag { font-size: 10.5px; padding: 1px 8px; border-radius: 999px; background: var(--primary-lighter); color: var(--primary); white-space: nowrap; }
.issue-desc { flex: 1; min-width: 200px; color: #445; }
.issue-action { font-size: 12px; color: var(--text-muted); }
</style>
