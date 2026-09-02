// src/constants/storageKeys.js
// localStorage 业务 key 唯一事实源
// 🔴 跨模块共享的存储 key：读写方分处多文件，拼写漂移 = 数据静默读写错位（读到旧值/写丢新值）。
//    以下 key 曾以纯字面量散落 3-6 个文件（App/useBackup/apiConfig/Settings/useActivation/pathHelper/GenerateModule/History/router），
//    现统一收口本文件——新增/改名 key 只改此处。

export const STORAGE_KEYS = {
  // 应用配置/设置
  API_CONFIG: 'apiConfig',
  STORAGE_PATH: 'storagePath',
  ACTIVATION_INFO: 'activationInfo',
  HAS_LAUNCHED: 'has_launched',
  APP_ROUTE: '__app_route',

  // 生成记录软删除墓碑（跨 App 统计 / GenerateModule / HistoryModule 读写）
  DELETED_GEN_IDS: 'wisdom_deleted_gen_doc_ids',
  DELETED_HIST_IDS: 'wisdom_deleted_hist_doc_ids',

  // 草稿中转（DraftModule 本模块用）
  DRAFTS: 'drafts',
  PENDING_DRAFT: 'pendingDraft',
};
