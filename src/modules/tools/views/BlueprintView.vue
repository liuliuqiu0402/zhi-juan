<template>
  <div class="bp-page">
    <!-- 概览条 -->
    <div class="bp-overview">
      <div>
        <span class="lib-badge">📐 蓝图库</span>
        <b>真题蓝本 {{ examList.length }} / {{ allExamCount }} 条</b>
        <span class="ov-sep">·</span>
        <b>教辅结构 {{ teachList.length }} / {{ allTeachCount }} 条</b>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div class="dim-now">
          <span class="dimb">{{ dims.stage ? STAGE_LABELS[dims.stage] : '全部学段' }}</span>
          <span class="dimb">{{ dims.subject || '全部学科' }}</span>
          <span class="dimb">{{ dims.genType ? GEN_TYPE_LABELS[dims.genType] : '全部类型' }}</span>
        </div>
        <button class="btn-p" @click="openNew">＋ 新增蓝本</button>
        <button class="btn" @click="doExport">📤 导出</button>
        <button class="btn" @click="importInput?.click()">📥 导入</button>
        <input ref="importInput" type="file" accept=".json" style="display:none" @change="doImport" />
      </div>
    </div>

    <!-- 校验结果 -->
    <div class="bp-validate" v-if="validateResults.length">
      <div class="v-head">🔍 blueprintGuard 静态校验（含用户自定义蓝本）</div>
      <div v-for="(r, i) in validateResults" :key="i" class="v-item" :class="`sev-${r.severity}`">
        <span class="v-code">{{ r.code }}</span> {{ r.detail }}
      </div>
    </div>
    <div class="bp-validate ok" v-else>✅ blueprintGuard 静态校验全部通过（当前筛选范围）</div>

    <!-- 真题蓝本（手风琴） -->
    <h4 class="bp-h">📐 真题蓝本（exam）<span class="hint">点击名称展开/收起 · 展开后可编辑</span>
      <span class="st-chips">
        <button class="st-chip" :class="{ sel: examFilter === 'all' }" @click="examFilter = 'all'">全部 {{ examCounts.total }}</button>
        <button class="st-chip on" :class="{ sel: examFilter === 'on' }" @click="examFilter = 'on'">启用 {{ examCounts.on }}</button>
        <button class="st-chip off" :class="{ sel: examFilter === 'off' }" @click="examFilter = 'off'">停用 {{ examCounts.off }}</button>
      </span>
    </h4>
    <div v-if="examList.length" class="bp-list">
      <div v-for="bp in examList" :key="bp.key" class="bp-card" :class="{ open: openKey === bp.key, editing: editingKey === bp.key, disabled: bpOff(bp.key) }">
        <!-- 卡片头：点击切换展开 -->
        <div class="bp-head" @click="toggle(bp.key)">
          <span class="arrow">{{ openKey === bp.key ? '▾' : '▸' }}</span>
          <span class="lib-tag">📐 蓝图库</span>
          <span class="dim-name">{{ dimName(bp) }}</span>
          <span class="key-hint" :title="'数据键：' + bp.key">{{ bp.key }}</span>
          <span v-if="bp.source === 'user'" class="src-user">已自定义</span>
          <span class="bp-meta">满分 {{ bp.fullScore }} 分 · {{ bp.duration }} · {{ bp.sections.length }} 大题</span>
          <label class="sw" :class="{ off: bpOff(bp.key) }" @click.stop title="停用后该条目不参与生成（exam 走密封线兜底）">
            <input type="checkbox" :checked="!bpOff(bp.key)" @change="toggleBp(bp.key, $event.target.checked)" />
            <span>{{ bpOff(bp.key) ? '已停用' : '启用' }}</span>
          </label>
        </div>

        <!-- 展开态：浏览 -->
        <div v-if="openKey === bp.key && editingKey !== bp.key" class="bp-body">
          <div class="bp-secs">
            <div v-for="(s, i) in bp.sections" :key="i" class="bp-sec">
              <span class="sec-no">{{ '一二三四五六七八九十'[i] }}</span>
              <span class="sec-name">{{ s.name }}</span>
              <span class="sec-score">{{ s.score }}分</span>
              <span class="sec-note">{{ s.note }}</span>
              <span class="carriers">
                <span v-for="c in s.carriers" :key="c" class="car" :class="`c-${c}`">{{ CARRIER_LABELS[c] }}</span>
              </span>
            </div>
            <div v-if="!bp.sections.length" class="bp-empty">暂无大题（点「编辑」添加）</div>
          </div>
          <div class="bp-ops">
          <button class="btn" @click="startEdit(bp)">✏️ 编辑</button>
          <button class="btn" @click="copyBp(bp)">📋 复制</button>
          <button v-if="bp.source === 'user'" class="btn danger" @click="removeBp(bp)">🗑️ 删除自定义</button>
          <button v-if="bp.source === 'user'" class="btn" @click="removeBp(bp, true)">↩️ 重置为内置</button>
        </div>
        </div>

        <!-- 编辑态 -->
        <div v-if="editingKey === bp.key" class="bp-edit">
          <div class="edit-grid">
            <label>名称 <input v-model="draft.label" placeholder="蓝本名称" /></label>
            <label>满分 <input v-model.number="draft.fullScore" type="number" /></label>
            <label>时长 <input v-model="draft.duration" placeholder="如 60分钟" /></label>
          </div>
          <div class="edit-secs">
            <div v-for="(s, i) in draft.sections" :key="i" class="edit-sec">
              <span class="sec-no">{{ '一二三四五六七八九十'[i] }}</span>
              <input v-model="s.name" class="in-name" placeholder="大题名" />
              <input v-model.number="s.score" type="number" class="in-score" placeholder="分值" />
              <textarea v-model="s.note" rows="2" placeholder="命题要求/内容底线"></textarea>
              <button class="btn x" @click="removeSection(i)">✕</button>
            </div>
            <button class="btn add" @click="addSection">＋ 添加大题</button>
          </div>
          <div class="bp-ops">
            <button class="btn-p" @click="saveDraft(bp.key)">💾 保存</button>
            <button class="btn" @click="cancelEdit">取消</button>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="bp-empty">当前筛选无真题蓝本（可放宽筛选）</div>

    <!-- 教辅结构（手风琴只读） -->
    <h4 class="bp-h">📚 教辅结构（学科 × 8 类）<span class="hint">点击展开查看栏目与学段参数 · 已定制显示学科版栏目，未定制回退通用模板</span>
      <span class="st-chips">
        <button class="st-chip" :class="{ sel: teachFilter === 'all' }" @click="teachFilter = 'all'">全部 {{ teachCounts.total }}</button>
        <button class="st-chip on" :class="{ sel: teachFilter === 'on' }" @click="teachFilter = 'on'">启用 {{ teachCounts.on }}</button>
        <button class="st-chip off" :class="{ sel: teachFilter === 'off' }" @click="teachFilter = 'off'">停用 {{ teachCounts.off }}</button>
      </span>
    </h4>
    <div v-if="teachList.length" class="bp-list teach">
      <div v-for="bp in teachList" :key="bp.key" class="bp-card" :class="{ open: openTeach === bp.key, disabled: bpOff(bp.key) }">
        <div class="bp-head" @click="toggleTeach(bp.key)">
          <span class="arrow">{{ openTeach === bp.key ? '▾' : '▸' }}</span>
          <span class="lib-tag">📚 蓝图库</span>
          <span class="dim-name">{{ teachDimName(bp) }}</span>
          <span v-if="bp.custom" class="src-custom">学科定制</span>
          <span v-else class="src-fallback">通用模板</span>
          <span class="key-hint" :title="'数据键：' + bp.key">{{ bp.key }}</span>
          <span class="bp-meta">{{ dims.stage ? `学段要求（${STAGE_LABELS[dims.stage]}）：${stageParam(bp).note || '—'}` : '5 学段要求 · 展开查看' }}</span>
          <label class="sw" :class="{ off: bpOff(bp.key) }" @click.stop title="停用后此学科×类型不注入教辅结构（生成端按用户指令自由组织）">
            <input type="checkbox" :checked="!bpOff(bp.key)" @change="toggleBp(bp.key, $event.target.checked)" />
            <span>{{ bpOff(bp.key) ? '已停用' : '启用' }}</span>
          </label>
        </div>
        <div v-if="openTeach === bp.key" class="bp-body">
          <div class="bp-secs">
            <div v-for="(s, i) in bp.sections" :key="i" class="bp-sec">
              <span class="sec-no">{{ i + 1 }}</span>
              <span class="sec-name">{{ s.name }}</span>
              <span class="sec-note">{{ s.note }}</span>
            </div>
          </div>
          <!-- 学段要求表：5 档全展示（生成时按所选学段注入对应档）；题量/篇幅底线由程序护栏校验，不注入 AI -->
          <div class="bp-stages">
            <div class="stages-head">📌 学段要求（5 档 · 生成时按所选学段注入对应档）</div>
            <div v-for="(p, sk) in bp.stages" :key="sk" class="stage-row" :class="{ cur: sk === (dims.stage || 'primary_mid') }">
              <span class="st-name">{{ STAGE_LABELS[sk] || sk }}</span>
              <span class="st-note">{{ p.note || '—' }}</span>
            </div>
            <div class="stages-foot">题量/篇幅底线（{{ (bp.stages.primary_mid && bp.stages.primary_mid.volume) || '—' }} 等）由 teaching-volume-guard 生成后静默校验，不注入 AI；教辅无考试时长</div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="bp-empty">当前筛选无教辅结构（选 exam 时仅显示真题蓝本）</div>

    <!-- 新建蓝本弹层 -->
    <div v-if="newOpen" class="modal-mask" @click.self="newOpen = false">
      <div class="modal">
        <h4>＋ 新增蓝本（自定义覆盖或新建）</h4>
        <div class="edit-grid">
          <label>学科
            <select v-model="newForm.subject">
              <option value="" disabled>选择学科</option>
              <option v-for="s in SUBJECT_KEYS" :key="s" :value="s">{{ s }}</option>
            </select>
          </label>
          <label>学段
            <select v-model="newForm.stage">
              <option v-for="(l, k) in STAGE_LABELS" :key="k" :value="k">{{ l }}</option>
            </select>
          </label>
          <label>资料类型 <input :value="'正式试卷（exam）'" disabled /></label>
        </div>
        <p class="modal-tip">蓝本键 = 学科 | 学段（标准名，如 语文|primary_low）。生成时按「教材（学段+学科）+ 资料类型」精确检索，用户自定义版优先于内置。已自定义的蓝本可点「重置为内置」还原。</p>
        <div class="bp-ops">
          <button class="btn-p" @click="createBp">创建并编辑</button>
          <button class="btn" @click="newOpen = false">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue';
