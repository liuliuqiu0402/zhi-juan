/**
 * ☁️ Supabase 云存储层（v4：客户端合并，服务端只查原始行）
 *
 * 推：每个设备独立一行 (sync_key + device_id)，互不覆盖。
 * 拉：服务端只返回原始设备行 → 客户端 JS 合并去重（V8 处理 JSON 秒级完成）。
 * 删除：客户端打 _deleted: true 标记，合并时自动过滤。
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ── 配置 ──
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let _client: SupabaseClient | null = null;

// 🔧 自定义 fetch：60s 超时 + 网络错误自动重试（QUIC 协议错误等瞬时故障最多重试 3 次，指数退避）
const fetchWithRetry = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => {
          controller.abort();
          reject(new DOMException('Timeout after 60s', 'TimeoutError'));
        }, 60000)
      );
      const resp = await Promise.race([
        fetch(input, { ...init, signal: controller.signal }),
        timeoutPromise,
      ]);
      return resp;
    } catch (e: any) {
      // 判断是否值得重试的网络错误（QUIC、DNS、连接重置等瞬时故障）
      const isNetErr = e?.name === 'TypeError' ||
                       e?.name === 'TimeoutError' ||
                       /fetch failed|QUIC|network|ETIMEDOUT|ECONNRESET/i.test(e?.message || '');
      if (attempt < maxRetries && isNetErr) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
        console.warn('⚠️ 网络瞬时故障，' + (delay / 1000).toFixed(0) + 's 后重试 (' + (attempt + 1) + '/' + maxRetries + ')');
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
  throw new Error('fetchWithRetry: max retries exceeded');
};

function getClient(): SupabaseClient | null {
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('☁️ Supabase 未配置，跳过云端同步');
    return null;
  }
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { fetch: fetchWithRetry as typeof fetch },
  });
  return _client;
}

// ── sync_key 管理 ──

const SYNC_KEY_STORAGE = 'sync_key';

/** 获取当前设备的同步密钥 */
export function getSyncKey(): string | null {
  try {
    return localStorage.getItem(SYNC_KEY_STORAGE);
  } catch {
    return null;
  }
}

/** 设置同步密钥 */
export function setSyncKey(key: string): void {
  try {
    localStorage.setItem(SYNC_KEY_STORAGE, key);
  } catch {}
}

/** 同步密钥是否已配置 */
export function hasSyncKey(): boolean {
  return !!getSyncKey();
}

// ── device_id 管理 ──

const DEVICE_ID_KEY = 'wisdom_device_id';

/** 获取当前设备唯一标识（首次自动生成 UUID，永不改变） */
export function getDeviceId(): string {
  try {
    let did = localStorage.getItem(DEVICE_ID_KEY);
    if (!did) {
      did = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, did);
      console.log('🆔 已生成设备标识:', did.slice(0, 8));
    }
    return did;
  } catch {
    return 'fallback_' + Math.random().toString(36).slice(2, 10);
  }
}

// ── 工具 ──

function safeClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function noSyncKey(): boolean {
  if (!getSyncKey()) {
    console.warn('☁️ sync_key 未设置，跳过云端操作');
    return true;
  }
  return false;
}

function noClient(): SupabaseClient | null {
  const client = getClient();
  if (!client) console.warn('☁️ Supabase 客户端未初始化');
  return client;
}

// ══════════════════════════════════════════════════════════════
// 通用：客户端合并（V8 引擎处理 JSON 远快于 Supabase 免费实例）
// ══════════════════════════════════════════════════════════════

/**
 * 合并多设备行：展开 → 去重（同 id 保留最新时间戳）→ 过滤删除标记 → 排序 → 截断
 * @param rows RPC 返回的原始数组，每个元素是一个设备的 data 数组（JSONB 数组）
 * @param limit 最多保留条数
 */
