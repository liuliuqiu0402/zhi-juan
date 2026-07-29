import { reactive } from 'vue';

// ✨ 安全存储密钥的 key 前缀
const SECRET_PREFIX = 'enc_';

// ── Cookie 桥接：iOS Safari ↔ PWA 共享存储 ──
//    iOS 上 Safari 和 PWA 独立模式的 localStorage/IndexedDB 完全隔离，
//    但 Cookie 是共享的。通过 Cookie 桥接避免"浏览器配置好→PWA打开丢了"的问题。
const COOKIE_KEY = 'apiConfig';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1年

const readCookie = (name) => {
  try {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
    if (match) {
      return JSON.parse(decodeURIComponent(match[1]));
    }
  } catch { /* ignore */ }
  return null;
};

const writeCookie = (name, value) => {
  try {
    const json = encodeURIComponent(JSON.stringify(value));
    // SameSite=None + Secure：允许 PWA 独立窗口读取 Safari 设置的 Cookie
    //   在 HTTPS 部署下安全，iOS Safari↔PWA 通过此机制共享配置
    document.cookie = `${name}=${json}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=None; Secure`;
  } catch { /* ignore */ }
};

// 🔧 增强：多层级加密（Electron safeStorage > WebCrypto > base64混淆）
const encrypt = async (text) => {
  if (!text) return '';
  
  // 第一优先：Electron safeStorage
  try {
    if (window.electronAPI?.encrypt) {
      return window.electronAPI.encrypt(text);
    }
  } catch (e) { /* 降级 */ }
  
  // 第二优先：WebCrypto API（浏览器环境真加密）
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    // 导出密钥并转为 base64
    const exportedKey = await crypto.subtle.exportKey('raw', key);
    const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
    const ivBase64 = btoa(String.fromCharCode(...iv));
    const dataBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
    // 格式：enc_wc_key.iv.data
    return SECRET_PREFIX + 'wc_' + keyBase64 + '.' + ivBase64 + '.' + dataBase64;
  } catch (e) {
    console.warn('WebCrypto 加密失败，降级使用 base64 混淆:', e.message);
  }
  
  // 第三降级：base64 混淆（比明文好）
  return SECRET_PREFIX + btoa(text);
};

export const decrypt = async (encrypted) => {
  if (!encrypted) return '';
  
  // 第一优先：Electron safeStorage
  try {
    if (window.electronAPI?.decrypt) {
      const result = await window.electronAPI.decrypt(encrypted);
      if (result && result.length > 0) {
        return result;
      }
    }
  } catch (e) { 
    console.warn('⚠️ Electron safeStorage 解密失败，尝试其他方法:', e.message);
  }
  
  if (!encrypted.startsWith(SECRET_PREFIX)) {
    // 兼容旧版明文数据
    console.log('📝 检测到明文 API Key');
    return encrypted;
  }
  
  const stripped = encrypted.replace(SECRET_PREFIX, '').trim();
  
  // 第二优先：WebCrypto 解密
  if (stripped.startsWith('wc_')) {
    try {
      const parts = stripped.substring(3).split('.');
      if (parts.length === 3) {
        const keyBuffer = Uint8Array.from(atob(parts[0]), c => c.charCodeAt(0));
        const iv = Uint8Array.from(atob(parts[1]), c => c.charCodeAt(0));
        const dataBuffer = Uint8Array.from(atob(parts[2]), c => c.charCodeAt(0));
        
        const key = await crypto.subtle.importKey(
          'raw',
          keyBuffer,
          { name: 'AES-GCM' },
          false,
          ['decrypt']
        );
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          key,
          dataBuffer
        );
        const result = new TextDecoder().decode(decrypted).trim();
        if (result && result.length > 0) {
          console.log('✅ WebCrypto 解密成功');
          return result;
        }
      }
    } catch (e) {
      console.warn('⚠️ WebCrypto 解密失败:', e.message);
    }
  }
  
  // 第三降级：base64 解码
  try {
    const result = atob(stripped).trim();
    if (result && result.length > 0) {
      console.log('✅ Base64 解码成功');
      return result;
    }
  } catch (e) {
    console.warn('⚠️ Base64 解码失败:', e.message);
  }
  
  // 🔧 关键修复：如果所有方法都失败，返回原始加密值（带前缀），而不是空字符串
  console.error('❌ 所有解密方法都失败，返回原始加密值');
  return encrypted; // 返回原始值，让上层知道这是加密的
};

