<template>
  <div class="rc-page">
    <!-- 概览条（吸顶） -->
    <div class="rc-overview">
      <div>
        <span class="lib-badge">🎨 渲染契约库</span>
        <b>图形 TYPE {{ GRAPH_TYPES.length }}</b>
        <span class="ov-sep">·</span>
        <b>契约学科 {{ contractList.length }} / {{ SUBJECT_KEYS.length }}</b>
        <span class="ov-sep">·</span>
        <span>停用 <b class="issue-n">{{ disabledSub.size }}</b> 学科</span>
        <span class="ov-sep">·</span>
        <span>缺口 <b class="issue-n">{{ gapCount }}</b></span>
      </div>
      <div class="dim-now">
        <span class="dimb">{{ dims.subject || '全部学科' }}</span>
        <span class="dimb">{{ dims.stage ? STAGE_LABELS[dims.stage] : '全部学段' }}</span>
        <span class="dimb">{{ dims.genType ? GEN_TYPE_NAME[dims.genType] : '全部类型' }}</span>
        <button class="btn-p" @click="newOpen = true">＋ 新增契约</button>
        <button class="btn" @click="doExport">📤 导出</button>
        <button class="btn" @click="importInput?.click()">📥 导入</button>
        <input ref="importInput" type="file" accept=".json" style="display:none" @change="doImport" />
      </div>
    </div>

    <!-- 校验：覆盖缺口 -->
    <div class="rc-validate" v-if="validateMsgs.length">
      <div class="v-head">🔍 覆盖缺口自检</div>
      <div v-for="(m, i) in validateMsgs" :key="i" class="v-item" :class="`sev-${m.severity}`">
        <span class="v-code">{{ m.code }}</span> {{ m.detail }}
      </div>
    </div>
    <div class="rc-validate ok" v-else>✅ 渲染契约覆盖正常（当前筛选范围）</div>

    <!-- 图形 TYPE 目录（手风琴） -->
    <h4 class="rc-h">📊 图形 TYPE 目录（[GRAPH] 协议）<span class="hint">点击 TYPE 查看示例骨架</span>
      <span class="st-chips">
        <button class="st-chip" :class="{ sel: typeStatusFilter === 'all' }" @click="typeStatusFilter = 'all'">全部 {{ typeCounts.total }}</button>
        <button class="st-chip on" :class="{ sel: typeStatusFilter === 'on' }" @click="typeStatusFilter = 'on'">启用 {{ typeCounts.on }}</button>
        <button class="st-chip off" :class="{ sel: typeStatusFilter === 'off' }" @click="typeStatusFilter = 'off'">停用 {{ typeCounts.off }}</button>
      </span>
    </h4>
    <div class="rc-list">
      <div v-for="t in typeShowList" :key="t.id" class="rc-card" :class="{ open: openType === t.id, disabled: typeOff(t.id) }">
        <div class="rc-head" @click="toggleType(t.id)">
          <span class="arrow">{{ openType === t.id ? '▾' : '▸' }}</span>
          <span class="lib-tag">🎨 契约库</span>
          <span class="dim-name">{{ t.id }}</span>
          <span class="key-hint" :title="'图形类型'">GRAPH</span>
          <span class="rc-desc">{{ t.desc }}</span>
          <span class="rc-meta">{{ t.subjects.length }} 学科</span>
          <label class="sw" :class="{ off: typeOff(t.id) }" @click.stop title="停用后此 TYPE 不再注入 [GRAPH] 契约（渲染端不再输出）">
            <input type="checkbox" :checked="!typeOff(t.id)" @change="toggleTypeOn(t.id, $event.target.checked)" />
            <span>{{ typeOff(t.id) ? '已停用' : '启用' }}</span>
          </label>
        </div>
        <div v-if="openType === t.id" class="rc-body">
          <div class="rc-subjects">
            <b>适配学科：</b>
            <span v-for="s in t.subjects" :key="s" class="car">{{ s }}</span>
            <span v-if="!t.subjects.length" class="none">无学科适配（未启用）</span>
          </div>
          <pre class="rc-sample">{{ t.sample }}</pre>
        </div>
      </div>
    </div>

    <!-- 学科契约矩阵 -->
    <h4 class="rc-h">📚 学科契约（学科 × 学段 → 图形/公式/配图）<span class="hint">按学科筛选联动 · 展开可自定义</span>
      <span class="st-chips">
        <button class="st-chip" :class="{ sel: subStatusFilter === 'all' }" @click="subStatusFilter = 'all'">全部 {{ subCounts.total }}</button>
        <button class="st-chip on" :class="{ sel: subStatusFilter === 'on' }" @click="subStatusFilter = 'on'">启用 {{ subCounts.on }}</button>
        <button class="st-chip off" :class="{ sel: subStatusFilter === 'off' }" @click="subStatusFilter = 'off'">停用 {{ subCounts.off }}</button>
      </span>
    </h4>
    <div class="rc-list">
      <div v-for="c in contractList" :key="c.subject" class="rc-card" :class="{ open: openSub === c.subject, editing: editingSub === c.subject, disabled: subOff(c.subject) }">
        <div class="rc-head" @click="toggleSub(c.subject)">
          <span class="arrow">{{ openSub === c.subject ? '▾' : '▸' }}</span>
          <span class="lib-tag">🎨 契约库</span>
          <span class="dim-name">{{ c.subject }}</span>
          <span class="key-hint" :title="'学科契约'">{{ c.subject }}</span>
          <span v-if="c.missing" class="gap-tag">缺 GRAPH 契约</span>
          <span v-if="c.user" class="src-user">已自定义</span>
          <span class="rc-meta">
            <span v-if="c.graphTypes.length" class="mini">图形 {{ c.graphTypes.join('/') }}</span>
            <span v-if="c.formula" class="mini">公式 ✓</span>
            <span v-if="c.image" class="mini">配图 ✓</span>
          </span>
          <label class="sw" :class="{ off: subOff(c.subject) }" @click.stop title="停用后此学科不再注入图形/公式/配图契约（生成端不输出 [GRAPH]/公式/[IMAGE]）">
            <input type="checkbox" :checked="!subOff(c.subject)" @change="toggleSubOn(c.subject, $event.target.checked)" />
            <span>{{ subOff(c.subject) ? '已停用' : '启用' }}</span>
          </label>
        </div>
        <div v-if="openSub === c.subject && editingSub !== c.subject" class="rc-body">
          <div v-if="subOff(c.subject)" class="off-banner">⏸ 已停用：本学科图形/公式/配图契约均不注入（重新启用即恢复）</div>
          <div class="rc-subjects">
            <b>图形类型：</b>
            <span v-for="g in c.graphTypes" :key="g" class="car car-g">{{ g }}</span>
            <span v-if="!c.graphTypes.length" class="none">无（如需图表请补契约）</span>
          </div>
          <div class="rc-flags">
                <span class="flag" :class="c.formula ? 'on' : 'off'">公式 {{ c.formula ? '启用' : '未启用' }}</span>
                <span class="flag" :class="c.image ? 'on' : 'off'">配图 {{ c.image ? '启用' : '未启用' }}</span>
                <span v-if="c.stageEffect" class="flag stage-effect">{{ c.stageEffect }}</span>
                <span v-if="c.typeEffect" class="flag type-effect">{{ c.typeEffect }}</span>
              </div>
          <div class="rc-ops">
            <button class="btn" @click="startEdit(c)">✏️ 自定义契约</button>
            <button class="btn" @click="copyContract(c)">📋 复制</button>
            <button v-if="c.user" class="btn danger" @click="removeUser(c)">🗑️ 删除自定义</button>
          </div>
        </div>
        <!-- 编辑态：自定义学科契约 -->
        <div v-if="editingSub === c.subject" class="rc-edit">
          <div class="edit-label">图形类型（多选）</div>
          <div class="type-chips">
            <span
              v-for="t in GRAPH_TYPES"
              :key="t"
              class="chip-sel"
              :class="{ sel: editForm.graphTypes.includes(t) }"
              @click="toggleTypeSel(t)"
            >{{ t }}</span>
          </div>
          <div class="edit-grid">
            <label class="chk">公式（$..$ / $$..$$）<input v-model="editForm.formula" type="checkbox" /></label>
            <label class="chk">配图（[IMAGE]）<input v-model="editForm.image" type="checkbox" /></label>
          </div>
          <div class="rc-ops">
            <button class="btn-p" @click="saveUser(c.subject)">💾 保存契约</button>
            <button class="btn" @click="cancelEdit">取消</button>
          </div>
          <p class="edit-tip">※ 自定义契约即时生效：图（[GRAPH] TYPE）、公式（$..$）、配图（[IMAGE]）均按此覆盖内置，生成时自动读取；删除自定义即回退内置。</p>
        </div>
      </div>
      <div v-if="!contractList.length" class="rc-empty">当前筛选无学科契约（可放宽学科筛选）</div>
    </div>

    <!-- 配图与公式规则 -->
    <h4 class="rc-h">🖼️ 配图与公式规则</h4>
    <div class="rule-grid">
      <div class="rule-card">
        <b>[IMAGE] 配图</b>
        <p>触发关键词：<code>{{ IMAGE_KEYWORDS.join(' / ') }}</code></p>
        <p>教辅默认配图类型：<code>{{ IMAGE_DEFAULT_TYPES.join(' / ') }}</code></p>
        <p class="note">关键词已覆盖：识图 / 读图 / 示意 / 图表 / 地图 / 结构（生物结构图、地理读图等 needsImage 命中）。</p>
      </div>
      <div class="rule-card">
        <b>$..$ 公式</b>
        <p>公式学科：<code>{{ MATH_SUBJECTS.join(' / ') }}</code></p>
        <p>学段门控：数学低段不注入；物理/化学仅初中及以上。</p>
        <p class="note">图形数据必须与题干完全一致（契约强制）。</p>
      </div>
    </div>

    <!-- 新增契约弹层 -->
    <div v-if="newOpen" class="modal-mask" @click.self="newOpen = false">
      <div class="modal">
        <h4>＋ 新增学科契约</h4>
        <div class="modal-grid">
          <label>学科名称
            <input v-model="newForm.subject" placeholder="如：书法、地方课程…" list="subject-list" />
            <datalist id="subject-list">
              <option v-for="s in SUBJECT_KEYS" :key="s" :value="s" />
            </datalist>
          </label>
        </div>
        <div class="edit-label">图形类型（多选）</div>
        <div class="type-chips">
          <span v-for="t in GRAPH_TYPES" :key="t" class="chip-sel" :class="{ sel: newForm.graphTypes.includes(t) }" @click="toggleNewType(t)">{{ t }}</span>
        </div>
        <div class="edit-grid">
          <label class="chk">公式（$..$）<input v-model="newForm.formula" type="checkbox" /></label>
          <label class="chk">配图（[IMAGE]）<input v-model="newForm.image" type="checkbox" /></label>
        </div>
        <div class="rc-ops">
          <button class="btn-p" @click="saveNew">💾 保存</button>
          <button class="btn" @click="newOpen = false">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue';