function mergeDeviceData(rows: unknown[], limit: number): Record<string, unknown>[] {
  // 展开所有设备行（兼容两种 RPC 格式：{data: [...]} 或直接数组 [...]）
  const allItems: Record<string, unknown>[] = [];
  for (const row of rows) {
    const items = (row && typeof row === 'object' && !Array.isArray(row) && 'data' in row)
      ? (row as Record<string, unknown>).data
      : row;
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item && typeof item === 'object') {
          allItems.push(item as Record<string, unknown>);
        }
      }
    }
  }

  if (allItems.length === 0) return [];

  // 收集删除标记
  const tombstoneIds = new Set<string>();
  for (const item of allItems) {
    if (item._deleted && item.id) {
      tombstoneIds.add(item.id as string);
    }
  }

  // 去重：同 id 保留最新时间戳版本
  const map = new Map<string, Record<string, unknown>>();
  for (const item of allItems) {
    const id = item.id as string;
    if (!id || tombstoneIds.has(id)) continue;
    const existing = map.get(id);
    if (!existing) {
      map.set(id, item);
    } else {
      const newTime = (item.savedAt as number) || (item.timestamp as number) || (item.createdAt as number) || 0;
      const oldTime = (existing.savedAt as number) || (existing.timestamp as number) || (existing.createdAt as number) || 0;
      if (newTime > oldTime) {
        map.set(id, item);
      }
    }
  }

  // 按时间倒序排列，截断
  return Array.from(map.values())
    .sort((a, b) => {
      const aTime = (a.savedAt as number) || (a.timestamp as number) || (a.createdAt as number) || 0;
      const bTime = (b.savedAt as number) || (b.timestamp as number) || (b.createdAt as number) || 0;
      return bTime - aTime;
    })
    .slice(0, limit);
}

// ══════════════════════════════════════════════════════════════
// doc_history：push（即时上推） + pull（客户端合并）
// ══════════════════════════════════════════════════════════════

/** 推历史记录到云端（直接 upsert，不走 RPC，避免冷启动超时） */
export async function pushDocHistory(items: unknown[]): Promise<boolean> {
  if (noSyncKey()) return false;
  const client = noClient();
  if (!client) return false;

  try {
    // 排序 + 截断（与旧 RPC push_doc_history 行为一致：≤50 条）
    const sorted = [...items]
      .sort((a: any, b: any) => (b.savedAt || b.timestamp || 0) - (a.savedAt || a.timestamp || 0))
      .slice(0, 50);
    const { error } = await client
      .from('doc_history')
      .upsert({ id: getSyncKey() + ':' + getDeviceId(), data: sorted, updated_at: new Date().toISOString() });
    if (error) {
      console.error('☁️ push_doc_history 失败:', error.message);
      return false;
    }
    console.log('☁️ push_doc_history: ' + sorted.length + ' 条（直接 upsert）');
    return true;
  } catch (e) {
    console.warn('☁️ push_doc_history 异常:', e);
    return false;
  }
}