// ✨ 从存储加载配置（localStorage → Cookie 兜底）
const loadConfig = async () => {
  try {
    const saved = localStorage.getItem('apiConfig');
    if (saved) {
      const config = JSON.parse(saved);
      
      // 🔧 Cookie 补漏：如果 localStorage 缺 API Key，从 Cookie 合并
      if (!config.deepseekApiKey) {
        const cookieConfig = readCookie(COOKIE_KEY);
        if (cookieConfig?.deepseekApiKey) {
          console.log('🔑 从 Cookie 补全缺失的 API Key');
          config.deepseekApiKey = cookieConfig.deepseekApiKey;
          // 合并其他可能缺失的字段
          for (const f of ['currentEngine', 'deepseekGenerationModel', 'deepseekAnalysisModel', 'deepseekBaseUrl']) {
            if (!config[f] && cookieConfig[f] !== undefined) config[f] = cookieConfig[f];
          }
        }
      }
      
      // 🔧 异步解密密钥
      if (config.deepseekApiKey) {
        config.deepseekApiKey = await decrypt(config.deepseekApiKey);
      }
      
      // 🔧 关键修复：自动修正 DeepSeek API 地址
      let needsSave = false;
      if (config.deepseekBaseUrl) {
        // 如果包含了 /chat/completions，去掉它
        if (config.deepseekBaseUrl.includes('/chat/completions')) {
          console.warn('⚠️ 检测到 DeepSeek API 地址包含多余路径，自动修正...');
          config.deepseekBaseUrl = config.deepseekBaseUrl.replace(/\/chat\/completions.*$/, '');
          // 确保以 /v1 结尾
          if (!config.deepseekBaseUrl.endsWith('/v1')) {
            config.deepseekBaseUrl = config.deepseekBaseUrl.replace(/\/$/, '') + '/v1';
          }
          console.log(`✅ 已修正为: ${config.deepseekBaseUrl}`);
          needsSave = true;
        }
      }
      
      // 🔧 关键修复：在初始化 apiConfig 之前修正，确保界面显示正确的值
      if (needsSave) {
        // 立即同步保存（不使用 setTimeout），避免二次加密问题
        try {
          const toSave = { ...config };
          // 注意：config 中的 deepseekApiKey 已经被解密，saveConfig 会重新加密
          if (toSave.deepseekApiKey) {
            toSave.deepseekApiKey = await encrypt(toSave.deepseekApiKey);
          }
          localStorage.setItem('apiConfig', JSON.stringify(toSave));
          console.log('💾 已保存修正后的配置');
        } catch (e) {
          console.error('保存修正配置失败:', e);
        }
      }
      
      return config;
    }
    
    // 🔧 Cookie 兜底：iOS Safari↔PWA localStorage 隔离时从 Cookie 恢复
    const cookieConfig = readCookie(COOKIE_KEY);
    if (cookieConfig && Object.keys(cookieConfig).length > 0) {
      console.log('📦 从 Cookie 恢复 API 配置（iOS Safari↔PWA 桥接）');
      // 🔧 异步解密密钥
      if (cookieConfig.deepseekApiKey) {
        cookieConfig.deepseekApiKey = await decrypt(cookieConfig.deepseekApiKey);
      }
      // 回写到 localStorage，下次直接用
      try {
        const toSave = { ...cookieConfig };
        if (toSave.deepseekApiKey && !toSave.deepseekApiKey.startsWith('enc_')) {
          toSave.deepseekApiKey = await encrypt(toSave.deepseekApiKey);
        }
        localStorage.setItem('apiConfig', JSON.stringify(toSave));
      } catch { /* ignore */ }
      return cookieConfig;
    }
  } catch (e) {
    console.error('加载API配置失败:', e);
  }
  return {};
};

