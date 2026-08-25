<template>
  <div class="rules-module">
    <div class="page-head">
      <h2>🧪 质检规则</h2>
      <p class="page-desc">
        整卷生成的质检规则库：<b>fix 类</b>在注入指令时作为生成前约束提示、生成后自动修复卷面（用户无感）；
        <b>guard 类</b>生成后静默计数（仅开发者日志）。修改保存后即时生效（用户版优先于内置），
        后续生成与校验自动使用。
      </p>
      <p class="page-desc placeholder-desc">
        三维度定位：<b>学段 × 学科 × 资料类型</b>——规则仅在与它匹配的维度组合下注入/执行；
        适用维度用逗号分隔填写（如 <code>语文,数学</code>），<code>*</code> 表示全部。
      </p>
    </div>

    <div class="lib-layout">
      <!-- 左：规则列表（筛选 + 列表） -->
      <div class="lib-list">
        <div class="lib-list-head">
          <span>规则（{{ filteredRules.length }}）</span>
          <button class="btn btn-sm" @click="createNew">➕ 新建</button>
        </div>
        <div class="lib-filters">
          <select v-model="filter.category" class="filter-select">
            <option value="">全部类别</option>
            <option value="fix">fix 自动修复</option>
            <option value="guard">guard 静默防护</option>
          </select>
          <select v-model="filter.subject" class="filter-select">
            <option value="">全部学科</option>
            <option v-for="s in SUBJECT_OPTS" :key="s" :value="s">{{ s }}</option>
          </select>
          <select v-model="filter.stage" class="filter-select">
            <option value="">全部学段</option>
            <option v-for="s in STAGE_OPTS.filter(o => o.value)" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
          <span class="filter-hint">fix 注入生成前约束 + 生成后自动修复；guard 静默计数</span>
        </div>
        <div class="lib-items">
          <div
            v-for="rule in filteredRules"
            :key="rule.id"
            class="lib-item"
            :class="{ active: currentId === rule.id }"
            @click="select(rule)"
          >
            <div class="lib-item-title">{{ rule.name }}</div>
            <div class="lib-item-key">
              <span class="badge" :class="rule.source === 'user' ? 'badge-user' : 'badge-builtin'">
                {{ rule.source === 'user' ? '自定义' : '内置' }}
              </span>
              <span class="badge" :class="rule.category === 'fix' ? 'badge-fix' : 'badge-guard'">
                {{ rule.category === 'fix' ? 'fix 自动修复' : 'guard 静默' }}
              </span>
              {{ rule.enabled ? '启用' : '停用' }}
            </div>
          </div>
          <div v-if="!filteredRules.length" class="lib-empty">当前筛选无规则<br />（可点「➕ 新建」添加自定义规则）</div>
        </div>
      </div>

      <!-- 右：编辑区 -->
      <div class="lib-editor">
        <template v-if="current">
          <div class="editor-head">
            <span class="editor-head-title">
              {{ current.name }}
              <span v-if="current.source === 'user'" class="preview-tag">自定义（优先于内置）</span>
            </span>
            <button class="btn btn-sm" @click="clearSelection" title="关闭编辑区">✕ 关闭</button>
          </div>

          <div class="editor-meta">
            <label>标识 id
              <input v-model="form.id" :disabled="isBuiltin" placeholder="唯一英文标识（如 score-label-fix）" />
            </label>
            <label>规则名
              <input v-model="form.name" placeholder="如：分值标注对齐" />
            </label>
            <label>类别
              <select v-model="form.category">
                <option value="fix">fix 自动修复（注入约束+生成后修复）</option>
                <option value="guard">guard 静默防护（仅计数，不提示）</option>
              </select>
            </label>
            <label>启用
              <input v-model="form.enabled" type="checkbox" />
            </label>
          </div>

          <div class="editor-meta">
            <label>适用学科（* 或逗号分隔）
              <input v-model="form.subjectsText" placeholder="* 或 语文,数学" />
            </label>
            <label>适用学段（* 或逗号分隔）
              <input v-model="form.stagesText" placeholder="* 或 primary_low,middle" />
            </label>
            <label>适用资料类型（空 = 全部，逗号分隔）
              <input v-model="form.genTypesText" placeholder="空 = 全部；或 exam,practice" />
            </label>
          </div>

          <label class="block-label">生成前约束文案（fix 类注入指令用；guard 类可留空）
            <textarea v-model="form.promptHint" rows="2" placeholder="生成时要求模型遵守的约束描述"></textarea>
          </label>
          <label class="block-label">规则说明
            <textarea v-model="form.description" rows="3" placeholder="规则做什么、为什么"></textarea>
          </label>

          <div class="editor-actions">
            <button class="btn-primary" @click="save">💾 保存到质检规则库</button>
            <button v-if="current.source === 'user'" class="btn" @click="remove">🗑️ 删除（内置则回退）</button>
            <button class="btn" @click="resetAll">↩️ 恢复全部默认</button>
            <span v-if="savedTip" class="saved-tip">{{ savedTip }}</span>
          </div>
        </template>
        <div v-else class="empty-tip">
          <p>从左侧选择规则进行编辑，或点「➕ 新建」创建自定义规则。</p>
          <p class="empty-sub">
            生效链路：保存后，fix 类 promptHint 在「生成指令」时按三维度注入（阶段一）；
            生成后校验器按三维度匹配执行（阶段二，fix 自动修复、guard 静默计数）。
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import {
  listValidatorRules,
  saveUserRule,
  deleteUserRule,
  resetUserRules,
} from '../config/validatorRules.js';

