<template>
  <div class="instruction-module">
    <div class="page-head">
      <h2>📝 指令库</h2>
      <p class="page-desc">
        生成时注入模型的指令全部来自指令库。内置模板固定通用；用户模板点开修改保存后持久化自动更新，生成模块的注入指令随之更新。
      </p>
      <p class="page-desc placeholder-desc">
        <b>占位符</b>：<code>{grade}</code>年级学段 · <code>{subject}</code>学科 · <code>{unit}</code>命题范围（课/单元/期中/期末）· <code>{scope}</code>确认后的范围名 · <code>{structure}</code>卷面结构 · <code>{fullScore}</code>总分 · <code>{duration}</code>时长 · <code>{material}</code>教材原文（生成时按知识点检索附加）· <code>{extra}</code>用户附加要求。占位符在注入时由系统按当前选择替换。
      </p>
    </div>

    <div class="lib-layout">
      <!-- 左：模板列表（筛选 + 列表） -->
      <div class="lib-list">
        <div class="lib-list-head">
          <span>模板（{{ filteredTemplates.length }}）</span>
          <button class="btn btn-sm" @click="createNew">➕ 新建</button>
        </div>
        <div class="lib-filters">
          <select v-model="filter.genType" class="filter-select">
            <option value="">全部类型</option>
            <option v-for="g in GEN_TYPE_OPTS" :key="g.value" :value="g.value">{{ g.label }}</option>
          </select>
          <select v-model="filter.subject" class="filter-select">
            <option v-for="s in SUBJECT_OPTS" :key="s" :value="s">{{ s || '全部学科' }}</option>
          </select>
          <select v-model="filter.grade" class="filter-select">
            <option value="">全部学段</option>
            <option value="通用">通用（不限学段）</option>
            <option v-for="s in STAGE_OPTS.filter(o => o.value)" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
          <span class="filter-hint">内置模板适用全部学段；学段/学科筛选作用于用户自定义模板与内置学科模板</span>
        </div>
        <div class="lib-items">
          <div
            v-for="tpl in filteredTemplates"
            :key="tpl.key"
            class="lib-item"
            :class="{ active: currentKey === tpl.key }"
            @click="select(tpl)"
          >
            <div class="lib-item-title">{{ displayName(tpl) }}</div>
            <div class="lib-item-key">
              <span class="badge" :class="tpl.source === 'user' ? 'badge-user' : 'badge-builtin'">
                {{ tpl.source === 'user' ? '自定义' : '内置' }}
              </span>
              {{ keyDesc(tpl.key) }}
            </div>
          </div>
          <div v-if="!filteredTemplates.length" class="lib-empty">当前筛选无模板<br />（学段+学科同时选具体值时无交集即空白）</div>
        </div>
      </div>

      <!-- 右：编辑区 -->
      <div class="lib-editor">
        <template v-if="current">
          <div class="editor-head">
            <span class="editor-head-title">{{ current.name || keyDesc(current.key) }}</span>
            <button class="btn btn-sm" @click="clearSelection" title="关闭编辑区">✕ 关闭</button>
          </div>
          <div class="editor-meta">
            <label>资料类型
              <select v-model="form.genType">
                <option v-for="g in GEN_TYPE_OPTS" :key="g.value" :value="g.value">{{ g.label }}</option>
              </select>
            </label>
            <label>学科（可空=全部）
              <select v-model="form.subject">
                <option v-for="s in SUBJECT_OPTS" :key="s" :value="s">{{ s || '全部学科' }}</option>
              </select>
            </label>
            <label>学段（可空=全部）
              <select v-model="form.grade">
                <option v-for="s in STAGE_OPTS" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
            </label>
          </div>
          <input v-model="form.name" class="name-input" placeholder="模板名称（如：正式考卷·小学语文低段）" />
          <textarea
            v-model="form.template"
            class="template-textarea"
            rows="18"
            placeholder="指令模板内容（人话，像给助手布置任务；支持 {grade}{subject}{unit}{structure}{fullScore}{duration}{material}{extra} 占位符）"
          ></textarea>
          <div class="editor-actions">
            <button class="btn-primary" @click="save">💾 保存到指令库</button>
            <button v-if="current.source === 'user'" class="btn" @click="remove">🗑️ 删除</button>
            <button v-if="current.source === 'builtin'" class="btn" @click="duplicateFromBuiltin">📋 复制为自定义</button>
            <span v-if="savedTip" class="saved-tip">{{ savedTip }}</span>
          </div>
        </template>
        <div v-else class="empty-tip">
          <p>从左侧选择模板进行编辑，或点「➕ 新建」创建。</p>
          <p class="empty-sub">匹配规则：生成时按「年级 × 学科 × 资料类型」三维度匹配，精确优先，其次「学科 × 类型」、「类型」，最后回退内置默认。</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import {
  listPromptTemplates, savePromptTemplate, deletePromptTemplate, STAGE_NAMES, matchTemplateFilter,
} from '@/config/promptLibrary.js';
import { subjects } from '@/config/expertKnowledge.js';

