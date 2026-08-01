<template>
  <div class="app-container" :style="pwaScaleStyle">
    <!-- ==================== 激活验证 ==================== -->
    <div v-if="activationStatus === 'checking' && !isWebMode" class="activation-overlay">
      <div class="activation-loading">
        <div class="loading-spinner"></div>
        <p>正在验证激活状态...</p>
      </div>
    </div>

    <div v-if="activationStatus === 'inactive' && !isWebMode" class="activation-overlay">
      <div class="activation-modal">
        <h2>📦 智卷工坊 · 激活</h2>
        <p class="activation-desc">请输入激活码以继续使用</p>
        
        <input
          type="text"
          v-model="activationCode"
          placeholder="请输入激活码"
          class="activation-input"
          @keyup.enter="activate"
        />
        
        <div class="machine-id-display">
          <span>机器码：</span>
          <span class="machine-id-value">{{ machineId }}</span>
          <span class="copy-machine-id" @click="copyMachineId">📋</span>
        </div>
        
        <div v-if="activationError" class="activation-error">{{ activationError }}</div>
        
        <div class="activation-actions">
          <button class="btn btn-primary" @click="activate">激活</button>
        </div>
        
        <p class="activation-hint">如需购买激活码，请联系客服</p>
      </div>
    </div>

    <!-- ==================== 🔐 Web 端访问码验证 ==================== -->
    <div v-if="showWebAuth" class="activation-overlay">
      <div class="activation-modal">
        <h2>🔐 智卷工坊</h2>
        <p class="activation-desc">请输入访问码以继续使用</p>
        
        <input
          type="password"
          v-model="webAccessCode"
          placeholder="请输入访问码"
          class="activation-input"
          @keyup.enter="verifyWebAccess"
        />
        
        <div v-if="webAuthError" class="activation-error">{{ webAuthError }}</div>
        
        <div class="activation-actions">
          <button class="btn btn-primary" @click="verifyWebAccess">进入</button>
        </div>
        
        <p class="activation-hint">
          访问码在部署时设置，或首次使用时自行设定
        </p>
      </div>
    </div>

    <!-- ==================== 首次启动引导 ==================== -->
    <div v-if="showGuideOverlay" class="guide-overlay" @click.self="closeGuide">
      <div class="guide-card">
        <div class="guide-header">
          <span>🎉 欢迎使用智卷工坊</span>
          <button class="icon-btn" @click="closeGuide">✕</button>
        </div>
        <div class="guide-body">
          <div class="guide-step" v-show="guideStep === 1">
            <span class="step-icon">📚</span>
            <h3>第一步：上传教材</h3>
            <p>点击左侧「教材库」，上传您的PDF/Word教材，系统会自动识别目录结构。</p>
          </div>
          <div class="guide-step" v-show="guideStep === 2">
            <span class="step-icon">📋</span>
            <h3>第二步：上传模板</h3>
            <p>点击左侧「模板库」，上传您想要对标的教辅范本，AI将学习其风格。</p>
          </div>
          <div class="guide-step" v-show="guideStep === 3">
            <span class="step-icon">🤖</span>
            <h3>第三步：生成教辅</h3>
            <p>点击「生成教辅」，勾选教材和模板，点击生成，即可获得专业资料。</p>
          </div>
        </div>
        <div class="guide-footer">
          <span class="guide-dots">
            <span :class="{ active: guideStep === 1 }"></span>
            <span :class="{ active: guideStep === 2 }"></span>
            <span :class="{ active: guideStep === 3 }"></span>
          </span>
          <button class="btn-primary" @click="nextGuideStep">
            {{ guideStep === 3 ? '开始使用' : '下一步' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ==================== 主界面 ==================== -->
    <template v-if="activationStatus === 'active' && !showWebAuth">
      <AppHeader
        :licenseInfo="licenseInfo"
        :versionLabel="versionLabel"
        :remainingDays="remainingDays"
        :isExpiringSoon="isExpiringSoon"
        :canAccessFeature="canAccessFeature"
        :isMobile="isMobile"
        :signInfo="signInfo"
        :signCheckLoading="signCheckLoading"
        :isCapacitorIOS="isCapacitorIOS"
      />

      <div class="main-layout" :class="{ 'mobile-layout': isMobile }">
        <AppSidebar v-if="!isMobile" :canAccessFeature="canAccessFeature" />
        <!-- 📱 移动端：下拉刷新容器 -->
        <div v-if="isMobile" class="mobile-content" :ref="ptrContainerRef">
          <!-- 下拉刷新指示器 -->
          <div class="ptr-indicator" :style="{ height: pullDistance + 'px' }">
            <span v-if="ptrRefreshing" class="ptr-spinner">⟳</span>
            <span v-else-if="pullDistance > 0" class="ptr-arrow">↓</span>
            <span v-if="ptrRefreshing" class="ptr-text">刷新中...</span>
            <span v-else-if="pullDistance >= 60" class="ptr-text">释放刷新</span>
          </div>
          <router-view v-slot="{ Component }">
            <keep-alive :max="10">
              <component :is="Component" :key="refreshKey + ':' + $route.path" />
            </keep-alive>
          </router-view>
        </div>
        <!-- 🖥️ 桌面端 -->
        <div v-else class="content-area">
          <router-view v-slot="{ Component }">
            <keep-alive :max="10">
              <component :is="Component" :key="refreshKey + ':' + $route.path" />
            </keep-alive>
          </router-view>
        </div>
      </div>

      <!-- 📱 移动端底部导航栏 -->
      <nav v-if="isMobile" class="mobile-bottom-nav">
        <div class="nav-tab" :class="{ active: $route.path === '/textbook' }" @click="$router.push('/textbook')">
          <span class="nav-icon">📖</span>
          <span class="nav-label">教材</span>
        </div>
        <div class="nav-tab" :class="{ active: $route.path === '/template' }" @click="$router.push('/template')">
          <span class="nav-icon">📋</span>
          <span class="nav-label">模板</span>
        </div>
        <div class="nav-tab" :class="{ active: $route.path === '/generate' }" @click="$router.push('/generate')">
          <span class="nav-icon">🤖</span>
          <span class="nav-label">生成</span>
        </div>
        <div class="nav-tab" :class="{ active: $route.path === '/history' }" @click="$router.push('/history')">
          <span class="nav-icon">📚</span>
          <span class="nav-label">历史</span>
        </div>
        <div class="nav-tab" :class="{ active: $route.path === '/settings' }" @click="$router.push('/settings')">
          <span class="nav-icon">⚙️</span>
          <span class="nav-label">设置</span>
        </div>
      </nav>
    </template>

    <ToastProvider ref="toastRef" />
    <AppDialogs ref="dialogsRef" />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppHeader from '@/components/layout/AppHeader.vue';
import AppSidebar from '@/components/layout/AppSidebar.vue';
import ToastProvider from '@/components/common/ToastProvider.vue';
import AppDialogs from '@/components/common/AppDialogs.vue';
import { useActivation } from '@/composables/useActivation.js';
import { useDialog } from '@/composables/useDialog.js';
import { useMobile } from '@/composables/useMobile.js';
import { useWebAuth } from '@/composables/useWebAuth.js';
import { APP_EVENTS } from '@/constants/events.js';
import storage from '@/utils/storage';
import { pullFromCloud, isCloudConfigured, uploadTextbooks, uploadActivationInfo, pushDocHistory, pushGeneratedDocs, uploadInstructions, uploadTemplates, uploadSettings, getSyncKey, setSyncKey, hasSyncKey } from '@/utils/cloudStorage';
import { hasPendingGeneration, getPendingSnapshot } from '@/utils/generationSnapshot.js';
import { apiConfig, getCurrentEngineConfig, loadConfigSync } from '@/config/apiConfig.js';
// ☁️ Supabase 云端同步配置由 CI Secrets 注入
import { saveConfig } from '@/config/apiConfig.js';
// 📱 iOS 签名倒计时（基于安装时间计算 7 天有效期）
import { getSignCountdown, resetInstallTime } from '@/utils/signatureCheck';

const router = useRouter();

// 🔧 关键：在子组件初始化前同步加载配置（非敏感字段），避免 SettingsModule 读到默认值
//    优先 localStorage，iOS Safari↔PWA 隔离时从 Cookie 桥接恢复
(function bootstrapConfig() {
  try {
    const safeFields = loadConfigSync();
    if (Object.keys(safeFields).length > 0) {
      Object.assign(apiConfig, safeFields);
      console.log('⚙️ 同步加载配置完成，字段:', Object.keys(safeFields).join(', '));
    }
  } catch { /* ignore */ }
})();

// 📱 移动端检测
const { isMobile, pwaScaleStyle } = useMobile();

// 📱 iOS 签名状态（Capacitor 原生插件）
const signInfo = ref(null);
const signCheckLoading = ref(false);
const isCapacitorIOS = ref(false);

// 🔥 热启动检测：iOS 杀 PWA 进程后快速重启时，跳过云端下拉 + 恢复浏览状态
//    原理：pagehide 时写时间戳 + 路由 → onMounted 时检测是否在窗口期内重启
const WARM_START_KEY = '__app_last_pagehide';
const WARM_START_WINDOW = 600000; // 10 分钟内重启视为热启动（切微信回消息/看抖音再回来）
const isWarmStart = (() => {
  try {
    const lastHide = localStorage.getItem(WARM_START_KEY);
    if (lastHide) {
      const elapsed = Date.now() - parseInt(lastHide, 10);
      if (elapsed > 0 && elapsed < WARM_START_WINDOW) {
        localStorage.removeItem(WARM_START_KEY); // 消费标记，防止误判
        return true;
      }
    }
  } catch { /* ignore */ }
  return false;
})();

// 📱 移动端默认跳转到生成页面（热启动路由恢复由 router redirect 同步处理）
watch(isMobile, (mobile) => {
  if (mobile && router.currentRoute.value.path === '/') {
    // 🔥 有热启动路由时，交由 router redirect 处理，不做干预（避免取消 redirect 导航致闪）
    try {
      if (localStorage.getItem('__app_route')) return;
    } catch {}
    router.push('/generate');
  }
}, { immediate: true });

// 🔐 Web 端访问码鉴权
const { needsAuth, verify: verifyWebCode, setCode: setWebCode, hasPresetCode } = useWebAuth();
const isWebMode = ref(typeof window !== 'undefined' && !window.electronAPI);
const showWebAuth = ref(false);

// 🔥 Web 端需鉴权时：首帧即显示鉴权界面（避免冷启动白屏闪烁）
if (isWebMode.value && needsAuth.value) {
  showWebAuth.value = true;
}
const webAccessCode = ref('');
const webAuthError = ref('');

const verifyWebAccess = () => {
  const code = webAccessCode.value.trim();
  if (!code) {
    webAuthError.value = '请输入访问码';
    return;
  }
  if (verifyWebCode(code)) {
    showWebAuth.value = false;
    webAuthError.value = '';
    // 首次设置访问码（无预设码时，用户输入的就是访问码）
    if (!hasPresetCode) {
      setWebCode(code);
    }
    // Web 端跳过激活检查，直接进入主界面
    if (isWebMode.value && activationStatus.value !== 'active') {
      activationStatus.value = 'active';
    }
  } else {
    webAuthError.value = '访问码不正确，请重试';
  }
};

// 子组件引用
const toastRef = ref(null);
const dialogsRef = ref(null);

// 📱 下拉刷新
const ptrContainerRef = ref(null);
const ptrRefreshing = ref(false);
const pullDistance = ref(0);

// 🔄 组件级软刷新：改变 key 强制当前路由组件销毁重建，不刷新浏览器
const refreshKey = ref(0);

// 下拉刷新手势（仅在移动端生效）
let ptrStartY = 0, ptrPulling = false;
const PTR_THRESHOLD = 60;

const onPtrTouchStart = (e) => {
  const el = ptrContainerRef.value;
  if (!el || el.scrollTop > 5 || ptrRefreshing.value) return;
  ptrStartY = e.touches[0].clientY;
  ptrPulling = true;
};
const onPtrTouchMove = (e) => {
  if (!ptrPulling || ptrRefreshing.value) return;
  const delta = e.touches[0].clientY - ptrStartY;
  if (delta <= 0) { ptrPulling = false; pullDistance.value = 0; return; }
  pullDistance.value = Math.min(delta * 0.4, 120);
};
const onPtrTouchEnd = async () => {
  if (!ptrPulling || ptrRefreshing.value) { ptrPulling = false; pullDistance.value = 0; return; }
  ptrPulling = false;
  if (pullDistance.value >= PTR_THRESHOLD) {
    ptrRefreshing.value = true;
    pullDistance.value = 50;
    try {
      await handlePullRefresh();
    } catch {}
    ptrRefreshing.value = false;
  }
  pullDistance.value = 0;
};

let _ptrCleanup = null;
const setupPtrEvents = (el) => {
  el.addEventListener('touchstart', onPtrTouchStart, { passive: true });
  el.addEventListener('touchmove', onPtrTouchMove, { passive: true });
  el.addEventListener('touchend', onPtrTouchEnd);
  return () => {
    el.removeEventListener('touchstart', onPtrTouchStart);
    el.removeEventListener('touchmove', onPtrTouchMove);
    el.removeEventListener('touchend', onPtrTouchEnd);
  };
};

// 移动端挂载/卸载下拉刷新手势
if (typeof window !== 'undefined') {
  watch([isMobile, ptrContainerRef], ([mobile, el]) => {
    if (_ptrCleanup) { _ptrCleanup(); _ptrCleanup = null; }
    if (mobile && el) {
      _ptrCleanup = setupPtrEvents(el);
    }
  }, { immediate: true });
}

const handlePullRefresh = async () => {
  if (isCloudConfigured()) {
    try {
      const data = await pullFromCloud();
      // 历史记录：云端合并结果直接写本地
      if (data.docHistory && data.docHistory.length > 0) {
        await storage.setItem('docHistory', data.docHistory).catch(() => {});
      }
      // 生成结果：云端合并结果直接写本地
      if (data.generatedDocs && data.generatedDocs.length > 0) {
        localStorage.setItem('wisdom_generated_docs', JSON.stringify(data.generatedDocs));
      }
      // 教材：单向覆盖
      if (data.textbooks && data.textbooks.length > 0) {
        const local = await storage.getItem('textbooks');
        if (!local || local.length === 0 || data.textbooks.length >= local.length) {
          await storage.setItem('textbooks', data.textbooks).catch(() => {});
          try {
            const { useTextbookStore } = await import('@/stores/textbookStore');
            await useTextbookStore().loadTextbooks();
          } catch {}
        }
      }
      if (data.instructions && data.instructions.length > 0) {
        const localRaw = localStorage.getItem('instructionLib');
        let localCount = 0;
        if (localRaw) { try { const p = JSON.parse(localRaw); localCount = p.length || 0; } catch {} }
        if (localCount === 0 || data.instructions.length >= localCount) {
          localStorage.setItem('instructionLib', JSON.stringify(data.instructions));
          localStorage.setItem('instructionLib_version', '12');
          try {
            const { useInstructionStore } = await import('@/stores/instructionStore');
            useInstructionStore().reload();
          } catch {}
        }
      }
      if (data.templates && data.templates.length > 0) {
        const local = await storage.getItem('templates');
        if (!local || local.length === 0 || data.templates.length >= local.length) {
          await storage.setItem('templates', data.templates).catch(() => {});
          try {
            const { useTemplateStore } = await import('@/stores/templateStore');
            await useTemplateStore().loadTemplates();
          } catch {}
        }
      }
      window.dispatchEvent(new CustomEvent('data-sync-complete'));
    } catch {}
  }
  showToastMessage('✅ 同步完成', 'info');
};

// Toast 辅助方法（App.vue 级别使用）
const showToastMessage = (msg, type = 'info') => {
  toastRef.value?.showMessage(msg, type);
};

// 激活系统
const {
  activationStatus,
  activationCode,
  activationError,
  machineId,
  licenseInfo,
  versionLabel,
  expireDateLabel,
  remainingDays,
  isExpiringSoon,
  canAccessFeature,
  checkActivationStatus,
  activate: doActivate,
  copyMachineId,
  changeActivationCode
} = useActivation();

// 🔥 Web 端：跳过激活检查，首帧即显示主界面（避免冷启动白屏闪烁）
if (isWebMode.value) {
  activationStatus.value = 'active';
}

const activate = () => { doActivate(); };

// 对话框系统
const { showAlertDialogFn } = useDialog();

// 引导系统
const showGuideOverlay = ref(false);
const guideStep = ref(1);

const checkFirstRun = () => {
  const hasRun = localStorage.getItem('has_launched');
  if (!hasRun) {
    showGuideOverlay.value = true;
    localStorage.setItem('has_launched', 'true');
  }
};

const nextGuideStep = () => {
  if (guideStep.value < 3) { guideStep.value++; }
  else { showGuideOverlay.value = false; }
};

const closeGuide = () => { showGuideOverlay.value = false; };

// 断点续传检测
const checkPendingGeneration = async () => {
  try {
    const pending = await hasPendingGeneration();
    if (pending) {
      const snapshot = await getPendingSnapshot();
      const stepNames = ['', '提取命题素材', '构建知识图谱', '生成命题蓝图', '逐题生成', '质量校验'];
      const stepName = stepNames[snapshot?.step] || '未知';
      showToastMessage(
        `📌 检测到未完成的生成任务（已完成至步骤：${stepName}），可前往「生成教辅」继续`,
        'info',
        8000
      );
    }
  } catch { /* ignore */ }
};

// Python 依赖检测（含一键安装）
const checkPythonDepsAsync = async () => {
  try {
    if (window.electronAPI?.checkPythonDeps) {
      const deps = await window.electronAPI.checkPythonDeps();
      const missing = [];
      if (!deps.PyMuPDF) missing.push('PyMuPDF(fitz)');
      if (!deps.Pillow) missing.push('Pillow(PIL)');
      if (!deps.numpy) missing.push('numpy');
      if (!deps.opencv) missing.push('opencv-python(cv2)');
      if (missing.length > 0) {
        showToastMessage(
          `⚠️ Python 依赖缺失：${missing.join('、')}，PDF转图片等功能可能不可用。可进入「设置」点击安装`,
          'warning',
          10000
        );
      }
    }
  } catch { /* skip */ }
};

// 存储用量检测
const checkStorageUsageAsync = async () => {
  try {
    const usageMB = await storage.getUsage();
    if (usageMB > 10) {
      showToastMessage(`⚠️ 本地存储已达 ${usageMB}MB，建议进入「设置」清理空间`, 'warning');
    }
  } catch { /* ignore */ }
};

// 菜单事件监听
const setupMenuListeners = () => {
  if (window.electronAPI?.onMenuEvent) {
    window.electronAPI.onMenuEvent((_event, action) => {
      switch (action) {
        case 'settings': router.push('/settings'); break;
        case 'graph': router.push('/graph'); break;
        case 'instruction': router.push('/instruction'); break;
        case 'history': router.push('/history'); break;
        case 'guide': showGuide(); break;
      }
    });
  }
};

// 显示使用指南
const showGuide = async () => {
  const guideContent = `
【智卷工坊 · 操作指南】

一、快速上手
1. 上传教材：左侧「教材库」→ 点击「上传教材」→ 选择PDF
2. 上传模板：左侧「模板库」→ 同上操作
3. 生成教辅：左侧「生成教辅」→ 勾选教材章节 → 配置 → 生成

二、常用快捷键
F12：打开开发者工具
Ctrl+R：刷新页面

三、常见问题
Q: 目录识别不准？A: 使用微信截图(Alt+A)框选目录页，Ctrl+C复制后「从剪贴板导入」
Q: 如何切换AI模型？A: 左侧「系统设置」→ 选择引擎并配置
Q: 如何备份数据？A: 所有数据存储在「智卷工坊数据」文件夹中，备份此文件夹即可
  `;
  showToastMessage('使用指南已弹出', 'info');
  await showAlertDialogFn(guideContent);
};

// 草稿箱联动
const handleUseDraft = (draft) => {
  if (draft.type === 'textbook') { router.push('/textbook'); }
  else { router.push('/template'); }
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent(APP_EVENTS.DRAFT_TO_UPLOAD, {
      detail: { type: draft.type, path: draft.path, name: draft.name }
    }));
  }, 100);
};

