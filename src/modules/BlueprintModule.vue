<template>
  <div class="blueprint-module">
    <div class="page-head">
      <h2>📐 蓝图库</h2>
      <p class="page-desc">
        正式考卷的卷面结构（大题/分值/时长/命题要求）来自蓝图库。内置蓝本按各学段现行课标真题卷结构设计；
        点开蓝本修改保存后持久化，生成模块的卷面结构自动生效（用户版优先于内置）。
        <button class="btn btn-sm region-btn" @click="openRegionModal">🏙 省市分值维护</button>
      </p>
      <p class="page-desc placeholder-desc">
        三维度定位：<b>年级 × 学科 × 资料类型</b>——卷面结构（大题/分值/时长）是<b>正式考卷（exam）</b>的专属属性；
        课时练/预习等教辅类资料无固定卷面结构，其结构与流程由指令库模板指导。地区选择（省市）覆盖总分/时长时，
        各大题分值按新总分等比例缩放，末大题自动修正——该逻辑不受自定义蓝图影响。
      </p>
    </div>

    <div class="lib-layout">
      <!-- 左：蓝图列表（筛选 + 列表） -->
      <div class="lib-list">
        <div class="lib-list-head">
          <span>蓝图（{{ filteredBlueprints.length }}）</span>
          <button class="btn btn-sm" @click="createNew">➕ 新建</button>
        </div>
        <div class="lib-filters">
          <select v-model="filter.genType" class="filter-select">
            <option value="exam">正式考卷</option>
          </select>
          <select v-model="filter.subject" class="filter-select">
            <option value="">全部学科</option>
            <option v-for="s in SUBJECT_OPTS" :key="s" :value="s">{{ s }}</option>
          </select>
          <select v-model="filter.stage" class="filter-select">
            <option value="">全部学段</option>
            <option v-for="s in STAGE_OPTS.filter(o => o.value)" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
          <select v-model="previewRegion" class="filter-select" :title="'省市预览：显示该省市中考总分/时长覆盖后的分值（不影响存储的基础蓝本）'">
            <option value="">不预览（基础蓝本）</option>
            <option v-for="r in EXAM_REGION_OPTIONS" :key="r" :value="r">{{ r }}</option>
          </select>
          <span class="filter-hint">卷面结构蓝图仅正式考卷有；教辅类由指令库模板指导</span>
        </div>
        <div class="lib-items">
          <div
            v-for="bp in filteredBlueprints"
            :key="bp.key"
            class="lib-item"
            :class="{ active: currentKey === bp.key }"
            @click="select(bp)"
          >
            <div class="lib-item-title">{{ bp.label }}</div>
            <div class="lib-item-key">
              <span class="badge" :class="bp.source === 'user' ? 'badge-user' : 'badge-builtin'">
                {{ bp.source === 'user' ? '自定义' : '内置' }}
              </span>
              {{ bp.fullScore }}分 · {{ bp.duration }} · {{ bp.sections?.length || 0 }}个大题
            </div>
          </div>
          <div v-if="!filteredBlueprints.length" class="lib-empty">当前筛选无蓝图<br />（卷面结构仅正式考卷需要，教辅类由指令库模板指导）</div>
        </div>
      </div>

      <!-- 右：编辑区 -->
      <div class="lib-editor">
        <template v-if="current">
          <div class="editor-head">
            <span class="editor-head-title">
              {{ current.label }}
              <span v-if="current.preview && previewRegion" class="preview-tag">预览·{{ previewRegion }}（总分已覆盖，仅显示）</span>
            </span>
            <button class="btn btn-sm" @click="clearSelection" title="关闭编辑区">✕ 关闭</button>
          </div>
          <div class="editor-meta">
            <label>学科
              <select v-model="form.subject">
                <option v-for="s in SUBJECT_OPTS" :key="s" :value="s">{{ s }}</option>
              </select>
            </label>
            <label>学段
              <select v-model="form.stage">
                <option v-for="s in STAGE_OPTS" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
            </label>
            <label>总分
              <input v-model.number="form.fullScore" type="number" min="1" max="300" />
            </label>
            <label>考试时长
              <input v-model="form.duration" placeholder="如 60分钟" />
            </label>
          </div>
          <input v-model="form.label" class="name-input" placeholder="蓝图名称（如：语文·小学低段（1-2年级））" />

          <div class="sections-head">
            <span>大题结构（各大题分值之和 = 总分 {{ form.fullScore || 0 }}）</span>
            <button class="btn btn-sm" @click="addSection">➕ 加大题</button>
          </div>
          <div class="section-list">
            <div v-for="(sec, i) in form.sections" :key="i" class="section-row">
              <div class="section-row-top">
                <span class="section-no">{{ '一二三四五六七八九十'[i] || i + 1 }}</span>
                <input v-model="sec.name" class="sec-name" placeholder="大题名称（如：识字与写字）" />
                <input v-model.number="sec.score" class="sec-score" type="number" min="0" placeholder="分值" />
                <button class="btn btn-sm btn-remove" @click="form.sections.splice(i, 1)">✕</button>
              </div>
              <textarea v-model="sec.note" class="sec-note" rows="2" placeholder="大题命题要求（新课标视角，命题角色依据；给模型的大题内命题指引）"></textarea>
            </div>
            <div v-if="!form.sections.length" class="empty-sections">暂无大题，点「➕ 加大题」开始搭建卷面结构。</div>
          </div>

          <div class="editor-actions">
            <button class="btn-primary" @click="save">💾 保存到蓝图库</button>
            <button v-if="current.source === 'user'" class="btn" @click="remove">🗑️ 删除（回退内置）</button>
            <button v-if="current.source === 'builtin'" class="btn" @click="duplicateFromBuiltin">📋 复制为自定义</button>
            <span v-if="savedTip" class="saved-tip">{{ savedTip }}</span>
          </div>
        </template>
        <div v-else class="empty-tip">
          <p>从左侧选择蓝图进行编辑，或点「➕ 新建」创建。</p>
          <p class="empty-sub">匹配规则：生成正式考卷时按「学科 × 学段」精确匹配用户自定义蓝图（优先），否则使用内置蓝图（含省市覆盖/学段降级）。</p>
        </div>
      </div>
    </div>

    <!-- 🏙 省市分值维护弹窗（中考 · 初中；用户覆盖优先于内置，生成与预览即时生效） -->
    <div v-if="showRegionModal" class="modal-mask" @click.self="showRegionModal = false">
      <div class="modal-panel">
        <div class="modal-head">
          <span>🏙 省市分值维护（中考 · 初中）</span>
          <button class="btn btn-sm" @click="showRegionModal = false">✕</button>
        </div>
        <p class="modal-desc">
          内置各市中考试卷总分/时长（各市中考总分 100-150 分不等）。修改后保存即覆盖（用户版优先），生成与面板"省市预览"即时生效；
          清空总分并保存可回退内置。高考全国统一 3+1+2、小学无地区差异，无需维护。
        </p>
        <div class="region-sel-row">
          <select v-model="regionSel" class="filter-select">
            <option value="">选择省市</option>
            <option v-for="r in EXAM_REGION_OPTIONS" :key="r" :value="r">{{ r }}</option>
          </select>
          <span class="filter-hint">{{ regionSel ? `已显示 ${regionSel} 初中各学科` : '请先选择省市' }}</span>
        </div>
        <div v-if="regionSel" class="region-table">
          <div class="region-row region-row-head">
            <span>学科</span><span>内置总分</span><span>内置时长</span><span>覆盖总分</span><span>覆盖时长</span><span>操作</span>
          </div>
          <div v-for="row in regionRows" :key="row.subject" class="region-row">
            <span class="region-subject">{{ row.subject }}</span>
            <span class="region-cell">{{ row.builtin.fullScore || '—' }}</span>
            <span class="region-cell">{{ row.builtin.duration || '—' }}</span>
            <input v-model.number="row.override.fullScore" class="filter-input region-input" type="number" min="1" max="300" :placeholder="row.builtin.fullScore || ''" />
            <input v-model="row.override.duration" class="filter-input region-input" :placeholder="row.builtin.duration || ''" />
            <span class="region-ops">
              <button class="btn btn-sm" @click="saveRegionRow(row)" title="保存覆盖">💾</button>
              <button v-if="row.hasOverride" class="btn btn-sm btn-remove" @click="removeRegionRow(row)" title="回退内置">↩️</button>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import {
  listAllBlueprints, saveUserBlueprint, deleteUserBlueprint, previewWithRegion,
} from '@/config/blueprintProvider.js';
import { EXAM_REGION_OPTIONS, EXAM_REGION_CONFIG, setRegionOverride, removeRegionOverride, loadUserRegionConfig } from '@/config/examRegionConfig.js';

