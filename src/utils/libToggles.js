/**
 * 工具库条目启用/停用开关（独立模块，无依赖，避免各库循环引用）
 * ============================================================
 * 用途：用户在工具库面板可对每条内容（蓝图条目 / 指令 cell / 渲染 TYPE 等）停用；
 *       停用条目在生成端消费点（findBlueprint / getTeachingBlueprint /
 *       getPromptTemplate / buildRenderContract）直接不命中，回退到下一级数据。
 * 存储：localStorage（仅存停用项，缺省 = 启用）；模块级缓存避免生成热路径反复 JSON.parse。
 * 键约定：{ [libId]: { [entryKey]: false } }——libId ∈ blueprint / instruction / render-contract / layout-spec；
 *         entryKey 与各库数据键一致（如 '语文|primary_low'、'primary_low|语文|exam'、'COORDINATE'、'zuo-wen-ge'）。
 *         规则库启停不走此模块（RulesView 经 saveUserRule 的 enabled 字段覆盖，见 validatorRules）。
 */

const TOGGLES_KEY = 'wisdom_lib_toggles_v1';

let _toggleCache = null;

function readToggles() {
  if (_toggleCache === null) {
    try {
      _toggleCache = JSON.parse(localStorage.getItem(TOGGLES_KEY)) || {};
    } catch {
      _toggleCache = {};
    }
  }
  return _toggleCache;
}

/** 全部停用状态（{ [libId]: { [entryKey]: false } }，UI 初始化用） */
export function loadLibToggles() {
  return readToggles();
}

/** 设置某条目的启用状态（enabled=false 停用；重新启用时移除记录） */
export function setLibToggle(libId, entryKey, enabled) {
  if (!libId || !entryKey) return;
  const all = readToggles();
  const cur = { ...(all[libId] || {}) };
  if (enabled) delete cur[entryKey];
  else cur[entryKey] = false;
  if (Object.keys(cur).length) all[libId] = cur;
  else delete all[libId];
  localStorage.setItem(TOGGLES_KEY, JSON.stringify(all));
  _toggleCache = all;
}

/** 条目是否启用（缺省启用；停用 = 该条目不参与生成匹配/注入） */
export function isLibEntryEnabled(libId, entryKey) {
  if (!libId || !entryKey) return true;
  return readToggles()[libId]?.[entryKey] !== false;
}

/** 某库全部停用条目键（UI 灰显/角标用） */
export function listDisabledEntries(libId) {
  return Object.keys(readToggles()[libId] || {});
}

/** 测试用：清空全部开关状态 */
export function clearLibToggles() {
  localStorage.removeItem(TOGGLES_KEY);
  _toggleCache = {};
}

export default { loadLibToggles, setLibToggle, isLibEntryEnabled, listDisabledEntries, clearLibToggles };