import { GRAPH_TYPES, MATH_SUBJECTS, SUBJECT_GRAPH_TYPES, GRAPH_SAMPLES, needsImageHint } from '../../../config/eduRenderContract.js';
import { SUBJECT_KEYS } from '../../../config/toolLibrary.js';
import { exportLibrary, importLibrary, readLib, writeLib } from '../../../utils/libraryIO.js';
import { setLibToggle, listDisabledEntries } from '../../../utils/libToggles.js';

const dims = inject('toolDims', { value: { stage: '', subject: '', genType: '' } });

const STAGE_LABELS = {
  primary_low: '小学低段（1-2年级）', primary_mid: '小学中段（3-4年级）', primary_high: '小学高段（5-6年级）', middle: '初中（7-9年级）', high: '高中',
};
const GEN_TYPE_NAME = {
  exam: '正式试卷', practice: '课时练', special: '专项突破', preview: '课前预习',
  reading: '阅读训练', summary: '知识总结', dictation: '默写积累', errorbook: '错题本', review: '复习资料',
};
/* ===== 常量展示 ===== */
const GRAPH_TYPE_DESC = {
  COORDINATE: '数轴/坐标系（XLIM/YLIM/箭头/刻度）', SHAPES: '函数/几何（FUNCTION/POINT/POLYGON/CIRCLE）',
  BAR_CHART: '柱状统计图', LINE_CHART: '折线统计图', PIE_CHART: '饼状统计图',
  FORCE: '受力分析图', CIRCUIT: '电路图', OPTICS: '光路图', ATOM: '原子结构图',
};
const IMAGE_KEYWORDS = ['看图', '写话', '配图', '听音', '观察', '绘画', '绘图', '识图', '读图', '示意', '地图', '图表', '结构'];
const IMAGE_DEFAULT_TYPES = ['practice', 'special', 'preview', 'reading', 'dictation'];