const STAGE_OPTS = [
  { value: '', label: '全部学段' },
  { value: 'primary_low', label: '小学低段（1-2年级）' },
  { value: 'primary_mid', label: '小学中段（3-4年级）' },
  { value: 'primary_high', label: '小学高段（5-6年级）' },
  { value: 'middle', label: '初中' },
  { value: 'high', label: '高中' },
  { value: 'all', label: '跨学段通用' },
];

const blueprints = ref([]);
const currentKey = ref('');
const current = ref(null);
const savedTip = ref('');
const form = ref({ subject: '', stage: '', label: '', fullScore: 100, duration: '60分钟', sections: [] });

// 🔴 列表筛选（资料类型/学科/学段——卷面结构蓝图仅 exam 类型有数据）
const filter = ref({ genType: 'exam', subject: '', stage: '' });
// 省市预览：选中省市后，内置蓝本按该省市总分/时长覆盖显示（不改变存储的基础蓝本）
const previewRegion = ref('');
const filteredBlueprints = computed(() => {
  return blueprints.value
    .map(bp => previewWithRegion(bp, previewRegion.value))
    .filter((bp) => {
      const [subj, stg] = String(bp.key || '').split('|');
      if (filter.value.subject && subj !== filter.value.subject) return false;
      if (filter.value.stage && stg !== filter.value.stage) return false;
      return true;
    });
});

