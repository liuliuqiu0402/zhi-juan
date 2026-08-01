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

function getClient(): SupabaseClient | null {
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('☁️ Supabase 未配置，跳过云端同步');
    return null;
  }
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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

/** 推生成结果到云端（直接 upsert，不走 RPC，避免冷启动超时） */
export async function pushGeneratedDocs(items: unknown[]): Promise<boolean> {
  if (noSyncKey()) return false;
  const client = noClient();
  if (!client) return false;

  try {
    // 排序 + 截断（与旧 RPC push_generated_docs 行为一致：≤20 条）
    const sorted = [...items]
      .sort((a: any, b: any) => (b.savedAt || b.timestamp || 0) - (a.savedAt || a.timestamp || 0))
      .slice(0, 20);
    const { error } = await client
      .from('user_settings')
      .upsert({ id: getSyncKey() + ':generated_docs:' + getDeviceId(), data: sorted, updated_at: new Date().toISOString() });
    if (error) {
      console.error('☁️ push_generated_docs 失败:', error.message);
      return false;
    }
    console.log('☁️ push_generated_docs: ' + sorted.length + ' 条（直接 upsert）');
    return true;
  } catch (e) {
    console.warn('☁️ push_generated_docs 异常:', e);
    return false;
  }
}

/** 从云端拉取生成结果（轻量 RPC 只查原始行 → 客户端 JS 合并去重） */
export async function pullGeneratedDocs(): Promise<unknown[] | null> {
  if (noSyncKey()) return null;
  const client = noClient();
  if (!client) return null;

  try {
    const { data: result, error } = await client.rpc('fetch_generated_docs', {
      p_sync_key: getSyncKey(),
    });
    if (error) {
      console.error('☁️ pull_generated_docs 失败:', error.message);
      return null;
    }
    const rows = (result as unknown[]) || [];
    const merged = mergeDeviceData(rows, 20);
    console.log('☁️ pull_generated_docs:', merged.length, '条（客户端合并）');
    return merged;
  } catch (e) {
    console.warn('☁️ pull_generated_docs 异常:', e);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// v5 合并拉取：直接查 user_settings 表一次，按 ID 后缀分流
//   不走 RPC，与教材/模板同款路径，避免冷启动超时
// ══════════════════════════════════════════════════════════════

/** 一次查表拉取所有 user_settings 行，按 ID 后缀分流 */
export async function pullAllSettings(): Promise<{
  settings: Record<string, unknown> | null;
  activationInfo: Record<string, unknown> | null;
  instructions: unknown[] | null;
  generatedDocs: unknown[] | null;
}> {
  if (noSyncKey()) return { settings: null, activationInfo: null, instructions: null, generatedDocs: null };
  const client = getClient();
  if (!client) return { settings: null, activationInfo: null, instructions: null, generatedDocs: null };

  try {
    const { data: rows, error } = await client
      .from('user_settings')
      .select('id, data')
      .like('id', getSyncKey() + ':%');
    if (error) {
      console.error('☁️ pullAllSettings 失败:', error.message);
      return { settings: null, activationInfo: null, instructions: null, generatedDocs: null };
    }

    // 按 ID 后缀分流
    let settings: Record<string, unknown> | null = null;
    let activationInfo: Record<string, unknown> | null = null;
    let instructions: unknown[] | null = null;
    const genDocRows: unknown[] = [];

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
      } else if (suffix.startsWith('generated_docs:')) {
        genDocRows.push(row.data);
      }
    }

    const generatedDocs = mergeDeviceData(genDocRows, 20);
    console.log('☁️ pullAllSettings: 设置=' + (settings ? Object.keys(settings).length + '项' : '无') +
      ' 激活=' + (activationInfo ? '有' : '无') +
      ' 指令=' + (instructions?.length ?? 0) + '条' +
      ' 生成=' + generatedDocs.length + '条（客户端合并）');
    return { settings, activationInfo, instructions, generatedDocs };
  } catch (e) {
    console.warn('☁️ pullAllSettings 异常:', e);
    return { settings: null, activationInfo: null, instructions: null, generatedDocs: null };
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
  // v5：user_settings 4 次查询合并为 1 次 RPC
  const allSettingsP = pullAllSettings().then(r => { mark('全设置'); return r; });
  const [textbooks, docHistory, allSettings, templates] = await Promise.all([
    downloadTextbooks().then(r => { mark('教材'); return r; }),
    pullDocHistory().then(r => { mark('历史'); return r; }),
    allSettingsP,
    downloadTemplates().then(r => { mark('模板'); return r; }),
  ]);
  const { settings, activationInfo, generatedDocs, instructions } = allSettings;
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

// ── 保留旧导出名兼容（后续逐步迁移） ──
export { pushDocHistory as mergeDocHistory };
export { pushDocHistory as safeUploadDocHistory };
export { pushGeneratedDocs as mergeGeneratedDocs };
export { pushGeneratedDocs as safeUploadGeneratedDocs };