/** 从云端拉取历史记录（直接查表 → 客户端 JS 合并去重，不走 RPC，避免冷启动超时） */
export async function pullDocHistory(): Promise<unknown[] | null> {
  if (noSyncKey()) return null;
  const client = getClient();
  if (!client) return null;

  try {
    const { data: rows, error } = await client
      .from('doc_history')
      .select('data')
      .like('id', getSyncKey() + ':%');
    if (error) {
      console.error('☁️ pull_doc_history 失败:', error.message);
      return null;
    }
    const merged = mergeDeviceData((rows as unknown[]) || [], 50);
    console.log('☁️ pull_doc_history:', merged.length, '条（客户端合并）');
    return merged;
  } catch (e) {
    console.warn('☁️ pull_doc_history 异常:', e);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// generated_docs：push（即时上推） + pull（拉取合并）
// ══════════════════════════════════════════════════════════════

/** 推生成结果到云端（直接 upsert，不走 RPC，避免冷启动超时）
 *  v6：独立 generated_docs 表，与 doc_history 同款路径 */
export async function pushGeneratedDocs(items: unknown[]): Promise<boolean> {
  if (noSyncKey()) return false;
  const client = noClient();
  if (!client) return false;

  try {
    // 排序 + 截断（≤20 条）
    const sorted = [...items]
      .sort((a: any, b: any) => (b.savedAt || b.timestamp || 0) - (a.savedAt || a.timestamp || 0))
      .slice(0, 20);
    const { error } = await client
      .from('generated_docs')
      .upsert({ id: getSyncKey() + ':' + getDeviceId(), data: sorted, updated_at: new Date().toISOString() });
    if (error) {
      console.error('☁️ push_generated_docs 失败:', error.message);
      return false;
    }
    console.log('☁️ push_generated_docs: ' + sorted.length + ' 条（独立表直接 upsert）');
    return true;
  } catch (e) {
    console.warn('☁️ push_generated_docs 异常:', e);
    return false;
  }
}

/** 从云端拉取生成结果（新表优先 + 旧 user_settings 兼容，客户端 JS 合并去重） */
export async function pullGeneratedDocs(): Promise<unknown[] | null> {
  if (noSyncKey()) return null;
  const client = getClient();
  if (!client) return null;

  const allRows: unknown[] = [];

  try {
    // ① 新表 generated_docs（v6+）
    const { data: newRows, error: newErr } = await client
      .from('generated_docs')
      .select('data')
      .like('id', getSyncKey() + ':%');
    if (!newErr && newRows) allRows.push(...(newRows as unknown[]));
  } catch { /* 表可能还未创建，忽略 */ }

  try {
    // ② 旧 user_settings 兼容（v5 及之前，generated_docs:* 行）
    const { data: oldRows, error: oldErr } = await client
      .from('user_settings')
      .select('id, data')
      .like('id', getSyncKey() + ':generated_docs:%');
    if (!oldErr && oldRows) {
      for (const row of (oldRows as { id: string; data: unknown }[])) {
        allRows.push(row.data);
      }
    }
  } catch { /* 兼容读取失败，忽略 */ }

  const merged = mergeDeviceData(allRows, 20);
  console.log('☁️ pull_generated_docs:', merged.length, '条（新表' +
    (allRows.length > 0 && (allRows[0] as any)?.data ? '+旧兼容' : '') +
    ' + 客户端合并）');
  return merged;
}

// ══════════════════════════════════════════════════════════════
// v5 合并拉取：直接查 user_settings 表一次，按 ID 后缀分流
//   不走 RPC，与教材/模板同款路径，避免冷启动超时
// ══════════════════════════════════════════════════════════════

/** 一次查表拉取所有 user_settings 行，按 ID 后缀分流（v6：generated_docs 已独立建表） */
export async function pullAllSettings(): Promise<{
  settings: Record<string, unknown> | null;
  activationInfo: Record<string, unknown> | null;
  instructions: unknown[] | null;
}> {
  if (noSyncKey()) return { settings: null, activationInfo: null, instructions: null };
  const client = getClient();
  if (!client) return { settings: null, activationInfo: null, instructions: null };

  try {
    const { data: rows, error } = await client
      .from('user_settings')
      .select('id, data')
      .like('id', getSyncKey() + ':%');
    if (error) {
      console.error('☁️ pullAllSettings 失败:', error.message);
      return { settings: null, activationInfo: null, instructions: null };
    }

    // 按 ID 后缀分流（仅 settings / activation / instructions，generated_docs 已独立）
    let settings: Record<string, unknown> | null = null;
    let activationInfo: Record<string, unknown> | null = null;
    let instructions: unknown[] | null = null;

    const syncKey = getSyncKey() || '';
    for (const row of (rows as { id: string; data: unknown }[]) || []) {
      const suffix = row.id?.replace(syncKey + ':', '');
      if (!suffix) continue;
      if (suffix === 'settings') {
        settings = row.data as Record<string, unknown>;
      } else if (suffix === 'activation') {
        activationInfo = row.data as Record<string, unknown>;
      } else if (suffix === 'instructions') {
        instructions = row.data as unknown[];
      }
    }

    console.log('☁️ pullAllSettings: 设置=' + (settings ? Object.keys(settings).length + '项' : '无') +
      ' 激活=' + (activationInfo ? '有' : '无') +
      ' 指令=' + (instructions?.length ?? 0) + '条');
    return { settings, activationInfo, instructions };
  } catch (e) {
    console.warn('☁️ pullAllSettings 异常:', e);
    return { settings: null, activationInfo: null, instructions: null };
  }
}

// ══════════════════════════════════════════════════════════════
// 教材库（覆盖写入 — 桌面是唯一源头，单向推送）
// ══════════════════════════════════════════════════════════════

export async function uploadTextbooks(textbooks: unknown[]): Promise<boolean> {
  if (noSyncKey()) return false;
  const client = getClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('textbooks')
      .upsert({ id: getSyncKey(), data: safeClone(textbooks), updated_at: new Date().toISOString() });
    if (error) { console.warn('☁️ 教材上传失败:', error.message); return false; }
    return true;
  } catch (e) {
    console.warn('☁️ 教材上传异常:', e);
    return false;
  }
}

export async function downloadTextbooks(): Promise<unknown[] | null> {
  if (noSyncKey()) return null;
  const client = getClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('textbooks')
      .select('data')
      .eq('id', getSyncKey())
      .single();
    if (error || !data) return null;
    return data.data as unknown[];
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// 模板库（覆盖写入 — 桌面是唯一源头，单向推送）
// ══════════════════════════════════════════════════════════════

export async function uploadTemplates(templates: unknown[]): Promise<boolean> {
  if (noSyncKey()) return false;
  const client = getClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('templates')
      .upsert({ id: getSyncKey(), data: safeClone(templates), updated_at: new Date().toISOString() });
    if (error) { console.warn('☁️ 模板上传失败:', error.message); return false; }
    return true;
  } catch (e) {
    console.warn('☁️ 模板上传异常:', e);
    return false;
  }
}

export async function downloadTemplates(): Promise<unknown[] | null> {
  if (noSyncKey()) return null;
  const client = getClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('templates')
      .select('data')
      .eq('id', getSyncKey())
      .single();
    if (error || !data) return null;
    return data.data as unknown[];
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// user_settings（激活/设置/指令 — 覆盖写入）
// ══════════════════════════════════════════════════════════════

/** user_settings 专用：上传，返回是否成功 */
async function upsertUserSetting(subKey: string, data: unknown): Promise<boolean> {
  if (noSyncKey()) return false;
  const client = getClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('user_settings')
      .upsert({ id: getSyncKey() + ':' + subKey, data: safeClone(data), updated_at: new Date().toISOString() });
    if (error) { console.warn('☁️ user_settings.' + subKey + ' 上传失败:', error.message); return false; }
    return true;
  } catch (e) {
    console.warn('☁️ user_settings.' + subKey + ' 上传异常:', e);
    return false;
  }
}

/** user_settings 专用：下载 */
async function fetchUserSetting(subKey: string): Promise<unknown | null> {
  if (noSyncKey()) return null;
  const client = getClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('user_settings')
      .select('data')
      .eq('id', getSyncKey() + ':' + subKey)
      .single();
    if (error || !data) return null;
    return data.data;
  } catch {
    return null;
  }
}