/** 学科下拉：从蓝本 key 去重（与蓝图库同源，避免旧名"信息技术"混入） */
const SUBJECT_OPTS = computed(() => {
  const set = new Set();
  for (const bp of blueprints.value) set.add(String(bp.key).split('|')[0]);
  return [...set].sort();
});

const refresh = () => {
  blueprints.value = listAllBlueprints();
};

const parseKey = (key = '') => {
  const [subject, stage] = String(key).split('|');
  return { subject: subject || '', stage: stage || '' };
};

const select = (bp) => {
  // 再次点击当前选中项 → 取消选中（关闭右侧编辑区）
  if (currentKey.value === bp.key) { clearSelection(); return; }
  current.value = bp;
  currentKey.value = bp.key;
  const p = parseKey(bp.key);
  form.value = {
    ...p,
    label: bp.label || bp.key,
    fullScore: bp.fullScore,
    duration: bp.duration,
    sections: (bp.sections || []).map(s => ({ ...s })),
  };
};

const clearSelection = () => {
  current.value = null;
  currentKey.value = '';
  savedTip.value = '';
};

const createNew = () => {
  current.value = { key: '', source: 'user' };
  currentKey.value = '__new__';
  form.value = { subject: '语文', stage: 'primary_low', label: '', fullScore: 100, duration: '60分钟', sections: [] };
  savedTip.value = '';
};

const duplicateFromBuiltin = () => {
  current.value = { key: '', source: 'user' };
  currentKey.value = '__new__';
  form.value = { ...form.value, label: `${form.value.label || ''}（副本）` };
  savedTip.value = '';
};

const addSection = () => {
  form.value.sections.push({ name: '', score: 0, note: '' });
};

const save = () => {
  const key = [form.value.subject, form.value.stage].filter(Boolean).join('|');
  if (!form.value.subject || !form.value.stage || !form.value.sections.length) {
    savedTip.value = '⚠️ 请选择学科与学段，并至少添加一个大题';
    return;
  }
  // 大题分值之和校验（提示但不阻止）
  const sum = form.value.sections.reduce((a, s) => a + (Number(s.score) || 0), 0);
  if (sum !== Number(form.value.fullScore || 0)) {
    savedTip.value = `⚠️ 大题分值之和（${sum}）≠ 总分（${form.value.fullScore}），已保存——建议修正使之和等于总分`;
  } else {
    savedTip.value = '✅ 已保存，持久化已更新，生成模块自动生效';
  }
  saveUserBlueprint(key, { ...form.value, sections: form.value.sections.map(s => ({ name: s.name, score: Number(s.score) || 0, note: s.note })) });
  refresh();
  currentKey.value = key;
  nextTick(() => {
    const found = blueprints.value.find(t => t.key === key);
    if (found) current.value = found;
  });
  setTimeout(() => { savedTip.value = ''; }, 4000);
};

const remove = () => {
  if (!current.value?.key) return;
  if (!window.confirm(`删除自定义蓝图「${current.value.label || current.value.key}」？将回退到内置蓝本。`)) return;
  deleteUserBlueprint(current.value.key);
  refresh();
  current.value = null;
  currentKey.value = '';
  savedTip.value = '';
};

onMounted(refresh);

