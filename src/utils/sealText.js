/**
 * 密封线文本规整（共享）
 * ============================================================
 * 🔴 曾分别内联于 themeConfig.buildSealZoneHTML（预览）与 utils/drawingMLShapes.sealGroupOOXML（docx 导出），
 *    同正文双份、改一处忘另一处即破坏"预览与导出一致"；现收敛为共享叶模块（无依赖，防环）。
 * ============================================================
 */

/** 剥离字段尾部粘连的密封线字符（如"密封线内不要答题封""学号：＿密"） */
export const stripSealSuffix = (s) => String(s || '').replace(/[密封线]+$/g, '');

/** 学校/班级/姓名/学号后的下划线统一为 8 个全角 ＿（"再长一些且一致"，预览与 docx 导出同规整） */
export const normalizeSealBlanks = (s) => String(s || '').replace(/＿+/g, '＿＿＿＿＿＿＿＿');

export default { stripSealSuffix, normalizeSealBlanks };