import { EXAM_BLUEPRINTS } from '../../../config/examPaperBlueprints.js';
import { TEACHING_BLUEPRINTS, TEACHING_GEN_TYPES, TEACHING_SUBJECT_BLUEPRINTS } from '../../../config/teachingBlueprints.js';
import { validateAllBlueprints } from '../../../config/blueprintGuard.js';
import { CARRIER_LABELS, enhanceBlueprint } from '../../../config/blueprintSchema.js';
import { listAllBlueprints, saveUserBlueprint, deleteUserBlueprint } from '../../../config/blueprintProvider.js';
import { SUBJECT_KEYS } from '../../../config/toolLibrary.js';
import { exportLibrary, importLibrary, readLib, writeLib } from '../../../utils/libraryIO.js';
import { setLibToggle, listDisabledEntries } from '../../../utils/libToggles.js';

const dims = inject('toolDims', { value: { stage: '', subject: '', genType: '' } });
const refreshLibStats = inject('refreshLibStats', () => {});

/* ===== 条目启用/停用开关（停用 = 生成端不命中，见 blueprintProvider/getTeachingBlueprint） ===== */
const disabledBp = ref(new Set(listDisabledEntries('blueprint')));
const bpOff = (key) => disabledBp.value.has(key);
const toggleBp = (key, on) => {
  setLibToggle('blueprint', key, on);
  const next = new Set(disabledBp.value);
  if (on) next.delete(key); else next.add(key);
  disabledBp.value = next;
};

