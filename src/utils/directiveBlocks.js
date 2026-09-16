/**
 * 指令块抽取与字段解析（单一实现）
 *
 * 用途：把生成文档里的 `[GRAPH]…[/GRAPH]` / `[IMAGE]…[/IMAGE]` 块整体抽出来，
 * 供「📐 复制图形指令」「🖼️ 复制配图稿」两个一键复制入口使用（见 GenerateModule.vue）。
 *
 * 背景（2026-09-16）：渲染端已不再本地出图（Stable Diffusion 弃用），配图统一走
 * 「复制画面描述 → 外部 AI 出图 → 渲染端『选择我生成的图片』插回 → 导出」。
 * 老师需要的是**一条一条的配图稿**（并知道它对应哪道题），
 * 而不是从整篇源码里自己翻 [IMAGE] 块 —— 所以这里把抽取/解析固定成一处实现。
 */

export const DIRECTIVE_TAGS = ['GRAPH', 'IMAGE'];

/**
 * 抽出全部指令块（**含**标记本身，便于整段粘贴回渲染端）。
 * @param {string} content 文档源码
 * @param {string} tag 'GRAPH' | 'IMAGE'（不区分大小写）
 * @returns {string[]}
 */
export function extractDirectiveBlocks(content = '', tag = '') {
  const t = String(tag || '').trim().toUpperCase();
  if (!content || !DIRECTIVE_TAGS.includes(t)) return [];
  const re = new RegExp(`\\[${t}\\]([\\s\\S]*?)\\[\\/${t}\\]`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(String(content))) !== null) out.push(m[0]);
  return out;
}

/**
 * 解析块体里的 KEY:VALUE。
 * - 键名统一大写、去首尾空白；
 * - 值支持跨行（后续缩进行接到上一个键上），例如 GRAPH 里的多行 COMPONENTS/FORCES；
 * - 没有冒号的行若紧跟在一个键之后，视为该键的续行。
 * @param {string} body 块体（不含 [TAG] 标记）
 * @returns {Record<string,string>}
 */
export function parseDirectiveFields(body = '') {
  const fields = {};
  let lastKey = '';
  for (const rawLine of String(body || '').split('\n')) {
    const line = rawLine.replace(/\s+$/, '');
    if (!line.trim()) continue;
    const idx = line.indexOf(':');
    const isContinuation = /^\s/.test(rawLine);   // 缩进行 = 续行
    if (idx > 0 && !(isContinuation && lastKey)) {
      const key = line.slice(0, idx).trim().toUpperCase();
      const value = line.slice(idx + 1).trim();
      if (key) {
        fields[key] = value;
        lastKey = key;
        continue;
      }
    }
    if (lastKey) {
      fields[lastKey] = fields[lastKey] ? `${fields[lastKey]}\n${line.trim()}` : line.trim();
    }
  }
  return fields;
}

/**
 * 把文档里的配图指令整理成"一条一条"的配图稿清单。
 * @param {string} content 文档源码
 * @param {{contextChars?: number}} [options] contextChars：位置对照取多少字（默认 60）
 * @returns {Array<{prompt:string,keywords:string,style:string,desc:string,where:string,raw:string}>}
 */
export function buildImagePromptList(content = '', options = {}) {
  const contextChars = Number(options.contextChars) || 60;
  const src = String(content || '');
  const re = /\[IMAGE\]([\s\S]*?)\[\/IMAGE\]/gi;
  const out = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    const fields = parseDirectiveFields(m[1]);
    const prompt = fields.PROMPT || '';
    const keywords = fields.KEYWORDS || '';
    const style = fields.STYLE || '';
    // 位置对照：取该指令之前的一小段正文（去掉指令标记噪音，便于老师核对是哪道题）
    const where = src.slice(Math.max(0, m.index - contextChars * 2), m.index)
      .replace(/\[\/?(?:GRAPH|IMAGE)\]/gi, ' ')
      .replace(/[\s\u3000]+/g, ' ')
      .trim()
      .slice(-contextChars);
    out.push({
      prompt,
      keywords,
      style,
      desc: prompt || keywords || '',
      where,
      raw: m[0],
    });
  }
  return out;
}

export default {
  DIRECTIVE_TAGS,
  extractDirectiveBlocks,
  parseDirectiveFields,
  buildImagePromptList,
};
