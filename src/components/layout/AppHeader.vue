<template>
  <header
    class="app-header"
    :class="{ 'mobile-header': isMobile }"
  >
    <div class="header-left">
      <span class="logo">{{ isMobile ? '📘 智卷' : '📘 智卷工坊' }}</span>
      <span
        v-if="!isMobile"
        class="badge"
      >小初高·学科教辅专家</span>
      <span
        v-if="!isMobile && licenseInfo.version !== 'ultimate'"
        class="version-badge"
      >
        {{ versionLabel }}
      </span>
    </div>
    
    <div
      v-if="!isMobile"
      class="header-center"
    >
      <span
        v-if="isExpiringSoon"
        class="expire-warning"
      >⚠️ 即将到期，请续费</span>
      <span
        v-else-if="remainingDays !== null"
        class="expire-info"
      >⏰ 剩余 {{ remainingDays }} 天</span>
    </div>
    
    <div
      v-if="!isMobile"
      class="header-right"
    >
      <button
        class="header-btn"
        @click="$router.push('/history')"
      >
        📚 历史
      </button>
      <button
        class="header-btn"
        :disabled="!canAccessFeature('graph')"
        @click="$router.push('/graph')"
      >
        ⭐ 图形库
      </button>
      <button
        class="header-btn"
        @click="$router.push('/settings')"
      >
        ⚙️ 设置
      </button>
    </div>

    <!-- 📱 移动端：签名到期（仅iOS） + 操作按钮 -->
    <div
      v-if="isMobile"
      class="header-right"
    >
      <template v-if="isCapacitorIOS">
        <span
          v-if="signInfo && signInfo.found && signInfo.daysRemaining >= 0"
          class="mobile-sign-badge"
          :class="{ warning: signInfo.daysRemaining <= 3 }"
        >
          📱 {{ signInfo.daysRemaining === 0 ? '今日到期!' : signInfo.daysRemaining + '天' }}
        </span>
        <span
          v-else-if="signInfo && !signInfo.found"
          class="mobile-sign-badge unknown"
        >
          📱 未签名
        </span>
      </template>
      <button
        class="header-btn header-btn-sm"
        title="重置任务"
        @click="resetTask"
      >
        🔄
      </button>
      <button
        class="header-btn header-btn-sm"
        title="上推：桌面全量 | 手机仅双向2类（引擎独立）"
        @click="uploadToCloud"
      >
        📤
      </button>
      <button
        class="header-btn header-btn-sm"
        title="同步：桌面拉双向2类→合并→推回 | 手机拉全量→合并双向→推回（引擎独立）"
        @click="refreshApp"
      >
        ☁️
      </button>
    </div>
  </header>
</template>

<script setup>
import { APP_EVENTS } from '@/constants/events.js'; // 全局事件名唯一事实源（曾字面量分发）

const refreshApp = () => {
  window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_REFRESH));
};

const uploadToCloud = () => {
  window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_UPLOAD));
};

const resetTask = () => {
  window.dispatchEvent(new CustomEvent(APP_EVENTS.RESET_TASK));
};

defineProps({
  licenseInfo: { type: Object, required: true },
  versionLabel: { type: String, required: true },
  remainingDays: { type: Number, default: null },
  isExpiringSoon: { type: Boolean, default: false },
  canAccessFeature: { type: Function, required: true },
  isMobile: { type: Boolean, default: false },
  // 📱 iOS 签名信息（移动端顶部显示）
  signInfo: { type: Object, default: null },
  signCheckLoading: { type: Boolean, default: false },
  isCapacitorIOS: { type: Boolean, default: false },
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
  padding: 0 12px;
  padding-top: calc(env(safe-area-inset-top, 0px));
  min-height: calc(48px + env(safe-area-inset-top, 0px));
}
.mobile-header .logo {
  font-size: 16px;
}
.mobile-header .header-right {
  gap: 4px;
  align-items: center;
}
.mobile-header .header-btn {
  padding: 4px 8px;
  font-size: 15px;
  min-width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 20px;
  -webkit-tap-highlight-color: transparent;
}
.mobile-header .header-btn:active {
  background: var(--primary-bg);
  transform: scale(0.92);
}
.mobile-header .header-btn-sm {
  padding: 3px 7px;
  font-size: 15px;
}

/* 📱 签名到期徽章 */
.mobile-sign-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 12px;
  background: #f0fff4;
  color: #38a169;
  white-space: nowrap;
  border: 1px solid #c6f6d5;
  display: inline-flex;
  align-items: center;
  line-height: 1;
  height: 24px;
}
.mobile-sign-badge.warning {
  background: #fff5f5;
  color: #e53e3e;
  border-color: #feb2b2;
  animation: sign-pulse 2s ease-in-out infinite;
}
.mobile-sign-badge.unknown {
  background: #f7fafc;
  color: #a0aec0;
  border-color: #e2e8f0;
}
@keyframes sign-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
</style>