// ✨ 从存储加载配置（同步版，仅读非敏感字段，供 App.vue 提前注入）
export const loadConfigSync = () => {
  try {
    const raw = localStorage.getItem('apiConfig');
    if (raw) {
      const parsed = JSON.parse(raw);
      const { deepseekApiKey, ...safeFields } = parsed;
      if (Object.keys(safeFields).length > 0) return safeFields;
    }
    
    // 🔧 Cookie 兜底（同步版）：仅返回数据，不写 localStorage
    //    完整恢复（含 API Key）由异步 loadConfig 负责，避免写入不完整数据
    const cookieConfig = readCookie(COOKIE_KEY);
    if (cookieConfig && Object.keys(cookieConfig).length > 0) {
      console.log('📦 从 Cookie 恢复基础配置（iOS Safari↔PWA 桥接）');
      const { deepseekApiKey, ...safeFields } = cookieConfig;
      if (Object.keys(safeFields).length > 0) return safeFields;
    }
  } catch { /* ignore */ }
  return {};
};

// ✨ 保存配置（加密密钥，同步写入 localStorage + Cookie 桥接）
export const saveConfig = async (config) => {
  try {
    const toSave = { ...config };
    // 🔧 异步加密密钥（避免二次加密：已 enc_ 开头的跳过）
    if (toSave.deepseekApiKey && !toSave.deepseekApiKey.startsWith('enc_')) {
      toSave.deepseekApiKey = await encrypt(toSave.deepseekApiKey);
    }
    localStorage.setItem('apiConfig', JSON.stringify(toSave));
    
    // 🔧 Cookie 桥接：仅写入跨设备同步的核心字段（避免超 4KB 上限导致静默失败）
    //    iOS Safari↔PWA 通过此机制共享 DeepSeek 配置
    const cookieCore = {
      currentEngine: toSave.currentEngine,
      deepseekBaseUrl: toSave.deepseekBaseUrl,
      deepseekApiKey: toSave.deepseekApiKey,
      deepseekGenerationModel: toSave.deepseekGenerationModel,
      deepseekAnalysisModel: toSave.deepseekAnalysisModel,
    };
    // 桌面端额外同步 Ollama 字段
    if (!isWebDevice()) {
      cookieCore.ollamaBaseUrl = toSave.ollamaBaseUrl;
      cookieCore.ollamaTextModel = toSave.ollamaTextModel;
      cookieCore.ollamaLightModel = toSave.ollamaLightModel;
    }
    writeCookie(COOKIE_KEY, cookieCore);
    
    // 🔧 新增：清除内存缓存，下次调用时自动重新加载
    _configCache = null;
    _configCacheTime = 0;
  } catch (e) {
    console.error('保存API配置失败:', e);
  }
};