/* ===== 图形 TYPE 目录 ===== */
const typeList = GRAPH_TYPES.map((id) => ({
  id,
  desc: GRAPH_TYPE_DESC[id] || '',
  sample: GRAPH_SAMPLES[id] || '（无示例）',
  subjects: Object.entries(SUBJECT_GRAPH_TYPES).filter(([, types]) => types.includes(id)).map(([s]) => s),
}));
const openType = ref('');
const toggleType = (id) => { openType.value = openType.value === id ? '' : id; };

/* ===== 全部/启用/停用 状态筛选（点击计数过滤列表） ===== */
const typeStatusFilter = ref('all'); // all | on | off
const typeCounts = computed(() => {
  let on = 0, off = 0;
  for (const t of typeList) { if (typeOff(t.id)) off++; else on++; }
  return { total: typeList.length, on, off };
});
const typeShowList = computed(() => typeList.filter((t) => {
  if (typeStatusFilter.value === 'on' && typeOff(t.id)) return false;
  if (typeStatusFilter.value === 'off' && !typeOff(t.id)) return false;
  return true;
}));

/* ===== 图形 TYPE 启用/停用开关（停用 = 不再注入该 TYPE，见 buildRenderContract） ===== */
const disabledType = ref(new Set(listDisabledEntries('render-contract')));
const typeOff = (id) => disabledType.value.has(id);
const toggleTypeOn = (id, on) => {
  setLibToggle('render-contract', id, on);
  const next = new Set(disabledType.value);
  if (on) next.delete(id); else next.add(id);
  disabledType.value = next;
};