export function uploadSettings(settings: Record<string, unknown>): Promise<boolean> {
  return upsertUserSetting('settings', settings);
}
export function downloadSettings(): Promise<Record<string, unknown> | null> {
  return fetchUserSetting('settings') as Promise<Record<string, unknown> | null>;
}
export function uploadActivationInfo(info: Record<string, unknown>): Promise<boolean> {
  return upsertUserSetting('activation', info);
}
export function downloadActivationInfo(): Promise<Record<string, unknown> | null> {
  return fetchUserSetting('activation') as Promise<Record<string, unknown> | null>;
}
export function uploadInstructions(instructions: unknown[]): Promise<boolean> {
  return upsertUserSetting('instructions', instructions);
}
export function downloadInstructions(): Promise<unknown[] | null> {
  return fetchUserSetting('instructions') as Promise<unknown[] | null>;
}

// ══════════════════════════════════════════════════════════════
// 一键同步
// ══════════════════════════════════════════════════════════════

/** 从云端拉取所有数据（合并后的生成结果 + 历史记录 + 单向数据） */
export async function pullFromCloud(): Promise<{
  textbooks: unknown[] | null;
  docHistory: unknown[] | null;
  settings: Record<string, unknown> | null;
  activationInfo: Record<string, unknown> | null;
  generatedDocs: unknown[] | null;
  instructions: unknown[] | null;
  templates: unknown[] | null;
}> {
  const t0 = performance.now();
  // 🔧 分项计时：逐项标记，便于精确定位瓶颈
  const timings: string[] = [];
  const mark = (label: string) => {
    const t = ((performance.now() - t0) / 1000).toFixed(2);
    timings.push(label + t + 's');
  };
  // v6：5 路并行直查（generated_docs 独立建表）
  const [textbooks, docHistory, generatedDocs, allSettings, templates] = await Promise.all([
    downloadTextbooks().then(r => { mark('教材'); return r; }),
    pullDocHistory().then(r => { mark('历史'); return r; }),
    pullGeneratedDocs().then(r => { mark('生成结果'); return r; }),
    pullAllSettings().then(r => { mark('全设置'); return r; }),
    downloadTemplates().then(r => { mark('模板'); return r; }),
  ]);
  const { settings, activationInfo, instructions } = allSettings;
  const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
  console.log('⏱️ pullFromCloud 分项耗时: ' + timings.join(' | '));
  const sizeParts: string[] = [];
  if (textbooks?.length) sizeParts.push('教材' + textbooks.length + '条');
  if (docHistory?.length) sizeParts.push('历史' + docHistory.length + '条');
  if (settings && Object.keys(settings).length > 0) sizeParts.push('设置' + Object.keys(settings).length + '条');
  if (activationInfo) sizeParts.push('激活1条');
  if (generatedDocs?.length) sizeParts.push('生成结果' + generatedDocs.length + '条');
  if (instructions?.length) sizeParts.push('指令库' + instructions.length + '条');
  if (templates?.length) sizeParts.push('模板' + templates.length + '条');
  console.log('☁️ pullFromCloud 完成 (' + elapsed + 's): ' + (sizeParts.join(', ') || '无数据'));
  return { textbooks, docHistory, settings, activationInfo, generatedDocs, instructions, templates };
}

