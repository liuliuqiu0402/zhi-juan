/**
 * Azure 语音合成（听力音频）· 2026-09-16
 * ============================================================
 * 用途：把 utils/listeningScript.js 产出的 **SSML** 一次合成为整卷 mp3。
 * 为什么用 Azure 而不是 edge-tts：Azure 支持完整 SSML（<voice> 分角色 + <break> 精确停顿），
 *   一次请求出整卷；而 edge-tts 已被移除自定义 SSML 支持，只能"逐句合成再拼接"，
 *   对听力卷（多角色 + 读两遍 + 题间留白）反而更麻烦。
 *
 * 🔴 调用位置：**优先走主进程**（Electron 无跨域限制）。
 *   前端直连会因自定义头 Ocp-Apim-Subscription-Key 触发 CORS 预检，浏览器可能直接拦下；
 *   故 Electron 下走 window.electronAPI.azureTtsToFile（主进程 fetch + 落盘），
 *   仅在无 electronAPI（Web/PWA）时降级为前端 fetch + Blob 下载。
 *
 * 🔴 密钥：只从 apiConfig.azureSpeechKey 读（内存中的解密值），本模块不持久化、不打印 Key。
 * ============================================================
 */
import { STORAGE_KEYS } from '../constants/storageKeys.js';

/** 常用区域（下拉建议；也允许手填其它区域） */
export const AZURE_SPEECH_REGIONS = [
  { value: 'eastasia', label: '东亚（香港）' },
  { value: 'southeastasia', label: '东南亚（新加坡）' },
  { value: 'japaneast', label: '日本东部' },
  { value: 'koreacentral', label: '韩国中部' },
  { value: 'eastus', label: '美国东部' },
  { value: 'westus2', label: '美国西部 2' },
];

/** 输出格式（考试音频建议 24kHz/160kbps 单声道 mp3） */
export const AZURE_OUTPUT_FORMATS = [
  { value: 'audio-24khz-160kbitrate-mono-mp3', label: '24kHz / 160kbps 单声道 MP3（推荐）' },
  { value: 'audio-16khz-128kbitrate-mono-mp3', label: '16kHz / 128kbps 单声道 MP3（体积小）' },
  { value: 'audio-48khz-192kbitrate-mono-mp3', label: '48kHz / 192kbps 单声道 MP3（高保真）' },
];

export const DEFAULT_OUTPUT_FORMAT = 'audio-24khz-160kbitrate-mono-mp3';

/** SSML 体积保守阈值：超限判为"整卷过大"，提示按大题拆分（保守值，非官方上限声明） */
export const SSML_SOFT_LIMIT = 60000;

/**
 * 区域名归一：容忍用户粘贴完整端点/域名/带协议/带路径——
 * 'eastasia'、'EastAsia '、'https://eastasia.tts.speech.microsoft.com/cognitiveservices/v1'
 * 一律归一为 'eastasia'（脏输入会让端点拼错 → 404，是最常见的配置翻车点）
 */
