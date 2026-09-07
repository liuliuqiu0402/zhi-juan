/**
 * 防照搬护栏（底线线 O5，2026-09-07 用户定版）
 * ============================================================
 * 判据（确定性、字面层）：生成正文与参考段（示范段原文）——
 *   · 整句连续 ≥8 字命中；或
 *   · 同串 3 个连续数字命中（防"照搬教材数字"）。
 * 命中即报"疑似照搬"提示（只报不改，交编辑核对/模型重做），程序不判定语义雷同。
 * 依据：docs/design/三线生成架构-设计准绳.md 底线线（O5 防照搬护栏默认阈值，A/B 校准）。
 * ============================================================
 */

const normWs = (s) => String(s || '').replace(/\s+/g, '');

/** 汉字/可读字符连续 n 字命中检测（字面确定性；跳过标点归一后比连续片段）。 */
function longRunOverlap(body, corpus, n) {
  const hits = [];
  for (const src of corpus) {
    const c = normWs(src);
    if (c.length < n) continue;
    for (let i = 0; i + n <= c.length; i += 1) {
      const chunk = c.slice(i, i + n);
      if (body.includes(chunk)) {
        hits.push({ kind: 'long', n, snippet: chunk, source: src.slice(0, 60) });
        break; // 同源命中一次即可（提示该源存在长句重合）
      }
    }
  }
  return hits;
}

/** 同串 3 个连续数字命中检测（正文含与参考段相同的连续 3 位数字串）。 */
function numberRunOverlap(body, corpus) {
  const hits = [];
  const numRe = /\d{3,}/g;
  const seenNums = new Set();
  for (const src of corpus) {
    const c = normWs(src);
    let m;
    while ((m = numRe.exec(c)) !== null) {
      const num = m[0];
      if (seenNums.has(num)) continue;
      if (body.includes(num)) {
        seenNums.add(num);
        hits.push({ kind: 'num', n: num.length, snippet: num, source: src.slice(0, 60) });
      }
    }
  }
  return hits;
}

/**
 * 防照搬扫描（只报不改）。
 * @param {object} p
 * @param {string} p.bodyHtml 生成正文（HTML 或纯文本均可——按去标签后的文本比对）
 * @param {string[]} p.corpus 参考段原文数组（示范段文本）
 * @param {number} [p.longN] 连续字命中阈值（默认 8）
 * @returns {Array<{kind:'long'|'num', n:number, snippet:string, source:string}>} 命中清单（空=无命中）
 */
export function scanCopyOverlap({ bodyHtml = '', corpus = [], longN = 8 } = {}) {
  const text = String(bodyHtml || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&emsp;|&#8195;/gi, ' ')
    .replace(/&ensp;|&#8194;/gi, ' ')
    .replace(/&amp;/g, '&');
  const body = normWs(text);
  if (!body || !Array.isArray(corpus) || !corpus.length) return [];
  const srcs = corpus.map((s) => String(s || '')).filter(Boolean);
  return [...longRunOverlap(body, srcs, Math.max(4, longN)), ...numberRunOverlap(body, srcs)];
}

/** 命中清单 → 一条生成报告提示（供 auditWarnings / 编辑核对，程序不改内容）。 */
export function copyOverlapNote(hits = [], limit = 5) {
  if (!Array.isArray(hits) || !hits.length) return '';
  const top = hits.slice(0, limit).map((h) => `「${h.snippet}」（${h.kind === 'num' ? '数字串' : `${h.n} 字连续`}命中参考段）`);
  return `⚠️ 防照搬提示：正文存在 ${hits.length} 处与教材示范段字面重合${hits.length > limit ? `（前 ${limit} 处）` : ''}：${top.join('、')}。请改编情境/数据后保留（交编辑核对，非程序判定雷同）。`;
}
