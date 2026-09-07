/**
 * 段类型枚举与判定（复位工程 · S4.1 素材线前置）
 * ============================================================
 * 依据：docs/design/复位工程-阶段0盘点清单.md G5「Step1 段类型枚举补'拓展/文化'」、
 *   docs/design/三线生成架构-设计准绳.md「锚范围性质判定：仅绑定'你知道吗/拓展框'型段的锚
 *   → 拓展锚（不进必覆盖清单）」。
 *
 * 用途：
 *   - Step1 段落类型启发式标注（useAiGenerator.extractContentCards）补"拓展/文化"类；
 *   - coverageAnchor 锚范围性质判定（isExtensionAnchor）——兼容存量（type 未标定时按文本复判）。
 * ============================================================
 */

/** 拓展/文化段类型名（Step1 段类型枚举成员）。 */
export const SEG_TYPE_EXTENSION = '拓展/文化';

/** 拓展/文化框文本特征（"你知道吗"科普框/数学文化/课外阅读等——非练习、非正文规则句；
 *  注意不收录"拓展应用/拓展提升"等疑似练习题标题词，防止练习段误标）。 */
export const EXTENSION_TEXT_RE = /你知道吗|数学文化|文化园地|科学阅读|课外阅读|阅读链接|知识窗|生活小知识|小常识|趣味数学|数学阅读/;

/**
 * 段是否属"拓展/文化"性质（Step1 type 标注优先；存量段 type=正文 时按文本特征复判）。
 * @param {{type?:string, text?:string}|string} seg 段对象或段文本
 * @returns {boolean}
 */
export function isExtensionSegment(seg) {
  const type = typeof seg === 'string' ? '' : String(seg?.type || '').trim();
  if (type === SEG_TYPE_EXTENSION) return true;
  const text = typeof seg === 'string' ? seg : String(seg?.text || '');
  if (!text) return false;
  return EXTENSION_TEXT_RE.test(text);
}