const SUBJECT_OPTS = ['', '通用', ...subjects]; // 学科下拉：全部 / 通用 / 全学科列表（与教材库同源）
const GEN_TYPE_OPTS = [
  { value: 'exam', label: '正式考卷' },
  { value: 'practice', label: '课时练' },
  { value: 'special', label: '专项突破' },
  { value: 'preview', label: '课前预习' },
  { value: 'reading', label: '阅读训练' },
  { value: 'summary', label: '知识总结' },
  { value: 'dictation', label: '默写积累' },
  { value: 'errorbook', label: '错题本' },
  { value: 'review', label: '复习资料' },
];

const STAGE_OPTS = [
  { value: '', label: '全部学段' },
  { value: 'primary_low', label: '小学低段（1-2年级）' },
  { value: 'primary_mid', label: '小学中段（3-4年级）' },
  { value: 'primary_high', label: '小学高段（5-6年级）' },
  { value: 'middle', label: '初中' },
  { value: 'high', label: '高中' },
];

const templates = ref([]);
const currentKey = ref('');
const current = ref(null);
const savedTip = ref('');
const form = ref({ grade: '', subject: '', genType: 'exam', name: '', template: '' });

// 🔴 列表筛选（类型/学科/学段——共用 matchTemplateFilter，三态：全部/通用/具体值）
const filter = ref({ genType: '', subject: '', grade: '' });
const filteredTemplates = computed(() => {
  return templates.value.filter((t) => matchTemplateFilter(t, filter.value));
});

const refresh = () => {
  templates.value = listPromptTemplates();
};

/** 学段键集合（识别二维 key 的第一段是学段还是学科） */
const STAGE_KEYS = Object.keys(STAGE_NAMES);

/** key 解析：`[grade|][subject|]genType` → form（学段键与学科名正确区分） */
const parseKey = (key = '') => {
  const parts = String(key).split('|').filter(Boolean);
  const genType = parts[parts.length - 1] || 'exam';
  let subject = '';
  let grade = '';
  if (parts.length >= 2) {
    const prev = parts[parts.length - 2];
    if (STAGE_KEYS.includes(prev)) grade = prev;
    else subject = prev;
  }
  if (parts.length >= 3) grade = parts[parts.length - 3];
  return { grade, subject, genType };
};

/** 模板标识中文描述：`primary_low|exam` → "小学低段 × 正式考卷" */
const keyDesc = (key = '') => {
  const p = parseKey(key);
  const parts = [];
  if (p.grade) parts.push(STAGE_NAMES[p.grade] || p.grade);
  if (p.subject) parts.push(p.subject);
  const g = GEN_TYPE_OPTS.find(o => o.value === p.genType);
  parts.push(g ? g.label : p.genType);
  return parts.join(' × ');
};

/** 显示名兜底：name 为空或含 undefined/null（旧版本脏数据）时用中文维度描述 */
const displayName = (tpl) => {
  const n = String(tpl?.name || '').trim();
  if (n && !n.includes('undefined') && !n.includes('null')) return n;
  return keyDesc(tpl.key);
};

const buildKey = () => [form.value.grade, form.value.subject, form.value.genType].filter(Boolean).join('|');

const select = (tpl) => {
  // 再次点击当前选中项 → 取消选中（关闭右侧编辑区）
  if (currentKey.value === tpl.key) { clearSelection(); return; }
  current.value = tpl;
  currentKey.value = tpl.key;
  const p = parseKey(tpl.key);
  form.value = { ...p, name: displayName(tpl), template: tpl.template };
};

const clearSelection = () => {
  current.value = null;
  currentKey.value = '';
  savedTip.value = '';
};

