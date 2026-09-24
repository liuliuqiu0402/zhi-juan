/**
 * 🎚 `[GRAPH]` 就地渲染策略 —— 分级开关（默认全关）
 * ============================================================
 * 背景（2026-09-24 用户裁定，两条都记在这里免得后人对不上）：
 *   ① 收回 `[GRAPH]`（函数图象/几何函数图/统计图就地出图）**不能是降级**：
 *      "如果做不到、没有另一个项目齐全的话，还不如不硬收回"。
 *   ② 长尾学科图（受力/电路/光路/装置/分子结构等）**继续走 EduRender Studio**，
 *      出好的图由用户**复制粘贴**进正文——这条路径本项目已具备且已验证
 *      （粘贴即 `data:image` 图片；排版页不丢〔allowBase64〕、Word 走 ImageRun、PDF 走 puppeteer）。
 *      所以**不做"自动插回"通道**（用户明确说不需要）。
 *
 * 因此这里的默认值是**全关**：一行代码都不改变现有产出，等逐类对照验收通过再逐个打开。
 * 打开方式：把类型 value 加进 `GRAPH_RENDER_TYPES`（合法值见 DIAGRAM_TYPES）。
 *   · 建议顺序：先开风险最低的统计图（契约字段与我们的 spec 几乎一一对应），
 *     再开 coordinate / shapes（它们还有"精细参数未映射""平面几何缺去轴"两处已知差距要补）。
 *   · 未打开的类型：`[GRAPH]` 指令块**原样保留**在正文里，用户照旧"复制该条 → 到
 *     EduRender Studio 出图 → 粘贴回来"——与从前完全一致。
 *
 * 🔴 为什么用配置常量而不是界面开关：改动要**可审计**（谁在什么时候开了哪一类，
 *    在 git 历史里看得见），且不会让用户误以为"打开就等于不降级"。等对照验收完毕，
 *    再评估是否需要在设置页暴露。
 * ============================================================
 */

/** 总开关：false = 所有类型都走原流程（复制出去出图） */
export const GRAPH_RENDER_ENABLED = false;

/** 逐类白名单：只有列在这里、且总开关为 true 的类型才就地渲染 */
export const GRAPH_RENDER_TYPES = [];

/**
 * 某图种是否就地渲染。override 的语义（明确写死，避免"传了 enabled 却被白名单拦掉"这种坑）：
 *   · 不传          → 用上面的配置（默认全关）
 *   · {enabled:true}          → **全部放开**（供测试/一次性调用）
 *   · {enabled:true, types:[…]} → 只放开列出的类型
 *   · {enabled:false}         → 全部关闭
 */
export const isGraphRenderEnabledFor = (type, override) => {
  if (override) {
    if (!override.enabled) return false;
    if (!Array.isArray(override.types)) return true;
    return override.types.includes(type);
  }
  return GRAPH_RENDER_ENABLED && GRAPH_RENDER_TYPES.includes(type);
};

export default { GRAPH_RENDER_ENABLED, GRAPH_RENDER_TYPES, isGraphRenderEnabledFor };
