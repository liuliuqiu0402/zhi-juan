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

// 🔧 自定义 fetch：120s 超时（Supabase 免费版冷启动可达 30-120s）+
//    网络错误自动重试（QUIC 协议错误等瞬时故障最多重试 3 次，指数退避）
const FETCH_TIMEOUT = 120000; // 120s
const fetchWithRetry = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => {
          controller.abort();
          reject(new DOMException('Timeout after ' + (FETCH_TIMEOUT / 1000) + 's', 'TimeoutError'));
        }, FETCH_TIMEOUT)
      );
      const resp = await Promise.race([
        fetch(input, { ...init, signal: controller.signal }),
        timeoutPromise,
      ]);
      return resp;
    } catch (e: any) {
      // 判断是否值得重试的网络错误（含 AbortError——Controller.abort() 触发的超时终止）
      const isNetErr = e?.name === 'TypeError' ||
                       e?.name === 'TimeoutError' ||
                       e?.name === 'AbortError' ||
                       /fetch failed|QUIC|network|ETIMEDOUT|ECONNRESET|abort/i.test(e?.message || '');
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

  // 防 Vite 代码分割/动态 import 导致模块多次加载产生多个 GoTrueClient 实例
  const w = typeof window !== 'undefined' ? (window as any) : null;
  if (w?.__wisdom_supabase) {
    _client = w.__wisdom_supabase;
    return _client;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('☁️ Supabase 未配置，跳过云端同步');
    return null;
  }
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { fetch: fetchWithRetry as typeof fetch },
    auth: {
      persistSession: false,       // 不用 auth，避免 GoTrueClient 注册 localStorage 监听
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  if (w) w.__wisdom_supabase = _client;
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

// ── device_name 管理（设备名即设备ID，不再用随机UUID）──

const DEVICE_NAME_KEY = 'wisdom_device_name';

/** 自动检测设备名（兜底用，用户可在设置页改名） */
function detectDeviceName(): string {
  try {
    if (typeof window !== 'undefined' && (window as any).electronAPI) return '🖥️ 电脑';
    const ua = navigator.userAgent || '';
    if (/电容|Capacitor/i.test(ua)) {
      if (/iPhone|iPad/i.test(ua)) return '📱 iPhone';
      if (/Android/i.test(ua)) return '📱 安卓手机';
    }
    if (/Mobile|Android|iPhone/i.test(ua)) return '📱 手机浏览器';
    return '💻 电脑浏览器';
  } catch { return '设备'; }
}

/** 获取当前设备名称（即设备标识，重装后输同名可恢复） */
export function getDeviceName(): string {
  try {
    const stored = localStorage.getItem(DEVICE_NAME_KEY);
    if (stored) return stored;
  } catch {}
  const name = detectDeviceName();
  try { localStorage.setItem(DEVICE_NAME_KEY, name); } catch {}
  return name;
}

/** 用户自定义设备名称（修改后下次上推生效，同名设备按时间合并） */
export function setDeviceName(name: string): void {
  try {
    const old = localStorage.getItem(DEVICE_NAME_KEY);
    localStorage.setItem(DEVICE_NAME_KEY, name);
    if (old && old !== name) {
      console.log('🏷️ 设备名已更改: ' + old + ' → ' + name + '（下次上推时新名称生效）');
    }
  } catch {}
}

// ── device_id 管理（设备名即ID，不再用随机UUID）──

/** 获取当前设备唯一标识（= 设备名称，重装后同名可自动恢复数据） */
export function getDeviceId(): string {
  return getDeviceName();
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
// 暖机：触发 Supabase 冷启动，避免后续数据查询超时
// ══════════════════════════════════════════════════════════════

/**
 * 暖机 ping：打轻量查询唤醒 Supabase 免费实例的所有表。
 * 冷启动时第1次尝试可能超时（fetchWithRetry 会自动重试，重试时 DB 已热 ≈ 秒级），
 * 之后所有数据查询都无需再经历冷启动延迟。
 *
 * 🔧 v2：user_settings + generated_docs 两张表都要暖，
 *    否则 generated_docs 首次查询可能 120s 超时导致拉取失败。
 *
 * 注意：此函数可能耗时 30-120s（取决于 Supabase 休眠深度），同步 handler 会在 Toast 中提示用户等待。
 */
export async function warmupCloud(): Promise<boolean> {
  if (!getSyncKey()) return false;
  const client = getClient();
  if (!client) return false;
  try {
    const t0 = performance.now();
    // 🔧 v3：使用真实 LIKE 查询模式预热，而非简单的 limit(1)
    //    limit(1) 只唤醒实例，不预热 LIKE 执行计划 → 实际数据查询仍可能 120s 超时
    //    用实际查询模式（LIKE + limit 1）同时唤醒实例 + 预热执行计划缓存
    const syncKey = getSyncKey() || '';
    await Promise.all([
      client.from('user_settings').select('id').like('id', syncKey + ':%').limit(1),
      client.from('generated_docs').select('id').like('id', syncKey + ':%').limit(1),
    ]);
    const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
    console.log('🔥 暖机完成 (' + elapsed + 's)');
    return true;
  } catch (e) {
    console.warn('⚠️ 暖机超时:', (e as Error)?.message || e);
    return false;
  }
}

// ══════════════════════════════════════════════════════════════
// 通用：客户端合并（V8 引擎处理 JSON 远快于 Supabase 免费实例）
// ══════════════════════════════════════════════════════════════

/**
 * 合并多设备行：展开 → 去重（同 id 保留最新时间戳）→ 排序 → 截断
 * 注：_deleted 墓碑由独立的 deleted_docs 通道处理，此处仅做纯数据合并
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

  // 去重：同 id 保留最新时间戳版本
  const map = new Map<string, Record<string, unknown>>();
  for (const item of allItems) {
    const id = item.id as string;
    if (!id) continue;
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
    // 过滤 _deleted 条目，防止墓碑数据被推到云端污染其他设备
    const clean = (items as any[]).filter((d: any) => !d._deleted);
    // 排序 + 截断（与旧 RPC push_doc_history 行为一致：≤50 条）
    const sorted = [...clean]
      .sort((a: any, b: any) => (b.savedAt || b.timestamp || 0) - (a.savedAt || a.timestamp || 0))
      .slice(0, 50);
    const { error } = await client
      .from('doc_history')
      .upsert({ id: getSyncKey() + ':' + getDeviceId(), data: sorted, updated_at: new Date().toISOString() });
    if (error) {
      console.error('☁️ push_doc_history 失败:', error.message);
      return false;
    }
    const filtered = items.length - clean.length;
    if (filtered > 0) console.log('☁️ push_doc_history: 过滤 ' + filtered + ' 条已删除，推送 ' + sorted.length + ' 条');
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
    // 过滤 _deleted 条目
    const clean = (items as any[]).filter((d: any) => !d._deleted);
    // 排序 + 截断（≤20 条）
    const sorted = [...clean]
      .sort((a: any, b: any) => (b.savedAt || b.timestamp || 0) - (a.savedAt || a.timestamp || 0))
      .slice(0, 20);
    const { error } = await client
      .from('generated_docs')
      .upsert({ id: getSyncKey() + ':' + getDeviceId(), data: sorted, updated_at: new Date().toISOString() });
    if (error) {
      console.error('☁️ push_generated_docs 失败:', error.message);
      return false;
    }
    const filtered = items.length - clean.length;
    if (filtered > 0) console.log('☁️ push_generated_docs: 过滤 ' + filtered + ' 条已删除，推送 ' + sorted.length + ' 条');
    return true;
  } catch (e) {
    console.warn('☁️ push_generated_docs 异常:', e);
    return false;
  }
}

/** 从云端拉取生成结果（generated_docs 表，客户端 JS 合并去重） */
export async function pullGeneratedDocs(): Promise<unknown[] | null> {
  if (noSyncKey()) return null;
  const client = getClient();
  if (!client) return null;

  try {
    const { data: rows, error } = await client
      .from('generated_docs')
      .select('data')
      .like('id', getSyncKey() + ':%');
    if (error) {
      console.error('☁️ pull_generated_docs 失败:', error.message);
      return null;
    }
    const merged = mergeDeviceData((rows as unknown[]) || [], 20);
    console.log('☁️ pull_generated_docs:', merged.length, '条（客户端合并）');
    return merged;
  } catch (e) {
    console.warn('☁️ pull_generated_docs 异常:', e);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// 墓碑通道：已删除文档 ID 独立存储（不参与 Top-N 截断，7 天自动过期）
// ══════════════════════════════════════════════════════════════

const TOMBSTONE_TTL = 7 * 24 * 60 * 60 * 1000;

export async function pullDeletedDocIds(table: string): Promise<Record<string, number>> {
  if (noSyncKey()) return {};
  const client = getClient();
  if (!client) return {};

  try {
    const { data, error } = await client
      .from(table)
      .select('data')
      .eq('id', getSyncKey() + ':deleted')
      .maybeSingle();
    if (error) {
      if (!error.message?.includes('contains 0 rows')) {
        console.warn('☁️ pull_deleted_docs 查询失败:', error.message);
      }
      return {};
    }
    const raw: Record<string, number> = data?.data?.ids || {};
    const cutoff = Date.now() - TOMBSTONE_TTL;
    const filtered: Record<string, number> = {};
    let pruned = 0;
    for (const [id, ts] of Object.entries(raw)) {
      if (ts >= cutoff) { filtered[id] = ts; } else { pruned++; }
    }
    if (pruned > 0) {
      console.log('☁️ pull_deleted_docs(' + table + '): 清理 ' + pruned + ' 条过期墓碑');
    }
    return filtered;
  } catch (e) {
    console.warn('☁️ pull_deleted_docs 异常:', e);
    return {};
  }
}

export async function pushDeletedDocIds(table: string, localDeletedIds: Record<string, number>): Promise<boolean> {
  if (noSyncKey()) return false;
  const client = noClient();
  if (!client) return false;

  try {
    const cloudDeleted = await pullDeletedDocIds(table);
    const merged: Record<string, number> = { ...cloudDeleted };
    for (const [id, ts] of Object.entries(localDeletedIds)) {
      if (!merged[id] || ts > merged[id]) merged[id] = ts;
    }
    const cutoff = Date.now() - TOMBSTONE_TTL;
    for (const id of Object.keys(merged)) {
      if (merged[id] < cutoff) delete merged[id];
    }

    const { error } = await client
      .from(table)
      .upsert({
        id: getSyncKey() + ':deleted',
        data: { ids: merged },
        updated_at: new Date().toISOString(),
      });
    if (error) {
      console.error('☁️ push_deleted_docs(' + table + ') 失败:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('☁️ push_deleted_docs 异常:', e);
    return false;
  }
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
export function uploadActivationInfo(info: Record<string, unknown>): Promise<boolean> {
  return upsertUserSetting('activation', info);
}
export function uploadInstructions(instructions: unknown[]): Promise<boolean> {
  return upsertUserSetting('instructions', instructions);
}

/** 下载所有设备名，返回 device_id → 名称 的映射
 *  新版：device_id 即设备名，直接从行键提取
 *  旧版兼容：读取 dname:* 行获取旧UUID对应的设备名 */
export async function downloadDeviceNames(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (noSyncKey()) return map;
  const client = getClient();
  if (!client) return map;
  try {
    // 读取旧版 dname:* 行（兼容升级前数据）
    const { data: rows } = await client
      .from('user_settings')
      .select('id, data')
      .like('id', getSyncKey() + ':dname:%');
    if (rows) {
      for (const row of rows as { id: string; data: any }[]) {
        const did = row.id?.replace(getSyncKey() + ':dname:', '');
        if (did && row.data?.name) map.set(did, row.data.name);
      }
    }
  } catch { /* ignore */ }
  return map;
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

  // 🔧 暖机：两张表并行唤醒，使用真实 LIKE 查询模式预热执行计划
  const client = getClient();
  if (client && !noSyncKey()) {
    try {
      const syncKey = getSyncKey() || '';
      await Promise.all([
        client.from('user_settings').select('id').like('id', syncKey + ':%').limit(1),
        client.from('generated_docs').select('id').like('id', syncKey + ':%').limit(1),
      ]);
      mark('暖机');
    } catch { /* 暖机失败不阻塞，后续拉取各自容错 */ }
  }

  // v6：5 路并行直查（generated_docs 独立建表）
  let [textbooks, docHistory, generatedDocs, allSettings, templates] = await Promise.all([
    downloadTextbooks().then(r => { mark('教材'); return r; }),
    pullDocHistory().then(r => { mark('历史'); return r; }),
    pullGeneratedDocs().then(r => { mark('生成结果'); return r; }),
    pullAllSettings().then(r => { mark('全设置'); return r; }),
    downloadTemplates().then(r => { mark('模板'); return r; }),
  ]);

  // 🔧 冷启动重试：generated_docs 查询可能因执行计划未预热而超时
  //    暖机后其他查询已跑通，此时重试单表大概率秒级成功
  if (generatedDocs === null) {
    console.log('🔄 generated_docs 首次拉取超时，暖机后重试…');
    try {
      generatedDocs = await pullGeneratedDocs();
      mark('生成结果(重试)');
    } catch { /* 重试仍失败则放弃 */ }
  }
  if (docHistory === null) {
    console.log('🔄 doc_history 首次拉取超时，暖机后重试…');
    try {
      docHistory = await pullDocHistory();
      mark('历史(重试)');
    } catch { /* 重试仍失败则放弃 */ }
  }
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

/** 检查云端是否已配置 */
export function isCloudConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

// ══════════════════════════════════════════════════════════════
// 🧹 清理残留设备行（重装产生的旧 device_id 行，数据已合并至当前设备）
// ══════════════════════════════════════════════════════════════

/** 同名设备按时间保留最新、删除较早的（重装残留 / 旧版UUID迁移） */
export async function cleanupStaleDeviceRows(): Promise<number> {
  if (noSyncKey()) return 0;
  const client = getClient();
  if (!client) return 0;

  const syncKey = getSyncKey();
  const selfId = getDeviceId();
  let deleted = 0;

  // ① 拉取云端设备名映射（兼容旧版UUID→名称）
  const deviceNameMap = await downloadDeviceNames();
  // 新版：设备名即ID，无需额外映射
  deviceNameMap.set(selfId, getDeviceName());

  // ② 查询某表的所有设备行
  const getDeviceInfo = async (table: string): Promise<Map<string, { count: number; updatedAt: number }>> => {
    const map = new Map<string, { count: number; updatedAt: number }>();
    try {
      const { data: rows } = await client!
        .from(table)
        .select('id, data, updated_at')
        .like('id', syncKey + ':%');
      if (rows) {
        for (const row of rows as { id: string; data: unknown; updated_at: string }[]) {
          const did = row.id?.replace(syncKey + ':', '');
          if (!did) continue;
          const existing = map.get(did) || { count: 0, updatedAt: 0 };
          map.set(did, {
            count: existing.count + (Array.isArray(row.data) ? row.data.length : 0),
            updatedAt: Math.max(existing.updatedAt, new Date(row.updated_at).getTime() || 0),
          });
        }
      }
    } catch { /* ignore */ }
    return map;
  };

  const [histInfo, genInfo] = await Promise.all([
    getDeviceInfo('doc_history'),
    getDeviceInfo('generated_docs'),
  ]);

  // ③ 收集所有出现过 device_id 的行
  const allIds = new Set<string>();
  for (const id of histInfo.keys()) allIds.add(id);
  for (const id of genInfo.keys()) allIds.add(id);

  // ④ 按设备名分组（新版：ID即名称；旧版UUID：从云端映射获取名称）
  //    UUID格式的无名设备统一归并到 __legacy__ 组，全部清理（用户不再使用自动UUID设备）
  //    🔧 名称归一化：trim + 合并连续空格，避免 "iPhone 1" vs "iPhone 1 " 被当作两台设备
  const normalize = (s: string) => (s || '').trim().replace(/\s+/g, ' ');
  const normalizedSelf = normalize(selfId);
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const nameGroups = new Map<string, string[]>();
  for (const id of allIds) {
    let name = deviceNameMap.get(id);
    if (!name) {
      // 旧版 UUID 且无名称映射 → 统一归并到 __legacy__（全部废弃，不留）
      name = uuidRe.test(id) ? '__legacy__' : id;
    }
    // 归一化后分组（__legacy__ 不归一化以免被改掉）
    const groupKey = name === '__legacy__' ? name : normalize(name);
    if (!nameGroups.has(groupKey)) nameGroups.set(groupKey, []);
    nameGroups.get(groupKey)!.push(id);
  }

  // ⑤ 同名多设备 → 按 updated_at 降序，保留最新的，删除较早的
  //    ⚠️ __legacy__ 例外：全部删除（用户不使用自动UUID设备，除非 selfId 恰好在其中）
  for (const [name, ids] of nameGroups) {
    if (ids.length <= 1 && name !== '__legacy__') continue;

    ids.sort((a, b) => {
      if (normalize(a) === normalizedSelf) return -1;
      if (normalize(b) === normalizedSelf) return 1;
      const aTime = Math.max(histInfo.get(a)?.updatedAt || 0, genInfo.get(a)?.updatedAt || 0);
      const bTime = Math.max(histInfo.get(b)?.updatedAt || 0, genInfo.get(b)?.updatedAt || 0);
      return bTime - aTime;
    });

    const toDelete: string[] = [];
    if (name === '__legacy__') {
      // 旧版UUID设备：全清（除非 selfId）
      for (const id of ids) {
        if (id !== selfId) toDelete.push(id);
      }
    } else {
      // 正常设备：只保留最新一台
      for (const id of ids.slice(1)) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      for (const table of ['doc_history', 'generated_docs']) {
        try {
          await client!.from(table).delete().eq('id', syncKey + ':' + id);
        } catch { /* ignore */ }
      }
      deleted++;
    }

    if (toDelete.length > 0) {
      const keepLabel = name === '__legacy__' ? '（全部废弃）' : (normalize(ids[0]) === normalizedSelf ? '本机' : (deviceNameMap.get(ids[0]) || ids[0]));
      console.log('🧹 清理「' + name + '」的 ' + toDelete.length + ' 台残留设备，保留 ' + keepLabel);
    }
  }

  // ⑤½ 清理空数据设备（历史0 + 生成0），非本机且无有效数据的设备行直接删除
  let emptyCount = 0;
  for (const [id, histEntry] of histInfo) {
    if (id === selfId) continue;
    const genEntry = genInfo.get(id);
    if (histEntry.count === 0 && (!genEntry || genEntry.count === 0)) {
      for (const table of ['doc_history', 'generated_docs']) {
        try { await client!.from(table).delete().eq('id', syncKey + ':' + id); } catch { /* ignore */ }
      }
      emptyCount++;
    }
  }
  deleted += emptyCount;
  if (emptyCount > 0) console.log('🧹 清理 ' + emptyCount + ' 台空数据设备');

  if (deleted > 0) console.log('🧹 已清理 ' + deleted + ' 台残留设备');

  // ⑥ 清理废弃的 user_settings 行：dname:*（名称映射已废弃） + generated_docs:*（v5格式已迁移）
  try {
    const [dnameRows, oldGenRows] = await Promise.all([
      client.from('user_settings').select('id').like('id', syncKey + ':dname:%'),
      client.from('user_settings').select('id').like('id', syncKey + ':generated_docs:%'),
    ]);
    const staleIds: string[] = [];
    if (dnameRows?.data) staleIds.push(...(dnameRows.data as { id: string }[]).map(r => r.id));
    if (oldGenRows?.data) staleIds.push(...(oldGenRows.data as { id: string }[]).map(r => r.id));
    if (staleIds.length > 0) {
      for (const id of staleIds) {
        try { await client.from('user_settings').delete().eq('id', id); } catch {}
      }
      console.log('🧹 清理 ' + staleIds.length + ' 条废弃映射（dname:* / generated_docs:*）');
    }
  } catch { /* ignore */ }

  return deleted;
}

// ══════════════════════════════════════════════════════════════
// 🔍 云端探测：启动时后台暖机 + 数据摘要
// ══════════════════════════════════════════════════════════════

/** 根据设备ID列表生成标签（新版：ID即名称，直接使用；旧版UUID：从云端设备名映射获取） */
function buildDeviceLabels(allIds: string[], selfId: string, cloudNames: Map<string, string>): Map<string, string> {
  const map = new Map<string, string>();
  map.set(selfId, '本机');
  const others = [...new Set(allIds.filter(id => id && id !== selfId && id !== '?'))].sort();
  others.forEach((id) => {
    // 优先用云端存储的名称（兼容旧UUID），其次直接用ID本身（新版设备名即ID）
    const cloudName = cloudNames.get(id);
    map.set(id, cloudName || id);
  });
  return map;
}

let _probePending = false;

/** 云端设备信息（probeCloud 填充，fetchCloudDevices 消费） */
export interface CloudDeviceInfo {
  deviceId: string;
  label: string;
  histCount: number;
  genCount: number;
  isSelf: boolean;
}
let _lastCloudDevices: CloudDeviceInfo[] = [];

/** 启动时探测云端状态，暖机后输出数据摘要，用户据此决定何时同步 */
export async function probeCloud(showReadyHint = true): Promise<void> {
  // 🔒 并发守卫：避免启动时多处触发导致重复探测
  if (_probePending) return;
  _probePending = true;
  try {
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

  // ② 拉取数据摘要（7 路并行：5路数据 + 2路墓碑）
  const syncKey = getSyncKey() || '';
  const selfId = getDeviceId();

  const safeQuery = async (fn: () => any) => { try { const r = await fn(); return [r, null]; } catch (e) { return [null, e]; } };

  const [
    [textbookRow, tbErr],
    [templateRow, tpErr],
    [settingsRows, stErr],
    [histRows, hiErr],
    [genRows, geErr],
    [deletedHistRow],   // 墓碑：doc_history
    [deletedGenRow],    // 墓碑：generated_docs
  ] = await Promise.all([
    safeQuery(() => client.from('textbooks').select('data').eq('id', syncKey).single()),
    safeQuery(() => client.from('templates').select('data').eq('id', syncKey).single()),
    safeQuery(() => client.from('user_settings').select('id, data').like('id', syncKey + ':%')),
    safeQuery(() => client.from('doc_history').select('id, data').like('id', syncKey + ':%')),
    safeQuery(() => client.from('generated_docs').select('id, data').like('id', syncKey + ':%')),
    safeQuery(() => client.from('doc_history').select('data').eq('id', syncKey + ':deleted').maybeSingle()),
    safeQuery(() => client.from('generated_docs').select('data').eq('id', syncKey + ':deleted').maybeSingle()),
  ]);

  // ── 解析墓碑 ID 集合 ──
  const tombstoneIds = { hist: new Set<string>(), gen: new Set<string>() };
  const TOMBSTONE_TTL_LOCAL = 7 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - TOMBSTONE_TTL_LOCAL;
  const parseTombstones = (row: any): Set<string> => {
    const s = new Set<string>();
    if (!row?.data?.data?.ids) return s;
    for (const [id, ts] of Object.entries(row.data.data.ids as Record<string, number>)) {
      if (ts >= cutoff) s.add(id);
    }
    return s;
  };
  tombstoneIds.hist = parseTombstones(deletedHistRow?.[0]);
  tombstoneIds.gen = parseTombstones(deletedGenRow?.[0]);

  // ── 共享数据（全设备共用一份：教材/模板/设置/激活/指令）──
  const tbOk = !tbErr && textbookRow?.data?.data;
  const tbCount = tbOk && Array.isArray(textbookRow.data.data) ? textbookRow.data.data.length : 0;
  const tpOk = !tpErr && templateRow?.data?.data;
  const tpCount = tpOk && Array.isArray(templateRow.data.data) ? templateRow.data.data.length : 0;

  let hasSettings = false, hasActivation = false, hasInstructions = false;
  let hasDeepseekConfig = false;
  const stFailed = !!stErr;
  if (!stErr && settingsRows?.data) {
    for (const row of settingsRows.data as { id: string; data: unknown }[]) {
      const suffix = row.id?.replace(syncKey + ':', '');
      if (suffix === 'settings') {
        hasSettings = true;
        const sData = (row.data as Record<string, unknown>) || {};
        hasDeepseekConfig = Object.keys(sData).some(k => k.startsWith('deepseek'));
      }
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
      // 🧹 过滤：跳过 deleted 墓碑行和空 ID
      if (did === 'deleted' || did === '?') continue;
      const arr = Array.isArray((row as any)?.data) ? (row as any).data as any[] : [];
      // 🔧 扣除墓碑：已删除条目不计入统计
      const count = arr.filter((d: any) => d?.id && !tombstoneIds.hist.has(d.id) && !d._deleted).length;
      ensureDev(did).hist = count;
      histTotal += count;
    }
  }

  const geFailed = !!geErr;
  let genTotal = 0;
  if (!geErr && genRows?.data) {
    for (const row of genRows.data as { id: string; data: unknown }[]) {
      const did = row.id?.replace(syncKey + ':', '') || '?';
      // 🧹 过滤：跳过 deleted 墓碑行和空 ID
      if (did === 'deleted' || did === '?') continue;
      const arr = Array.isArray((row as any)?.data) ? (row as any).data as any[] : [];
      // 🔧 扣除墓碑
      const count = arr.filter((d: any) => d?.id && !tombstoneIds.gen.has(d.id) && !d._deleted).length;
      ensureDev(did).gen = count;
      genTotal += count;
    }
  }

  // 🏷️ 设备标签（新版：设备名即ID；旧版UUID：从云端设备名映射获取）
  const allDevIds = [...devMap.keys()];
  const deviceNameMap = await downloadDeviceNames();
  const deviceLabels = buildDeviceLabels(allDevIds, selfId, deviceNameMap);

  // ── 输出 ──
  // 共享数据行
  const tbStr = !!tbErr ? '❌' : (tbCount > 0 ? tbCount + '本' : '-');
  const tpStr = !!tpErr ? '❌' : (tpCount > 0 ? tpCount + '个' : '-');
  const stLabel = hasSettings ? (hasDeepseekConfig ? '✓(DeepSeek)' : '✓') : '-';
  const stStr = stFailed ? '❌' : stLabel;
  const acStr = stFailed ? '❌' : (hasActivation ? '✓' : '-');
  const inStr = stFailed ? '❌' : (hasInstructions ? '✓' : '-');
  console.log('☁️ 共享：教材' + tbStr + '  模板' + tpStr + '  设置' + stStr + '  激活' + acStr + '  指令' + inStr);

  // 各设备数据
  // 🧹 过滤：只显示"本机"+有自定义名称的设备，裸 UUID 设备不展示
  //    自动生成的设备名（📱开头等）也不展示，除非是本机
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // 🔧 自动生成的设备名模式：detectDeviceName() 会产出这些兜底名
  const autoNamePatterns = ['📱 手机浏览器', '📱 安卓手机', '📱 iPhone', '💻 电脑浏览器', '🖥️ 电脑'];
  const namedEntries = [...devMap.entries()].filter(([did]) => {
    if (did === selfId) return true; // 本机始终显示
    // 🧹 跳过 deleted 墓碑（双重保险，数据聚合阶段已过滤）
    if (did === 'deleted') return false;
    const label = deviceLabels.get(did) || '';
    // 过滤：空标签 / 标签本身是裸UUID / 标签是UUID截断的兜底（无名设备）
    if (!label || uuidRe.test(label)) return false;
    if (uuidRe.test(did) && label === did.slice(0, 8)) return false; // 仅UUID设备才用截断判断
    // 🧹 过滤自动生成的兜底名（📱 手机浏览器 / 💻 电脑浏览器 等测试废数据）
    if (autoNamePatterns.includes(label)) return false;
    return true;
  });

  if (namedEntries.length === 0) {
    console.log('☁️ 各设备：（无数据）');
  } else {
    console.log('☁️ 各设备（' + namedEntries.length + '台）：');
    namedEntries.sort(([a], [b]) => {
      if (a === selfId) return -1;
      if (b === selfId) return 1;
      return (deviceLabels.get(a) || '').localeCompare(deviceLabels.get(b) || '');
    });
    for (const [did, d] of namedEntries) {
      const label = deviceLabels.get(did) || did.slice(0, 8);
      const hStr = hiFailed ? '❌' : d.hist + '条';
      const gStr = geFailed ? '❌' : d.gen + '条';
      console.log('  ' + label + ': 历史' + hStr + '  生成' + gStr);
    }
  }

  // 🔄 存入共享变量，供 fetchCloudDevices() 消费
  _lastCloudDevices = namedEntries.map(([did, d]) => ({
    deviceId: did,
    label: deviceLabels.get(did) || did.slice(0, 8),
    histCount: d.hist,
    genCount: d.gen,
    isSelf: did === selfId,
  }));
  _lastCloudDevices.sort((a, b) => {
    if (a.isSelf) return -1;
    if (b.isSelf) return 1;
    return a.label.localeCompare(b.label);
  });

  // 💾 空间预估
  const estKB = Math.ceil(tbCount * 15 + tpCount * 8 + histTotal * 3 + genTotal * 6 + devMap.size * 5);
  const estStr = estKB > 999 ? (estKB / 1024).toFixed(1) + 'MB' : estKB + 'KB';
  console.log('💾 预估占用 ≈ ' + estStr + ' / 500MB（免费额度，足够）');

  if (showReadyHint) {
    console.log('💡 数据已就绪，可以点击 ☁️ 同步了');
  }
  } finally {
    _probePending = false;
  }
}

/**
 * 获取云端设备列表（复用 probeCloud 已拉取的数据，无额外网络请求）
 * 如需最新数据，先保证 probeCloud() 已执行完成
 */
export async function fetchCloudDevices(): Promise<CloudDeviceInfo[]> {
  // 如果还没有探测过，先执行一次
  if (_lastCloudDevices.length === 0) {
    await probeCloud(false);
  }
  return [..._lastCloudDevices];
}

/**
 * 手动移除指定设备的所有云端数据
 * 删除 doc_history + generated_docs 表中该设备的行
 */
export async function deleteDeviceFromCloud(deviceId: string): Promise<boolean> {
  const client = getClient();
  if (!client || noSyncKey()) return false;
  const syncKey = getSyncKey() || '';

  console.log('🗑️ 正在移除云端设备: ' + deviceId);
  let deleted = 0;
  for (const table of ['doc_history', 'generated_docs']) {
    try {
      const { error } = await client.from(table).delete().eq('id', syncKey + ':' + deviceId);
      if (error) {
        console.warn('⚠️ 删除 ' + table + ' 失败:', error.message);
      } else {
        deleted++;
      }
    } catch (e) {
      console.warn('⚠️ 删除 ' + table + ' 异常:', e);
    }
  }

  if (deleted > 0) {
    console.log('✅ 已移除云端设备数据: ' + deviceId);
    _lastCloudDevices = []; // 清空缓存，下次加载时重新探测
    return true;
  }
  return false;
}