/** 推送单向数据到云端 + 即时上推双向数据 */
export async function pushToCloud(data: {
  textbooks?: unknown[];
  docHistory?: unknown[];
  settings?: Record<string, unknown>;
  generatedDocs?: unknown[];
  instructions?: unknown[];
  templates?: unknown[];
}): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  if (data.textbooks) tasks.push(uploadTextbooks(data.textbooks));
  if (data.docHistory) tasks.push(pushDocHistory(data.docHistory));
  if (data.settings) tasks.push(uploadSettings(data.settings));
  if (data.generatedDocs) tasks.push(pushGeneratedDocs(data.generatedDocs));
  if (data.instructions) tasks.push(uploadInstructions(data.instructions));
  if (data.templates) tasks.push(uploadTemplates(data.templates));
  await Promise.all(tasks);
}

/** 检查云端是否已配置 */
export function isCloudConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

// ══════════════════════════════════════════════════════════════
// 🔍 云端探测：启动时后台暖机 + 数据摘要
// ══════════════════════════════════════════════════════════════

/** 获取当前设备的人类可辨识标签（平台+简短ID） */
export function getDeviceLabel(): string {
  const did = getDeviceId();
  const shortId = did.slice(0, 4);
  try {
    if (typeof window !== 'undefined' && (window as any).electronAPI) return '🖥️ 电脑·' + shortId;
    const ua = navigator.userAgent || '';
    if (/电容|Capacitor/i.test(ua)) {
      if (/iPhone|iPad/i.test(ua)) return '📱 iPhone·' + shortId;
      if (/Android/i.test(ua)) return '📱 安卓·' + shortId;
    }
    if (/Mobile|Android|iPhone/i.test(ua)) return '📱 手机·' + shortId;
    return '💻 网页·' + shortId;
  } catch { return '设备·' + shortId; }
}