const STAGE_LABELS = {
  primary_low: '小学低段（1-2年级）', primary_mid: '小学中段（3-4年级）', primary_high: '小学高段（5-6年级）', middle: '初中（7-9年级）', high: '高中',
};
const GEN_TYPE_LABELS = {
  exam: '正式试卷', practice: '课时练', special: '专项突破', preview: '课前预习',
  reading: '阅读训练', summary: '知识总结', dictation: '默写积累', errorbook: '错题本', review: '复习资料',
};
/* ===== 数据源：内置 + 用户自定义（blueprintProvider） ===== */
const allExam = ref(listAllBlueprints().map((bp) => enhanceBlueprint(bp)));
const allExamCount = computed(() => allExam.value.length);
/** 教辅结构全矩阵：学科 × 资料类型（学段为参数，随筛选展示 5 档）；已定制用学科版栏目，未定制回退通用并标注 */
const allTeach = [];
for (const subj of SUBJECT_KEYS) {
  for (const t of TEACHING_GEN_TYPES) {
    const def = TEACHING_BLUEPRINTS[t];
    if (!def) continue;
    const custom = TEACHING_SUBJECT_BLUEPRINTS[subj]?.[t];
    const subjectStages = TEACHING_SUBJECT_BLUEPRINTS[subj]?.stages;
    allTeach.push({
      key: `${subj}|${t}`, subject: subj, genType: t, label: def.label,
      sections: (custom || def).sections, stages: subjectStages || def.stages, custom: !!custom,
    });
  }
}
const allTeachCount = allTeach.length;

