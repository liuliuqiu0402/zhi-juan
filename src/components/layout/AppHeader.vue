<template>
  <header class="app-header" :class="{ 'mobile-header': isMobile }">
    <div class="header-left">
      <span class="logo">{{ isMobile ? '📘 智卷' : '📘 智卷工坊' }}</span>
      <span v-if="!isMobile" class="badge">小初高·学科教辅专家</span>
      <span v-if="!isMobile && licenseInfo.version !== 'ultimate'" class="version-badge">
        {{ versionLabel }}
      </span>
    </div>
    
    <div class="header-center" v-if="!isMobile">
      <span v-if="isExpiringSoon" class="expire-warning">⚠️ 即将到期，请续费</span>
      <span v-else-if="remainingDays !== null" class="expire-info">⏰ 剩余 {{ remainingDays }} 天</span>
    </div>
    
    <div class="header-right" v-if="!isMobile">
      <button class="header-btn" @click="$router.push('/history')">📚 历史</button>
      <button class="header-btn" @click="$router.push('/graph')" :disabled="!canAccessFeature('graph')">⭐ 图形库</button>
      <button class="header-btn" @click="$router.push('/instruction')" :disabled="!canAccessFeature('instruction')">📋 指令库</button>
      <button class="header-btn" @click="$router.push('/settings')">⚙️ 设置</button>
    </div>

    <!-- 📱 移动端：右侧刷新 + 设置按钮 -->
    <div class="header-right" v-if="isMobile">
      <button class="header-btn" @click="refreshApp" title="刷新">🔄</button>
      <button class="header-btn" @click="$router.push('/settings')">⚙️</button>
    </div>
  </header>
</template>

<script setup>
const refreshApp = () => {
  window.dispatchEvent(new CustomEvent('app-refresh'));
};

defineProps({
  licenseInfo: { type: Object, required: true },
  versionLabel: { type: String, required: true },
  remainingDays: { type: Number, default: null },
  isExpiringSoon: { type: Boolean, default: false },
  canAccessFeature: { type: Function, required: true },
  isMobile: { type: Boolean, default: false },
});
</script>

<style scoped>
.app-header {
  height: 56px;
  background: white;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo { font-size: 20px; font-weight: bold; color: var(--primary); }

.badge {
  background: var(--primary-lighter); color: var(--primary-light); padding: 4px 12px;
  border-radius: 20px; font-size: 12px; font-weight: 500;
}

.version-badge {
  background: linear-gradient(135deg, var(--primary-light), #1e4a8a); color: white;
  padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;
}

.header-center { display: flex; align-items: center; }
.expire-warning { color: var(--warning); font-size: 13px; font-weight: 500; }
.expire-info { color: var(--success); font-size: 13px; }

.header-right { display: flex; gap: 8px; }

.header-btn {
  padding: 8px 16px; border-radius: 24px; border: 1px solid var(--border);
  background: white; cursor: pointer; font-size: 13px; font-weight: 500;
  color: var(--primary); transition: all 0.2s;
}
.header-btn:hover { background: var(--primary-bg); border-color: var(--primary-light); }
.header-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* 📱 移动端 */
.mobile-header {
  height: 48px;
  padding: 0 16px;
}
.mobile-header .logo {
  font-size: 18px;
}
.mobile-header .header-btn {
  padding: 6px 12px;
  font-size: 18px;
}
</style>
