/**
 * 易错题本分项名 · 单一事实源（2026-09-28 收口）
 * ============================================================
 * 背景：易错题本六个分项名曾**双轨**——注入侧 teachingBlueprints 用
 *   「题目呈现/典型错解/错因剖析/正确解答/方法提炼/变式训练」，
 *   指令库 promptLibrary 另写一份「题目/典型错法/错因/正确解答/方法提示/变式」，两处不一致。
 * 处置：收为**一份**——本文件即唯一定义处；
 *   · teachingBlueprints（注入蓝图 sections + COLUMN_STYLE_SETS.errorbook.a）引用 ERRORBOOK_FACETS/NAMES；
 *   · promptLibrary（<h4> 小标题 / 答案区口径）引用 ERRORBOOK_FACET_NAMES。
 *   两库均**只引用、不重写**（改分项名只改此处）。
 * 说明：抽出为独立叶子模块是**为了打断 promptLibrary ↔ teachingBlueprints 的循环导入**——
 *   promptLibrary 在模块求值期即构建 BUILTIN_TEMPLATES（会读本常量），若从 teachingBlueprints 取，
 *   会在其求值完成前读到未初始化绑定（实测为 undefined）。本模块无依赖、最先求值，
 *   故两库皆可在顶层安全引用。
 * ============================================================
 */

/** 易错题本六分项（基准套 columnStyle='a'/默认）：不是资料大类，而是"每道题的组成分项" */
export const ERRORBOOK_FACETS = [
  { name: '题目呈现', note: '呈现题目（保留关键信息，不省略题干）' },
  { name: '典型错解', note: '本知识点的典型错法或错答，指出错在哪一步' },
  { name: '错因剖析', note: '具体到知识点或解题步骤，归因明确，不写空泛套话' },
  { name: '正确解答', note: '分步完整解答，讲透解题思路' },
  { name: '方法提炼', note: '归纳本类题可迁移的通用策略' },
  { name: '变式训练', note: '每题配变式（不复刻本题思路）' },
];

/** 分项名序列（顺序即逐题成组次序）——跨库引用的事实源 */
export const ERRORBOOK_FACET_NAMES = ERRORBOOK_FACETS.map((f) => f.name);
