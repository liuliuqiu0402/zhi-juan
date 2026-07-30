/**
 * ☁️ Supabase 云存储层
 * 负责桌面端与手机端的数据同步：教材库、生成结果、用户设置
 *
 * 使用前需在 Supabase 项目设置中获取 URL + anon key，
 * 填入下方或通过环境变量 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 注入。
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ── 配置（部署时通过 Vercel 环境变量注入） ──
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let _client: SupabaseClient | null = null;

/** 获取 Supabase 客户端（懒初始化） */
function getClient(): SupabaseClient | null {
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('☁️ Supabase 未配置，跳过云端同步');
    return null;
  }
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _client;
}

// ── 教材库同步 ──

/** 上传教材列表到云端（覆盖写入） */
export async function uploadTextbooks(textbooks: unknown[]): Promise<void> {
  const client = getClient();
  if (!client) return;

  // 序列化（移除无法传输的字段如 Symbol、函数）
  const safe = JSON.parse(JSON.stringify(textbooks));

  try {
    const { error } = await client
      .from('textbooks')
      .upsert({ id: 'default', data: safe, updated_at: new Date().toISOString() });
    if (error) console.warn('☁️ 教材上传失败:', error.message);
  } catch (e) {
    console.warn('☁️ 教材上传异常:', e);
  }
}

/** 从云端下载教材列表 */
export async function downloadTextbooks(): Promise<unknown[] | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('textbooks')
      .select('data')
      .eq('id', 'default')
      .single();
    if (error || !data) return null;
    return data.data as unknown[];
  } catch {
    return null;
  }
}

// ── 模板库同步 ──

/** 上传模板列表到云端（覆盖写入） */
export async function uploadTemplates(templates: unknown[]): Promise<void> {
  const client = getClient();
  if (!client) return;

  const safe = JSON.parse(JSON.stringify(templates));

  try {
    const { error } = await client
      .from('templates')
      .upsert({ id: 'default', data: safe, updated_at: new Date().toISOString() });
    if (error) console.warn('☁️ 模板上传失败:', error.message);
  } catch (e) {
    console.warn('☁️ 模板上传异常:', e);
  }
}

/** 从云端下载模板列表 */
export async function downloadTemplates(): Promise<unknown[] | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('templates')
      .select('data')
      .eq('id', 'default')
      .single();
    if (error || !data) return null;
    return data.data as unknown[];
  } catch {
    return null;
  }
}

// ── 生成结果同步 ──

/** 上传生成结果到云端 */
export async function uploadDocHistory(history: unknown[]): Promise<void> {
  const client = getClient();
  if (!client) return;

  const safe = JSON.parse(JSON.stringify(history));
  try {
    const { error } = await client
      .from('doc_history')
      .upsert({ id: 'default', data: safe, updated_at: new Date().toISOString() });
    if (error) console.warn('☁️ 生成记录上传失败:', error.message);
  } catch (e) {
    console.warn('☁️ 生成记录上传异常:', e);
  }
}

/** 从云端下载生成结果 */
export async function downloadDocHistory(): Promise<unknown[] | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('doc_history')
      .select('data')
      .eq('id', 'default')
      .single();
    if (error || !data) return null;
    return data.data as unknown[];
  } catch {
    return null;
  }
}

// ── 激活信息同步 ──

/** 上传激活信息到云端 */
export async function uploadActivationInfo(info: Record<string, unknown>): Promise<void> {
  const client = getClient();
  if (!client) return;

  const safe = JSON.parse(JSON.stringify(info));
  try {
    const { error } = await client
      .from('user_settings')
      .upsert({ id: 'activation', data: safe, updated_at: new Date().toISOString() });
    if (error) console.warn('☁️ 激活信息上传失败:', error.message);
  } catch (e) {
    console.warn('☁️ 激活信息上传异常:', e);
  }
}

/** 从云端下载激活信息 */
export async function downloadActivationInfo(): Promise<Record<string, unknown> | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('user_settings')
      .select('data')
      .eq('id', 'activation')
      .single();
    if (error || !data) return null;
    return data.data as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ── 用户设置同步 ──

