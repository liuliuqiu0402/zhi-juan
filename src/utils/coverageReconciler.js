/**
 * 🧹 覆盖对账器（已废除）——本文件仅保留共用的"去标签"文本工具
 * ============================================================
 * 🔴 2026-09 用户定版：**生成后覆盖对账整体废除**——覆盖是否呈现由正文生成期决定；
 *    报告只如实输出「覆盖点→题映射 + 未呈现清单」交用户核对，程序不自动改写正文
 *    （防复习卡污染栏目形态、防按覆盖点凑内容）。随之 `reconcileCoverage` /
 *    `reconcileCoverageStats` / `coverageNoteOf` 在生产代码零调用，属死代码。
 *
 * ✅ A9（2026-09-11 清理，依据 docs/design/极简方案-定稿.md 第三节）：上述三函数及其
 *    专属依赖（contractOf / classifyProbe / literalProbeWords / groupByChapter / wordMatch）
 *    已从本文件移除。
 *
 * 🔒 保留项：`stripHtmlForRecon`——`domainReconciler`（域覆盖对账，"只报不改"生产防线）
 *    复用的"去标签 → 单行文本"工具（对账只看"是否出现"，不看排版形态），
 *    不可随对账器一并删除。
 * ============================================================
 */

/** 去 HTML 标签 → 单行文本（对账只看"是否出现"，不看排版形态） */
export const stripHtmlForRecon = (html) =>
  String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ');