/* ══════════ 省市分值维护（弹窗） ══════════ */
const showRegionModal = ref(false);
const regionSel = ref('');
const regionTick = ref(0);
const openRegionModal = () => { showRegionModal.value = true; regionSel.value = ''; };

/** 选定省市的初中各学科行（内置值 + 用户覆盖值） */
const regionRows = computed(() => {
  regionTick.value; // 依赖触发：保存/删除后自增刷新
  if (!regionSel.value) return [];
  const builtinMap = EXAM_REGION_CONFIG[regionSel.value]?.middle || {};
  const userMap = loadUserRegionConfig()[regionSel.value]?.middle || {};
  const subjects = new Set([...Object.keys(builtinMap), ...Object.keys(userMap)]);
  return [...subjects].map(subject => ({
    subject,
    builtin: { fullScore: builtinMap[subject]?.fullScore || '', duration: builtinMap[subject]?.duration || '' },
    override: { fullScore: userMap[subject]?.fullScore ?? null, duration: userMap[subject]?.duration ?? '' },
    hasOverride: !!userMap[subject],
  }));
});

const saveRegionRow = (row) => {
  const score = Number(row.override.fullScore);
  if (!score || score < 1) { savedTip.value = `⚠️ ${row.subject}：请填写有效的覆盖总分`; return; }
  setRegionOverride(regionSel.value, 'middle', row.subject, { fullScore: score, duration: String(row.override.duration || '').trim() });
  savedTip.value = `✅ ${row.subject}（${regionSel.value}）覆盖已保存，生成即时生效`;
  regionTick.value++;
  setTimeout(() => { savedTip.value = ''; }, 3000);
};

const removeRegionRow = (row) => {
  removeRegionOverride(regionSel.value, 'middle', row.subject);
  savedTip.value = `↩️ ${row.subject}（${regionSel.value}）已回退内置`;
  regionTick.value++;
  setTimeout(() => { savedTip.value = ''; }, 3000);
};
</script>