export const apiConfig = reactive({
  // 当前引擎: 'ollama' 或 'deepseek'
  currentEngine: 'ollama',
  
  // ========== Ollama 本地配置 ==========
  ollamaBaseUrl: 'http://localhost:11434',
  
  // 重型文本模型（命题生成、蓝图规划）
  // 💡 推荐：deepseek-r1:14b（考卷/命题推理最优）| glm4:9b（知识点总结最优）| qwen2.5:14b（全类型稳定）
  ollamaTextModel: 'deepseek-r1:14b',
  
  // 轻量文本模型（分析、提取、格式化）
  // 💡 推荐：glm4:9b（分析提取精准）| qwen2.5:7b（轻快省显存）
  ollamaLightModel: 'glm4:9b',
  
  // 多模态模型（图片识别、OCR）
  ollamaMultimodalModel: 'qwen3-vl:8b',  // 🔧 优化：8B版本准确率更高，显存充足

  // 🔧 新增：按任务独立配置的模型（空字符串 = 使用默认重型/轻量模型）
  ollamaQuestionGenModel: '',     // 题目生成专用模型
  ollamaReviewModel: '',           // 质量审查专用模型
  ollamaAnalysisModel: '',         // 分析提取专用模型
  ollamaHeadingModel: 'qwen2.5:7b',  // 标题分类专用模型（需要足够语义理解能力，7B 最合适）
  
  // ========== DeepSeek 云端配置 ==========
  deepseekBaseUrl: 'https://api.deepseek.com/v1',  // 🔧 修复：不要包含 /chat/completions
  deepseekApiKey: '',
  deepseekModel: 'deepseek-v4-pro',  // 🔧 保留兼容旧数据
  // 🔧 按任务分模型：生成用 Flash（快），分析用 Pro（准）
  deepseekGenerationModel: 'deepseek-v4-flash',
  deepseekAnalysisModel: 'deepseek-v4-pro',
  
  // 🔧 新增：是否分析理科图表（默认启用）
  analyzeCharts: true,

  // 选择图片识别/OCR 引擎：'paddleocr_vl'（PaddleOCR-VL）
  multimodalEngine: 'paddleocr_vl',
  
  // ========== 模型使用策略 ==========
  // 🔧 优化：分析、审查类任务升级到重型模型，确保准确判断
  // 定义不同任务使用哪个模型：'heavy'(重型) | 'light'(轻量) | 'multimodal'(多模态)
  modelStrategy: {
    // 教材原文提取 → 多模态模型（扫描件OCR，必须用视觉模型）
    contentExtraction: 'multimodal',
    
    // 🔧 知识点分析 → 升级到重型模型（需准确判断认知层次、提取命题素材）
    contentAnalysis: 'heavy',
    
    // 命题蓝图 → 重型模型（最复杂的任务，需要推理能力）
    blueprintGeneration: 'heavy',
    
    // 逐题生成 → 重型模型（需要创造力和准确性）
    questionGeneration: 'heavy',
    
    // 🔧 质量审查 → 升级到重型模型（审查比生成更需要准确，不能用7b凑合）
    qualityReview: 'heavy',
    
    // 🔧 逐题验证/数学验算 → 新增：用独立模型，低温确保客观
    questionValidation: 'heavy',
    
    // 格式化 → 轻量模型足够（简单任务）
    formatting: 'light'
  },
  
  // 图片设置
  imageSettings: {
    format: 'jpeg',
    quality: 85
  },
  
  // 生成设置（按任务区分温度）
  generationSettings: {
    analysisTemperature: 0.1,           // 分析/提取（低温，更准确）
    blueprintTemperature: 0.3,          // 蓝图生成（中低温，有结构约束）
    questionTemperature: 0.5,           // 🔧 题目生成：从0.7降到0.5，平衡准确性和创造性
    reviewTemperature: 0.1,             // 质量审查（低温，需客观）
    maxTokens: 4096,                    // 默认输出限制
    
    // 🔧 注意：maxTokensByTask 的实际生效值由下方的 MAX_TOKENS_BY_TASK 常量定义，
    //    此处仅作为 UI 展示参考，不会被 localStorage 覆盖。
    maxTokensByTask: {
      'extraction': 2048,
      'analysis': 65536,
      'blueprint': 32768,
      'generation': 65536,
      'review': 2048,
      'formatting': 2048
    },
    
    topP: 0.9,
    repeatPenalty: 1.1
  },
  
  // 🔧 初始化时无法 await，改为在后面异步加载
  // 此处不再展开，由 getCurrentEngineConfig 等函数内部异步处理
});

// 🔧 新增：内存缓存，避免每次调用都读 localStorage
let _configCache = null;
let _configCacheTime = 0;

// ✨ 分级缓存配置：不同类型数据设置不同的 TTL
const CACHE_CONFIG = {
  'apiConfig': { ttl: 60000, priority: 'high' },      // API 配置：60秒
  'modelList': { ttl: 120000, priority: 'medium' },   // 模型列表：2分钟
};

const CONFIG_CACHE_TTL = 60000; // 默认缓存有效期60秒

/**
 * 🔧 优化：获取配置（带内存缓存，避免频繁读取localStorage）
 */
const getCachedConfig = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && _configCache && (now - _configCacheTime) < CONFIG_CACHE_TTL) {
    return _configCache;
  }
  
  const savedConfig = await loadConfig();
  if (savedConfig && Object.keys(savedConfig).length > 0) {
    _configCache = savedConfig;
    _configCacheTime = now;
    return savedConfig;
  }
  return {};
};

// 获取可用模型列表（用于下拉选择）
export const getAvailableModels = async () => {
  if (apiConfig.currentEngine !== 'ollama') return [];
  try {
    const response = await fetch(`${apiConfig.ollamaBaseUrl}/api/tags`);
    const data = await response.json();
    return data.models?.map(m => m.name) || [];
  } catch {
    return ['deepseek-r1:14b', 'deepseek-r1:8b', 'glm4:9b', 'qwen2.5:14b', 'qwen2.5:7b', 'qwen3-vl:8b'];
  }
};

// 🔧 模型自动发现缓存（避免每次生成都调 /models）
let _deepseekModelsCache = null;
let _deepseekModelsCacheTime = 0;
const MODEL_DISCOVERY_TTL = 3600000; // 1 小时

