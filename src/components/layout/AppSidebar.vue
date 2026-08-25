<template>
  <div class="sidebar">
    <div class="nav-category">📦 核心功能</div>
    
    <div class="nav-item" :class="{ active: $route.path === '/textbook' }" @click="$router.push('/textbook')">
      <span>📚</span> 教材库
    </div>
    
    <div class="nav-item" :class="{ active: $route.path === '/template', disabled: !canAccessFeature('template') }"
      @click="goIfAllowed('/template', 'template')"
      :title="!canAccessFeature('template') ? '专业版/旗舰版功能' : ''">
      <span>📋</span> 模板库
      <span v-if="!canAccessFeature('template')" class="lock-icon">🔒</span>
    </div>

    <div class="nav-item" :class="{ active: $route.path === '/instruction' }" @click="$router.push('/instruction')">
      <span>📝</span> 指令库
    </div>

    <div class="nav-item" :class="{ active: $route.path === '/blueprint' }" @click="$router.push('/blueprint')">
      <span>📐</span> 蓝图库
    </div>

    <div class="nav-item" :class="{ active: $route.path === '/rules' }" @click="$router.push('/rules')">
      <span>🧪</span> 质检规则
    </div>
    
    <div class="nav-item" :class="{ disabled: !canAccessFeature('draft') }"
      @click="goIfAllowed('/draft', 'draft')"
      :title="!canAccessFeature('draft') ? '旗舰版功能' : ''">
      <span>📦</span> 草稿箱
    </div>
    
    <div class="nav-item" :class="{ active: $route.path === '/generate' }" @click="$router.push('/generate')">
      <span>🤖</span> 生成教辅
    </div>
    
    <div class="nav-item" :class="{ disabled: !canAccessFeature('typeset') }"
      @click="goIfAllowed('/typeset', 'typeset')"
      :title="!canAccessFeature('typeset') ? '专业版/旗舰版功能' : ''">
      <span>📄</span> 排版导出
    </div>
    
    <div class="nav-category">🔧 工具</div>
    
    <div class="nav-item" :class="{ disabled: !canAccessFeature('history') }"
      @click="goIfAllowed('/history', 'history')"
      :title="!canAccessFeature('history') ? '旗舰版功能' : ''">
      <span>📚</span> 历史记录
    </div>
    
    <div class="nav-item" :class="{ disabled: !canAccessFeature('graph') }"
      @click="goIfAllowed('/graph', 'graph')"
      :title="!canAccessFeature('graph') ? '旗舰版功能' : ''">
      <span>⭐</span> 图形库
    </div>
    
    <div class="nav-item" :class="{ active: $route.path === '/settings' }" @click="$router.push('/settings')">
      <span>⚙️</span> 系统设置
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();

defineProps({
  canAccessFeature: { type: Function, required: true }
});

const goIfAllowed = (path, feature) => {
  router.push(path);
};
</script>

<style scoped>
.sidebar {
  width: 220px; background: var(--primary); color: white;
  display: flex; flex-direction: column; padding: 16px 0;
  overflow-y: auto; flex-shrink: 0;
}

.nav-category {
  padding: 12px 20px 10px; font-size: 13px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.5px; color: #8ba3c7;
}

.nav-item {
  padding: 14px 20px; cursor: pointer; display: flex; align-items: center;
  gap: 12px; transition: background 0.2s; font-size: 16px; color: #d0def0;
}
.nav-item:hover { background: var(--primary-light); color: white; }
.nav-item.active { background: var(--primary-light); border-left: 4px solid #f5b042; color: white; }
.nav-item.disabled { opacity: 0.5; cursor: not-allowed; }
.lock-icon { margin-left: auto; }
</style>