/** 刷新数据源（保存/删除后调用） */
const reload = () => { allExam.value = listAllBlueprints().map((bp) => enhanceBlueprint(bp)); refreshLibStats(); };

/* ===== 手风琴 ===== */
const openKey = ref('');
const openTeach = ref('');
const toggle = (key) => { openKey.value = openKey.value === key ? '' : key; };
const toggleTeach = (key) => { openTeach.value = openTeach.value === key ? '' : key; };

/* ===== 全部/启用/停用 状态筛选（停用条目灰显，点击计数过滤列表） ===== */
const examFilter = ref('all'); // all | on | off
const teachFilter = ref('all');

/* ===== 筛选 ===== */
const matchStage = (key) => {
  const st = dims.value.stage;
  if (!st) return true;
  return key.includes(`|${st}`) || key === st;
};
const matchSubject = (key) => {
  const su = dims.value.subject;
  if (!su) return true;
  return key.startsWith(`${su}|`) || key === su;
};
const dimExamList = computed(() =>
  allExam.value.filter((bp) => {
    if (dims.value.genType && dims.value.genType !== 'exam') return false;
    return matchSubject(bp.key) && matchStage(bp.key);
  })
);
const examCounts = computed(() => {
  let on = 0, off = 0;
  for (const bp of dimExamList.value) { if (bpOff(bp.key)) off++; else on++; }
  return { total: dimExamList.value.length, on, off };
});
const examList = computed(() => dimExamList.value.filter((bp) => {
  if (examFilter.value === 'on' && bpOff(bp.key)) return false;
  if (examFilter.value === 'off' && !bpOff(bp.key)) return false;
  return true;
}));
const dimTeachList = computed(() =>
  allTeach.filter((bp) => {
    if (dims.value.genType === 'exam') return false;
    if (dims.value.genType && bp.genType !== dims.value.genType) return false;
    if (dims.value.subject && bp.subject !== dims.value.subject) return false;
    return true;
  })
);
const teachCounts = computed(() => {
  let on = 0, off = 0;
  for (const bp of dimTeachList.value) { if (bpOff(bp.key)) off++; else on++; }
  return { total: dimTeachList.value.length, on, off };
});
const teachList = computed(() => dimTeachList.value.filter((bp) => {
  if (teachFilter.value === 'on' && bpOff(bp.key)) return false;
  if (teachFilter.value === 'off' && !bpOff(bp.key)) return false;
  return true;
}));
const stageParam = (bp) => {
  const st = dims.value.stage;
  if (st && bp.stages && bp.stages[st]) return bp.stages[st];
  return (bp.stages && bp.stages.primary_mid) || {};
};

/* ===== 全中文三维度名（学段 × 学科 × 资料类型 + 库标记） ===== */
const parseKey = (key) => {
  const [subject, stage] = String(key || '').split('|');
  return { subject: subject || '', stage: stage || '' };
};
/** 真题蓝本：学段 · 学科 · 正式试卷 */
const dimName = (bp) => {
  const { subject, stage } = parseKey(bp.key);
  return `${STAGE_LABELS[stage] || stage || '全部学段'} · ${subject || '通用'} · 正式试卷`;
};
/** 教辅结构：学段(筛选) · 学科 · 资料类型（三维度名） */
const teachDimName = (bp) =>
  `${dims.value.stage ? STAGE_LABELS[dims.value.stage] : '全部学段'} · ${bp.subject} · ${GEN_TYPE_LABELS[bp.genType] || bp.genType}`;