const SUBJECT_OPTS = ['语文', '数学', '英语', '物理', '化学', '生物', '科学', '地理', '历史', '道德与法治', '思想政治', '信息科技', '音乐', '美术', '体育'];
const STAGE_OPTS = [
  { value: 'primary_low', label: '小学低段（1-2年级）' },
  { value: 'primary_mid', label: '小学中段（3-4年级）' },
  { value: 'primary_high', label: '小学高段（5-6年级）' },
  { value: 'middle', label: '初中' },
  { value: 'high', label: '高中' },
];

const allRules = ref([]);
const filter = ref({ category: '', subject: '', stage: '' });
const currentId = ref('');
const form = ref(null);
const savedTip = ref('');

const load = () => {
  allRules.value = listValidatorRules();
};
load();

const matchesDimension = (rule, key) => {
  const list = rule[key] || [];
  const f = filter.value[key === 'subjects' ? 'subject' : 'stage'];
  if (!f) return true;
  return list.includes('*') || list.includes(f);
};

const filteredRules = computed(() => allRules.value.filter(r => {
  if (filter.value.category && r.category !== filter.value.category) return false;
  if (!matchesDimension(r, 'subjects')) return false;
  if (!matchesDimension(r, 'stages')) return false;
  return true;
}));

const current = computed(() => allRules.value.find(r => r.id === currentId.value) || null);
const isBuiltin = computed(() => !!current.value && current.value.source === 'builtin');

const select = (rule) => {
  currentId.value = rule.id;
  form.value = {
    id: rule.id,
    name: rule.name,
    category: rule.category,
    subjectsText: (rule.subjects || []).join(','),
    stagesText: (rule.stages || []).join(','),
    genTypesText: (rule.genTypes || []).join(','),
    enabled: rule.enabled !== false,
    promptHint: rule.promptHint || '',
    description: rule.description || '',
  };
  savedTip.value = '';
};

const createNew = () => {
  currentId.value = '__new__';
  form.value = { id: '', name: '', category: 'fix', subjectsText: '*', stagesText: '*', genTypesText: '', enabled: true, promptHint: '', description: '' };
  savedTip.value = '';
};

const clearSelection = () => {
  currentId.value = '';
  form.value = null;
  savedTip.value = '';
};

const parseList = (text) => {
  const arr = String(text || '').split(',').map(s => s.trim()).filter(Boolean);
  return arr.length ? [...new Set(arr)] : [];
};

