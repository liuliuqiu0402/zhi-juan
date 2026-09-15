/**
 * 历史生成记录的一次性数据修正（GenerateModule 加载/云同步后调用）
 *
 * 背景（2026-09-15 清理）：
 *   生成结果列表的"难度比例"胶囊，原先在**没有逐题难度数据**时会降级到配置面板的目标值，
 *   而该配置项本身是死控件（生成端从不读取）且默认值为空 → 实际每次都退回硬编码 50/30/20。
 *   于是「同步练习 / 专项 / 阅读 / 预习」等非整卷链路的记录，全都带着同一组 50/30/20，
 *   看着像统计结果，其实是假数据。
 *
 *   生成端已改为"无真实逐题数据即返回 null、模板不渲染"，但**旧记录里已经存下的值不会自己消失**，
 *   所以需要在这里做一次存量清理。
 *
 * 判据（刻意保守）：
 *   只剔除"恰好等于 {50,30,20}"的旧值 —— 这正是那段兜底表达式唯一的产出（两个兜底常量都由 `|| 50/30/20`
 *   给出）。真实统计偶然恰好等于 50/30/20 的概率极低，且即便误剔也只影响这一个胶囊的显示，不动题目内容。
 */

/** 旧兜底表达式产出的特征值（easy/medium/hard） */
export const LEGACY_FAKE_DIFFICULTY = { easy: 50, medium: 30, hard: 20 };

/** 是否为"旧兜底假难度比例"（恰好 50/30/20） */
export function isLegacyFakeDifficulty(difficulty) {
  return !!difficulty
    && difficulty.easy === LEGACY_FAKE_DIFFICULTY.easy
    && difficulty.medium === LEGACY_FAKE_DIFFICULTY.medium
    && difficulty.hard === LEGACY_FAKE_DIFFICULTY.hard;
}

/**
 * 就地清理假难度比例（把命中的记录 difficulty 置为 null，模板 v-if 即不再渲染该胶囊）
 * @param {Array} docs 记录数组
 * @returns {number} 被清理的记录条数（0 表示无需回写存储）
 */
export function dropLegacyFakeDifficulty(docs) {
  if (!Array.isArray(docs)) return 0;
  let fixed = 0;
  for (const doc of docs) {
    if (doc && isLegacyFakeDifficulty(doc.difficulty)) {
      doc.difficulty = null;
      fixed += 1;
    }
  }
  return fixed;
}