/* ===== 校验 ===== */
const validateResults = computed(() => {
  const map = {};
  examList.value.forEach((bp) => { map[bp.key] = { ...bp }; delete map[bp.key].key; });
  return validateAllBlueprints(map);
});

/* ===== 编辑 / 保存 / 删除 / 新增 ===== */
const editingKey = ref('');
const draft = ref(null);

const startEdit = (bp) => {
  editingKey.value = bp.key;
  draft.value = JSON.parse(JSON.stringify({ label: bp.label, fullScore: bp.fullScore, duration: bp.duration, sections: bp.sections || [] }));
  openKey.value = bp.key;
};
const cancelEdit = () => { editingKey.value = ''; draft.value = null; };
const addSection = () => draft.value.sections.push({ name: '', score: 0, note: '' });
const removeSection = (i) => draft.value.sections.splice(i, 1);

const saveDraft = (key) => {
  if (!draft.value) return;
  const ok = saveUserBlueprint(key, draft.value);
  if (ok) { reload(); editingKey.value = ''; draft.value = null; }
  else window.alert('保存失败（localStorage 不可用或数据异常）');
};

const removeBp = (bp, reset = false) => {
  const msg = reset ? `重置「${bp.key}」为内置蓝本？` : `删除「${bp.key}」的自定义版本？`;
  if (!window.confirm(msg)) return;
  deleteUserBlueprint(bp.key);
  reload();
  if (openKey.value === bp.key) openKey.value = '';
};

/* ===== 新增蓝本 ===== */
const newOpen = ref(false);
const newForm = ref({ subject: '', stage: 'primary_low' });
const openNew = () => { newForm.value = { subject: '', stage: 'primary_low' }; newOpen.value = true; };
const createBp = () => {
  const subject = newForm.value.subject.trim();
  const stage = newForm.value.stage;
  if (!subject) { window.alert('请填写学科名（如 语文/数学/英语）'); return; }
  const key = `${subject}|${stage}`;
  const builtin = EXAM_BLUEPRINTS[key];
  const base = builtin ? { label: builtin.label, fullScore: builtin.fullScore, duration: builtin.duration, sections: builtin.sections } : { label: `${subject}·${STAGE_LABELS[stage]}`, fullScore: 100, duration: '60分钟', sections: [] };
  saveUserBlueprint(key, base);
  newOpen.value = false;
  reload();
  // 自动定位并进入编辑
  openKey.value = key;
  const bp = allExam.value.find((b) => b.key === key);
  if (bp) startEdit(bp);
};

/* ===== 复制蓝本 ===== */
const copyBp = (bp) => {
  const newKey = `${bp.key}_副本`;
  saveUserBlueprint(newKey, {
    label: `${bp.label}（副本）`,
    fullScore: bp.fullScore,
    duration: bp.duration,
    sections: JSON.parse(JSON.stringify(bp.sections || [])),
  });
  reload();
  openKey.value = newKey;
  const nb = allExam.value.find((b) => b.key === newKey);
  if (nb) startEdit(nb);
};

/* ===== 导入/导出 ===== */
const importInput = ref(null);
const BP_USER_KEY = 'wisdom_blueprint_library_v1';
const doExport = () => {
  exportLibrary('blueprint', readLib(BP_USER_KEY));
};
const doImport = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const data = await importLibrary(file);
    if (typeof data !== 'object' || data === null) throw new Error('数据格式不正确');
    writeLib(BP_USER_KEY, data);
    window.alert(`导入成功（${Object.keys(data).length} 条自定义蓝本）。`);
    reload();
  } catch (err) {
    window.alert('导入失败：' + err.message);
  }
  e.target.value = '';
};
</script>