/** 根据设备 UUID 列表生成稳定标签（按字母序分配 A/B/C…，附带短ID） */
function buildDeviceLabels(allIds: string[], selfId: string): Map<string, string> {
  const others = [...new Set(allIds.filter(id => id && id !== selfId && id !== '?'))].sort();
  const map = new Map<string, string>();
  map.set(selfId, '本机');
  others.forEach((id, i) => map.set(id, '设备-' + String.fromCharCode(65 + i) + '·' + id.slice(0, 4)));
  return map;
}

/** 启动时探测云端状态，暖机后输出数据摘要，用户据此决定何时同步 */
export async function probeCloud(): Promise<void> {
  const client = getClient();
  if (!client || noSyncKey()) return;

  const t0 = performance.now();
  console.log('⏳ 正在连接云端…');

  // ① 暖机 ping：任意轻量查询触发冷启动
  try {
    await client.from('user_settings').select('id').limit(1);
  } catch (e) {
    console.warn('⚠️ 云端连接失败:', (e as Error)?.message || e);
    return;
  }

  const warmupS = ((performance.now() - t0) / 1000).toFixed(1);
  const warmupLabel = Number(warmupS) > 30 ? '冷启动 ' + warmupS + 's' : warmupS + 's';
  console.log('✅ 云端已就绪（耗时 ' + warmupLabel + '）');

  // ② 拉取数据摘要（5 路独立查询，各自容错，一个失败不影响其他）
  const syncKey = getSyncKey() || '';
  const selfId = getDeviceId();

  const safeQuery = async (fn: () => any) => { try { const r = await fn(); return [r, null]; } catch (e) { return [null, e]; } };

  const [textbookRow, tbErr] = await safeQuery(() => client.from('textbooks').select('data').eq('id', syncKey).single());
  const [templateRow, tpErr] = await safeQuery(() => client.from('templates').select('data').eq('id', syncKey).single());
  const [settingsRows, stErr] = await safeQuery(() => client.from('user_settings').select('id, data').like('id', syncKey + ':%'));
  const [histRows, hiErr]    = await safeQuery(() => client.from('doc_history').select('id, data').like('id', syncKey + ':%'));
  const [genRows, geErr]     = await safeQuery(() => client.from('generated_docs').select('id, data').like('id', syncKey + ':%'));

  // ── 共享数据（全设备共用一份：教材/模板/设置/激活/指令）──
  const tbOk = !tbErr && textbookRow?.data?.data;
  const tbCount = tbOk && Array.isArray(textbookRow.data.data) ? textbookRow.data.data.length : 0;
  const tpOk = !tpErr && templateRow?.data?.data;
  const tpCount = tpOk && Array.isArray(templateRow.data.data) ? templateRow.data.data.length : 0;

  let hasSettings = false, hasActivation = false, hasInstructions = false;
  const stFailed = !!stErr;
  if (!stErr && settingsRows?.data) {
    for (const row of settingsRows.data as { id: string; data: unknown }[]) {
      const suffix = row.id?.replace(syncKey + ':', '');
      if (suffix === 'settings') hasSettings = true;
      else if (suffix === 'activation') hasActivation = true;
      else if (suffix === 'instructions') hasInstructions = true;
    }
  }

  // ── 按设备汇总（仅 history / generated 每设备独立一行）──
  const devMap = new Map<string, { hist: number; gen: number }>();
  const ensureDev = (did: string) => {
    if (!devMap.has(did)) devMap.set(did, { hist: 0, gen: 0 });
    return devMap.get(did)!;
  };

  const hiFailed = !!hiErr;
  let histTotal = 0;
  if (!hiErr && histRows?.data) {
    for (const row of histRows.data as { id: string; data: unknown }[]) {
      const did = row.id?.replace(syncKey + ':', '') || '?';
      const count = Array.isArray((row as any)?.data) ? (row as any).data.length : 0;
      ensureDev(did).hist = count;
      histTotal += count;
    }
  }

  const geFailed = !!geErr;
  let genTotal = 0;
  if (!geErr && genRows?.data) {
    for (const row of genRows.data as { id: string; data: unknown }[]) {
      const did = row.id?.replace(syncKey + ':', '') || '?';
      const count = Array.isArray((row as any)?.data) ? (row as any).data.length : 0;
      ensureDev(did).gen = count;
      genTotal += count;
    }
  }

  // 🏷️ 设备标签
  const allDevIds = [...devMap.keys()];
  const deviceLabels = buildDeviceLabels(allDevIds, selfId);

  // ── 输出 ──
  // 共享数据行
  const tbStr = !!tbErr ? '❌' : (tbCount > 0 ? tbCount + '本' : '-');
  const tpStr = !!tpErr ? '❌' : (tpCount > 0 ? tpCount + '个' : '-');
  const stStr = stFailed ? '❌' : (hasSettings ? '✓' : '-');
  const acStr = stFailed ? '❌' : (hasActivation ? '✓' : '-');
  const inStr = stFailed ? '❌' : (hasInstructions ? '✓' : '-');
  console.log('☁️ 共享：教材' + tbStr + '  模板' + tpStr + '  设置' + stStr + '  激活' + acStr + '  指令' + inStr);

  // 各设备数据
  if (devMap.size === 0) {
    console.log('☁️ 各设备：（无数据）');
  } else {
    console.log('☁️ 各设备（' + devMap.size + '台）：');
    const entries = [...devMap.entries()];
    entries.sort(([a], [b]) => {
      if (a === selfId) return -1;
      if (b === selfId) return 1;
      return (deviceLabels.get(a) || '').localeCompare(deviceLabels.get(b) || '');
    });
    for (const [did, d] of entries) {
      const label = deviceLabels.get(did) || did.slice(0, 8);
      const hStr = hiFailed ? '❌' : d.hist + '条';
      const gStr = geFailed ? '❌' : d.gen + '条';
      console.log('  ' + label + ': 历史' + hStr + '  生成' + gStr);
    }
  }

  // 💾 空间预估
  const estKB = Math.ceil(tbCount * 15 + tpCount * 8 + histTotal * 3 + genTotal * 6 + devMap.size * 5);
  const estStr = estKB > 999 ? (estKB / 1024).toFixed(1) + 'MB' : estKB + 'KB';
  console.log('💾 预估占用 ≈ ' + estStr + ' / 500MB（免费额度，足够）');

  console.log('💡 数据已就绪，可以点击 ☁️ 同步了');
}

// ── 保留旧导出名兼容（后续逐步迁移） ──
export { pushDocHistory as mergeDocHistory };
export { pushDocHistory as safeUploadDocHistory };
export { pushGeneratedDocs as mergeGeneratedDocs };
export { pushGeneratedDocs as safeUploadGeneratedDocs };