/** 上传设置到云端（共享 key，桌面/手机互通） */
export async function uploadSettings(settings: Record<string, unknown>): Promise<void> {
  const client = getClient();
  if (!client) return;

  const safe = JSON.parse(JSON.stringify(settings));
  try {
    const { error } = await client
      .from('user_settings')
      .upsert({ id: 'settings', data: safe, updated_at: new Date().toISOString() });
    if (error) console.warn('☁️ 设置上传失败:', error.message);
  } catch (e) {
    console.warn('☁️ 设置上传异常:', e);
  }
}

/** 从云端下载设置（共享 key，桌面/手机互通） */
export async function downloadSettings(): Promise<Record<string, unknown> | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('user_settings')
      .select('data')
      .eq('id', 'settings')
      .single();
    if (error || !data) return null;
    return data.data as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ── 指令库同步 ──

/** 上传自定义指令到云端 */
export async function uploadInstructions(instructions: unknown[]): Promise<void> {
  const client = getClient();
  if (!client) return;

  const safe = JSON.parse(JSON.stringify(instructions));
  try {
    const { error } = await client
      .from('user_settings')
      .upsert({ id: 'instructions', data: safe, updated_at: new Date().toISOString() });
    if (error) console.warn('☁️ 指令库上传失败:', error.message);
  } catch (e) {
    console.warn('☁️ 指令库上传异常:', e);
  }
}

/** 从云端下载自定义指令 */
export async function downloadInstructions(): Promise<unknown[] | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('user_settings')
      .select('data')
      .eq('id', 'instructions')
      .single();
    if (error || !data) return null;
    return data.data as unknown[];
  } catch {
    return null;
  }
}

// ── 生成结果面板同步（wisdom_generated_docs） ──

/** 上传生成结果面板到云端 */
export async function uploadGeneratedDocs(docs: unknown[]): Promise<void> {
  const client = getClient();
  if (!client) return;

  const safe = JSON.parse(JSON.stringify(docs));
  try {
    const { error } = await client
      .from('user_settings')
      .upsert({ id: 'generated_docs', data: safe, updated_at: new Date().toISOString() });
    if (error) console.warn('☁️ 生成结果上传失败:', error.message);
  } catch (e) {
    console.warn('☁️ 生成结果上传异常:', e);
  }
}

/** 从云端下载生成结果面板 */
export async function downloadGeneratedDocs(): Promise<unknown[] | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('user_settings')
      .select('data')
      .eq('id', 'generated_docs')
      .single();
    if (error || !data) return null;
    return data.data as unknown[];
  } catch {
    return null;
  }
}

// ── 一键同步 ──

/** 登录后首次拉取：云端 → 本地 */
export async function pullFromCloud(): Promise<{
  textbooks: unknown[] | null;
  docHistory: unknown[] | null;
  settings: Record<string, unknown> | null;
  activationInfo: Record<string, unknown> | null;
  generatedDocs: unknown[] | null;
  instructions: unknown[] | null;
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

/** 操作后推送：本地 → 云端 */
export async function pushToCloud(data: {
  textbooks?: unknown[];
  docHistory?: unknown[];
  settings?: Record<string, unknown>;
  generatedDocs?: unknown[];
  instructions?: unknown[];
  templates?: unknown[];
}): Promise<void> {
  const tasks: Promise<void>[] = [];
  if (data.textbooks) tasks.push(uploadTextbooks(data.textbooks));
  if (data.docHistory) tasks.push(uploadDocHistory(data.docHistory));
  if (data.settings) tasks.push(uploadSettings(data.settings));
  if (data.generatedDocs) tasks.push(uploadGeneratedDocs(data.generatedDocs));
  if (data.instructions) tasks.push(uploadInstructions(data.instructions));
  if (data.templates) tasks.push(uploadTemplates(data.templates));
  await Promise.all(tasks);
}

/** 检查云端是否已配置 */
export function isCloudConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}
