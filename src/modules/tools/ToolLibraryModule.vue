<template>
  <div class="tool-library-page">
    <!-- ============ 子页容器：左侧二级导航 + 子视图 ============ -->
    <template v-if="activeLib">
      <div class="sub-layout">
        <aside class="sub-sidebar">
          <div class="sub-cat">🧰 工具库</div>
          <div
            v-for="lib in TOOL_LIBRARIES"
            :key="lib.id"
            class="sub-item"
            :class="{ active: activeLib.id === lib.id }"
            @click="$router.push(`/tools/${lib.id}`)"
          >
            <span>{{ lib.icon }}</span> {{ lib.name }}
            <span v-if="lib.migrate === 'migrating'" class="mig-badge">迁移中</span>
          </div>
        </aside>
        <section class="sub-content">
          <div class="sub-toolbar">
            <button class="back-btn" @click="$router.push('/tools')">← 返回工具库</button>
            <div class="crumb">工具库 <span class="crumb-sep">/</span> {{ activeLib.icon }} {{ activeLib.name }} <span class="crumb-dim">三维度 · 学段×学科×资料类型</span></div>
            <div class="toolbar-actions">
              <template v-for="act in (activeLib.toolbar?.actions || [])" :key="act">
                <button v-if="act === 'new'" class="btn" @click="onNewEntry">+ 新建条目</button>
                <button v-if="act === 'validate'" class="btn" @click="onValidate">🔍 校验</button>
                <button v-if="act === 'clear'" class="btn danger" @click="onClear">🗑️ 清理</button>
              </template>
              <DimensionFilter
                v-if="activeLib.toolbar?.filter === 'dim3'"
                v-model="dims"
                compact
              />
            </div>
          </div>
          <div class="sub-body">
            <component :is="activeView" :key="reloadKey" />
          </div>
        </section>
      </div>
    </template>

    <!-- ============ 首页：8 库卡片 ============ -->
    <template v-else>
      <div class="embedded-page">
        <div class="page-header">
          <div>
            <h2>🧰 工具库</h2>
            <p class="page-desc">生成端各工具库统一入口 · 三维度检索（学段 × 学科 × 资料类型）· 代码读取而非指令注入</p>
          </div>
          <DimensionFilter v-model="dims" compact />
        </div>
        <div class="keyline" v-if="hasAnyDim">
          <span class="dim-key">当前检索键</span>
          <span class="dimb">{{ dims.stage ? STAGE_LABELS[dims.stage] : '全部学段' }}</span>
          <span class="dimb">{{ dims.subject || '全部学科' }}</span>
          <span class="dimb">{{ dims.genType ? GEN_TYPE_LABELS[dims.genType] : '全部类型' }}</span>
          <span class="dim-tip">各库检索将在迁移后按此键启用</span>
        </div>
        <div class="lib-grid">
          <div
            v-for="lib in TOOL_LIBRARIES"
            :key="lib.id"
            class="lib-card"
            :class="`st-${lib.status}`"
            @click="$router.push(`/tools/${lib.id}`)"
          >
            <div class="lib-ico">{{ lib.icon }}</div>
            <div class="lib-name">
              {{ lib.name }}
              <span v-if="lib.status === 'new'" class="badge-new">新增</span>
              <span v-if="lib.migrate === 'migrating'" class="badge-mig">迁移中</span>
              <span v-if="lib.status === 'warn'" class="badge-warn">有缺口</span>
            </div>
            <div class="lib-desc">{{ lib.desc }}</div>
            <div class="lib-ft">
              <span class="chip">{{ (libStats && libStats[lib.id]) || lib.count }}</span>
              <span class="dim-hint">学段 × 学科 × 类型</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch, markRaw, provide } from 'vue';
import { useRoute } from 'vue-router';
import { TOOL_LIBRARIES, SUBJECT_KEYS, getToolLibrary, computeLibStats } from '@/config/toolLibrary.js';
import DimensionFilter from '@/components/tools/DimensionFilter.vue';