// 事件监听
const setupDraftListener = () => {
  window.addEventListener(APP_EVENTS.USE_DRAFT, (e) => handleUseDraft(e.detail));
};

const handleSwitchTab = (e) => {
  if (e.detail?.tab) router.push('/' + e.detail.tab);
};

// 初始化
onMounted(async () => {
  // 🔧 异步解密 API Key 并同步到 apiConfig（敏感字段，需异步解密）
  getCurrentEngineConfig().catch(() => {});

  // 🔐 Web 端：显示访问码验证，跳过机器码激活
  if (isWebMode.value) {
    if (needsAuth.value) {
      showWebAuth.value = true;
      activationStatus.value = 'active'; // 先假激活，等访问码通过
    } else {
      activationStatus.value = 'active';
    }
  } else {
    // 桌面端：走现有激活流程
    try {
      await checkActivationStatus();
    } catch (e) {
      console.error('❌ 激活状态检查失败:', e);
    }
    // 🔧 兜底：确保 activationStatus 离开 checking 状态，避免白屏
    if (activationStatus.value === 'checking') {
      console.warn('⚠️ 激活检查未完成，降级为未激活状态');
      activationStatus.value = 'inactive';
    }
  }

  // 📱 iOS 签名倒计时：首次启动记录安装时间，7 天倒计时
  try {
    const { Capacitor } = await import('@capacitor/core');
    isCapacitorIOS.value = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  } catch {
    // 非 Capacitor 环境，不显示签名倒计时
  }
  if (isCapacitorIOS.value) {
    signInfo.value = getSignCountdown();
    console.log('[App] 签名倒计时:', signInfo.value.daysRemaining + '天');
    // ⏰ 自动倒数：每小时更新一次剩余天数（按天精度）
    setInterval(() => {
      const updated = getSignCountdown();
      if (updated.daysRemaining !== signInfo.value?.daysRemaining) {
        signInfo.value = updated;
        console.log('[App] 签名倒计时更新:', updated.daysRemaining + '天');
      }
    }, 3600000);  // 1小时
  }

  // ☁️ 云端配置检查 + 指令库同步
  //    ❄️ 不做自动数据拉取/推送，统一走手动 ☁️ 同步按钮（app-refresh 事件）
  if (isCloudConfigured()) {
    console.log('☁️ Supabase 已配置');
    // 🔧 始终同步指令库到云端（确保已存在的自定义指令不会丢失）
    try {
      const { useInstructionStore } = await import('@/stores/instructionStore');
      useInstructionStore().syncToCloudIfNeeded();
    } catch {}
    console.log((isWarmStart ? '🔥 热启动' : '❄️ 冷启动') + ' — 请手动点击 ☁️ 按钮同步云端数据');

    // 🔑 同步密钥：首次使用自动生成
    if (!hasSyncKey()) {
      const generatedKey = Math.random().toString(36).substring(2, 6).toUpperCase();
      setSyncKey(generatedKey);
      console.log('🔑 已生成同步密钥:', generatedKey);
      if (!isWebMode.value) {
        // 桌面端：弹窗提示
        setTimeout(() => {
          showToastMessage('🔑 同步密钥: ' + generatedKey + '（可在设置页查看）', 'info');
        }, 2000);
      }
    }
  }

  setupMenuListeners();
  setupDraftListener();

  window.addEventListener(APP_EVENTS.SWITCH_TAB, handleSwitchTab);
  window.addEventListener('show-toast', (e) => {
    showToastMessage(e.detail.message, e.detail.type || 'info');
  });

  checkFirstRun();
  checkPythonDepsAsync();
  checkStorageUsageAsync();

  // 断点续传检测
  checkPendingGeneration();

  // GPU 状态显示
  try {
    if (window.electronAPI?.getOllamaGpuStatus) {
      const gpuStatus = await window.electronAPI.getOllamaGpuStatus();
      const statusMsg = gpuStatus.status === 'GPU' ? '✅ GPU 加速已激活' :
        gpuStatus.status === 'CPU' ? '⚠️ 运行在 CPU 模式' : 'ℹ️ 暂无模型加载';
      console.log(`[${gpuStatus.status}] Ollama: ${statusMsg}`);
    }
  } catch { /* skip */ }

  // 🔒 禁止锁屏/切APP后自动刷新（三层防护 + 状态持久化）
  //    1) visibilitychange：进程存活时，隐藏→可见不触发任何同步
  //    2) pagehide：进程可能被杀前保存时间戳 + 当前路由，用于冷启动恢复
  //    3) pageshow：从 bfcache 恢复时不触发任何操作
  let wasHidden = false;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      wasHidden = true;
      // 🔥 保存时间戳 + 当前路由，用于进程被杀后热启动检测和状态恢复
      try {
        localStorage.setItem(WARM_START_KEY, Date.now().toString());
        localStorage.setItem('__app_route', router.currentRoute.value.path);
      } catch {}
    } else if (wasHidden) {
      wasHidden = false;
      console.log('📱 页面恢复可见，保留原界面状态');
    }
  });
  window.addEventListener('pagehide', () => {
    try {
      localStorage.setItem(WARM_START_KEY, Date.now().toString());
      localStorage.setItem('__app_route', router.currentRoute.value.path);
    } catch {}
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      console.log('📱 页面从 bfcache 恢复，保留原界面');
    }
  });
  // 🔄 手动同步按钮：从云端拉取合并后的数据，写回本地
  //    双向数据（历史+生成结果）已在 RPC 内合并去重，直接覆盖本地即可
  window.addEventListener('app-refresh', async () => {
    console.log('🔄 手动同步：从云端拉取');
    if (isCloudConfigured()) {
      showToastMessage('☁️ 同步中…', 'info');
      try {
        // ① 🔽 从云端拉取（RPC 已合并所有设备行 + 过滤 _deleted）
        const cloudData = await pullFromCloud();

        // ② 🔼 桌面端：推送单向数据（并行上传，不再串行阻塞）
        if (!isWebMode.value) {
          const pushTasks = [];
          // 教材
          pushTasks.push((async () => {
            try {
              const localTextbooks = await storage.getItem('textbooks');
              if (localTextbooks && localTextbooks.length > 0) {
                await uploadTextbooks(localTextbooks);
                return '教材';
              }
            } catch {}
          })());
          // 激活
          pushTasks.push((async () => {
            try {
              const rawAct = localStorage.getItem('activationInfo');
              if (rawAct) {
                const act = JSON.parse(rawAct);
                if (act && act.version && act.version !== 'basic') {
                  const { _sign, ...clean } = act;
                  await uploadActivationInfo(clean);
                  return '激活';
                }
              }
            } catch {}
          })());
          // 指令库
          pushTasks.push((async () => {
            try {
              const rawIns = localStorage.getItem('instructionLib');
              if (rawIns) {
                const parsed = JSON.parse(rawIns);
                if (parsed && parsed.length > 0) {
                  await uploadInstructions(parsed);
                  return '指令库';
                }
              }
            } catch {}
          })());
          // 模板
          pushTasks.push((async () => {
            try {
              const localTemplates = await storage.getItem('templates');
              if (localTemplates && localTemplates.length > 0) {
                await uploadTemplates(localTemplates);
                return '模板';
              }
            } catch {}
          })());
          // 设置
          pushTasks.push((async () => {
            try {
              const dsFields = ['currentEngine', 'deepseekBaseUrl', 'deepseekApiKey',
                'deepseekGenerationModel', 'deepseekAnalysisModel'];
              const sp = {};
              for (const f of dsFields) { if (apiConfig[f]) sp[f] = apiConfig[f]; }
              if (Object.keys(sp).length > 0) {
                await uploadSettings(sp);
                return '设置';
              }
            } catch {}
          })());
          const desktopPushResults = (await Promise.allSettled(pushTasks))
            .filter(r => r.status === 'fulfilled' && r.value)
            .map(r => r.value);
          if (desktopPushResults.length > 0) {
            console.log('🔄 刷新：桌面端已推送单向数据:', desktopPushResults.join('、'));
          }
        }

        // ③ 💾 写入本地：云端合并 + 本地兜底（防推送失败导致本地新数据被覆盖）
        let storedGenCount = 0;
        let storedHistCount = 0;
        // 历史记录
        {
          const localHistory = await storage.getItem('docHistory') || [];
          const cloudHistory = cloudData.docHistory || [];
          const map = new Map();
          for (const item of localHistory) { if (item?.id) map.set(item.id, item); }
          for (const item of cloudHistory) {
            const exist = map.get(item?.id);
            if (!exist || (item?.savedAt || item?.timestamp || item?.createdAt || 0) >= (exist?.savedAt || exist?.timestamp || exist?.createdAt || 0)) {
              map.set(item?.id, item);
            }
          }
          const merged = Array.from(map.values())
            .sort((a, b) => (a?.savedAt || a?.timestamp || a?.createdAt || 0) - (b?.savedAt || b?.timestamp || b?.createdAt || 0))
            .slice(-50);
          storedHistCount = merged.length;
          await storage.setItem('docHistory', merged).catch(() => {});
          pushDocHistory(merged).catch(() => {});
        }
        // 生成结果
        {
          const localGenRaw = localStorage.getItem('wisdom_generated_docs');
          const localGen = localGenRaw ? JSON.parse(localGenRaw) : [];
          const cloudGen = cloudData.generatedDocs || [];
          const map = new Map();
          for (const item of localGen) { if (item?.id) map.set(item.id, item); }
          for (const item of cloudGen) {
            const exist = map.get(item?.id);
            if (!exist || (item?.savedAt || item?.timestamp || item?.createdAt || 0) >= (exist?.savedAt || exist?.timestamp || exist?.createdAt || 0)) {
              map.set(item?.id, item);
            }
          }
          const merged = Array.from(map.values())
            .sort((a, b) => (a?.savedAt || a?.timestamp || a?.createdAt || 0) - (b?.savedAt || b?.timestamp || b?.createdAt || 0))
            .slice(-20);
          storedGenCount = merged.length;
          localStorage.setItem('wisdom_generated_docs', JSON.stringify(merged));
          pushGeneratedDocs(merged).catch(() => {});
        }
        // 教材
        if (cloudData.textbooks && cloudData.textbooks.length > 0) {
          const localTextbooks = await storage.getItem('textbooks');
          if (!localTextbooks || localTextbooks.length === 0 || cloudData.textbooks.length >= localTextbooks.length) {
            await storage.setItem('textbooks', cloudData.textbooks).catch(() => {});
            try {
              const { useTextbookStore } = await import('@/stores/textbookStore');
              await useTextbookStore().loadTextbooks();
            } catch {}
          }
        }
        // 指令
        if (cloudData.instructions && cloudData.instructions.length > 0) {
          const localRaw = localStorage.getItem('instructionLib');
          let localCount = 0;
          if (localRaw) { try { const p = JSON.parse(localRaw); localCount = p.length || 0; } catch {} }
          if (localCount === 0 || cloudData.instructions.length >= localCount) {
            localStorage.setItem('instructionLib', JSON.stringify(cloudData.instructions));
            localStorage.setItem('instructionLib_version', '12');
            try {
              const { useInstructionStore } = await import('@/stores/instructionStore');
              useInstructionStore().reload();
            } catch {}
          }
        }
        // 设置
        if (cloudData.settings && Object.keys(cloudData.settings).length > 0) {
          const engineFields = ['currentEngine', 'deepseekBaseUrl', 'deepseekApiKey',
            'deepseekGenerationModel', 'deepseekAnalysisModel'];
          let needsApply = false;
          for (const f of engineFields) {
            if (cloudData.settings[f] !== undefined && cloudData.settings[f] !== apiConfig[f]) {
              apiConfig[f] = cloudData.settings[f];
              needsApply = true;
            }
          }
          if (needsApply) {
            await saveConfig(Object.assign({}, apiConfig));
            console.log('🔄 刷新：已应用云端设置, currentEngine:', cloudData.settings.currentEngine);
          }
        }
        // 激活
        if (cloudData.activationInfo) {
          localStorage.setItem('activationInfo', JSON.stringify(cloudData.activationInfo));
          try { await storage.setItem('activationInfo', cloudData.activationInfo); } catch {}
          if (isWebMode.value) {
            licenseInfo.value = { ...cloudData.activationInfo, isActive: true };
            activationStatus.value = 'active';
          }
        }
        // 模板
        if (cloudData.templates && cloudData.templates.length > 0) {
          const localTemplates = await storage.getItem('templates');
          if (!localTemplates || localTemplates.length === 0 || cloudData.templates.length >= localTemplates.length) {
            await storage.setItem('templates', cloudData.templates).catch(() => {});
            try {
              const { useTemplateStore } = await import('@/stores/templateStore');
              await useTemplateStore().loadTemplates();
            } catch {}
          }
        }

        const genCount = storedGenCount;
        const histCount = storedHistCount;
        console.log('🔄 同步完成', isWebMode.value ? '(手机端)' : '(桌面端)',
          '| 生成结果:', genCount, '条 | 历史:', histCount, '条');
        showToastMessage(
          '✅ 同步完成 · 生成' + genCount + '条 历史' + histCount + '条',
          'info'
        );
        window.dispatchEvent(new CustomEvent('data-sync-complete'));
      } catch (e) { console.warn('🔄 同步失败:', e); }
    }
  });

  // 📤 手动上推：推送本地全量数据到云端（双向+单向，桌面端包含教材/模板/指令/设置/激活）
  window.addEventListener('app-upload', async () => {
    console.log('📤 手动上推：推送本地数据到云端');
    if (isCloudConfigured()) {
      showToastMessage('📤 上推中…', 'info');
      try {
        const results = [];
        // 双向数据：历史记录
        try {
          const localHistory = await storage.getItem('docHistory') || [];
          if (localHistory.length > 0) {
            await pushDocHistory(localHistory);
            results.push('历史' + localHistory.length + '条');
          }
        } catch {}
        // 双向数据：生成结果
        try {
          const localGenRaw = localStorage.getItem('wisdom_generated_docs');
          if (localGenRaw) {
            const localGen = JSON.parse(localGenRaw);
            if (localGen && localGen.length > 0) {
              await pushGeneratedDocs(localGen);
              results.push('生成' + localGen.length + '条');
            }
          }
        } catch {}
        // 单向数据：仅桌面端推送（教材/模板/指令/设置/激活 → 手机端只拉不推）
        if (!isWebMode.value) {
          try {
            const localTextbooks = await storage.getItem('textbooks');
            if (localTextbooks && localTextbooks.length > 0) {
              await uploadTextbooks(localTextbooks);
              results.push('教材');
            }
          } catch {}
          try {
            const localTemplates = await storage.getItem('templates');
            if (localTemplates && localTemplates.length > 0) {
              await uploadTemplates(localTemplates);
              results.push('模板');
            }
          } catch {}
          try {
            const rawIns = localStorage.getItem('instructionLib');
            if (rawIns) {
              const parsed = JSON.parse(rawIns);
              if (parsed && parsed.length > 0) {
                await uploadInstructions(parsed);
                results.push('指令库');
              }
            }
          } catch {}
          try {
            const dsFields = ['currentEngine', 'deepseekBaseUrl', 'deepseekApiKey',
              'deepseekGenerationModel', 'deepseekAnalysisModel'];
            const settingsToPush = {};
            for (const f of dsFields) { if (apiConfig[f]) settingsToPush[f] = apiConfig[f]; }
            if (Object.keys(settingsToPush).length > 0) {
              await uploadSettings(settingsToPush);
              results.push('设置');
            }
          } catch {}
          try {
            const rawAct = localStorage.getItem('activationInfo');
            if (rawAct) {
              const act = JSON.parse(rawAct);
              if (act && act.version && act.version !== 'basic') {
                const { _sign, ...clean } = act;
                await uploadActivationInfo(clean);
                results.push('激活');
              }
            }
          } catch {}
        }
        if (results.length > 0) {
          console.log('📤 上推完成:', results.join('、'));
          showToastMessage('📤 已上推 ' + results.join('、'), 'info');
        } else {
          showToastMessage('📤 无数据需上推', 'info');
        }
      } catch (e) {
        console.warn('📤 上推失败:', e);
        showToastMessage('📤 上推失败', 'error');
      }
    }
  });

  // 🔄 任务重置：清空当前生成页状态，恢复初始界面（组件级软刷新）
  //    与数据同步(cloud sync)分离——同步只拉数据不销毁组件，重置才重建组件
  window.addEventListener('reset-task', () => {
    console.log('🔄 任务重置：销毁重建当前组件');
    refreshKey.value++;
    showToastMessage('✅ 已重置', 'info');
  });

  // 📱 签名倒计时重置：SettingsModule 中用户点击"已续签"后刷新顶部徽章
  window.addEventListener('sign-countdown-reset', () => {
    if (isCapacitorIOS.value) {
      signInfo.value = getSignCountdown();
      console.log('[App] 签名倒计时已重置:', signInfo.value.daysRemaining + '天');
    }
  });

  // 🔧 iOS PWA 专用：localStorage 降级备份到 sessionStorage
  //    iOS 存储压力大时可能静默清空 localStorage，sessionStorage 相对稳定
  const BACKUP_KEYS = ['apiConfig', 'wisdom_generated_docs', 'instructionLib', 'instructionLib_version', 'activationInfo', 'textbooks', 'docHistory', 'templates'];
  const backupToSession = () => {
    for (const k of BACKUP_KEYS) {
      try {
        const v = localStorage.getItem(k);
        if (v) sessionStorage.setItem('__bk_' + k, v);
      } catch {}
    }
  };
  const restoreFromSession = () => {
    let restored = 0;
    for (const k of BACKUP_KEYS) {
      try {
        if (!localStorage.getItem(k)) {
          const bk = sessionStorage.getItem('__bk_' + k);
          if (bk) { localStorage.setItem(k, bk); restored++; }
        }
      } catch {}
    }
    if (restored > 0) console.log('📦 从 sessionStorage 恢复 ' + restored + ' 个数据键');
    return restored;
  };
  // 启动时尝试恢复
  restoreFromSession();
  // 每60秒备份一次
  setInterval(backupToSession, 60000);
  backupToSession(); // 立即备份一次

  // 🔧 页面隐藏时备份（iOS 可能在后台清 localStorage）
  window.addEventListener('pagehide', backupToSession);
  window.addEventListener('beforeunload', backupToSession);
});
</script>

