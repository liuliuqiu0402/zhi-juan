/**
 * 研读轮编排器（复位工程·阶段 2 核心）
 * ============================================================
 * 定位：编辑（模型）"充分了解素材"的内部编排与批摘要校验，纯逻辑、可单测、不依赖引擎。
 * 角色合一说：批摘要=编辑研读后的笔记；程序只做两件助手事——组织研读材料消息（纯追加）、
 *   校验笔记的可溯源性与点名覆盖（帮编辑核对出处，不是验收）。
 * 准绳依据：docs/design/三线生成架构-设计准绳.md「研读编排」
 *   · 每批消息=该批覆盖点 + 绑定教学文本片段（练习段已滤）+ 课标要点；
 *   · 批摘要校验：点名⊆该批清单（无范围外新增点）、引用可溯源（引句须出自绑定片段）、理解非空；
 *   · 事实层零记忆兜底：片段缺失/引句无源 → 不静默（need_material/重读）。
 * ============================================================
 */

/**
 * 研读单位（调用方由覆盖锚 + 绑定片段构造，练习型段已过滤）。
 * @typedef {Object} StudyUnit
 * @property {string} name 覆盖点名（与覆盖清单一致）
 * @property {string} [level] 认知层次
 * @property {string[]} [concepts] 具体概念（整条保留，不截句）
 * @property {Array<{text:string, type:string}>} [segments] 教学文本完整段
 * @property {string} [curriculum] 该点课标要点（版本受控，由 cell 提供）
 */

/** 构造研读批用户消息（角色合一说：编辑收到"这批材料"；内容仅为材料+研读要求，无题型诱导）。
 *  指示语含行式笔记契约（首条即明确，防模型自由输出导致点名解析失败）。 */
export function buildStudyBatchMessage(units) {
  if (!Array.isArray(units) || units.length === 0) return '';
  const lines = [];
  lines.push('【研读批·覆盖要点与教材片段】请通读以下各点的含义与教材表述，随后写研读笔记。笔记必须按行式契约逐点输出：每个要点单独一行，行首【要点名】（与下方要点名完全一致、含【】），后随一句话理解（只准依据素材与课标）；如需引用教材原句，在同一行以｜引用：原句 收尾（≤1 句）。每个要点必须逐一点到、不得遗漏、不得新增范围外要点。要点含义不明或片段缺失请明确写出，不要凭记忆补写教材内容。');
  for (const u of units) {
    const head = u.level ? `\n【${u.name}】（${u.level}）` : `\n【${u.name}】`;
    lines.push(head);
    if (Array.isArray(u.concepts) && u.concepts.length) {
      lines.push(`含义要点：${u.concepts.join('；')}`);
    }
    if (u.curriculum) lines.push(`课标要求：${u.curriculum}`);
    const segs = (u.segments || []).filter((s) => s && s.text && String(s.text).trim());
    if (segs.length) {
      lines.push('教材片段（参考，可简短引用，不得成段照搬）：');
      for (const s of segs) lines.push(`· ${s.text.trim()}`);
    } else {
      lines.push('（该点无可用教材片段——如属缺料请进入缺料处理，勿凭记忆补写）');
    }
  }
  return lines.join('\n');
}

const NAME_LINE_RE = /^【\s*(.+?)\s*】/;

/**
 * 解析批摘要为结构化记录。
 * 约定行式（编辑笔记契约，写进研读消息）：每点一行起于【点名】，后随理解句，可含"｜引用：…"。
 * 容错（expectedNames 提供时）：模型偶发省略【】但行首为"点名："形态（与批内点名完全一致）也识别，
 * 防"格式小偏差→整点判缺→无谓回流"（2026-09 实测：模型输出"小数乘整数的意义：…"无【】被漏解析）。
 * @param {string} digestText
 * @param {object} [opts] { expectedNames?: string[] } 批内点名清单（宽松行识别用；未提供则仅严格【】）
 * @returns {Array<{name:string, note:string, quote:string}>}
 */