const save = () => {
  if (!form.value.id) { savedTip.value = '⚠️ 请填写规则 id（唯一英文标识）'; return; }
  const rule = {
    id: form.value.id,
    name: form.value.name || form.value.id,
    category: form.value.category,
    subjects: parseList(form.value.subjectsText),
    stages: parseList(form.value.stagesText),
    genTypes: parseList(form.value.genTypesText),
    enabled: !!form.value.enabled,
    promptHint: form.value.category === 'fix' ? (form.value.promptHint || '') : '',
    description: form.value.description || '',
  };
  if (saveUserRule(rule)) {
    savedTip.value = '✅ 已保存，后续生成与校验即时生效';
    currentId.value = rule.id;
    load();
  } else {
    savedTip.value = '⚠️ 保存失败';
  }
};

const remove = () => {
  if (!current.value || !form.value.id) return;
  if (deleteUserRule(form.value.id)) {
    savedTip.value = '🗑️ 已删除（内置规则回退为停用，自定义规则移除）';
    clearSelection();
    load();
  }
};

const resetAll = () => {
  resetUserRules();
  savedTip.value = '↩️ 已恢复全部默认（清空用户自定义）';
  clearSelection();
  load();
};

watch(filter, () => { load(); }, { deep: false });
</script>

<style scoped>
.rules-module { padding: 20px; max-width: 1200px; margin: 0 auto; }
.page-head h2 { margin: 0 0 6px; }
.page-desc { color: #666; font-size: 13px; margin: 4px 0; line-height: 1.6; }
.placeholder-desc { color: #999; }
code { background: #f0f0f0; padding: 1px 5px; border-radius: 3px; font-size: 12px; }

.lib-layout { display: flex; gap: 16px; margin-top: 16px; align-items: flex-start; }
.lib-list { width: 300px; flex-shrink: 0; border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; }
.lib-list-head { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #f7f8fa; font-weight: 600; border-bottom: 1px solid #eee; }
.lib-filters { display: flex; gap: 6px; padding: 8px; border-bottom: 1px solid #eee; flex-wrap: wrap; }
.filter-select { flex: 1; min-width: 90px; padding: 4px 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; }
.filter-hint { width: 100%; font-size: 11px; color: #999; }
.lib-items { max-height: 560px; overflow-y: auto; }
.lib-item { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer; }
.lib-item:hover { background: #f5f8ff; }
.lib-item.active { background: #e8f1ff; border-left: 3px solid #4a90d9; }
.lib-item-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.lib-item-key { font-size: 12px; color: #888; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.badge { padding: 1px 6px; border-radius: 8px; font-size: 11px; }
.badge-user { background: #fff3d6; color: #a06a00; }
.badge-builtin { background: #e5e5e5; color: #666; }
.badge-fix { background: #d9f2e6; color: #1a7a44; }
.badge-guard { background: #e8ecf5; color: #556; }
.lib-empty { padding: 30px 12px; text-align: center; color: #999; font-size: 13px; line-height: 1.8; }

.lib-editor { flex: 1; border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px; min-height: 300px; }
.editor-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.editor-head-title { font-size: 15px; font-weight: 600; }
.preview-tag { font-size: 11px; color: #a06a00; background: #fff3d6; padding: 1px 6px; border-radius: 8px; margin-left: 6px; }
.editor-meta { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.editor-meta label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #666; flex: 1; min-width: 160px; }
.editor-meta input, .editor-meta select { padding: 5px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; }
.block-label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #666; margin-bottom: 10px; }
.block-label textarea { padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; line-height: 1.5; resize: vertical; }
.editor-actions { display: flex; gap: 8px; align-items: center; margin-top: 14px; flex-wrap: wrap; }
.saved-tip { font-size: 12px; color: #1a7a44; }
.empty-tip { text-align: center; color: #999; padding: 60px 20px; font-size: 14px; line-height: 2; }
.empty-sub { font-size: 12px; color: #aaa; }
.btn { padding: 6px 12px; border: 1px solid #ddd; border-radius: 5px; background: #fff; cursor: pointer; font-size: 13px; }
.btn-sm { padding: 3px 8px; font-size: 12px; }
.btn:hover { background: #f5f5f5; }
.btn-primary { padding: 6px 14px; border: none; border-radius: 5px; background: var(--primary, #4a90d9); color: #fff; cursor: pointer; font-size: 13px; }
.btn-primary:hover { opacity: 0.9; }
</style>