/**
 * 🔧 自动发现 DeepSeek 云端最新可用模型
 * 调用 GET /models 端点，优先选择 pro 模型，其次 flash
 * 降级：API 调用失败 / 无 API Key → 保持当前配置不变
 * 缓存：1 小时内不重复请求
 */
export const autoDiscoverDeepSeekModel = async () => {
  const now = Date.now();
  if (_deepseekModelsCache && (now - _deepseekModelsCacheTime) < MODEL_DISCOVERY_TTL) {
    return _deepseekModelsCache;
  }
  
  // 无 API Key 时不调用（/models 可能需鉴权）
  if (!apiConfig.deepseekApiKey) {
    console.log('🔍 DeepSeek 未配置 API Key，跳过模型自动发现');
    return apiConfig.deepseekModel;
  }
  
  try {
    const baseUrl = apiConfig.deepseekBaseUrl || 'https://api.deepseek.com/v1';
    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiConfig.deepseekApiKey}`
      }
    });
    
    if (!response.ok) {
      console.warn(`🔍 DeepSeek /models 返回 ${response.status}，使用已配置的模型: ${apiConfig.deepseekModel}`);
      return apiConfig.deepseekModel;
    }
    
    const data = await response.json();
    const models = (data.data || []).map(m => m.id).filter(Boolean);
    
    if (models.length === 0) {
      console.warn('🔍 DeepSeek /models 返回空列表，使用已配置的模型');
      return apiConfig.deepseekModel;
    }
    
    console.log(`🔍 DeepSeek 云端当前可用模型: ${models.join(', ')}`);
    
    // 优先 pro → flash → 第一个
    const proModel = models.find(m => m.includes('pro'));
    const flashModel = models.find(m => m.includes('flash'));
    const bestModel = proModel || flashModel || models[0];
    
    if (bestModel !== apiConfig.deepseekModel) {
      console.log(`🔄 DeepSeek 模型自动更新: ${apiConfig.deepseekModel} → ${bestModel}`);
      apiConfig.deepseekModel = bestModel;
      // 同步持久化到 localStorage
      const savedConfig = await loadConfig();
      if (savedConfig) {
        savedConfig.deepseekModel = bestModel;
        await saveConfig(savedConfig);
      }
    } else {
      console.log(`✅ DeepSeek 模型已是最新: ${bestModel}`);
    }
    
    _deepseekModelsCache = bestModel;
    _deepseekModelsCacheTime = now;
    return bestModel;
  } catch (e) {
    console.warn('🔍 DeepSeek 模型自动发现失败，使用已配置的模型:', e.message);
    return apiConfig.deepseekModel;
  }
};

/**
 * 获取当前引擎配置
 * @param {string} taskType - 任务类型
 *   'extraction' | 'analysis' | 'blueprint' | 'generation' | 'review' | 'formatting'
 * @returns {object} { engine, baseUrl, textModel, multimodalModel, temperature, maxTokens }
 */
export const getCurrentEngineConfig = async (taskType = 'generation') => {
  // 🔧 优化：使用缓存版本，避免每次读取localStorage
  const savedConfig = await getCachedConfig();
  if (savedConfig && Object.keys(savedConfig).length > 0) {
    Object.assign(apiConfig, savedConfig);
  }
  
  // 任务类型 → 策略映射
  // 🔧 新增 questionValidation 映射
  const strategyMap = {
    'extraction': apiConfig.modelStrategy.contentExtraction,
    'analysis': apiConfig.modelStrategy.contentAnalysis,
    'blueprint': apiConfig.modelStrategy.blueprintGeneration,
    'generation': apiConfig.modelStrategy.questionGeneration,
    'review': apiConfig.modelStrategy.qualityReview,
    'questionValidation': apiConfig.modelStrategy.questionValidation,  // 🔧 新增
    'formatting': apiConfig.modelStrategy.formatting
  };
  const strategy = strategyMap[taskType] || 'heavy';
  
  // 任务类型 → 温度映射
  // 🔧 验证任务使用最低温度，确保客观
  const temperatureMap = {
    'extraction': apiConfig.generationSettings.analysisTemperature,
    'analysis': apiConfig.generationSettings.analysisTemperature,
    'blueprint': apiConfig.generationSettings.blueprintTemperature,
    'generation': apiConfig.generationSettings.questionTemperature,
    'review': apiConfig.generationSettings.reviewTemperature,
    'questionValidation': 0,  // 🔧 验证任务温度=0，确保客观一致
    'formatting': apiConfig.generationSettings.analysisTemperature
  };
  const taskTemperature = temperatureMap[taskType] ?? apiConfig.generationSettings.questionTemperature;
  
  if (apiConfig.currentEngine === 'ollama') {
    // 🔧 优化：按任务类型选择模型，支持用户自定义覆盖
    let textModel;
    
    // 先按 strategy 确定基础模型（heavy 或 light）
    if (strategy === 'light') {
      textModel = apiConfig.ollamaLightModel;
    } else if (strategy === 'multimodal') {
      textModel = apiConfig.ollamaMultimodalModel;
    } else {
      // heavy 策略：根据具体任务类型进一步选择
      textModel = apiConfig.ollamaTextModel;  // 默认重型模型
      
      // 🔧 如果用户为特定任务配置了专用模型，则覆盖
      if (taskType === 'generation' && apiConfig.ollamaQuestionGenModel) {
        textModel = apiConfig.ollamaQuestionGenModel;
      } else if (taskType === 'review' && apiConfig.ollamaReviewModel) {
        textModel = apiConfig.ollamaReviewModel;
      } else if ((taskType === 'analysis' || taskType === 'extraction') && apiConfig.ollamaAnalysisModel) {
        textModel = apiConfig.ollamaAnalysisModel;
      }
    }
    
    return {
      engine: 'ollama',
      baseUrl: apiConfig.ollamaBaseUrl,
      textModel: textModel,
      multimodalModel: apiConfig.ollamaMultimodalModel,
      temperature: taskTemperature,
      maxTokens: MAX_TOKENS_BY_TASK[taskType] || apiConfig.generationSettings.maxTokens
    };
  } else {
    // 🔧 按任务类型选择 DeepSeek 模型
    //    生成类（generation/blueprint/formatting）→ Flash 快速
    //    分析类（analysis/extraction/review）→ Pro 准确
    const generationTasks = ['generation', 'blueprint', 'formatting'];
    const analysisTasks = ['analysis', 'extraction', 'review', 'questionValidation'];
    let deepseekModel;
    if (generationTasks.includes(taskType)) {
      deepseekModel = apiConfig.deepseekGenerationModel || apiConfig.deepseekModel;
    } else if (analysisTasks.includes(taskType)) {
      deepseekModel = apiConfig.deepseekAnalysisModel || apiConfig.deepseekModel;
    } else {
      deepseekModel = apiConfig.deepseekModel;  // 兜底
    }
    
    return {
      engine: 'deepseek',
      baseUrl: apiConfig.deepseekBaseUrl,
      apiKey: apiConfig.deepseekApiKey,
      model: deepseekModel,
      temperature: taskTemperature,
      maxTokens: MAX_TOKENS_BY_TASK[taskType] || apiConfig.generationSettings.maxTokens
    };
  }
};

/**
 * 🔧 新增：刷新配置缓存（供外部在修改配置后调用）
 */
export const refreshConfigCache = async () => {
  _configCache = null;
  _configCacheTime = 0;
  return await getCachedConfig(true);
};

// ✨ 智能缓存管理器（用于未来扩展）
class SmartCache {
  constructor() {
    this.cache = new Map();
    this.accessTimes = new Map();
    this.maxSize = 50; // 最多缓存50项
  }
  
  set(key, value, type = 'default') {
    // 如果缓存已满，清理最少使用的项
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    
    const config = CACHE_CONFIG[type] || { ttl: CONFIG_CACHE_TTL, priority: 'low' };
    this.cache.set(key, {
      value,
      expireTime: Date.now() + config.ttl,
      priority: config.priority,
      lastAccess: Date.now()
    });
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // 检查是否过期
    if (Date.now() > item.expireTime) {
      this.cache.delete(key);
      return null;
    }
    
    // 更新访问时间
    item.lastAccess = Date.now();
    return item.value;
  }
  
  clear() {
    this.cache.clear();
    this.accessTimes.clear();
  }
  
  // 清理最少使用的项
  evictLRU() {
    let oldestKey = null;
    let oldestTime = Infinity;
    
    for (const [key, item] of this.cache.entries()) {
      // 优先清理低优先级的项
      if (item.priority === 'low') {
        this.cache.delete(key);
        return;
      }
      
      if (item.lastAccess < oldestTime) {
        oldestTime = item.lastAccess;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

// 导出智能缓存实例（供未来使用）
export const smartCache = new SmartCache();


/**
 * 获取多模态配置（图片分析专用）
 */
export const getMultimodalConfig = async () => {
  const savedConfig = await loadConfig();
  if (savedConfig && Object.keys(savedConfig).length > 0) {
    Object.assign(apiConfig, savedConfig);
  }
  
  const engine = apiConfig.multimodalEngine || 'paddleocr_vl';
  
  // PaddleOCR-VL
  return {
    engine: 'paddleocr_vl',
    baseUrl: '',
    model: 'PaddleOCR-VL'
  };
};

/**
 * 获取多模态引擎配置（getMultimodalConfig 的别名，兼容旧代码引用）
 */
export const getOCREngineConfig = async () => {
  return getMultimodalConfig();
};

// ==================== 🔧 新增：动态模型选择器 ====================

/**
 * 从模型名称推断参数量
 */
const inferParamSize = (modelName) => {
  const match = modelName.match(/(\d+)b/i);
  return match ? parseInt(match[1]) : 0;
};

/**
 * 动态选择最佳模型
 * @param {string} taskType - 任务类型
 * @param {object} requirements - 任务要求
 * @returns {object} 选中的模型配置
 */
export const selectBestModel = (taskType, requirements = {}) => {
  // 注意：此函数由 getCurrentEngineConfigEnhanced 调用，
  // 后者已通过 await loadConfig() 同步了配置，此处不再重复加载

  // 任务类型 → 策略映射
  const strategyMap = {
    'extraction': apiConfig.modelStrategy.contentExtraction,
    'analysis': apiConfig.modelStrategy.contentAnalysis,
    'blueprint': apiConfig.modelStrategy.blueprintGeneration,
    'generation': apiConfig.modelStrategy.questionGeneration,
    'review': apiConfig.modelStrategy.qualityReview,
    'questionValidation': apiConfig.modelStrategy.questionValidation,
    'formatting': apiConfig.modelStrategy.formatting
  };
  const strategy = strategyMap[taskType] || 'heavy';

  // 对于审查/验证任务，如果配置了独立审查模型，优先使用
  if ((taskType === 'review' || taskType === 'questionValidation') && 
      apiConfig.ollamaReviewModel && 
      apiConfig.ollamaReviewModel !== apiConfig.ollamaTextModel) {
    console.log(`🔍 [${taskType}] 使用独立审查模型: ${apiConfig.ollamaReviewModel}`);
    return {
      model: apiConfig.ollamaReviewModel,
      reason: '独立审查引擎，避免确认偏差',
      strategy: 'heavy'
    };
  }

  // 根据策略选择模型
  let selectedModel;
  let reason = '';

  if (strategy === 'light') {
    selectedModel = apiConfig.ollamaLightModel || apiConfig.ollamaTextModel;
    reason = '轻量任务，速度快';
  } else if (strategy === 'multimodal') {
    selectedModel = apiConfig.ollamaMultimodalModel;
    reason = '多模态任务，需要视觉能力';
  } else {
    selectedModel = apiConfig.ollamaTextModel;
    reason = '重型任务，需要高质量输出';

    if (taskType === 'generation' && apiConfig.ollamaQuestionGenModel) {
      selectedModel = apiConfig.ollamaQuestionGenModel;
      reason = '用户指定的题目生成专用模型';
    } else if (taskType === 'analysis' && apiConfig.ollamaAnalysisModel) {
      selectedModel = apiConfig.ollamaAnalysisModel;
      reason = '用户指定的分析专用模型';
    }
  }

  console.log(`🎯 [${taskType}] 选择模型: ${selectedModel} (${reason})`);
  return { model: selectedModel, reason, strategy };
};


/**
 * 🔧 核心常量：按任务类型区分的 maxTokens（权威来源，不会被 localStorage 覆盖）
 * 推理模型(R1系列)的思考链和输出内容共享 max_tokens 配额，需给足余量。
 * - analysis/generation: 65536（分析/生成 prompt 最长，推理链最复杂）
 * - blueprint: 32768（知识图谱 JSON，中等复杂度）
 * - extraction/review/formatting: 2048（短输出）
 */
const MAX_TOKENS_BY_TASK = Object.freeze({
  'extraction': 2048,
  'analysis': 65536,
  'blueprint': 32768,
  'generation': 65536,
  'review': 2048,
  'formatting': 2048
});


/**
 * 获取当前引擎配置（增强版，支持动态模型选择）
 */
export const getCurrentEngineConfigEnhanced = async (taskType = 'generation', requirements = {}) => {
  // 🔧 优化：使用缓存版本，避免每次读取localStorage
  const savedConfig = await getCachedConfig();
  if (savedConfig && Object.keys(savedConfig).length > 0) {
    Object.assign(apiConfig, savedConfig);
  }

  // 🔧 DeepSeek 引擎：自动发现云端最新可用模型（1 小时缓存，不阻塞）
  if (apiConfig.currentEngine === 'deepseek') {
    autoDiscoverDeepSeekModel(); // fire-and-forget，首次调用后缓存生效
  }

  // 🔧 修复：只有 Ollama 引擎才需要动态选择模型
  // DeepSeek 引擎直接使用 deepseek-v4-pro，不需要选择
  let bestModel = null;
  if (apiConfig.currentEngine === 'ollama') {
    bestModel = selectBestModel(taskType, requirements);
  } else {
    // DeepSeek 引擎：直接使用 deepseek-v4-pro
    bestModel = { model: apiConfig.deepseekModel, reason: 'DeepSeek 统一模型', strategy: 'heavy' };
  }

  // 任务类型 → 温度映射
  const temperatureMap = {
    'extraction': apiConfig.generationSettings.analysisTemperature,
    'analysis': apiConfig.generationSettings.analysisTemperature,
    'blueprint': apiConfig.generationSettings.blueprintTemperature,
    'generation': apiConfig.generationSettings.questionTemperature,
    'review': apiConfig.generationSettings.reviewTemperature,
    'questionValidation': 0,
    'formatting': apiConfig.generationSettings.analysisTemperature
  };
  const taskTemperature = temperatureMap[taskType] ?? apiConfig.generationSettings.questionTemperature;

  if (apiConfig.currentEngine === 'ollama') {
    return {
      engine: 'ollama',
      baseUrl: apiConfig.ollamaBaseUrl,
      textModel: bestModel.model,
      multimodalModel: apiConfig.ollamaMultimodalModel,
      temperature: taskTemperature,
      maxTokens: apiConfig.generationSettings.maxTokens,
      modelSelectionReason: bestModel.reason
    };
  } else {
    // 🔧 按任务类型选择 DeepSeek 模型
    //    生成类（generation/blueprint/formatting）→ Flash 快速
    //    分析类（analysis/extraction/review）→ Pro 准确
    const generationTasks = ['generation', 'blueprint', 'formatting'];
    const analysisTasks = ['analysis', 'extraction', 'review', 'questionValidation'];
    let deepseekModel;
    if (generationTasks.includes(taskType)) {
      deepseekModel = apiConfig.deepseekGenerationModel || apiConfig.deepseekModel;
    } else if (analysisTasks.includes(taskType)) {
      deepseekModel = apiConfig.deepseekAnalysisModel || apiConfig.deepseekModel;
    } else {
      deepseekModel = apiConfig.deepseekModel;
    }
    return {
      engine: 'deepseek',
      baseUrl: apiConfig.deepseekBaseUrl,
      apiKey: apiConfig.deepseekApiKey,
      model: deepseekModel,
      temperature: taskTemperature,
      maxTokens: MAX_TOKENS_BY_TASK[taskType] || apiConfig.generationSettings.maxTokens
    };
  }
};

/**
 * 🔧 新增：清洗文本中可能泄露的文件路径
 * @param {string} text - 原始文本
 * @returns {string} 清洗后的文本
 */
export const sanitizeFilePath = (text) => {
  if (!text || typeof text !== 'string') return text;
  
  let cleaned = text;
  
  // Windows 绝对路径
  cleaned = cleaned.replace(/[A-Za-z]:[\\/][^\s\n,，。；;！!？?]{3,}/g, '[路径已移除]');
  // UNC 路径
  cleaned = cleaned.replace(/\\\\[^\s\n,，。]{3,}/g, '[路径已移除]');
  // Unix 绝对路径
  cleaned = cleaned.replace(/\/[a-zA-Z]+\/[^\s\n,，。]{3,}/g, '[路径已移除]');
  // 应用数据目录名
  cleaned = cleaned.replace(/智卷工坊数据/g, '应用数据');
  
  return cleaned;
};