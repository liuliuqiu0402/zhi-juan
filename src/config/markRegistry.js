/**
 * 🏷 标记载体注册表（**单一事实源**）
 * ============================================================
 * 为什么必须集中（2026-10-30 属主实测："题干写着加点、画线，正文却没有标记"）：
 *   同一条"标记约定"原先散在 5 个地方，各写一份、互不知道对方：
 *     ① 指令（validatorRules 的 promptHint，埋在 7k 字质检附加段里）
 *     ② 口径（promptLibrary 的"题面不承载强调"——与标记规则正面竞争）
 *     ③ 渲染（themeConfig / global.css / RichTextEditor / TypesetModule / GenerateModule 各一份 CSS）
 *     ④ 导出（docxBuilder 的 class → Word 映射）
 *     ⑤ 校验与清洗（examValidator 的全文计数、contentCleaner 拆裸 <u>）
 *   任一处漏跟，结果都是"模型写了也白写"：看不见、导不出、或被清洗掉。
 *   所以本文件是**唯一登记处**，其余各处一律从这里派生（并由守卫测试锁死五方一致）。
 *
 * 约定（模型侧只照抄这一张表，不做语义推断）：
 *   · 只有这里的 class 可用；不自创 class、不加内联样式、不互相嵌套；
 *   · 标记必须落在**题干指定的那一处**；同一要求涉及多处则逐处标；
 *   · 题干有要求而正文无对应标记 = 该题无效（生成后逐题对账只报不改）。
 * ============================================================
 */

/**
 * @typedef {Object} MarkRule
 * @property {string} id        规则 id（与 class 同名，便于跨层引用）
 * @property {string} label     中文名（报告/面板展示）
 * @property {string} cls       HTML class（**唯一**，渲染/导出/校验都按它认）
 * @property {string[]} subjects 适用学科（精确匹配 normalizeSubjectName 产物）
 * @property {string} write     给模型照抄的写法
 * @property {string} trigger   题干触发词（写成"顿号列举"，供指令文案用）
 * @property {RegExp} triggerRe 触发词正则（对账用）
 * @property {string} forbid    禁止的替代写法（防"用加粗/下划线蒙混"）
 */
export const MARK_RULES = [
  {
    id: 'emphasis-dot',
    label: '加点（着重号）',
    cls: 'emphasis-dot',
    subjects: ['语文'],
    write: '<span class="emphasis-dot">字</span>',
    trigger: '加点／加点的字／加点的词语',
    triggerRe: /加点/,
    forbid: '不得用加粗、下划线代替加点',
  },
  {
    id: 'underline-sentence',
    label: '画线（横线）',
    cls: 'underline-sentence',
    subjects: ['语文', '英语'],
    write: '<u class="underline-sentence">被画线的部分</u>',
    trigger: '画线／划线／画出／划出／标出／描出',
    triggerRe: /画线|划线|画出|划出|标出|描出/,
    forbid: '不得用裸 <u> 或加粗代替画线——裸 <u> 会被当成填空横线',
  },
  {
    id: 'wavy-underline',
    label: '波浪线',
    cls: 'wavy-underline',
    subjects: ['语文', '英语'],
    write: '<span class="wavy-underline">被画的部分</span>',
    trigger: '波浪线（用波浪线画出）',
    triggerRe: /波浪线/,
    forbid: '不得用普通下划线代替波浪线',
  },
  {
    id: 'double-line',
    label: '双横线',
    cls: 'double-line',
    subjects: ['语文'],
    write: '<span class="double-line">被画的部分</span>',
    trigger: '双横线／双线（用双横线画出）',
    triggerRe: /双横线|双线/,
    forbid: '不得用单横线代替双横线',
  },
  {
    id: 'circle-mark',
    label: '圈出',
    cls: 'circle-mark',
    subjects: ['语文'],
    write: '<span class="circle-mark">被圈的部分</span>',
    trigger: '圈出／圈起来／圈出错别字',
    triggerRe: /圈出|圈起来|圈错/,
    forbid: '不得用括号或加点代替圈出',
    // 🔴 2026-10-30：**学生动作**（学生自己圈、自己划），不是作者必须预置的标记——
    //   故：渲染/导出提供载体（模型要举例时能用），但**不注入"必须标"的要求、也不参与逐题对账**
    //   （否则"圈出加点字正确的读音"这类题会被误判成"缺 circle-mark"，实测会误报）。
    studentAction: true,
  },
  {
    id: 'strike-mark',
    label: '划去（删除）',
    cls: 'strike-mark',
    subjects: ['语文'],
    write: '<span class="strike-mark">被划去的部分</span>',
    trigger: '划去／删去／划掉（用修改符号删去）',
    triggerRe: /划去|删去|划掉/,
    forbid: '不得直接删掉文字——题干要求"划去"时须保留原文并加标记',
    studentAction: true, // 同上：划去是学生用修改符号的动作，不要求作者预置
  },
];