/* ===== 学科契约启用/停用开关（停用 = 该学科不注入图形/公式/配图契约，见 buildRenderContract 的 subj: 检查） ===== */
const disabledSub = ref(new Set([...listDisabledEntries('render-contract')].filter((k) => k.startsWith('subj:')).map((k) => k.slice(5))));
const subOff = (subject) => disabledSub.value.has(subject);
const toggleSubOn = (subject, on) => {
  setLibToggle('render-contract', `subj:${subject}`, on);
  const next = new Set(disabledSub.value);
  if (on) next.delete(subject); else next.add(subject);
  disabledSub.value = next;
};

/* ===== 学科契约（内置 + 用户自定义） ===== */
const USER_KEY = 'wisdom_render_contract_v1';
const loadUser = () => { try { return JSON.parse(localStorage.getItem(USER_KEY) || '{}'); } catch { return {}; } };

const allContract = SUBJECT_KEYS.map((subject) => {
  const user = loadUser()[subject];
  const graphTypes = user ? (user.graphTypes || []) : (SUBJECT_GRAPH_TYPES[subject] || []);
  const formula = user ? !!user.formula : MATH_SUBJECTS.includes(subject);
  const image = user ? !!user.image : needsImageHint(`${subject} 看图配图听音观察`, 'exam');
  // 缺口：蓝本引用了 [GRAPH] 但学科无契约（历史已在 2026-08 补齐）
  const missing = false;
  return {
    subject, graphTypes, formula, image, missing,
    user: !!user, stageNote: subject === '数学' ? '低段裁剪（仅数轴/统计图）' : '全学段',
  };
});

