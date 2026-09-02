import { ref, computed } from 'vue';
import storage from '../utils/storage';
import { APP_EVENTS } from '../constants/events.js'; // 全局事件名唯一事实源（曾字面量分发 show-toast）
import { STORAGE_KEYS } from '../constants/storageKeys.js'; // localStorage 业务 key 唯一事实源（activationInfo 曾字面量散落）

// 超级管理员码
const SUPER_CODE = 'WISDOM-ADMIN-2024';

// 🔧 简单签名密钥（防篡改校验）
const SIGN_KEY = 'zjgf_act_2025';

// ── 模块级单例状态（跨组件共享） ──
const activationStatus = ref('checking');
const activationCode = ref('');
const activationError = ref('');
const machineId = ref('');
const licenseInfo = ref({
  isActive: false,
  version: 'basic',
  expireDate: null,
  subjects: ['all'],
  machineId: ''
});

/** 运行时检查是否为 Web/手机端（避免模块加载时 electronAPI 未就绪） */
function checkIsWebMode() {
  return typeof window !== 'undefined' && !window.electronAPI;
}

export function useActivation() {

  // 版本标签
  const versionLabel = computed(() => {
    const map = { basic: '基础版', pro: '专业版', ultimate: '旗舰版' };
    return map[licenseInfo.value.version] || '基础版';
  });

  // 到期时间标签
  const expireDateLabel = computed(() => {
    if (!licenseInfo.value.expireDate) return '未知';
    if (licenseInfo.value.expireDate === 'permanent') return '永久有效';
    return licenseInfo.value.expireDate;
  });

  // 剩余天数
  const remainingDays = computed(() => {
    if (!licenseInfo.value.expireDate || licenseInfo.value.expireDate === 'permanent') return null;
    const expire = new Date(licenseInfo.value.expireDate);
    const today = new Date();
    const diff = Math.ceil((expire - today) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  });

  // 是否即将到期（7天内）
  const isExpiringSoon = computed(() => {
    const days = remainingDays.value;
    return days !== null && days <= 7 && days > 0;
  });

  // 检查功能权限
  const canAccessFeature = (feature) => {
    if (!licenseInfo.value.isActive) return false;
    
    const version = licenseInfo.value.version;
    const featureMap = {
      'template': ['pro', 'ultimate'],
      'draft': ['ultimate'],
      'typeset': ['pro', 'ultimate'],
      'history': ['ultimate'],
      'graph': ['ultimate'],
      'instruction': ['ultimate']
    };
    
    const requiredVersions = featureMap[feature];
    if (!requiredVersions) return true; // 基础功能
    return requiredVersions.includes(version);
  };

  // 获取机器码（Electron: 硬件指纹，确定性；Web/手机: localStorage 持久化，不随机）
  const getMachineId = async () => {
    try {
      if (window.electronAPI?.getMachineId) {
        machineId.value = await window.electronAPI.getMachineId();
      } else {
        // Web/手机端：持久化存储，首次生成后不再变化（重装后同名设备可保持一致）
        const STORED_KEY = 'wisdom_machine_id';
        let stored = null;
        try { stored = localStorage.getItem(STORED_KEY); } catch {}
        if (stored) {
          machineId.value = stored;
        } else {
          // crypto.randomUUID() 在旧版 Android WebView 上可能不存在，降级到 Math.random
          let uuid = '';
          try {
            uuid = crypto.randomUUID().substring(0, 8).toUpperCase();
          } catch {
            uuid = Math.random().toString(36).substring(2, 10).toUpperCase();
          }
          machineId.value = 'WEB-' + uuid;
          try { localStorage.setItem(STORED_KEY, machineId.value); } catch {}
        }
      }
    } catch (e) {
      console.error('获取机器码失败:', e);
      machineId.value = 'ERROR-' + Date.now();
    }
  };

  // 验证激活码
  const verifyActivationCode = (code) => {
    // 超级管理员码
    if (code === SUPER_CODE) {
      return {
        valid: true,
        payload: {
          machineId: 'admin',
          version: 'ultimate',
          expireDate: 'permanent',
          subjects: ['all']
        }
      };
    }

    try {
      // 尝试 Base64 解码
      const jsonStr = atob(code);
      const payload = JSON.parse(jsonStr);
      
      // 验证机器码
      if (payload.machineId !== machineId.value && payload.machineId !== 'admin') {
        return { valid: false, error: '激活码与当前设备不匹配' };
      }
      
      // 验证有效期
      if (payload.expireDate !== 'permanent') {
        const expireDate = new Date(payload.expireDate);
        if (expireDate < new Date()) {
          return { valid: false, error: '激活码已过期' };
        }
      }
      
      return { valid: true, payload };
    } catch (e) {
      return { valid: false, error: '激活码格式无效' };
    }
  };

  // 🔧 新增：生成签名（防篡改）
  const generateSign = (data) => {
    const str = JSON.stringify(data) + SIGN_KEY;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  };

  // 🔧 新增：验证签名
  const verifySign = (data, sign) => {
    return generateSign(data) === sign;
  };

  // 检查激活状态
  const checkActivationStatus = async () => {
    // 📱 Web/手机端：activationStatus 由 App.vue 的访问码鉴权管理，这里只读取激活信息用于显示
    if (checkIsWebMode()) {
      await getMachineId();
      let savedInfo = null;
      try { savedInfo = await storage.getItem(STORAGE_KEYS.ACTIVATION_INFO); } catch {
        const raw = localStorage.getItem(STORAGE_KEYS.ACTIVATION_INFO);
        if (raw) { try { savedInfo = JSON.parse(raw); } catch {} }
      }
      if (savedInfo && savedInfo.version) {
        // 跳过签名和机器码校验，直接应用（云端同步的数据已可信）
        licenseInfo.value = { ...savedInfo, isActive: true };
      }
      return;
    }

    // 🖥️ 桌面端：完整校验流程
    activationStatus.value = 'checking';
    await getMachineId();
    
    // 🔧 优先从 IndexedDB 读取，再降级到 localStorage
    let savedInfo = null;
    try {
      savedInfo = await storage.getItem(STORAGE_KEYS.ACTIVATION_INFO);
    } catch (e) {
      // IndexedDB 读取失败，降级到 localStorage
      const localData = localStorage.getItem(STORAGE_KEYS.ACTIVATION_INFO);
      if (localData) {
        try {
          savedInfo = JSON.parse(localData);
        } catch { savedInfo = null; }
      }
    }
    
    if (savedInfo) {
      try {
        const info = savedInfo;
        
        // 🔧 新增：验证签名（防篡改）
        const storedSign = info._sign;
        const { _sign, ...dataWithoutSign } = info;
        if (storedSign && !verifySign(dataWithoutSign, storedSign)) {
          console.warn('⚠️ 激活信息签名验证失败，可能被篡改');
          activationStatus.value = 'inactive';
          licenseInfo.value.isActive = false;
          await storage.removeItem(STORAGE_KEYS.ACTIVATION_INFO);
          localStorage.removeItem(STORAGE_KEYS.ACTIVATION_INFO);
          return;
        }
        
        // 验证机器码是否匹配
        if (info.machineId === machineId.value || info.machineId === 'admin') {
          // 验证是否过期
          if (info.expireDate && info.expireDate !== 'permanent') {
            if (new Date(info.expireDate) < new Date()) {
              activationStatus.value = 'inactive';
              licenseInfo.value.isActive = false;
              return;
            }
          }
          licenseInfo.value = { ...info, isActive: true };
          activationStatus.value = 'active';
        } else {
          activationStatus.value = 'inactive';
        }
      } catch (e) {
        activationStatus.value = 'inactive';
      }
    } else {
      activationStatus.value = 'inactive';
    }
  };

  // 执行激活
  const activate = async () => {
    if (!activationCode.value.trim()) {
      activationError.value = '请输入激活码';
      return false;
    }

    const result = verifyActivationCode(activationCode.value);
    if (!result.valid) {
      activationError.value = result.error;
      return false;
    }

    // 保存激活信息
    licenseInfo.value = {
      isActive: true,
      version: result.payload.version,
      expireDate: result.payload.expireDate,
      subjects: result.payload.subjects,
      machineId: machineId.value
    };
    
    // 🔧 改为存入 IndexedDB，并添加防篡改签名
    const activationData = {
      version: result.payload.version,
      expireDate: result.payload.expireDate,
      subjects: result.payload.subjects,
      machineId: machineId.value
    };
    const signedData = {
      ...activationData,
      _sign: generateSign(activationData)
    };
    
    await storage.setItem(STORAGE_KEYS.ACTIVATION_INFO, signedData);
    // 🔧 同步清理 localStorage 中的旧数据
    localStorage.removeItem(STORAGE_KEYS.ACTIVATION_INFO);
    
    activationStatus.value = 'active';
    activationError.value = '';
    return true;
  };

  // 复制机器码
  const copyMachineId = () => {
    navigator.clipboard?.writeText(machineId.value);
    // 自定义事件通知 App.vue 显示 Toast
    window.dispatchEvent(new CustomEvent(APP_EVENTS.SHOW_TOAST, { 
      detail: { message: '机器码已复制到剪贴板', type: 'success' } 
    }));
  };

  // 更换激活码
  const changeActivationCode = async () => {
    await storage.removeItem(STORAGE_KEYS.ACTIVATION_INFO);
    localStorage.removeItem(STORAGE_KEYS.ACTIVATION_INFO); // 兼容旧数据
    activationStatus.value = 'inactive';
    activationCode.value = '';
    licenseInfo.value.isActive = false;
  };

  return {
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
    activate,
    copyMachineId,
    changeActivationCode
  };
}