<style scoped>
.blueprint-module { padding: 20px 24px; max-width: 1200px; margin: 0 auto; }
.page-head { display: flex; flex-direction: column; gap: 6px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border-light); }
.page-head h2 { margin: 0; font-size: 20px; color: var(--primary); font-weight: 600; }
.page-desc { color: var(--text-secondary); font-size: 13px; line-height: 1.7; margin: 0; }
.placeholder-desc { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
.placeholder-desc b { color: var(--text-secondary); }
.filter-select { padding: 6px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 12px; background: #fff; color: var(--text-primary); flex-shrink: 0; cursor: pointer; }
.filter-select:focus { outline: none; border-color: var(--primary-light); box-shadow: 0 0 0 2px var(--primary-lighter); }
.filter-hint { font-size: 11px; color: var(--text-muted); white-space: nowrap; margin-left: 4px; }
.lib-layout { display: flex; gap: 16px; align-items: flex-start; }
.lib-list { width: 340px; flex-shrink: 0; background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-md); overflow: hidden; max-height: 72vh; display: flex; flex-direction: column; box-shadow: 0 1px 3px rgba(30,58,111,0.05); }
.lib-list-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: linear-gradient(90deg, var(--primary-lighter), #f5f8fd); border-bottom: 1px solid var(--border-light); font-weight: 600; color: var(--primary); flex-shrink: 0; }
.lib-filters { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--border-light); flex-wrap: nowrap; flex-shrink: 0; }
.lib-items { overflow-y: auto; flex: 1; padding: 6px; display: flex; flex-direction: column; gap: 4px; }
.lib-empty { color: var(--text-muted); font-size: 13px; text-align: center; padding: 40px 12px; line-height: 1.8; }
.lib-item { padding: 10px 12px; border-radius: var(--radius-sm); cursor: pointer; border: 1px solid transparent; transition: background 0.15s, border-color 0.15s; }
.lib-item:hover { background: var(--primary-lighter); }
.lib-item.active { background: linear-gradient(135deg, var(--primary-light), var(--primary)); color: #fff; }
.lib-item-title { font-weight: 600; font-size: 14px; margin-bottom: 3px; }
.lib-item-key { font-size: 12px; opacity: 0.75; display: flex; align-items: center; gap: 6px; }
.badge { font-size: 11px; padding: 2px 10px; border-radius: 20px; font-weight: 500; }
.badge-user { background: var(--success-light); color: var(--success); }
.badge-builtin { background: var(--primary-lighter); color: var(--primary-light); }
.lib-item.active .badge-user { background: rgba(255,255,255,0.25); color: #fff; }
.lib-item.active .badge-builtin { background: rgba(255,255,255,0.2); color: #fff; }
.lib-editor { flex: 1; background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 20px; box-shadow: 0 1px 3px rgba(30,58,111,0.05); }
.editor-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid var(--border-light); }
.editor-head-title { font-weight: 600; font-size: 15px; color: var(--primary); display: flex; align-items: center; gap: 8px; }
.preview-tag { font-size: 11px; font-weight: 500; padding: 2px 10px; border-radius: 20px; background: var(--warning-light); color: var(--warning); }
.editor-meta { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 12px; }
.editor-meta label { display: flex; flex-direction: column; font-size: 12px; color: var(--text-secondary); gap: 4px; }
.editor-meta select, .editor-meta input { padding: 7px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px; min-width: 130px; background: #fff; color: var(--text-primary); }
.editor-meta select:focus, .editor-meta input:focus, .name-input:focus, .sec-name:focus, .sec-score:focus, .sec-note:focus { outline: none; border-color: var(--primary-light); box-shadow: 0 0 0 2px var(--primary-lighter); }
.name-input { width: 100%; padding: 9px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: 10px; font-size: 14px; box-sizing: border-box; color: var(--text-primary); }
.sections-head { display: flex; justify-content: space-between; align-items: center; font-weight: 600; font-size: 13px; color: var(--text-secondary); margin: 6px 0 8px; }
.section-list { display: flex; flex-direction: column; gap: 8px; max-height: 46vh; overflow-y: auto; padding-right: 4px; }
.section-row { border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 8px; background: #fff; transition: border-color 0.15s; }
.section-row:hover { border-color: var(--border); }
.section-row-top { display: flex; align-items: center; gap: 8px; }
.section-no { font-weight: 700; color: var(--primary-light); font-size: 15px; width: 20px; flex-shrink: 0; }
.sec-name { flex: 1; padding: 6px 9px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px; color: var(--text-primary); background: #fff; }
.sec-score { width: 70px; padding: 6px 9px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px; color: var(--text-primary); background: #fff; }
.sec-note { width: 100%; box-sizing: border-box; margin-top: 6px; padding: 6px 9px; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 12px; line-height: 1.6; font-family: inherit; background: #fff; color: var(--text-primary); resize: vertical; }
.btn-remove { color: var(--danger); }
.empty-sections { color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px 0; border: 1px dashed var(--border); border-radius: var(--radius-sm); }
.editor-actions { margin-top: 12px; display: flex; align-items: center; gap: 10px; }
.saved-tip { font-size: 13px; color: var(--success); }
.empty-tip { color: var(--text-muted); text-align: center; padding: 60px 20px; }
.empty-sub { font-size: 12px; color: var(--text-muted); margin-top: 8px; }
.btn-sm { padding: 4px 12px; font-size: 12px; }
.region-btn { margin-left: 8px; border-color: var(--border); background: #fff; color: var(--primary-light); }
.region-btn:hover { background: var(--primary-lighter); }

/* 省市分值维护弹窗 */
.modal-mask { position: fixed; inset: 0; background: rgba(30, 58, 111, 0.35); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-panel { width: 680px; max-width: 92vw; max-height: 80vh; overflow-y: auto; background: #fff; border-radius: var(--radius-md); padding: 20px; box-shadow: 0 8px 30px rgba(30, 58, 111, 0.18); }
.modal-head { display: flex; justify-content: space-between; align-items: center; font-weight: 600; font-size: 16px; color: var(--primary); margin-bottom: 8px; }
.modal-desc { font-size: 12px; color: var(--text-muted); line-height: 1.7; margin-bottom: 12px; }
.region-sel-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.region-table { border: 1px solid var(--border-light); border-radius: var(--radius-sm); overflow: hidden; }
.region-row { display: grid; grid-template-columns: 90px 70px 90px 90px 110px 90px; gap: 8px; align-items: center; padding: 8px 10px; border-bottom: 1px solid var(--border-light); font-size: 13px; }
.region-row:last-child { border-bottom: none; }
.region-row-head { background: var(--primary-lighter); font-weight: 600; color: var(--primary); font-size: 12px; }
.region-subject { font-weight: 500; color: var(--text-primary); }
.region-cell { color: var(--text-muted); }
.region-input { width: 100%; min-width: 0; }
.region-ops { display: flex; gap: 4px; }
.btn-remove { color: var(--danger); }
</style>