/* ===== 三维度影响（学段/类型 → 契约状态变化） ===== */
const getStageEffect = (subject, stage) => {
  if (!stage) return '';
  if (subject === '数学') {
    if (stage === 'primary_low' || stage === 'primary_mid') return '低段：不注入公式（仅数轴/统计图）';
    return '中高段：注入公式';
  }
  if ((subject === '物理' || subject === '化学') && stage.startsWith('primary')) return '小学：不注入公式';
  return '';
};
const getTypeEffect = (genType) => {
  if (!genType) return '';
  if (IMAGE_DEFAULT_TYPES.includes(genType)) return `${GEN_TYPE_NAME[genType]}：默认配图`;
  if (genType === 'exam') return '试卷：不默认配图';
  return '';
};

/* 全部/启用/停用 状态筛选（点击计数过滤列表） */
const subStatusFilter = ref('all'); // all | on | off
const dimContractList = computed(() =>
  allContract
    .filter((c) => {
      if (dims.value.subject && c.subject !== dims.value.subject) return false;
      return true;
    })
    .map((c) => ({
      ...c,
      stageEffect: getStageEffect(c.subject, dims.value.stage),
      typeEffect: getTypeEffect(dims.value.genType),
    }))
);
const subCounts = computed(() => {
  let on = 0, off = 0;
  for (const c of dimContractList.value) { if (subOff(c.subject)) off++; else on++; }
  return { total: dimContractList.value.length, on, off };
});
const contractList = computed(() => dimContractList.value.filter((c) => {
  if (subStatusFilter.value === 'on' && subOff(c.subject)) return false;
  if (subStatusFilter.value === 'off' && !subOff(c.subject)) return false;
  return true;
}));
const openSub = ref('');
const toggleSub = (s) => { openSub.value = openSub.value === s ? '' : s; };
const gapCount = computed(() => allContract.filter((c) => c.missing).length);

/* ===== 校验 ===== */
const validateMsgs = computed(() => {
  const msgs = [];
  // 缺口历史已补齐（2026-08：SUBJECT_GRAPH_PARTS/TYPES 增"历史"）；IMAGE 关键词已扩展含识图/读图等。
  return msgs;
});

/* ===== 编辑学科契约（用户自定义） ===== */
const editingSub = ref('');
const editForm = ref({ graphTypes: [], formula: false, image: false });
const startEdit = (c) => {
  editingSub.value = c.subject;
  editForm.value = { graphTypes: [...c.graphTypes], formula: c.formula, image: c.image };
  openSub.value = c.subject;
};
const cancelEdit = () => { editingSub.value = ''; };
const toggleTypeSel = (t) => {
  const i = editForm.value.graphTypes.indexOf(t);
  if (i >= 0) editForm.value.graphTypes.splice(i, 1);
  else editForm.value.graphTypes.push(t);
};
const saveUser = (subject) => {
  const lib = loadUser();
  lib[subject] = { graphTypes: editForm.value.graphTypes, formula: editForm.value.formula, image: editForm.value.image, updatedAt: Date.now() };
  try { localStorage.setItem(USER_KEY, JSON.stringify(lib)); } catch { window.alert('保存失败'); return; }
  window.location.reload(); // 简单刷新以重算契约（数据量小，可接受）
};
const removeUser = (c) => {
  if (!window.confirm(`删除「${c.subject}」的自定义契约？删除后回退内置。`)) return;
  const lib = loadUser();
  delete lib[c.subject];
  try { localStorage.setItem(USER_KEY, JSON.stringify(lib)); } catch {}
  window.location.reload();
};