<style scoped>
.app-container {
  /* 用 fixed 填满物理屏幕，比 100dvh 可靠（iOS PWA 下 100dvh 可能大于可见区域） */
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  overflow: hidden;
}

/* 激活页面 */
.activation-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(255, 255, 255, 0.98); display: flex;
  align-items: center; justify-content: center; z-index: 2000;
}
.activation-loading { text-align: center; }
.activation-modal {
  background: white; padding: 40px; border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  text-align: center; max-width: 420px; width: 90%;
}
.activation-modal h2 { color: var(--primary); margin-bottom: 8px; font-size: 24px; }
.activation-desc { color: #666; margin-bottom: 24px; font-size: 14px; }
.activation-input {
  width: 100%; padding: 14px 16px; border-radius: 12px;
  border: 2px solid var(--border-light); font-size: 16px; text-align: center; letter-spacing: 2px;
}
.activation-input:focus { outline: none; border-color: var(--primary-light); }
.machine-id-display {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  margin: 16px 0; padding: 12px 16px; background: var(--primary-bg); border-radius: 8px; font-size: 13px;
}
.machine-id-value {
  font-family: 'Consolas', monospace; font-weight: 600; color: var(--primary);
  max-width: 280px; overflow-x: auto; white-space: nowrap; padding: 4px 0;
}
.copy-machine-id { cursor: pointer; padding: 4px 8px; border-radius: 4px; }
.copy-machine-id:hover { background: #e0e8f0; }
.activation-error { color: var(--danger); margin: 12px 0; font-size: 13px; }
.activation-actions { margin-top: 20px; }
.activation-hint { margin-top: 20px; color: var(--text-muted); font-size: 12px; }

.loading-spinner {
  width: 48px; height: 48px; border: 4px solid var(--border-light);
  border-top-color: var(--primary-light); border-radius: 50%;
  animation: spin 1s linear infinite; margin: 0 auto 20px;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* 引导页 */
.guide-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.5); display: flex; align-items: center;
  justify-content: center; z-index: 3000;
}
.guide-card {
  background: white; border-radius: 24px; width: 420px; padding: 24px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}
.guide-header {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 18px; font-weight: 600; color: var(--primary); margin-bottom: 20px;
}
.guide-step { text-align: center; padding: 20px 0; }
.step-icon { font-size: 48px; display: block; margin-bottom: 16px; }
.guide-step h3 { color: var(--primary); margin-bottom: 12px; }
.guide-step p { color: #666; line-height: 1.6; }
.guide-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
.guide-dots { display: flex; gap: 8px; }
.guide-dots span { width: 8px; height: 8px; border-radius: 4px; background: #ddd; transition: all 0.2s; }
.guide-dots span.active { width: 20px; background: var(--primary-light); }

/* 主布局 */
.main-layout { flex: 1; display: flex; min-height: 0; overflow: hidden; }
.content-area { flex: 1; overflow: hidden; background: white; }

/* 📱 移动端布局 */
.mobile-layout {
  flex-direction: column;
}
.mobile-content {
  flex: 1;
  min-height: 0;
  /* 外框禁止滚动，各面板内部自行 overflow-y:auto */
  overflow: hidden;
  padding-bottom: 0;
  /* 阻止浏览器原生下拉刷新 */
  overscroll-behavior-y: contain;
}

/* 📱 下拉刷新指示器 */
.ptr-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  overflow: hidden;
  transition: height 0.2s ease;
  font-size: 12px;
  color: var(--text-muted);
}
.ptr-arrow {
  display: inline-block;
  transition: transform 0.2s;
  font-size: 16px;
}
.ptr-spinner {
  display: inline-block;
  font-size: 16px;
  animation: ptr-spin 0.8s linear infinite;
}
.ptr-text {
  font-size: 11px;
}
@keyframes ptr-spin {
  to { transform: rotate(360deg); }
}

/* 📱 底部导航栏 */
.mobile-bottom-nav {
  display: flex;
  justify-content: space-around;
  align-items: center;
  /* 显式计算：内容 56px + 设备底部安全区，避免 box-sizing:border-box 下 env() 被压缩 */
  height: calc(56px + env(safe-area-inset-bottom, 0px));
  background: white;
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
  padding-bottom: env(safe-area-inset-bottom, 0);
}
.mobile-bottom-nav .nav-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 6px 16px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-muted);
  font-size: 12px;
  -webkit-tap-highlight-color: transparent;
}
.mobile-bottom-nav .nav-tab.active {
  color: var(--primary);
  background: var(--primary-bg);
}
.mobile-bottom-nav .nav-icon {
  font-size: 22px;
  line-height: 1;
}
.mobile-bottom-nav .nav-label {
  font-size: 10px;
  font-weight: 500;
}

/* 📱 移动端全局微调 */
@media (max-width: 767px) {
  .activation-modal {
    padding: 24px 20px;
    border-radius: 16px;
    max-width: 90vw;
  }
  .activation-modal h2 { font-size: 18px; }
  .activation-desc { font-size: 13px; margin-bottom: 16px; }
  .activation-input {
    padding: 12px 14px;
    font-size: 14px;
  }
  .machine-id-display {
    font-size: 11px;
    padding: 10px 12px;
  }
  .activation-error { font-size: 12px; }
  .activation-hint { font-size: 11px; margin-top: 16px; }
  .activation-actions .btn-primary {
    font-size: 14px;
    padding: 12px 24px;
  }

  .guide-overlay {
    align-items: flex-end;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  .guide-card {
    width: 100%;
    padding: 20px 16px calc(20px + env(safe-area-inset-bottom, 0px));
    border-radius: 16px 16px 0 0;
    max-height: 80vh;
    overflow-y: auto;
  }
  .guide-header { font-size: 16px; }
  .guide-step h3 { font-size: 15px; }
  .guide-step p { font-size: 13px; }
  .guide-footer .btn-primary { font-size: 14px; padding: 10px 20px; }
}
</style>
 
 