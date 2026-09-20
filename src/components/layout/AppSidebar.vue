<template>
  <div class="sidebar">
    <div class="nav-category">
      📦 核心功能
    </div>
    
    <div
      class="nav-item"
      :class="{ active: $route.path === '/textbook' }"
      @click="$router.push('/textbook')"
    >
      <span>📚</span> 教材库
    </div>
    
    <div
      class="nav-item"
      :class="{ active: $route.path === '/template', disabled: !canAccessFeature('template') }"
      :title="!canAccessFeature('template') ? '专业版/旗舰版功能' : ''"
      @click="goIfAllowed('/template', 'template')"
    >
      <span>📋</span> 模板库
      <span
        v-if="!canAccessFeature('template')"
        class="lock-icon"
      >🔒</span>
    </div>

    <div
      class="nav-item"
      :class="{ active: $route.path.startsWith('/tools') }"
      @click="$router.push('/tools')"
    >
      <span>🧰</span> 工具库
    </div>

    <div
      class="nav-item"
      :class="{ disabled: !canAccessFeature('draft') }"
      :title="!canAccessFeature('draft') ? '旗舰版功能' : ''"
      @click="goIfAllowed('/draft', 'draft')"
    >
      <span>📦</span> 草稿箱
    </div>
    
    <div
      class="nav-item"
      :class="{ active: $route.path === '/generate' }"
      @click="$router.push('/generate')"
    >
      <span>🤖</span> 生成教辅
    </div>
    
    <div
      class="nav-item"
      :class="{ disabled: !canAccessFeature('typeset') }"
      :title="!canAccessFeature('typeset') ? '专业版/旗舰版功能' : ''"
      @click="goIfAllowed('/typeset', 'typeset')"
    >
      <span>📄</span> 排版导出
    </div>
    
    <div class="nav-category">
      🔧 工具
    </div>

    <!-- 🎧 听力配音（2026-09-20）：**独立功能**入口。
         为什么不放在「生成教辅」里：那边结果列表是 20 条上限滚动的临时区，
         记录滚走入口就没了；听力配音本就不依赖任何记录（粘贴素材即可）。
         无需授权门控——与教材库/工具库/生成教辅同级。 -->
    <div
      class="nav-item"
      :class="{ active: $route.path === '/listening' }"
      @click="$router.push('/listening')"
    >
      <span>🎧</span> 听力配音
    </div>

    <div
      class="nav-item"
      :class="{ disabled: !canAccessFeature('history') }"
      :title="!canAccessFeature('history') ? '旗舰版功能' : ''"
      @click="goIfAllowed('/history', 'history')"
    >
      <span>📚</span> 历史记录
    </div>
    
    <div
      class="nav-item"
      :class="{ active: $route.path === '/settings' }"
      @click="$router.push('/settings')"
    >
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
