// src/constants/events.js
// 全局自定义事件名称常量（唯一事实源）
// 🔴 跨模块协议型字符串：监听方与分发方分处不同文件，拼写漂移=事件静默失效。
//    以下常用事件曾以纯字面量散落 4-6 个文件配对（App/AppHeader/GenerateModule/Settings/History/Typeset/ToastProvider/useActivation），
//    现统一收口本文件——新增/改名事件只改此处。

export const APP_EVENTS = {
  // 模块切换
  SWITCH_TAB: 'switch-tab',

  // 排版模块接收内容
  TYPESET_CONTENT: 'typeset-content',

  // 草稿箱→上传弹窗
  PROCESS_DRAFT: 'process-draft',
  DRAFT_TO_UPLOAD: 'draft-to-upload',

  // 历史记录→生成模块加载指令
  LOAD_INSTRUCTION: 'load-instruction',

  // 草稿箱→使用草稿
  USE_DRAFT: 'use-draft',

  // 轻提示（ToastProvider 监听；App/useActivation/GenerateModule/Settings 等分发）
  SHOW_TOAST: 'show-toast',

  // 内容/数据变更 → 全局刷新
  APP_REFRESH: 'app-refresh',
  APP_UPLOAD: 'app-upload',
  RESET_TASK: 'reset-task',

  // 云同步完成（App 监听后广播给 GenerateModule/HistoryModule/TypesetModule 刷新记录）
  DATA_SYNC_COMPLETE: 'data-sync-complete',

  // 试用到期倒计时重置
  SIGN_COUNTDOWN_RESET: 'sign-countdown-reset',
};