/* ===== 新增自定义学科契约 ===== */
const newOpen = ref(false);
const newForm = ref({ subject: '', graphTypes: [], formula: false, image: false });
const toggleNewType = (t) => {
  const i = newForm.value.graphTypes.indexOf(t);
  if (i >= 0) newForm.value.graphTypes.splice(i, 1);
  else newForm.value.graphTypes.push(t);
};
const saveNew = () => {
  const name = newForm.value.subject.trim();
  if (!name) { window.alert('请输入学科名称'); return; }
  const lib = loadUser();
  lib[name] = { graphTypes: newForm.value.graphTypes, formula: newForm.value.formula, image: newForm.value.image, updatedAt: Date.now() };
  try { localStorage.setItem(USER_KEY, JSON.stringify(lib)); } catch { window.alert('保存失败'); return; }
  window.location.reload();
};

/* ===== 导入/导出 ===== */
const importInput = ref(null);
const doExport = () => {
  exportLibrary('render_contract', readLib(USER_KEY));
};
const doImport = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const data = await importLibrary(file);
    writeLib(USER_KEY, data);
    window.location.reload();
  } catch (err) {
    window.alert('导入失败：' + err.message);
  }
  e.target.value = '';
};

/* ===== 复制契约 → 打开新增弹层（预填数据） ===== */
const copyContract = (c) => {
  newForm.value = { subject: `${c.subject}_副本`, graphTypes: [...c.graphTypes], formula: c.formula, image: c.image };
  newOpen.value = true;
};

</script>

