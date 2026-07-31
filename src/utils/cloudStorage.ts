/**
 * ☁️ Supabase 云存储层（v3：按设备独立存储 + 拉取时动态合并）
 *
 * 推：每个设备独立一行 (sync_key + device_id)，互不覆盖。本地数据变化即触发上推。
 * 拉：读取所有设备行 → RPC 内合并去重（同 id 取最新时间戳）→ 过滤 _deleted 标记。
 * 删除：客户端打 _deleted: true 标记保留在列表中，手动同步后消失。
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
// doc_history：push（即时上推） + pull（拉取合并）
// ══════════════════════════════════════════════════════════════

/** 推历史记录到云端（只写自己设备的行，不影响其他设备） */
export async function pushDocHistory(items: unknown[]): Promise<boolean> {
  if (noSyncKey()) return false;
  const client = noClient();
  if (!client) return false;

  try {
    const { error } = await client.rpc('push_doc_history', {
      p_sync_key: getSyncKey(),
      p_device_id: getDeviceId(),
      p_items: safeClone(items),
    });
    if (error) {
      console.error('☁️ push_doc_history 失败:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('☁️ push_doc_history 异常:', e);
    return false;
  }
}

/** 从云端拉取合并后的历史记录（读所有设备行 → RPC 合并去重） */
export async function pullDocHistory(): Promise<unknown[] | null> {
  if (noSyncKey()) return null;
  const client = noClient();
  if (!client) return null;

  try {
    const { data: result, error } = await client.rpc('pull_doc_history', {
      p_sync_key: getSyncKey(),
    });
    if (error) {
      console.error('☁️ pull_doc_history 失败:', error.message);
      return null;
    }
    const r = result as { ok: boolean; count: number; data: unknown[] };
    console.log('☁️ pull_doc_history:', r?.count, '条（已合并）');
    return r?.data || [];
  } catch (e) {
    console.warn('☁️ pull_doc_history 异常:', e);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// generated_docs：push（即时上推） + pull（拉取合并）
// ══════════════════════════════════════════════════════════════

/** 推生成结果到云端（只写自己设备的行） */
export async function pushGeneratedDocs(items: unknown[]): Promise<boolean> {
  if (noSyncKey()) return false;
  const client = noClient();
  if (!client) return false;

  try {
    const { error } = await client.rpc('push_generated_docs', {
      p_sync_key: getSyncKey(),
      p_device_id: getDeviceId(),
      p_items: safeClone(items),
    });
    if (error) {
      console.error('☁️ push_generated_docs 失败:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('☁️ push_generated_docs 异常:', e);
    return false;
  }
}

/** 从云端拉取合并后的生成结果 */
export async function pullGeneratedDocs(): Promise<unknown[] | null> {
  if (noSyncKey()) return null;
  const client = noClient();
  if (!client) return null;

  try {
    const { data: result, error } = await client.rpc('pull_generated_docs', {
      p_sync_key: getSyncKey(),
    });
    if (error) {
      console.error('☁️ pull_generated_docs 失败:', error.message);
      return null;
    }
    const r = result as { ok: boolean; count: number; data: unknown[] };
    console.log('☁️ pull_generated_docs:', r?.count, '条（已合并）');
    return r?.data || [];
  } catch (e) {
    console.warn('☁️ pull_generated_docs 异常:', e);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// 教材库（覆盖写入 — 桌面是唯一源头，单向推送）
// ══════════════════════════════════════════════════════════════

export async function uploadTextbooks(textbooks: unknown[]): Promise<void> {
  if (noSyncKey()) return;
  const client = getClient();
  if (!client) return;

  try {
    const { error } = await client
      .from('textbooks')
      .upsert({ id: getSyncKey(), data: safeClone(textbooks), updated_at: new Date().toISOString() });
    if (error) console.warn('☁️ 教材上传失败:', error.message);
  } catch (e) {
    console.warn('☁️ 教材上传异常:', e);
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

export async function uploadTemplates(templates: unknown[]): Promise<void> {
  if (noSyncKey()) return;
  const client = getClient();
  if (!client) return;

  try {
    const { error } = await client
      .from('templates')
      .upsert({ id: getSyncKey(), data: safeClone(templates), updated_at: new Date().toISOString() });
    if (error) console.warn('☁️ 模板上传失败:', error.message);
  } catch (e) {
    console.warn('☁️ 模板上传异常:', e);
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

/** user_settings 专用：上传 */
async function upsertUserSetting(subKey: string, data: unknown): Promise<void> {
  if (noSyncKey()) return;
  const client = getClient();
  if (!client) return;

  try {
    const { error } = await client
      .from('user_settings')
      .upsert({ id: getSyncKey() + ':' + subKey, data: safeClone(data), updated_at: new Date().toISOString() });
    if (error) console.warn('☁️ user_settings.' + subKey + ' 上传失败:', error.message);
  } catch (e) {
    console.warn('☁️ user_settings.' + subKey + ' 上传异常:', e);
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

export function uploadSettings(settings: Record<string, unknown>): Promise<void> {
  return upsertUserSetting('settings', settings);
}
export function downloadSettings(): Promise<Record<string, unknown> | null> {
  return fetchUserSetting('settings') as Promise<Record<string, unknown> | null>;
}
export function uploadActivationInfo(info: Record<string, unknown>): Promise<void> {
  return upsertUserSetting('activation', info);
}
export function downloadActivationInfo(): Promise<Record<string, unknown> | null> {
  return fetchUserSetting('activation') as Promise<Record<string, unknown> | null>;
}
export function uploadInstructions(instructions: unknown[]): Promise<void> {
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
  const [textbooks, docHistory, settings, activationInfo, generatedDocs, instructions, templates] = await Promise.all([
    downloadTextbooks(),
    pullDocHistory(),
    downloadSettings(),
    downloadActivationInfo(),
    pullGeneratedDocs(),
    downloadInstructions(),
    downloadTemplates(),
  ]);
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
