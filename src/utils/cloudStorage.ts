/**
 * ☁️ Supabase 云存储层（v2：云端 RPC 合并 + sync_key 隔离）
 *
 * 合并逻辑已迁移到 PostgreSQL RPC 函数，客户端只需调用 rpc 即可。
 * 所有数据按 sync_key 隔离，同一密钥的多设备共享数据。
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

// ══════════════════════════════════════════════════════════════
// doc_history（RPC 合并 + select 拉取）
// ══════════════════════════════════════════════════════════════

/** 上传历史记录到云端（RPC 服务端合并，防挤兑）。返回云端合并后的完整数据 */
export async function mergeDocHistory(items: unknown[]): Promise<unknown[] | null> {
  if (noSyncKey()) return null;
  const client = getClient();
  if (!client) return null;

  try {
    const { data: result, error } = await client.rpc('merge_doc_history', {
      p_sync_key: getSyncKey(),
      p_items: safeClone(items),
    });
    if (error) {
      console.error('☁️ merge_doc_history RPC 失败:', error.message);
      return null;
    }
    const r = result as { ok: boolean; count: number; data: unknown[] };
    console.log('☁️ merge_doc_history 成功:', r?.count, '条');
    return r?.data || null;
  } catch (e) {
    console.warn('☁️ merge_doc_history 异常:', e);
    return null;
  }
}

/** 从云端下载历史记录 */
export async function downloadDocHistory(): Promise<unknown[] | null> {
  if (noSyncKey()) return null;
  const client = getClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('doc_history')
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
// generated_docs（RPC 合并 + select 拉取）
// ══════════════════════════════════════════════════════════════

/** 上传生成结果到云端（RPC 服务端合并，防挤兑）。返回云端合并后的完整数据 */
export async function mergeGeneratedDocs(items: unknown[]): Promise<unknown[] | null> {
  if (noSyncKey()) return null;
  const client = getClient();
  if (!client) return null;

  try {
    const { data: result, error } = await client.rpc('merge_generated_docs', {
      p_sync_key: getSyncKey(),
      p_items: safeClone(items),
    });
    if (error) {
      console.error('☁️ merge_generated_docs RPC 失败:', error.message);
      return null;
    }
    const r = result as { ok: boolean; count: number; data: unknown[] };
    console.log('☁️ merge_generated_docs 成功:', r?.count, '条');
    return r?.data || null;
  } catch (e) {
    console.warn('☁️ merge_generated_docs 异常:', e);
    return null;
  }
}

/** 从云端下载生成结果面板 */
export async function downloadGeneratedDocs(): Promise<unknown[] | null> {
  if (noSyncKey()) return null;
  const client = getClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('user_settings')
      .select('data')
      .eq('id', getSyncKey() + ':generated_docs')
      .single();
    if (error || !data) return null;
    return data.data as unknown[];
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// 教材库（覆盖写入）
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
// 模板库（覆盖写入）
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

/** 从云端拉取所有数据 */
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
    downloadDocHistory(),
    downloadSettings(),
    downloadActivationInfo(),
    downloadGeneratedDocs(),
    downloadInstructions(),
    downloadTemplates(),
  ]);
  return { textbooks, docHistory, settings, activationInfo, generatedDocs, instructions, templates };
}

/** 推送单向数据到云端 */
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
  if (data.docHistory) tasks.push(mergeDocHistory(data.docHistory));
  if (data.settings) tasks.push(uploadSettings(data.settings));
  if (data.generatedDocs) tasks.push(mergeGeneratedDocs(data.generatedDocs));
  if (data.instructions) tasks.push(uploadInstructions(data.instructions));
  if (data.templates) tasks.push(uploadTemplates(data.templates));
  await Promise.all(tasks);
}

/** 检查云端是否已配置 */
export function isCloudConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

// ── 保留旧导出名兼容（后续逐步迁移） ──
export { mergeDocHistory as safeUploadDocHistory };
export { mergeGeneratedDocs as safeUploadGeneratedDocs };
// uploadGeneratedDocs / uploadDocHistory 保留但不再导出（内部已改为 merge）
// 如需覆盖写入（不合并），直接调用 upsertUserSetting