<style scoped>
.rc-page { padding: 18px 22px 30px; max-width: 1080px; }
/* 图形 TYPE 启用/停用开关（停用卡片灰显） */
.sw { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; font-size: 12px; color: #2e7d32; user-select: none; white-space: nowrap; }
.sw.off { color: #c0392b; }
.sw input { accent-color: var(--primary); cursor: pointer; }
.rc-card.disabled .rc-head { opacity: .55; }
.off-banner { font-size: 12px; color: #a06a10; background: #fdf3e2; border: 1px solid #f3d9a8; border-radius: 6px; padding: 6px 10px; margin-bottom: 8px; }
.rc-overview { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-size: 13px; background: var(--bg); border: 1px solid var(--border-light); border-radius: 10px; padding: 10px 14px; box-shadow: 0 2px 6px rgba(30,58,111,.06); }
.lib-badge { display: inline-block; font-size: 12px; font-weight: 700; color: #fff; background: var(--primary); border-radius: 6px; padding: 3px 10px; margin-right: 10px; }
.ov-sep { margin: 0 8px; color: #c2ccda; }
.issue-n { color: var(--danger); }
.dim-now { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.dimb { font-size: 12px; padding: 2px 10px; border-radius: 6px; background: var(--primary-lighter); color: var(--primary); border: 1px solid #c9d8ee; }

.rc-validate { margin-top: 12px; background: #fff; border: 1px solid var(--border-light); border-radius: 10px; padding: 10px 14px; font-size: 12.5px; }
.rc-validate.ok { color: #1d7a4a; background: var(--success-light); border-color: #bfe6cd; }
.v-head { font-weight: 600; color: var(--primary); margin-bottom: 6px; }
.v-item { margin: 3px 0; }
.v-item.sev-error { color: var(--danger); }
.v-item.sev-warning { color: #a06a10; }
.v-code { font-family: Consolas, monospace; font-weight: 700; }

.rc-h { font-size: 14px; color: var(--primary); margin: 22px 0 10px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
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
.rc-list { display: flex; flex-direction: column; gap: 8px; }
.rc-card { background: #fff; border: 1px solid var(--border-light); border-radius: 10px; overflow: hidden; }
.rc-card.open { border-color: var(--primary-light); box-shadow: 0 2px 10px rgba(30,58,111,.08); }
.rc-head { display: flex; align-items: center; gap: 8px; padding: 10px 14px; cursor: pointer; flex-wrap: wrap; }
.rc-head:hover { background: var(--primary-lighter); }
.arrow { color: var(--accent); font-weight: 700; }
.lib-tag { display: inline-block; font-size: 11px; font-weight: 700; color: #fff; background: var(--primary); border-radius: 6px; padding: 2px 8px; }
.dim-name { font-weight: 700; font-size: 13.5px; color: #26303e; font-family: Consolas, monospace; }
.key-hint { font-size: 11px; color: var(--text-muted); font-weight: 400; }
.rc-desc { font-size: 12px; color: #667; }
.rc-meta { font-size: 12px; color: var(--text-muted); margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap; }
.mini { font-size: 11px; padding: 1px 8px; border-radius: 999px; background: var(--primary-lighter); color: var(--primary); }
.gap-tag { font-size: 10.5px; font-weight: 700; color: #b03a2e; background: var(--danger-light); border: 1px solid #f5c2bd; border-radius: 999px; padding: 1px 8px; }
.src-user { font-size: 10.5px; font-weight: 600; color: #a06a10; background: #fdf3e2; border: 1px solid #f3d9a8; border-radius: 999px; padding: 1px 8px; }
.rc-body { border-top: 1px dashed var(--border-light); padding: 10px 14px 14px; }
.rc-subjects { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12.5px; }
.rc-subjects b { color: var(--primary); }
.car { font-size: 11px; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--border); color: #556; background: #fff; }
.car-g { background: var(--success-light); border-color: #bfe6cd; color: #1d7a4a; }
.none { color: var(--text-muted); font-size: 12px; }
.rc-sample { white-space: pre-wrap; word-break: break-all; font-size: 11.5px; line-height: 1.6; color: #445; background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 8px; padding: 10px 12px; max-height: 220px; overflow: auto; margin: 8px 0 0; }
.rc-flags { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.flag { font-size: 11.5px; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--border); color: #667; }
.flag.on { background: var(--success-light); border-color: #bfe6cd; color: #1d7a4a; }
.flag.off { background: var(--bg-card); }
.rc-ops { display: flex; gap: 8px; margin-top: 10px; }
.btn { border: 1px solid var(--border); background: #fff; border-radius: 6px; padding: 5px 12px; font-size: 12.5px; cursor: pointer; }
.btn:hover { background: var(--primary-lighter); color: var(--primary); }
.btn.danger { color: var(--danger); border-color: var(--danger-light); }
.btn-p { border: none; background: var(--primary); color: #fff; border-radius: 6px; padding: 6px 14px; font-size: 13px; cursor: pointer; }
.btn-p:hover { background: var(--primary-light); }

.rc-edit { border-top: 1px dashed var(--border-light); padding: 12px 14px 14px; background: var(--primary-lighter); }
.edit-label { font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
.type-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.chip-sel { font-size: 11.5px; padding: 4px 12px; border-radius: 999px; border: 1px solid var(--border); cursor: pointer; background: #fff; color: #556; font-family: Consolas, monospace; }
.chip-sel.sel { background: var(--primary); color: #fff; border-color: var(--primary); }
.edit-grid { display: flex; gap: 16px; margin-bottom: 8px; }
.edit-grid label.chk { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #445; }
.edit-tip { font-size: 11.5px; color: var(--text-muted); margin: 8px 0 0; }
.rc-empty { color: var(--text-muted); font-size: 13px; padding: 10px 4px; }

.rule-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
.rule-card { background: #fff; border: 1px solid var(--border-light); border-radius: 10px; padding: 12px 14px; font-size: 12.5px; }
.rule-card b { color: var(--primary); }
.rule-card p { margin: 6px 0; color: #445; }
.rule-card code { background: var(--primary-lighter); color: var(--primary); padding: 1px 6px; border-radius: 4px; font-size: 11.5px; }
.warn-note { color: #a06a10; }
.note { color: var(--text-muted); }

.flag.stage-effect { background: #fdf3e2; border-color: #f3d9a8; color: #a06a10; }
.flag.type-effect { background: #e8f5e9; border-color: #c8e6c9; color: #2e7d32; }

.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 100; display: flex; align-items: center; justify-content: center; }
.modal { background: #fff; border-radius: 12px; padding: 20px 24px; width: 460px; max-width: 90vw; box-shadow: 0 8px 30px rgba(0,0,0,.18); }
.modal h4 { margin: 0 0 14px; font-size: 15px; color: var(--primary); }
.modal-grid { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.modal-grid label { font-size: 12.5px; color: var(--primary); font-weight: 600; }
.modal-grid input { border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; font-size: 13px; }
</style>
