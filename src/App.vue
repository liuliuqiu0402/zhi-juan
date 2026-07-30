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
import { pullFromCloud, isCloudConfigured, uploadTextbooks, uploadDocHistory, uploadActivationInfo, uploadGeneratedDocs, uploadInstructions, uploadTemplates, uploadSettings } from '@/utils/cloudStorage';
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
  // 通知当前模块刷新
  window.dispatchEvent(new CustomEvent('pull-refresh'));
  // 云端同步（仅下载，不上推——防止手机端覆盖桌面端数据）
  if (isCloudConfigured()) {
    try {
      const data = await pullFromCloud();
      // ⚠️ 安全网：仅当云端数据非空且不少于本地时才覆盖
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
      if (data.docHistory && data.docHistory.length > 0) {
        await storage.setItem('docHistory', data.docHistory).catch(() => {});
      }
      if (data.generatedDocs && data.generatedDocs.length > 0) {
        localStorage.setItem('wisdom_generated_docs', JSON.stringify(data.generatedDocs));
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
      // 🔔 通知各模块重新加载云端数据
      window.dispatchEvent(new CustomEvent('data-sync-complete'));
    } catch {}
  }
  showToastMessage('✅ 已刷新', 'info');
};

// 🔥 热启动安全上推：仅上传本地数据到云端，不做下拉（避免云端旧数据覆盖本地）
const quickPushToCloud = async () => {
  const results = [];
  try {
    // ── 桌面端专属单向推送（教材/模板/指令/设置/激活）──
    if (!isWebMode.value) {
    // 教材
    const localTextbooks = await storage.getItem('textbooks');
    if (localTextbooks && localTextbooks.length > 0) {
      try {
        await uploadTextbooks(localTextbooks);
        results.push('教材');
      } catch (e) { console.warn('☁️ 教材上传失败:', e); }
    }
    // 激活信息
    try {
      const rawAct = localStorage.getItem('activationInfo');
      if (rawAct) {
        const act = JSON.parse(rawAct);
        if (act && act.version && act.version !== 'basic') {
          const { _sign, ...clean } = act;
          await uploadActivationInfo(clean);
          results.push('激活信息');
        }
      }
    } catch (e) { console.warn('☁️ 激活信息上传失败:', e); }
    // 指令库
    try {
      const rawIns = localStorage.getItem('instructionLib');
      if (rawIns) {
        const parsed = JSON.parse(rawIns);
        if (parsed && parsed.length > 0) {
          await uploadInstructions(parsed);
          results.push('指令库');
        }
      }
    } catch (e) { console.warn('☁️ 指令库上传失败:', e); }
    // 模板
    try {
      const localTemplates = await storage.getItem('templates');
      if (localTemplates && localTemplates.length > 0) {
        await uploadTemplates(localTemplates);
        results.push('模板');
      }
    } catch (e) { console.warn('☁️ 模板上传失败:', e); }
    // 设置
    try {
      const settingsToPush = {};
      const engineFields = ['deepseekBaseUrl', 'deepseekApiKey',
        'deepseekGenerationModel', 'deepseekAnalysisModel'];
      for (const f of engineFields) {
        if (apiConfig[f]) settingsToPush[f] = apiConfig[f];
      }
      if (Object.keys(settingsToPush).length > 0) {
        await uploadSettings(settingsToPush);
        results.push('设置');
      }
    } catch (e) { console.warn('☁️ 设置上传失败:', e); }
    } // 结束桌面端专属
    // ── 双向同步（手机↔桌面互通）：仅生成结果 + 历史记录 ──
    // 历史
    const localHistory = await storage.getItem('docHistory');
    if (localHistory && localHistory.length > 0) {
      try {
        await uploadDocHistory(localHistory);
        results.push('历史');
      } catch (e) { console.warn('☁️ 历史上传失败:', e); }
    }
    // 生成结果
    try {
      const raw = localStorage.getItem('wisdom_generated_docs');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.length > 0) {
          await uploadGeneratedDocs(parsed);
          results.push('生成结果');
        }
      }
    } catch (e) { console.warn('☁️ 生成结果上传失败:', e); }
    if (results.length > 0) {
      console.log('☁️ 已上推云端:', results.join('、'));
    } else {
      console.log('☁️ 无本地数据需要上推');
    }
  } catch { /* 静默失败 */ }
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
  }

  // ☁️ 云端数据同步（桌面端 + Web 端均尝试）
  if (isCloudConfigured()) {
    console.log('☁️ Supabase 已配置，开始云端同步...');
    // 🔧 始终同步指令库到云端（确保 HMR 场景下已存在的自定义指令不会丢失）
    try {
      const { useInstructionStore } = await import('@/stores/instructionStore');
      useInstructionStore().syncToCloudIfNeeded();
    } catch {}
    // 🔥 热启动：仅做完整性检查，不做任何上推（同步统一走刷新按钮）
    if (isWarmStart) {
      console.log('🔥 检测到热启动（距上次 pagehide < 10min）');
      // ⚠️ 防御：iOS 存储压力大时可能清空 IndexedDB，若关键数据丢失必须从云端恢复
      const localTextbooks = await storage.getItem('textbooks');
      const localTemplates = await storage.getItem('templates');
      if ((!localTextbooks || localTextbooks.length === 0) && (!localTemplates || localTemplates.length === 0)) {
        console.warn('⚠️ 热启动检测到本地数据全部丢失，回退到完整云端下拉恢复');
        // 回退到完整同步（不 return，继续执行下方 pullFromCloud）
      } else {
        // 📱 本地数据完整：跳过一切同步，保留原界面（双向同步统一走刷新按钮）
        console.log('🔥 热启动完成，本地数据完整');
        return;
      }
    }
    // 🔽 完整云端下拉（冷启动 或 热启动回退）
    showToastMessage('☁️ 同步中…', 'info');
    pullFromCloud().then(async ({ textbooks, docHistory, settings, activationInfo, generatedDocs, instructions, templates }) => {
      // 🔽 下拉：云端 → 本地
      const pulled = [];
      if (textbooks && textbooks.length > 0) {
        // ⚠️ 安全网：云端数据量少于本地时不覆盖
        const localTextbooks = await storage.getItem('textbooks');
        if (!localTextbooks || localTextbooks.length === 0 || textbooks.length >= localTextbooks.length) {
          pulled.push('教材' + textbooks.length + '本');
          await storage.setItem('textbooks', textbooks).catch(() => {});
          // 🔄 重载教材 store（确保已加载的组件获取最新数据）
          try {
            const { useTextbookStore } = await import('@/stores/textbookStore');
            await useTextbookStore().loadTextbooks();
          } catch {}
        } else {
          console.warn('⚠️ 云端教材(' + textbooks.length + ')少于本地(' + localTextbooks.length + ')，跳过覆盖');
          pulled.push('教材(已保留本地' + localTextbooks.length + '本)');
        }
      }
      if (docHistory) {
        pulled.push('历史' + docHistory.length + '条');
        await storage.setItem('docHistory', docHistory).catch(() => {});
      }
      // 📋 生成结果面板同步
      if (generatedDocs && generatedDocs.length > 0) {
        pulled.push('生成结果' + generatedDocs.length + '条');
        localStorage.setItem('wisdom_generated_docs', JSON.stringify(generatedDocs));
      }
      // 📝 指令库同步（安全网：云端少于本地时不覆盖）
      if (instructions && instructions.length > 0) {
        const localRaw = localStorage.getItem('instructionLib');
        let localCount = 0;
        if (localRaw) { try { const p = JSON.parse(localRaw); localCount = p.length || 0; } catch {} }
        if (localCount === 0 || instructions.length >= localCount) {
          pulled.push('指令' + instructions.length + '条');
          localStorage.setItem('instructionLib', JSON.stringify(instructions));
          // 🔧 同步写入版本号，防止 loadInstructionLib 版本检查时误清数据
          localStorage.setItem('instructionLib_version', '12');
          // 🔄 重载指令库 store
          try {
            const { useInstructionStore } = await import('@/stores/instructionStore');
            useInstructionStore().reload();
          } catch {}
        } else {
          console.warn('⚠️ 云端指令(' + instructions.length + ')少于本地(' + localCount + ')，跳过覆盖');
        }
      }
      // 📋 模板库同步（安全网：云端少于本地时不覆盖）
      if (templates && templates.length > 0) {
        const localTemplates = await storage.getItem('templates');
        if (!localTemplates || localTemplates.length === 0 || templates.length >= localTemplates.length) {
          pulled.push('模板' + templates.length + '个');
          await storage.setItem('templates', templates).catch(() => {});
          // 🔄 重载模板 store
          try {
            const { useTemplateStore } = await import('@/stores/templateStore');
            await useTemplateStore().loadTemplates();
          } catch {}
        } else {
          console.warn('⚠️ 云端模板(' + templates.length + ')少于本地(' + localTemplates.length + ')，跳过覆盖');
        }
      }

      // 🔑 激活信息同步
      if (activationInfo) {
        pulled.push('激活信息');
        // 下拉到本地：保存云端激活信息（手机端直接使用，桌面端作为备份）
        localStorage.setItem('activationInfo', JSON.stringify(activationInfo));
        try { await storage.setItem('activationInfo', activationInfo); } catch {}
        // 📱 手机端：应用云端激活信息到 licenseInfo（跳过机器码校验）
        if (isWebMode.value) {
          licenseInfo.value = { ...activationInfo, isActive: true };
          activationStatus.value = 'active';
        }
      }
      // ⚙️ 引擎设置从云端恢复（共享 key，桌面/手机互通）
      if (settings && Object.keys(settings).length > 0) {
        // 同步 DeepSeek 连接配置 + 引擎选择（手机端跳过 Ollama 字段）
        const engineFields = ['currentEngine', 'deepseekBaseUrl', 'deepseekApiKey',
          'deepseekGenerationModel', 'deepseekAnalysisModel'];
        // 桌面端额外恢复 Ollama 字段（手机端跳过，避免混乱）
        if (!isWebMode.value) {
          engineFields.push('ollamaBaseUrl', 'ollamaTextModel', 'ollamaLightModel');
        }
        let needsApply = false;
        for (const f of engineFields) {
          if (settings[f] !== undefined && settings[f] !== apiConfig[f]) {
            apiConfig[f] = settings[f];
            needsApply = true;
            console.log('☁️ 从云端恢复字段:', f, '=', settings[f]);
          }
        }
        if (needsApply) {
          // 持久化到 localStorage，下次启动直接读取
          await saveConfig(Object.assign({}, apiConfig));
          console.log('☁️ 从云端恢复引擎设置完成, currentEngine:', settings.currentEngine, isWebMode.value ? '(手机端)' : '(桌面端)');
        } else {
          console.log('☁️ 云端设置与本地一致，跳过');
        }
      } else {
        console.log('☁️ 云端无设置数据');
      }

      // 🔼 桌面端冷启动：仅推送单向数据到云端（教材/模板/指令/设置/激活）
      //    双向数据（历史+生成结果）统一走刷新按钮，不在此处上推
      if (!isWebMode.value) {
        try {
          const localTextbooks = await storage.getItem('textbooks');
          if (localTextbooks && localTextbooks.length > 0) await uploadTextbooks(localTextbooks);
        } catch {}
        try {
          const rawAct = localStorage.getItem('activationInfo');
          if (rawAct) {
            const act = JSON.parse(rawAct);
            if (act && act.version && act.version !== 'basic') {
              const { _sign, ...clean } = act;
              await uploadActivationInfo(clean);
            }
          }
        } catch {}
        try {
          const rawIns = localStorage.getItem('instructionLib');
          if (rawIns) {
            const parsed = JSON.parse(rawIns);
            if (parsed && parsed.length > 0) await uploadInstructions(parsed);
          }
        } catch {}
        try {
          const localTemplates = await storage.getItem('templates');
          if (localTemplates && localTemplates.length > 0) await uploadTemplates(localTemplates);
        } catch {}
        try {
          // ☁️ 仅推送 DeepSeek 配置（手机端只接收这些，Ollama 字段不上云）
          const dsFields = ['currentEngine', 'deepseekBaseUrl', 'deepseekApiKey',
            'deepseekGenerationModel', 'deepseekAnalysisModel'];
          const settingsToPush = {};
          for (const f of dsFields) { if (apiConfig[f]) settingsToPush[f] = apiConfig[f]; }
          if (Object.keys(settingsToPush).length > 0) {
            await uploadSettings(settingsToPush);
            console.log('☁️ 冷启动已推送设置:', Object.keys(settingsToPush).join(', '));
          }
        } catch {}
      }

      // 📱 手机端：显示同步结果
      if (pulled.length > 0) {
        showToastMessage('☁️ 已同步: ' + pulled.join('、'), 'info');
        console.log('☁️ 冷启动云端同步完成:', pulled.join('、'));
      } else {
        showToastMessage('☁️ 云端暂无数据，请在桌面端点刷新上传', 'info');
        console.log('☁️ 冷启动：云端无数据');
      }
      // 🔔 通知各模块重新加载云端数据（确保 ref 与 storage 一致）
      window.dispatchEvent(new CustomEvent('data-sync-complete', { detail: { pulled } }));
    }).catch(() => {});
  } else {
    console.warn('☁️ Supabase 未配置！VITE_SUPABASE_URL/ANON_KEY 缺失');
    showToastMessage('⚠️ 云端未配置，无法同步数据', 'info');
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
  // 🔄 软刷新：Header 刷新按钮 → 先拉取 → 合并 → 再推送（解决两端同时新增的冲突）
  window.addEventListener('app-refresh', async () => {
    refreshKey.value++;
    console.log('🔄 软刷新：重置当前页面状态');
    if (isCloudConfigured()) {
      showToastMessage('☁️ 同步中…', 'info');
      try {
        // ① 🔽 先从云端拉取最新数据（避免后推覆盖先推的冲突）
        const cloudData = await pullFromCloud();

        // ② 🔼 桌面端：推送单向数据（教材/模板/指令/设置/激活，桌面是唯一源头）
        if (!isWebMode.value) {
          const desktopPushResults = [];
          try {
            const localTextbooks = await storage.getItem('textbooks');
            if (localTextbooks && localTextbooks.length > 0) {
              await uploadTextbooks(localTextbooks);
              desktopPushResults.push('教材');
            }
          } catch {}
          try {
            const rawAct = localStorage.getItem('activationInfo');
            if (rawAct) {
              const act = JSON.parse(rawAct);
              if (act && act.version && act.version !== 'basic') {
                const { _sign, ...clean } = act;
                await uploadActivationInfo(clean);
                desktopPushResults.push('激活信息');
              }
            }
          } catch {}
          try {
            const rawIns = localStorage.getItem('instructionLib');
            if (rawIns) {
              const parsed = JSON.parse(rawIns);
              if (parsed && parsed.length > 0) {
                await uploadInstructions(parsed);
                desktopPushResults.push('指令库');
              }
            }
          } catch {}
          try {
            const localTemplates = await storage.getItem('templates');
            if (localTemplates && localTemplates.length > 0) {
              await uploadTemplates(localTemplates);
              desktopPushResults.push('模板');
            }
          } catch {}
          try {
            const dsFields = ['currentEngine', 'deepseekBaseUrl', 'deepseekApiKey',
              'deepseekGenerationModel', 'deepseekAnalysisModel'];
            const settingsToPush = {};
            for (const f of dsFields) { if (apiConfig[f]) settingsToPush[f] = apiConfig[f]; }
            if (Object.keys(settingsToPush).length > 0) {
              await uploadSettings(settingsToPush);
              desktopPushResults.push('设置');
            }
          } catch {}
          if (desktopPushResults.length > 0) {
            console.log('🔄 刷新：桌面端已推送单向数据:', desktopPushResults.join('、'));
          }
        }

        // ③ 🔀 合并双向数据：cloud ∪ local（按 id 去重，解决两端同时新增冲突）
        const localHistory = await storage.getItem('docHistory') || [];
        const localGenRaw = localStorage.getItem('wisdom_generated_docs');
        const localGenerated = localGenRaw ? JSON.parse(localGenRaw) : [];

        const cloudHistory = cloudData.docHistory || [];
        const cloudGenerated = cloudData.generatedDocs || [];

        // 按 id 合并：云端 ∪ 本地，id 相同取本地（本地最新），无 id 用内容指纹兜底
        const mergeById = (cloudArr, localArr) => {
          const map = new Map();
          let fallbackIdx = 0;
          // 先加云端（后续 local 覆盖同 id 同指纹）
          for (const item of cloudArr) {
            const key = item.id || ('_fallback_' + (fallbackIdx++) + '_' + JSON.stringify(item).slice(0, 80));
            map.set(key, item);
          }
          for (const item of localArr) {
            const key = item.id || ('_fallback_' + (fallbackIdx++) + '_' + JSON.stringify(item).slice(0, 80));
            map.set(key, item); // local 覆盖 cloud 同 id
          }
          // 按时间倒序（最新的在前），无时间戳的排在末尾
          return Array.from(map.values()).sort((a, b) => {
            const ta = a.savedAt || a.timestamp || 0;
            const tb = b.savedAt || b.timestamp || 0;
            return tb - ta;
          });
        };
        const mergedHistory = mergeById(cloudHistory, localHistory).slice(0, 50);
        const mergedGenerated = mergeById(cloudGenerated, localGenerated).slice(0, 20);

        // ④ 🔼 推送合并后的双向数据到云端
        if (mergedHistory.length > 0) {
          await uploadDocHistory(mergedHistory).catch(() => {});
        }
        if (mergedGenerated.length > 0) {
          await uploadGeneratedDocs(mergedGenerated).catch(() => {});
        }

        // ⑤ 💾 写入本地：双向数据写合并结果，单向数据写云端版本
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
        // 历史（合并后）
        await storage.setItem('docHistory', mergedHistory).catch(() => {});
        // 生成结果（合并后）
        localStorage.setItem('wisdom_generated_docs', JSON.stringify(mergedGenerated));
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

        console.log('🔄 刷新同步完成', isWebMode.value ? '(手机端)' : '(桌面端)');
        showToastMessage('✅ 同步完成', 'info');
      } catch (e) { console.warn('🔄 刷新同步失败:', e); }
      // 🔔 通知各模块重新加载云端数据
      window.dispatchEvent(new CustomEvent('data-sync-complete'));
    }
  });

  // 📱 签名倒计时重置：SettingsModule 中用户点击"已续签"后刷新顶部徽章
  window.addEventListener('sign-countdown-reset', () => {
    if (isCapacitorIOS.value) {
      signInfo.value = getSignCountdown();
      console.log('[App] 签名倒计时已重置:', signInfo.value.daysRemaining + '天');
    }
  });

  // 🔄 后台定时同步：每30秒静默拉取云端数据，实现跨设备即时同步
  //    仅在页面可见时执行，避免后台浪费资源
  let _syncTimer = null;
  const SILENT_SYNC_INTERVAL = 30000; // 30秒
  const silentCloudSync = async () => {
    if (!isCloudConfigured() || document.hidden) return;
    try {
      const data = await pullFromCloud();
      let changed = false;
      // 教材（安全网：仅当云端数据不少于本地时才覆盖）
      if (data.textbooks && data.textbooks.length > 0) {
        const local = await storage.getItem('textbooks');
        if (JSON.stringify(local) !== JSON.stringify(data.textbooks)) {
          if (!local || local.length === 0 || data.textbooks.length >= local.length) {
            await storage.setItem('textbooks', data.textbooks).catch(() => {});
            // 重新加载教材 Store，确保 UI 刷新
            try {
              const { useTextbookStore } = await import('@/stores/textbookStore');
              await useTextbookStore().loadTextbooks();
            } catch {}
            changed = true;
          } else {
            console.warn('⚠️ 后台同步：云端教材(' + data.textbooks.length + ')少于本地(' + local.length + ')，跳过覆盖');
          }
        }
      }
      // 历史（双向数据：合并而非覆盖，防止丢失本地新数据）
      if (data.docHistory && data.docHistory.length > 0) {
        const local = await storage.getItem('docHistory') || [];
        if (JSON.stringify(local) !== JSON.stringify(data.docHistory)) {
          // 合并：cloud ∪ local，按 id 去重，同 id 取本地
          const map = new Map();
          for (const item of data.docHistory) { if (item.id) map.set(item.id, item); }
          for (const item of local) { if (item.id) map.set(item.id, item); }
          const merged = Array.from(map.values()).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)).slice(0, 50);
          if (JSON.stringify(merged) !== JSON.stringify(local)) {
            await storage.setItem('docHistory', merged).catch(() => {});
            changed = true;
          }
        }
      }
      // 生成结果（双向数据：合并而非覆盖，防止丢失本地新数据）
      if (data.generatedDocs && data.generatedDocs.length > 0) {
        const localRaw = localStorage.getItem('wisdom_generated_docs');
        const local = localRaw ? JSON.parse(localRaw) : [];
        if (JSON.stringify(local) !== JSON.stringify(data.generatedDocs)) {
          // 合并：cloud ∪ local，按 id 去重，同 id 取本地
          const map = new Map();
          for (const item of data.generatedDocs) { if (item.id) map.set(item.id, item); }
          for (const item of local) { if (item.id) map.set(item.id, item); }
          const merged = Array.from(map.values()).slice(0, 20);
          if (JSON.stringify(merged) !== JSON.stringify(local)) {
            localStorage.setItem('wisdom_generated_docs', JSON.stringify(merged));
            changed = true;
          }
        }
      }
      // 指令库（安全网：仅当云端数据不少于本地时才覆盖）
      if (data.instructions && data.instructions.length > 0) {
        const local = localStorage.getItem('instructionLib');
        if (local !== JSON.stringify(data.instructions)) {
          let localCount = 0;
          if (local) { try { const p = JSON.parse(local); localCount = p.length || 0; } catch {} }
          if (localCount === 0 || data.instructions.length >= localCount) {
            localStorage.setItem('instructionLib', JSON.stringify(data.instructions));
            localStorage.setItem('instructionLib_version', '12');
            changed = true;
          }
        }
      }
      // 模板（安全网：仅当云端数据不少于本地时才覆盖）
      if (data.templates && data.templates.length > 0) {
        const local = await storage.getItem('templates');
        if (JSON.stringify(local) !== JSON.stringify(data.templates)) {
          if (!local || local.length === 0 || data.templates.length >= local.length) {
            await storage.setItem('templates', data.templates).catch(() => {});
            // 重新加载模板 Store，确保 UI 刷新
            try {
              const { useTemplateStore } = await import('@/stores/templateStore');
              await useTemplateStore().loadTemplates();
            } catch {}
            changed = true;
          }
        }
      }
      // 引擎设置（仅同步 DeepSeek 连接配置，currentEngine 各设备独立）
      if (data.settings && Object.keys(data.settings).length > 0) {
        const engineFields = ['deepseekBaseUrl', 'deepseekApiKey',
          'deepseekGenerationModel', 'deepseekAnalysisModel'];
        let settingsChanged = false;
        for (const f of engineFields) {
          if (data.settings[f] !== undefined && data.settings[f] !== apiConfig[f]) {
            apiConfig[f] = data.settings[f];
            settingsChanged = true;
          }
        }
        if (settingsChanged) {
          await saveConfig(Object.assign({}, apiConfig));
          changed = true;
        }
      }
      if (changed) {
        console.log('🔄 后台同步：检测到云端数据变更，已更新本地');
        window.dispatchEvent(new CustomEvent('data-sync-complete', { detail: { silent: true } }));
      }
    } catch { /* 静默失败，下次再试 */ }
  };
  _syncTimer = setInterval(silentCloudSync, SILENT_SYNC_INTERVAL);
  // 页面切回前台时立即同步一次
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) silentCloudSync();
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
