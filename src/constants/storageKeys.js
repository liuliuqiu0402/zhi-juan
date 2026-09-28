// src/constants/storageKeys.js
// localStorage 业务 key 注册表：跨模块共享 key 的**唯一命名来源**
// 🔴 用途：跨模块共享的存储 key 读写方分处多文件，拼写漂移 = 数据静默读写错位（读到旧值/写丢新值）。
//    已登记项的新增/改名只改此处，调用方一律引用 STORAGE_KEYS.*，不得再写字面量。
// ⚠️ 范围说明（2026-09-28 校对，避免"唯一事实源"过度声称）：
//    本表是**已登记 key 的唯一来源**，但不等于"全仓库已无字面量"——下列 GENERATED_DOCS /
//    DOC_HISTORY / TEXTBOOKS / TEMPLATES 四键在部分历史模块（GenerateModule / HistoryModule /
//    textbookStore / templateStore / TypesetModule 等）仍以同值字面量出现，属待迁移存量。
//    迁移时以本表值为准；新增代码请直接引用常量。

export const STORAGE_KEYS = {
  // 应用配置/设置
  API_CONFIG: 'apiConfig',
  STORAGE_PATH: 'storagePath',
  ACTIVATION_INFO: 'activationInfo',
  HAS_LAUNCHED: 'has_launched',
  APP_ROUTE: '__app_route',

  // 内容主数据（跨 App 云同步 / GenerateModule / HistoryModule / 两个 store 读写）
  // 🔧 2026-09-28 补登记：此前 App.vue 仍用同值字面量，四键未登记 → 收口入表
  GENERATED_DOCS: 'wisdom_generated_docs',
  DOC_HISTORY: 'docHistory',
  TEXTBOOKS: 'textbooks',
  TEMPLATES: 'templates',

  // 生成记录软删除墓碑（跨 App 统计 / GenerateModule / HistoryModule 读写）
  DELETED_GEN_IDS: 'wisdom_deleted_gen_doc_ids',
  DELETED_HIST_IDS: 'wisdom_deleted_hist_doc_ids',

  // 草稿中转（DraftModule 本模块用）
  DRAFTS: 'drafts',
  PENDING_DRAFT: 'pendingDraft',
};