export function normalizeRegion(input = '') {
  let s = String(input || '').trim().toLowerCase().replace(/^https?:\/\//, '');
  s = s.split('/')[0];
  if (!s) return '';
  if (s.includes('.')) s = s.split('.')[0];
  return s.replace(/[^a-z0-9-]/g, '');
}

/** 合成端点（REST v1） */
export function buildTtsEndpoint(region = '') {
  const r = normalizeRegion(region);
  if (!r) throw new Error('未配置 Azure 语音区域（region），无法拼出合成端点');
  return `https://${r}.tts.speech.microsoft.com/cognitiveservices/v1`;
}

/** 配置校验（缺项给出可操作的提示，而不是让请求裸奔到 401/404） */
export function validateAzureConfig({ key = '', region = '' } = {}) {
  if (!String(key || '').trim()) {
    return { ok: false, message: '未配置 Azure 语音 Key：请在「设置 → Azure 语音合成」中填写后再生成音频。' };
  }
  const r = normalizeRegion(region);
  if (!r) {
    return { ok: false, message: '未配置 Azure 语音区域：请填写资源所在区域（如 eastasia）。' };
  }
  return { ok: true, key: String(key).trim(), region: r };
}

/** 体积守卫：超限早失败并给出可执行建议（而不是等 413） */
export function assertSsmlSize(ssml = '') {
  const len = String(ssml || '').length;
  if (len > SSML_SOFT_LIMIT) {
    throw new Error(`SSML 过长（${len} 字符 > ${SSML_SOFT_LIMIT}），建议按大题拆分后分别合成再合并。`);
  }
  return len;
}

/** HTTP 状态 → 可读原因（Azure 的失败码语义差异大，逐条翻译才能让用户自解） */
export function describeAzureError(status, bodyText = '') {
  const tail = bodyText ? `　服务返回：${String(bodyText).slice(0, 200)}` : '';
  const map = {
    400: '请求被拒：SSML 格式非法（标签未闭合或含非法字符）',
    401: '鉴权失败：Azure 语音 Key 无效或已失效，请在设置页更新',
    403: '无权限：Key 与区域不匹配（最常见），或订阅/配额状态异常',
    404: '端点不存在：区域名可能拼错',
    413: '请求体过大：SSML 太长，建议按大题拆分',
    415: '不支持的输出格式：请在设置页改用受支持的音频格式',
    429: '请求过于频繁：免费层并发受限，请稍后重试',
  };
  if (map[status]) return `${map[status]}（HTTP ${status}）${tail}`;
  if (status >= 500) return `Azure 服务端临时故障（HTTP ${status}），请稍后重试${tail}`;
  return `Azure 语音合成失败（HTTP ${status}）${tail}`;
}

/** 文件名安全化（去非法字符，保留中文） */
export function safeAudioFileName(name = '', fallback = '听力音频') {
  const s = String(name || '').replace(/[\\/:*?"<>|\r\n\t]/g, '_').trim();
  return (s || fallback).slice(0, 80);
}

/**
 * 直接合成（前端 fetch 路径；Web/PWA 用）。
 * Electron 下请优先用 synthesizeToFile（走主进程，规避 CORS）。
 * @returns {Promise<Blob>} audio/mpeg
 */
export async function synthesizeSpeech(ssml = '', { key, region, outputFormat = DEFAULT_OUTPUT_FORMAT, timeoutMs = 180000 } = {}) {
  const cfg = validateAzureConfig({ key, region });
  if (!cfg.ok) throw new Error(cfg.message);
  assertSsmlSize(ssml);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(buildTtsEndpoint(cfg.region), {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': cfg.key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': outputFormat,
        'User-Agent': 'zhijuan-workshop',
      },
      body: String(ssml),
      signal: controller.signal,
    });
    if (!resp.ok) {
      let detail = '';
      try { detail = await resp.text(); } catch { /* 无响应体 */ }
      throw new Error(describeAzureError(resp.status, detail));
    }
    return await resp.blob();
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error(`合成超时（${Math.round(timeoutMs / 1000)}s），请检查网络或稍后重试`);
    // 浏览器 CORS 拦截的典型报错是 TypeError: Failed to fetch——给出可操作指引
    if (e instanceof TypeError) {
      throw new Error('请求未能发出（多为浏览器跨域拦截）。桌面端请使用「生成音频」按钮走主进程；Web 端需为 Azure 端点配置 CORS。');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 合成并落盘（统一入口）
 * · Electron：走主进程 azure-tts-to-file（主进程 fetch + 保存对话框 + 写文件）
 * · Web/PWA：前端 fetch → Blob 下载
 * @returns {Promise<{ ok:boolean, path?:string, canceled?:boolean, bytes?:number }>}
 */
export async function synthesizeToFile(ssml = '', {
  key, region, outputFormat = DEFAULT_OUTPUT_FORMAT, suggestedName = '听力音频', timeoutMs = 180000,
} = {}) {
  const cfg = validateAzureConfig({ key, region });
  if (!cfg.ok) throw new Error(cfg.message);
  assertSsmlSize(ssml);

  const fileName = `${safeAudioFileName(suggestedName)}.mp3`;
  const api = typeof window !== 'undefined' ? window.electronAPI : null;

  if (api && typeof api.azureTtsToFile === 'function') {
    const r = await api.azureTtsToFile({
      ssml: String(ssml),
      key: cfg.key,
      region: cfg.region,
      outputFormat,
      suggestedName: fileName,
      timeoutMs,
    });
    if (!r || r.ok !== true) throw new Error((r && r.error) || '音频生成失败');
    return r;
  }

  // Web/PWA 降级：Blob 下载（与项目其它导出同一套写法）
  const blob = await synthesizeSpeech(ssml, { key: cfg.key, region: cfg.region, outputFormat, timeoutMs });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { ok: true, bytes: blob.size };
}

/** 供设置页读取当前 Key/区域（不打印 Key 明文） */
export function readAzureConfigFromApiConfig(apiConfig = {}) {
  return {
    key: apiConfig.azureSpeechKey || '',
    region: apiConfig.azureSpeechRegion || '',
    outputFormat: apiConfig.azureSpeechOutputFormat || DEFAULT_OUTPUT_FORMAT,
  };
}

export { STORAGE_KEYS };

export default {
  AZURE_SPEECH_REGIONS,
  AZURE_OUTPUT_FORMATS,
  DEFAULT_OUTPUT_FORMAT,
  SSML_SOFT_LIMIT,
  normalizeRegion,
  buildTtsEndpoint,
  validateAzureConfig,
  assertSsmlSize,
  describeAzureError,
  safeAudioFileName,
  synthesizeSpeech,
  synthesizeToFile,
  readAzureConfigFromApiConfig,
};