<style scoped>
.bp-page { padding: 18px 22px 30px; max-width: 1080px; }
/* 条目启用/停用开关（停用卡片灰显） */
.sw { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; font-size: 12px; color: #2e7d32; user-select: none; white-space: nowrap; }
.sw.off { color: #c0392b; }
.sw input { accent-color: var(--primary); cursor: pointer; }
.bp-card.disabled .bp-head { opacity: .55; }
.bp-overview { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-size: 13px; background: var(--bg); border: 1px solid var(--border-light); border-radius: 10px; padding: 10px 14px; box-shadow: 0 2px 6px rgba(30,58,111,.06); }
.lib-badge { display: inline-block; font-size: 12px; font-weight: 700; color: #fff; background: var(--primary); border-radius: 6px; padding: 3px 10px; margin-right: 10px; }
.ov-sep { margin: 0 8px; color: #c2ccda; }
.issue-n { color: var(--danger); }
.dim-now { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.dimb { font-size: 12px; padding: 2px 10px; border-radius: 6px; background: var(--primary-lighter); color: var(--primary); border: 1px solid #c9d8ee; }
.btn-p { border: none; background: var(--primary); color: #fff; border-radius: 6px; padding: 6px 14px; font-size: 13px; cursor: pointer; }
.btn-p:hover { background: var(--primary-light); }
.btn { border: 1px solid var(--border); background: #fff; border-radius: 6px; padding: 5px 12px; font-size: 12.5px; cursor: pointer; }
.btn:hover { background: var(--primary-lighter); color: var(--primary); }
.btn.danger { color: var(--danger); border-color: var(--danger-light); }
.btn.x { padding: 2px 8px; }

.bp-validate { margin-top: 12px; background: #fff; border: 1px solid var(--border-light); border-radius: 10px; padding: 10px 14px; font-size: 12.5px; }
.bp-validate.ok { color: #1d7a4a; background: var(--success-light); border-color: #bfe6cd; }
.v-head { font-weight: 600; color: var(--primary); margin-bottom: 6px; }
.v-item { margin: 3px 0; }
.v-item.sev-error { color: var(--danger); }
.v-item.sev-warning { color: #a06a10; }
.v-code { font-family: Consolas, monospace; font-weight: 700; }

.bp-h { font-size: 14px; color: var(--primary); margin: 22px 0 10px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.hint { font-size: 11.5px; color: var(--text-muted); font-weight: 400; margin-left: 8px; }
/* 状态计数 chip（全部/启用/停用，点击过滤列表） */
.st-chips { display: inline-flex; gap: 6px; margin-left: auto; }
.st-chip { border: 1px solid var(--border); background: #fff; border-radius: 999px; padding: 2px 10px; font-size: 11.5px; cursor: pointer; color: var(--text-muted); }
.st-chip:hover { border-color: var(--primary-light); color: var(--primary); }
.st-chip.on { color: #2e7d32; }
.st-chip.off { color: #c0392b; }
.st-chip.sel { background: var(--primary); color: #fff; border-color: var(--primary); font-weight: 600; }
.st-chip.sel:hover { color: #fff; }
.st-chip.on.sel { background: #2e7d32; border-color: #2e7d32; }
.st-chip.off.sel { background: #c0392b; border-color: #c0392b; }
.bp-list { display: flex; flex-direction: column; gap: 8px; }
.bp-card { background: #fff; border: 1px solid var(--border-light); border-radius: 10px; overflow: hidden; }
.bp-card.open { border-color: var(--primary-light); box-shadow: 0 2px 10px rgba(30,58,111,.08); }
.bp-head { display: flex; align-items: center; gap: 8px; padding: 10px 14px; cursor: pointer; flex-wrap: wrap; }
.bp-head:hover { background: var(--primary-lighter); }
.arrow { color: var(--accent); font-weight: 700; }
.lib-tag { display: inline-block; font-size: 11px; font-weight: 700; color: #fff; background: var(--primary); border-radius: 6px; padding: 2px 8px; }
.dim-name { font-weight: 700; font-size: 13.5px; color: var(--ink, #26303e); }
.key-hint { font-size: 11px; color: var(--text-muted); font-weight: 400; }
.src-user { font-size: 10.5px; font-weight: 600; color: #a06a10; background: #fdf3e2; border: 1px solid #f3d9a8; border-radius: 999px; padding: 1px 8px; }
.src-custom { font-size: 10.5px; font-weight: 600; color: #1d7a4a; background: var(--success-light); border: 1px solid #bfe6cd; border-radius: 999px; padding: 1px 8px; }
.src-fallback { font-size: 10.5px; font-weight: 600; color: var(--text-muted); background: #f0f2f5; border: 1px solid var(--border-light); border-radius: 999px; padding: 1px 8px; }
.bp-meta { font-size: 12px; color: var(--text-muted); margin-left: auto; }
.bp-body { border-top: 1px dashed var(--border-light); padding: 10px 14px 14px; }
.bp-secs { display: flex; flex-direction: column; gap: 5px; }
.bp-sec { display: flex; align-items: center; gap: 8px; font-size: 12.5px; background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 8px; padding: 6px 10px; flex-wrap: wrap; }
.sec-no { color: var(--accent); font-weight: 700; }
.sec-name { font-weight: 600; }
.sec-score { color: var(--primary-light); font-weight: 600; }
.sec-note { color: #667; font-size: 12px; }
.carriers { margin-left: auto; display: flex; gap: 4px; flex-wrap: wrap; }
.car { font-size: 10.5px; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--border); color: #556; background: #fff; }
.c-zuo-wen-ge { background: #fdf3e2; border-color: #f3d9a8; color: #a06a10; }
.c-match { background: #eef3fa; border-color: #c9d8ee; color: #2b5ea7; }
.c-square-grid, .c-bracket-grid, .c-draw-area { background: var(--success-light); border-color: #bfe6cd; color: #1d7a4a; }
.c-blank-area { background: var(--primary-lighter); border-color: #c9d8ee; color: var(--primary); }
.bp-ops { display: flex; gap: 8px; margin-top: 10px; }
.stage-note { margin-top: 8px; font-size: 12px; color: #a06a10; background: #fdf3e2; border-radius: 8px; padding: 6px 10px; }
.bp-empty { color: var(--text-muted); font-size: 13px; padding: 10px 4px; }
.bp-stages { margin-top: 8px; border: 1px solid var(--border-light); border-radius: 8px; overflow: hidden; }
.stages-head { font-size: 12px; font-weight: 600; color: var(--primary); background: var(--primary-lighter); padding: 6px 10px; }
.stage-row { display: flex; align-items: baseline; gap: 10px; font-size: 12px; padding: 5px 10px; border-top: 1px dashed var(--border-light); flex-wrap: wrap; }
.stage-row.cur { background: #fbf7ec; }
.st-name { font-weight: 700; min-width: 118px; color: #26303e; }
.st-note { color: #667; font-size: 12px; }
.stages-foot { font-size: 11px; color: var(--text-muted); padding: 6px 10px; border-top: 1px dashed var(--border-light); }

/* 编辑态 */
.bp-edit { border-top: 1px dashed var(--border-light); padding: 12px 14px 14px; background: var(--primary-lighter); }
.edit-grid { display: grid; grid-template-columns: 1fr 100px 120px; gap: 10px; margin-bottom: 10px; }
.edit-grid label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-muted); }
.edit-grid input, .edit-grid select { border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; font-size: 13px; background: #fff; }
.edit-secs { display: flex; flex-direction: column; gap: 6px; }
.edit-sec { display: flex; align-items: flex-start; gap: 8px; background: #fff; border: 1px solid var(--border-light); border-radius: 8px; padding: 8px; }
.edit-sec .sec-no { margin-top: 6px; }
.in-name { width: 160px; border: 1px solid var(--border); border-radius: 6px; padding: 5px 8px; font-size: 12.5px; }
.in-score { width: 64px; border: 1px solid var(--border); border-radius: 6px; padding: 5px 8px; font-size: 12.5px; }
.edit-sec textarea { flex: 1; min-width: 200px; border: 1px solid var(--border); border-radius: 6px; padding: 5px 8px; font-size: 12px; resize: vertical; }
.btn.add { margin-top: 6px; }

/* 弹层 */
.modal-mask { position: fixed; inset: 0; background: rgba(30,42,64,.45); display: flex; align-items: center; justify-content: center; z-index: 999; }
.modal { background: #fff; border-radius: 12px; padding: 20px 22px; width: 420px; max-width: 92vw; box-shadow: 0 12px 40px rgba(0,0,0,.25); }
.modal h4 { margin: 0 0 14px; color: var(--primary); }
.modal-tip { font-size: 12px; color: var(--text-muted); margin: 10px 0; }
</style>
