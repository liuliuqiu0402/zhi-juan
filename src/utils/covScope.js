/**
 * 定向 browse 索引的类型分流（2026-09）
 * ============================================================
 * 【覆盖点→章节 定向索引】只在"该范围须全覆盖"的资料类型注入——
 *   summary/review/dictation/preview：内容型梳理，口径=覆盖本范围全部核心知识（不遗漏）；
 *   practice（课时练）：结构蓝本口径=基础建构任务覆盖本课时全部核心知识点，属该课时全覆盖。
 * exam（按蓝本结构与分值抽样命题，非全覆盖）、special（聚焦薄弱点）、
 * errorbook（针对已有错题）、reading（围绕所选篇目设题）不注入全量"覆盖点→章节"清单，
 * 仅保留章节目录白名单按需 browse——防止把导航索引读成"必须逐一覆盖/考查"的清单压力
 * （与已废除的判缺"必覆盖"闭环同源，2026-09 防复活）。
 * ============================================================
 */
export const FULL_COVER_GEN_TYPES = ['summary', 'review', 'dictation', 'preview', 'practice'];

export const isFullCoverGenType = (genType = '') => FULL_COVER_GEN_TYPES.includes(genType);