export function extractDigestRecords(digestText, { expectedNames = null } = {}) {
  const expectSet = Array.isArray(expectedNames)
    ? new Set(expectedNames.map((n) => String(n).trim()).filter(Boolean))
    : null;
  const out = [];
  const lines = String(digestText || '').split('\n');
  let cur = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const m = NAME_LINE_RE.exec(line);
    if (m) {
      if (cur) out.push(cur);
      cur = { name: m[1].trim(), note: '', quote: '' };
      const rest = line.slice(m[0].length).trim();
      if (rest) cur.note = rest;
      continue;
    }
    // 宽松点名行：行首 token（到首个 ：:｜ 或空白止，≤24 字）与批内点名完全一致 → 视为该点名行
    // （模型省略【】的常见形态；note 内容不得被当成上一行的附加文字）
    if (expectSet && !cur) {
      const lm = /^([^\s：:｜|]{1,24})[：:]\s*([\s\S]*)$/.exec(line);
      if (lm && expectSet.has(lm[1])) {
        cur = { name: lm[1], note: lm[2] ? String(lm[2]).trim() : '', quote: '' };
        continue;
      }
    } else if (expectSet && cur && !line.startsWith('【') && !/^【/.test(line)) {
      const lm = /^([^\s：:｜|]{1,24})[：:]\s*([\s\S]*)$/.exec(line);
      if (lm && expectSet.has(lm[1])) {
        // 上一行已有点名且新行行首又是另一个批内点名 → 结算上一行、开新点名行
        out.push(cur);
        cur = { name: lm[1], note: lm[2] ? String(lm[2]).trim() : '', quote: '' };
        continue;
      }
    }
    if (cur) {
      const qm = /引用[：:]\s*(.+)/.exec(line);
      if (qm) cur.quote = qm[1].trim();
      else if (cur.note) cur.note += line;
      else cur.note = line;
    }
  }
  if (cur) out.push(cur);
  return out;
}

const normWs = (s) => String(s || '').replace(/\s+/g, '');

/** 引用可溯源校验：引句中任一 ≥8 字连续片段须出现在绑定段语料中（字面可溯，程序确定性）。 */
export function isQuoteTraceable(quote, corpus) {
  const q = normWs(quote);
  if (!q) return false;
  const n = 8;
  for (let i = 0; i + n <= q.length; i += 1) {
    const chunk = q.slice(i, i + n);
    if (corpus.some((t) => normWs(t).includes(chunk))) return true;
  }
  return false;
}

/**
 * 批摘要校验（助手帮编辑核对笔记出处与点名，不是验收）。
 * @param {Array<{name:string,note:string,quote:string}>} records
 * @param {object} p {expectedNames:string[], corpus:string[]}
 * @returns {{ok:boolean, missing:string[], extra:string[], empty:string[], unverifiable:Array<{name:string}>}}
 */
export function validateDigestRecords(records, { expectedNames, corpus }) {
  const expect = new Set(expectedNames || []);
  const seen = new Set();
  const missing = [];
  const extra = [];
  const empty = [];
  const unverifiable = [];
  for (const r of records || []) {
    const name = String(r.name || '').trim();
    if (!name) continue;
    if (!expect.has(name)) extra.push(name);
    else seen.add(name);
    if (!String(r.note || '').trim()) empty.push(name);
    if (r.quote && !isQuoteTraceable(r.quote, corpus || [])) unverifiable.push({ name });
  }
  for (const n of expect) if (!seen.has(n)) missing.push(n);
  return { ok: missing.length === 0 && extra.length === 0 && empty.length === 0 && unverifiable.length === 0, missing, extra, empty, unverifiable };
}

/**
 * 研读总账累积：把通过校验的各批记录并入总账（点名→理解/引用；供委托轮随附编辑自校用）。
 * @returns {Map<string,{note:string,quote:string}>}
 */
export function mergeLedger(ledger, records) {
  for (const r of records || []) {
    const name = String(r.name || '').trim();
    if (!name) continue;
    const note = String(r.note || '').trim();
    const quote = String(r.quote || '').trim();
    const prev = ledger.get(name);
    if (!prev) {
      ledger.set(name, { note, quote });
      continue;
    }
    // 同名多批（长锚按段切批等）：理解/引用合并保留，不覆盖前批（总账完整性）
    ledger.set(name, {
      note: [prev.note, note].filter(Boolean).join('；'),
      quote: [prev.quote, quote].filter(Boolean).join('；'),
    });
  }
  return ledger;
}

/** 总账文本化（小、随委托轮由编辑自校引用，不属于素材原文）。 */
export function ledgerToText(ledger) {
  const out = [];
  for (const [name, v] of ledger) {
    const note = v.note ? `：${v.note}` : '';
    const quote = v.quote ? `｜引用：${v.quote}` : '';
    out.push(`· ${name}${note}${quote}`);
  }
  return out.join('\n');
}