import BlueprintView from './views/BlueprintView.vue';
import InstructionView from './views/InstructionView.vue';
import RulesView from './views/RulesView.vue';
import RenderContractView from './views/RenderContractView.vue';
import LayoutSpecView from './views/LayoutSpecView.vue';

const route = useRoute();

/** 首页三维度筛选（占位联动，迁移后接各库检索） */
const dims = ref({ stage: '', subject: '', genType: '' });
const hasAnyDim = computed(() => dims.value.stage || dims.value.subject || dims.value.genType);

/** 各库条数统计（分子/分母由真实数据源自动算，见 toolLibrary.computeLibStats） */
const statsTick = ref(0);
const libStats = computed(() => (statsTick.value, computeLibStats()));
/** 增删改后刷新统计（子视图保存/删除后经 inject 调用） */
const refreshLibStats = () => { statsTick.value += 1; };
provide('refreshLibStats', refreshLibStats);

/** 向子视图提供三维度检索键（蓝图/规则/要点等子库 inject 使用） */
provide('toolDims', dims);

const STAGE_LABELS = {
  primary_low: '小学低段（1-2年级）',
  primary_mid: '小学中段（3-4年级）',
  primary_high: '小学高段（5-6年级）',
  middle: '初中（7-9年级）',
  high: '高中',
};
const GEN_TYPE_LABELS = {
  exam: '正式试卷', practice: '课时练', special: '专项突破', preview: '课前预习',
  reading: '阅读训练', summary: '知识总结', dictation: '默写积累', errorbook: '错题本', review: '复习资料',
};

const VIEW_MAP = {
  'blueprint': markRaw(BlueprintView),
  'instruction': markRaw(InstructionView),
  'rules': markRaw(RulesView),
  'render-contract': markRaw(RenderContractView),
  'layout-spec': markRaw(LayoutSpecView),
};

const activeLib = computed(() => {
  const sub = String(route.params.sub || '');
  if (!sub) return null;
  return getToolLibrary(sub);
});

const activeView = computed(() => (activeLib.value ? VIEW_MAP[activeLib.value.id] : null));

/** 新建条目：按子库转发（迁移后各库接真实编辑器；当前占位提示） */
const onNewEntry = () => {
  if (!activeLib.value) return;
  // TODO(迁移)：各子库注册自己的新建逻辑（蓝图→蓝本编辑器 / 规则→规则表单 / 排版规格→参数表单…）
  window.alert(`「${activeLib.value.name}」新建条目将在迁移后开放（当前为框架占位）。`);
};

/** 校验：按子库转发（蓝图库→blueprintGuard 分值闭合/听力占比/学段结构） */
const onValidate = () => {
  if (!activeLib.value) return;
  // TODO(迁移)：蓝图库接入 blueprintGuard；规则库→接线状态自检；其余库注册各自的校验
  window.alert(`「${activeLib.value.name}」校验功能将在迁移后接入。`);
};

/** 清理：暂无可清理的子库（记忆库已退役） */
const reloadKey = ref(0);

watch(dims, () => {
  // TODO(迁移)：按 dims 检索对应库数据（蓝图/规则/要点等），当前为框架占位
}, { deep: true });
</script>

<style scoped>
.tool-library-page { height: 100%; display: flex; flex-direction: column; }
.embedded-page { flex: 1; overflow: auto; }

.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 20px 22px 0; }
.page-header h2 { margin: 0; font-size: 20px; color: var(--primary); }
.page-desc { margin: 6px 0 0; font-size: 12.5px; color: var(--text-muted); }

