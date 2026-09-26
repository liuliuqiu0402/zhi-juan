// ══════════ 用户蓝图栏目覆盖（localStorage 持久化，用户版优先）══════════
// 🔴 2026-09-27（用户裁定 g6）：目前没有自定义条目；**将来**用户在原内置蓝图栏目上修改时，
//    所有下游（生成注入/卷面结构/校验）必须读到**用户改后的条目**、在其基础上改，不得盲改内置源。
//    本模块是**机制先行**：存"用户栏目覆盖"（按 subject|stage 整组替换 sections），
//    getExamBlueprint 在省市覆盖之后合并（用户优先）——将来加自定义 UI 只需写本 storage，
//    全链路自动生效，无需再改生成/注入/校验各处。
//    与省市覆盖（examRegionConfig）同构：note 缺省按**同名栏目从内置蓝本继承**（少写一坨文案）。
const BLUEPRINT_OVERRIDES_KEY = 'wisdom-workshop.user-blueprint-overrides.v1';

/** 读取用户蓝图栏目覆盖（无/损坏 → 空对象） */
export function loadUserBlueprintOverrides() {
  try {
    const raw = localStorage.getItem(BLUEPRINT_OVERRIDES_KEY);
    if (!raw) return {};
    const lib = JSON.parse(raw);
    return lib && typeof lib === 'object' ? lib : {};
  } catch {
    return {};
  }
}

/** 保存整份用户蓝图栏目覆盖 */
export function saveUserBlueprintOverrides(lib) {
  try { localStorage.setItem(BLUEPRINT_OVERRIDES_KEY, JSON.stringify(lib || {})); } catch { /* 存储不可用时静默（同省市覆盖） */ }
}

/** 保存单个 subject|stage 的栏目覆盖（整组替换 sections；传空数组/缺省 → 删除该条，回退内置） */
export function setBlueprintSectionOverride(key, sections = []) {
  const lib = loadUserBlueprintOverrides();
  const valid = Array.isArray(sections)
    ? sections.filter((s) => s && String(s.name || '').trim() && Number(s.score) > 0)
    : [];
  if (valid.length) lib[key] = valid;
  else delete lib[key];
  saveUserBlueprintOverrides(lib);
  return valid.length > 0;
}

/** 删除单条栏目覆盖（回退内置） */
export function removeBlueprintSectionOverride(key) {
  const lib = loadUserBlueprintOverrides();
  if (lib[key]) {
    delete lib[key];
    saveUserBlueprintOverrides(lib);
    return true;
  }
  return false;
}

/** 按 key 取用户栏目覆盖（无 → null）；调用方负责与内置合并（note 缺省继承内置同名） */
export function getUserBlueprintSections(key) {
  const lib = loadUserBlueprintOverrides();
  return Array.isArray(lib[key]) && lib[key].length ? lib[key] : null;
}

export default {
  loadUserBlueprintOverrides,
  saveUserBlueprintOverrides,
  setBlueprintSectionOverride,
  removeBlueprintSectionOverride,
  getUserBlueprintSections,
};