/** 该学科**必须由作者标出**的标记（不在表里的学科 = 无标记能力，不注入、不参与对账）。
 *  学生动作类（圈出/划去）不在此列：有渲染载体、但不要求作者预置。 */
export const markRulesFor = (subject = '') =>
  MARK_RULES.filter((r) => r.subjects.includes(subject) && !r.studentAction);

/** 全部标记 class（渲染/导出/守卫测试按它逐项核对） */
export const markClassList = () => MARK_RULES.map((r) => `.${r.cls}`);

/**
 * 生成端注入文本（渲染契约段的一块）：
 * 只列"触发词 → 照抄写法"，一条一行、不留空行；按学科裁剪，别的学科不注入（防跨学科诱导）。
 * @returns {string} 空串 = 该学科无标记能力
 */
export function buildMarkCarrierClause(subject = '') {
  const rules = markRulesFor(subject);
  if (!rules.length) return '';
  const lines = rules.map((r) => `· ${r.trigger} → ${r.write}（${r.forbid}）`);
  return [
    '【标记载体】',
    '· 题干出现下列要求时，被标示处一律用对应写法（class 名照抄、不加内联样式、不自创 class 名）：',
    ...lines,
    '· 标记只落在**题干指定的那一处**，不得按"哪处更像重点"自选；同一要求涉及多处则逐处标出',
    '· 标记不得互相嵌套，也不得与填空空位（blank-N）混用；题干有要求而正文无对应标记，该题视为无效',
  ].join('\n');
}

/**
 * 题干触发词 → 要求了哪些标记。
 * 用途：生成后逐题对账（只报不改）——每块单独判，不再"全文计数"（旧口径一处有标记就整卷放过）。
 * @param {string} plainText 块内纯文本
 * @returns {Array<MarkRule>}
 */
export function detectMarkClaims(plainText = '') {
  const t = String(plainText || '');
  if (!t) return [];
  // 只判"作者必须标出"的标记；学生动作类（圈出/划去）不在此列（见 studentAction 说明）
  return MARK_RULES.filter((r) => !r.studentAction && r.triggerRe.test(t));
}

/** 该块里是否出现了这条标记（按 class 认，不按标签名——`<u>` 也可能是填空横线） */
export const hasMarkInHtml = (html = '', rule) =>
  new RegExp(`class=["'][^"']*\\b${rule.cls}\\b[^"']*["']`, 'i').test(String(html || ''));

/** 计数（清洗不变量测试用：清洗前后该标记数量不得减少） */
export const countMarkInHtml = (html = '', rule) =>
  (String(html || '').match(new RegExp(`class=["'][^"']*\\b${rule.cls}\\b[^"']*["']`, 'gi')) || []).length;

/**
 * 逐题对账（**只报不改**）：题干要求了某种标记、但**该题块内**没有对应载体 → 记一条。
 * 为什么按题块而不是全文：旧口径"全文标记数 == 0 才报"——卷里任意一处有标记，其余缺标记的题
 *   全部漏报（属主实测"题干写着加点、正文却没有，也没人提示"）。按题块判才看得见。
 * 题块切分与"加点"修复同口径（`<p class="question">` 为界；切不出就退化为整份一块，
 *   此时等价于旧行为——宁可少报，不误报）。答案区（answer-section）整体排除，避免把"答案里提到加点"当题面。
 * @returns {Array<{id:string,label:string,excerpt:string}>}
 */
export function auditMarkBlocks(html = '', { subject = '' } = {}) {
  // 学科不明时按"作者侧全集"判（学生动作类一律排除——圈出/划去是学生自己动手）
  const allowed = subject ? markRulesFor(subject) : MARK_RULES.filter((r) => !r.studentAction);
  if (!allowed.length) return [];
  const src = String(html || '');
  const bodyOnly = src.split(/<div[^>]*class=["'][^"']*answer-section["']/i)[0] || src;
  const blocks = bodyOnly.split(/(?=<p[^>]*\bclass=["'][^"']*\bquestion\b)/i);
  const out = [];
  for (const blk of blocks) {
    const plain = blk.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
    const claims = detectMarkClaims(plain).filter((r) => allowed.includes(r));
    for (const rule of claims) {
      if (!hasMarkInHtml(blk, rule)) {
        out.push({
          id: rule.id,
          label: rule.label,
          excerpt: plain.replace(/\s+/g, ' ').trim().slice(0, 30),
        });
      }
    }
  }
  return out;
}

export default {
  MARK_RULES, markRulesFor, markClassList, buildMarkCarrierClause,
  detectMarkClaims, hasMarkInHtml, countMarkInHtml, auditMarkBlocks,
};