const createNew = () => {
  current.value = { key: '', name: '', template: '', source: 'user' };
  currentKey.value = '__new__';
  form.value = { grade: '', subject: '', genType: 'exam', name: '', template: '' };
  savedTip.value = '';
};

const duplicateFromBuiltin = () => {
  current.value = { key: '', name: `${form.value.name || '自定义'}（副本）`, template: form.value.template, source: 'user' };
  currentKey.value = '__new__';
  savedTip.value = '';
};

const save = () => {
  const key = buildKey();
  if (!form.value.genType || !form.value.template.trim()) {
    savedTip.value = '⚠️ 请至少选择资料类型并填写模板内容';
    return;
  }
  const ok = savePromptTemplate(key, { name: form.value.name || key, template: form.value.template });
  savedTip.value = ok ? '✅ 已保存，持久化已更新，生成模块自动生效' : '⚠️ 保存失败';
  refresh();
  currentKey.value = key;
  nextTick(() => {
    const found = templates.value.find(t => t.key === key);
    if (found) current.value = found;
  });
  setTimeout(() => { savedTip.value = ''; }, 3000);
};

const remove = () => {
  if (!current.value?.key) return;
  if (!window.confirm(`删除模板「${current.value.name || current.value.key}」？内置模板不受影响。`)) return;
  deletePromptTemplate(current.value.key);
  refresh();
  current.value = null;
  currentKey.value = '';
  savedTip.value = '';
};

onMounted(refresh);
</script>

<style scoped>
.instruction-module { padding: 20px 24px; max-width: 1200px; margin: 0 auto; }
.page-head { display: flex; flex-direction: column; gap: 6px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border-light); }
.page-head h2 { margin: 0; font-size: 20px; color: var(--primary); font-weight: 600; }
.page-desc { color: var(--text-secondary); font-size: 13px; line-height: 1.7; margin: 0; }
.page-desc code { background: var(--primary-lighter); color: var(--primary-light); padding: 1px 6px; border-radius: 4px; font-size: 12px; }
.placeholder-desc { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
.placeholder-desc b { color: var(--text-secondary); }
.lib-filters { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--border-light); flex-wrap: nowrap; flex-shrink: 0; }
.filter-select, .filter-input { padding: 6px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 12px; background: #fff; color: var(--text-primary); flex-shrink: 0; cursor: pointer; }
.filter-select:focus, .filter-input:focus { outline: none; border-color: var(--primary-light); box-shadow: 0 0 0 2px var(--primary-lighter); }
.filter-input { width: 90px; }
.filter-hint { font-size: 11px; color: var(--text-muted); white-space: nowrap; margin-left: 4px; }
.lib-layout { display: flex; gap: 16px; align-items: flex-start; }
.lib-list { width: 340px; flex-shrink: 0; background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-md); overflow: hidden; max-height: 72vh; display: flex; flex-direction: column; box-shadow: 0 1px 3px rgba(30,58,111,0.05); }
.lib-list-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: linear-gradient(90deg, var(--primary-lighter), #f5f8fd); border-bottom: 1px solid var(--border-light); font-weight: 600; color: var(--primary); flex-shrink: 0; }
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
.editor-head-title { font-weight: 600; font-size: 15px; color: var(--primary); }
.editor-meta { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 12px; }
.editor-meta label { display: flex; flex-direction: column; font-size: 12px; color: var(--text-secondary); gap: 4px; }
.editor-meta select, .editor-meta input { padding: 7px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px; min-width: 150px; background: #fff; color: var(--text-primary); }
.editor-meta select:focus, .editor-meta input:focus, .name-input:focus, .template-textarea:focus { outline: none; border-color: var(--primary-light); box-shadow: 0 0 0 2px var(--primary-lighter); }
.name-input { width: 100%; padding: 9px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: 10px; font-size: 14px; box-sizing: border-box; color: var(--text-primary); }
.template-textarea { width: 100%; box-sizing: border-box; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px; line-height: 1.7; font-family: inherit; background: #fff; color: var(--text-primary); resize: vertical; }
.editor-actions { margin-top: 12px; display: flex; align-items: center; gap: 10px; }
.saved-tip { font-size: 13px; color: var(--success); }
.empty-tip { color: var(--text-muted); text-align: center; padding: 60px 20px; }
.empty-sub { font-size: 12px; color: var(--text-muted); margin-top: 8px; }
.btn-sm { padding: 4px 12px; font-size: 12px; }
</style>