/* ===== 首页检索键反馈 ===== */
.keyline { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 12px 22px 0; background: var(--primary-lighter); border: 1px solid #c9d8ee; border-radius: 8px; padding: 8px 12px; }
.dim-key { font-size: 12px; font-weight: 600; color: var(--primary); margin-right: 4px; }
.dimb { font-size: 12px; padding: 2px 10px; border-radius: 6px; background: #fff; color: var(--primary); border: 1px solid #c9d8ee; }
.dim-tip { font-size: 11.5px; color: var(--text-muted); margin-left: 4px; }

/* ===== 8 库卡片 ===== */
.lib-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(215px, 1fr)); gap: 14px; padding: 18px 22px 26px; }
.lib-card { background: var(--bg-card); border: 1px solid var(--border-light); border-left: 4px solid var(--primary-light); border-radius: 10px; padding: 16px 14px 12px; cursor: pointer; transition: box-shadow .15s, border-color .15s; }
.lib-card:hover { border-color: var(--primary-light); box-shadow: 0 2px 10px rgba(30,58,111,.1); }
.st-warn { border-left-color: var(--accent); }
.st-new { border-left-color: var(--success); }
.lib-ico { font-size: 24px; }
.lib-name { font-weight: 600; font-size: 14.5px; margin-top: 6px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.lib-desc { font-size: 12px; color: var(--text-muted); margin: 6px 0 10px; line-height: 1.5; min-height: 38px; }
.lib-ft { display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--text-muted); border-top: 1px dashed var(--border-light); padding-top: 8px; }
.chip { display: inline-block; font-size: 10.5px; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--border); color: #556; }
.dim-hint { font-size: 10.5px; }
.badge-new { background: var(--accent); color: #5b4005; font-size: 10px; font-weight: 700; padding: 1px 8px; border-radius: 999px; }
.badge-mig { background: #fdf3e2; color: #a06a10; font-size: 10px; font-weight: 700; padding: 1px 8px; border-radius: 999px; border: 1px solid #f3d9a8; }
.badge-warn { background: var(--danger-light); color: #b03a2e; font-size: 10px; font-weight: 700; padding: 1px 8px; border-radius: 999px; border: 1px solid #f5c2bd; }
.st-warn { border-left: 3px solid var(--accent); }
.st-new { border-left: 3px solid var(--success); }

/* ===== 子页布局 ===== */
.sub-layout { display: flex; height: 100%; overflow: hidden; }
.sub-sidebar { width: 200px; background: var(--primary); color: #d0def0; flex-shrink: 0; padding: 12px 0; overflow-y: auto; font-size: 13.5px; }
.sub-cat { padding: 10px 16px 6px; font-size: 11px; color: #8ba3c7; text-transform: uppercase; letter-spacing: .5px; }
.sub-item { display: flex; align-items: center; gap: 8px; padding: 10px 16px; cursor: pointer; transition: background .2s; }
.sub-item:hover { background: var(--primary-light); color: #fff; }
.sub-item.active { background: var(--primary-light); border-left: 4px solid var(--accent); color: #fff; }
.mig-badge { margin-left: auto; font-size: 10px; background: rgba(255,255,255,.14); border-radius: 999px; padding: 1px 7px; }
.sub-content { flex: 1; min-width: 0; overflow: auto; background: var(--bg); display: flex; flex-direction: column; }

/* ===== 子页工具栏：返回 + 面包屑 + 操作 ===== */
.sub-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; background: #fff; border-bottom: 1px solid var(--border-light); padding: 10px 18px; flex-shrink: 0; }
.back-btn { border: 1px solid var(--border); background: var(--bg-card); border-radius: 6px; padding: 6px 12px; font-size: 13px; cursor: pointer; color: var(--primary); white-space: nowrap; }
.back-btn:hover { background: var(--primary-lighter); }
.crumb { font-size: 13px; color: var(--text-muted); white-space: nowrap; }
.crumb-sep { margin: 0 4px; color: #c2ccda; }
.crumb-dim { font-size: 11px; color: var(--text-muted); background: var(--primary-lighter); border: 1px solid #c9d8ee; border-radius: 999px; padding: 1px 8px; margin-left: 8px; }
.toolbar-actions { margin-left: auto; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.toolbar-actions .btn { border: 1px solid var(--border); background: #fff; border-radius: 6px; padding: 6px 14px; font-size: 13px; cursor: pointer; white-space: nowrap; }
.toolbar-actions .btn:hover { background: var(--primary-lighter); color: var(--primary); }
.toolbar-actions .btn.danger { color: var(--danger); border-color: var(--danger-light); }
.toolbar-actions .btn.danger:hover { background: var(--danger-light); color: var(--danger); }
.sub-body { flex: 1; overflow: auto; }
</style>
