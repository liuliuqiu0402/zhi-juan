// ==================== 整卷结构质量校验器（ExamPaperAuditor）====================
// 🔴 定位：生成后程序化质检层（所有资料类型 × 所有学科 × 所有学段通用）。
//    提示词规则（questionTypeRules/promptLibrary）约束 AI"应该怎么出题"，
//    本校验器兜底"AI 没做到时怎么办"——能自动修复的修复（fix），
//    不能修复的静默计数（guard，不产生任何问题提示）。
//    规则清单在 src/config/validatorRules.js（与指令库/蓝图库同级，分学科可维护），
//    本文件只负责规则的执行逻辑。
// ============================================================
import { getValidatorRules } from '../config/validatorRules.js';
import { getCarrierAllowlist, getMergedSpec, getAnswerRegion } from '../config/layoutSpec.js';
import { CARRIER_LABELS } from '../config/blueprintSchema.js';

// ---------- 通用正则 ----------
// 全角拼音字符归一表（IPA 音标字符混入小学拼音、全角字母）
const PINYIN_NORM_MAP = {
  '\u0261': 'g',  // ɡ (IPA 带钩 g) → g
  '\u014b': 'ng', // ŋ → ng
  '\u0251': 'a',  // ɑ → a
  '\u0259': 'e',  // ə → e
  '\u02d0': '',   // ː (长音符号) 移除
};
const PINYIN_NORM_RE = new RegExp(`[${Object.keys(PINYIN_NORM_MAP).join('')}]`, 'g');
const PINYIN_CHARS = 'a-zA-Z\u0101\u00e1\u01ce\u00e0\u014d\u00f3\u01d2\u00f2\u0113\u00e9\u011b\u00e8\u012b\u00ed\u01d0\u00ec\u016b\u00fa\u01d4\u00f9\u01d6\u01d8\u01da\u01dc\u00fc';
// 独立拼音组（连续拼音字母/声调字母，前后非字母）
const PINYIN_GROUP_RE = new RegExp(`(?<![${PINYIN_CHARS}])[${PINYIN_CHARS}]+(?![${PINYIN_CHARS}])`, 'g');
// 空位载体：span/u/div 的 blank-N 标签、以及全角空格括号（　）
const BLANK_TAG_RE = /<span[^>]*class=["'][^"']*blank-\d+[^"']*["'][^>]*>[\s\S]*?<\/span>|<u[^>]*class=["'][^"']*blank-\d+[^"']*["'][^>]*>[\s\S]*?<\/u>/gi;
const PAREN_BLANK_RE = /[（(]\s*[　\u3000 ]{1,12}\s*[)）]/g;
// 拼音选项括号（读音题）：（háng xíng）/（háng、xíng）——音节间以空格或顿号分隔
const PINYIN_OPTION_RE = new RegExp(`[（(]\\s*[${PINYIN_CHARS}]+(?:[／/、，, \\s]+[${PINYIN_CHARS}]+)+\\s*[)）]`, 'g');
// 选项行：<p class="option"> 或行首 "A. xxx"
const OPTION_P_RE = /<p[^>]*class=["'][^"']*option[^"']*["'][^>]*>/gi;
const OPTION_LINE_RE = /(?:^|\n)\s*[A-H][.、．]\s*[^\n]+/g;
// 连线结构
const MATCH_ITEM_RE = /class=["'][^"']*match-item[^"']*["']/g;
// 题组子题编号：（1）（2）或 1. 2.
const SUBQ_RE = /[(（]\s*\d+\s*[)）]/g;
// 书写格子 class → 中文标签（writing-grid-fix 越界剥离 / 载体×题型正规化共用；
// 中文标签唯一源 = 蓝图 Schema CARRIER_LABELS，此处只取校验器需要的 6 个格子键）
const GRID_CLASS_LABEL = {
  'tian-zi-ge': CARRIER_LABELS['tian-zi-ge'],
  'four-line-three': CARRIER_LABELS['four-line-three'],
  'sixian-ge': CARRIER_LABELS['sixian-ge'],
  'pinyin-line': CARRIER_LABELS['pinyin-line'],
  'square': CARRIER_LABELS['square'],
  'mi-zi-ge': CARRIER_LABELS['mi-zi-ge'],
};

// ---------- 工具 ----------
const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, '');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 归一拼音字符（ɡ→g、全角字母→半角等），返回 {text, fixed} */
export const normalizePinyinText = (text) => {
  if (!text) return { text: text || '', fixed: 0 };
  let out = String(text);
  let fixed = 0;
  out = out.replace(PINYIN_NORM_RE, (ch) => { fixed += 1; return PINYIN_NORM_MAP[ch]; });
  // 全角字母数字 → 半角
  const fw = out.replace(/[\uFF21-\uFF3A\uFF41-\uFF5A\uFF10-\uFF19]/g, (ch) => {
    fixed += 1;
    return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  });
  out = fw;
  return { text: out, fixed };
};

/** 统计一段 HTML 中的空位数（blank 标签 + 全角括号空位） */
export const countBlanks = (html) => {
  if (!html) return 0;
  const tagCount = (html.match(BLANK_TAG_RE) || []).length;
  const parenCount = (html.match(PAREN_BLANK_RE) || []).length;
  return tagCount + parenCount;
};

/** 统计一段 HTML 中的独立拼音组数 */
export const countPinyinGroups = (html) => {
  if (!html) return 0;
  const text = stripTags(html);
  return (text.match(PINYIN_GROUP_RE) || []).length;
};

/** 统计读音题拼音选项组数：（háng xíng）式括号 */
export const countPinyinOptions = (html) => {
  if (!html) return 0;
  const text = stripTags(html);
  return (text.match(PINYIN_OPTION_RE) || []).length;
};

/** 统计选择题选项数（option 标签 + 行首 A. 式） */
export const countOptions = (html) => {
  if (!html) return 0;
  let n = (html.match(OPTION_P_RE) || []).length;
  if (n === 0) {
    const text = stripTags(html);
    n = (text.match(OPTION_LINE_RE) || []).length;
  }
  return n;
};

/** 统计连线题两侧项数（match-item 总数/2，非整数说明结构不对称） */
export const countMatchSides = (html) => {
  if (!html) return null;
  const items = (html.match(MATCH_ITEM_RE) || []).length;
  if (items === 0) return null;
  return { total: items, left: items / 2 };
};

/** 统计纯文本连线行数（一行内出现 ≥2 个全角空格/tab 分隔的两列 → 计 1 条连线，AI 未按 match-item 结构输出时兜底） */
export const countMatchLines = (text) => {
  if (!text) return 0;
  let n = 0;
  for (const ln of String(text).split(/\n/)) {
    if (/[\u3000\t]{2,}/.test(ln)) n += 1;
  }
  return n;
};

/**
 * 用 DOM 把整卷 HTML 切成"大题块"列表
 * @returns {Array<{title:string, raw:string, score:number|null}>}
 */
export const splitSections = (html) => {
  const out = [];
  try {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    const heads = Array.from(tpl.content.querySelectorAll('h2, h3, h4'));
    heads.forEach((h, i) => {
      const title = (h.textContent || '').trim();
      if (!title) return;
      const scoreMatch = title.match(/[（(]\s*(\d{1,3})\s*分\s*[)）]/);
      let raw = '';
      let node = h.nextSibling;
      const end = heads[i + 1] || null;
      while (node && node !== end) {
        raw += node.outerHTML || node.textContent || '';
        node = node.nextSibling;
      }
      out.push({ title, raw, score: scoreMatch ? parseInt(scoreMatch[1], 10) : null });
    });
  } catch (e) {
    console.warn('⚠️ 整卷大题切分失败:', e.message);
  }
  return out;
};

/**
 * 修复大标题内"每X分"标注与载体数对齐：
 *   - 分值能整除空位/连线数 → 保留"每空X分"（换算正确）
 *   - 否则：能整除子题数 → 改"每题X分"；再不行 → 去掉"每空/每线X分"字样，仅保留"共X分"
 * @param {string} title 大题标题
 * @param {number} totalScore 大题分值
 * @param {number} carrierCount 载体数（空位或连线对）
 * @param {number} subCount 子题数
 */
export const fixScoreLabel = (title, totalScore, carrierCount, subCount) => {
  let out = title;
  const unitMatch = out.match(/[（(][^)）]*?(每空|每线|每题|每字|每词)\s*(\d{1,3})\s*分[^)）]*?[)）]/);
  if (!unitMatch) return out;
  const unit = unitMatch[1];
  const claimed = parseInt(unitMatch[2], 10);
  // 🔧 载体按单位类型对应（每空→填空数、每线→连线数、每题→小题数）：
  //    读音题"圈出读音"无填空载体，若标"每空"应修正为"每题"
  // "每题"优先采用标题自带的"共N题"（如"（共4题，每题8分，共32分）"）——
  // 它代表出题意图，countSubQuestions 可能因 DOM 结构漏数（如子题用（1）（2）编号），不能作为唯一依据
  let ok = false;
  if (unit === '每题') {
    const nInTitle = out.match(/共\s*(\d{1,3})\s*题/);
    const n = nInTitle ? parseInt(nInTitle[1], 10) : subCount;
    if (n > 0 && totalScore % n === 0) ok = totalScore / n === claimed;
  } else if (unit === '每线') {
    if (carrierCount > 0 && totalScore % carrierCount === 0) ok = totalScore / carrierCount === claimed;
  } else if (carrierCount > 0 && totalScore % carrierCount === 0) {
    ok = totalScore / carrierCount === claimed;
  }
  if (ok) return out;
  // 换算：单位与真实载体对应——括号空位一律用"空"（田字格=填空位，不是"字/词"）；
  //    连线载体用"线"；无载体/不整除 → 回退"共N题每题X分"；再不行只留总分
  let label = '';
  if (unit !== '每题' && carrierCount > 0 && totalScore % carrierCount === 0) {
    const isLine = unit === '每线';
    const unitLabel = isLine ? '线' : '空';
    label = `共${carrierCount}${isLine ? '处连线' : '空'}，每${unitLabel}${totalScore / carrierCount}分，共${totalScore}分`;
  } else if (subCount > 1 && totalScore % subCount === 0) {
    label = `共${subCount}题，每题${totalScore / subCount}分，共${totalScore}分`;
  } else {
    label = `共${totalScore}分`;
  }
  out = out.replace(/[（(][^）)]*?(每空|每线|每题|每字|每词)\s*\d{1,3}\s*分[^）)]*?[)）]/, `（${label}）`);
  return out;
};

/**
 * 主入口：整卷质量校验与修复（按 学段×学科×资料类型 三维度匹配规则库执行）
 * @param {string} html 整卷 HTML（含答案区）
 * @param {Object} opts { subject(学科), stage(学段键), genType(资料类型) }
 * @returns {{html: string, issues: Array, fixed: number, silent: number}}
 *   issues 仅含 fix 类的修复记录（info 级）；guard 类只计数进 silent（debug 日志，不产生问题提示）
 */
export const auditExamPaper = (html, { subject = '', stage = '', genType = '' } = {}) => {
  if (!html || typeof html !== 'string') return { html: html || '', issues: [], fixed: 0, silent: 0 };
  const rules = getValidatorRules({ subject, stage, genType });
    const has = (id) => rules.has(id);
    // 🔍 [answer-diag] 分段追踪：输入是否含答案区（定位"audit 丢答案区"根因用）
    const hadAnswerSection = /<div[^>]*class=["'][^"']*answer-section/i.test(String(html));
    let out = String(html);
  const issues = [];
  let fixed = 0;
  let silent = 0;
  const silentDetails = [];
  const silentCount = (type, msg) => { silent += 1; silentDetails.push({ type, message: msg }); console.debug(`🔍 [质检-${type}] ${msg}`); };

  // ── 0. 拼音字符归一（规则 pinyin-norm，全卷防 ɡ/ŋ/ɑ 混入）──
  if (has('pinyin-norm')) {
    const { text, fixed: f } = normalizePinyinText(out);
    if (f > 0) {
      fixed += f;
      out = text;
    }
  }

  // ── 1. 模板残留清理（规则 template-cleanup）──
  if (has('template-cleanup')) {
    // 1a. "【插图占位】…复制 PROMPT…"非标准块 → 整个移除（渲染链路只认 [IMAGE] 标准块）
    const phRe = /【\s*插图占位[\s\S]*?(?:复制\s*PROMPT|PROMPT)[\s\S]*?(?:插入此处|<\/div>|$)/gi;
    out = out.replace(phRe, (m) => {
      issues.push({ severity: 'info', type: 'image-placeholder', message: `已移除非标准插图占位符残留（${m.length} 字符）` });
      fixed += 1;
      return '';
    });
    // 1b. 被转义的 HTML 标签实体残留（\</div\>、\</p>、</div\> 等形式）——
    //    🔴 反斜杠必须出现才匹配，绝不可误删正常闭合标签（否则 DOM 结构被破坏）
    const escRe = /\\<\/(div|p|span|u|h1|h2|h3|section|br)\s*\\?>|<\/(div|p|span|u|h1|h2|h3|section|br)\s*\\>/gi;
    out = out.replace(escRe, (m, tag) => {
      const t = tag || m.match(/\/(\w+)/)?.[1] || 'tag';
      if (t === 'br') { fixed += 1; return '<br>'; }
      issues.push({ severity: 'info', type: 'escaped-html', message: `已移除被转义的闭合标签残留：${m.trim()}` });
      fixed += 1;
      return '';
    });
    // 1c. 空条款（"3．。"——只有编号没有内容，可能是 <p> 包裹或裸文本）
    const emptyItemRe = /(?:^|\n|>)\s*\d+\s*[.、．]\s*。\s*(?:<|\n|$)/g;
    out = out.replace(emptyItemRe, (m) => {
      issues.push({ severity: 'info', type: 'empty-item', message: `已移除空条款（仅有编号无内容）：${m.trim()}` });
      fixed += 1;
      return m.startsWith('>') ? '' : '\n';
    });
    // 1c-2. 整个 <p> 只有空条款 → 删除整段
    const emptyPRe = /<p[^>]*>\s*\d+\s*[.、．]\s*。\s*<\/p>/g;
    out = out.replace(emptyPRe, (m) => {
      issues.push({ severity: 'info', type: 'empty-item', message: `已移除空条款段落：${stripTags(m).trim()}` });
      fixed += 1;
      return '';
    });
  }

  // ── 1.5. [IMAGE] 配图块标准化（规则 image-block-fix：AI 常漏 NEGATIVE/WIDTH/HEIGHT、写成一行式、参数间混入 HTML）──
  if (has('image-block-fix')) {
    // 🔧 兼容 [IMAGE: 描述] 一行式（AI 常漏块结构）→ 先规范化为标准 [IMAGE] 块
    out = out.replace(/\[IMAGE\s*[:：]\s*([^\]]+)\]/gi, (m, desc) => `[IMAGE]\nTYPE:SD\nPROMPT:${desc.trim()}\nNEGATIVE:写实,照片,复杂背景,文字,水印\nWIDTH:800\nHEIGHT:600\nSTYLE:line_art\n[/IMAGE]`);
    const imageBlockRe = /\[IMAGE\]([\s\S]*?)(\[\/IMAGE\]|$)/gi;
    const stripHtmlIn = (s) => String(s || '')
      .replace(/&lt;\/?[a-zA-Z][^&]*&gt;|<\/?[a-zA-Z][^>]*>|\\?<\/?[a-zA-Z]\s*\\?>/g, '')
      .replace(/&(?:nbsp|ensp|emsp);/g, ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
    const normImage = out.replace(imageBlockRe, (m, body) => {
      // 按行解析，兼容行内多字段（"TYPE:SD STYLE:line_art"）——值在遇到下一个字段名时截断
      const fields = { TYPE: 'SD', PROMPT: '', NEGATIVE: '写实,照片,复杂背景,文字,水印', WIDTH: '800', HEIGHT: '600', STYLE: 'line_art' };
      const KEY_RE = /(TYPE|PROMPT|NEGATIVE|WIDTH|HEIGHT|STYLE|描述)\s*[：:]\s*((?:(?!\b(?:TYPE|PROMPT|NEGATIVE|WIDTH|HEIGHT|STYLE|描述)\s*[：:])[^\n])*)/gi;
      let mm;
      while ((mm = KEY_RE.exec(body)) !== null) {
        const key = mm[1].toUpperCase() === '描述' ? 'PROMPT' : mm[1].toUpperCase();
        // 字段值统一清理 HTML 残留（AI 常在参数行间混入 </p><p></p>）与多余空白
        const cleanVal = stripHtmlIn(mm[2]);
        if (key === 'PROMPT' && fields.PROMPT) {
          fields.PROMPT += mm[2]; // 多段 PROMPT 先拼接，最后统一清理
        } else {
          fields[key] = cleanVal;
        }
      }
      const prompt = stripHtmlIn(fields.PROMPT) || '（画面描述缺失）';
      const norm = `[IMAGE]\nTYPE:${fields.TYPE || 'SD'}\nPROMPT:${prompt}\nNEGATIVE:${fields.NEGATIVE}\nWIDTH:${fields.WIDTH}\nHEIGHT:${fields.HEIGHT}\nSTYLE:${fields.STYLE}\n[/IMAGE]`;
      if (norm !== m) {
        issues.push({ severity: 'info', type: 'image-block', message: '已规范 [IMAGE] 配图块为标准 EduRender 格式（补齐参数/统一分行/清理残留）' });
        fixed += 1;
      }
      return norm;
    });
    out = normImage;
  }

  // ── 1.5.2. 正文重复内容检测截断（规则 duplicate-content-fix：截断续写时模型从头重出整卷）──
  if (has('duplicate-content-fix')) {
    // 1) 正文区重复大题标题（同一标题第二次出现 → 保留第一份）
    const bodyPart = out.split(/<div[^>]*class=["'][^"']*answer-section/i)[0];
    const ansPart = out.slice(bodyPart.length);
    const headRe = /<h[234][^>]*>([^<]*)<\/h[234]>/g;
    const heads = [];
    let hm;
    while ((hm = headRe.exec(bodyPart)) !== null) {
      const t = (hm[1] || '').trim();
      if (/^[一二三四五六七八九十]+、/.test(t)) heads.push({ text: t, index: hm.index });
    }
    let dupIndex = -1;
    const seenTitles = new Set();
    for (const h of heads) {
      if (seenTitles.has(h.text)) { dupIndex = h.index; break; }
      seenTitles.add(h.text);
    }
    if (dupIndex > 0) {
      issues.push({ severity: 'info', type: 'duplicate-content', message: '检测到正文重复（同一大题标题出现 ≥2 次，疑截断续写重出），已截断保留第一份' });
      fixed += 1;
      out = bodyPart.slice(0, dupIndex) + ansPart;
    }
    // 2) 重复答案区（once 模式正文含两份答案 → 保留第一份）
    const ansBlocks = out.match(/<div[^>]*class=["'][^"']*answer-section[^"']*["'][^>]*>/g) || [];
    if (ansBlocks.length > 1) {
      const first = out.indexOf(ansBlocks[0]);
      const second = out.indexOf(ansBlocks[1], first + ansBlocks[0].length);
      out = out.slice(0, second);
      issues.push({ severity: 'info', type: 'duplicate-content', message: '检测到重复答案区，已截断保留第一份' });
      fixed += 1;
    }
  }

  // ── 1.5.5. 连线题右列格式规范化（规则 match-format-fix：右列裸序号＋内容下方对照行 → 合并并排）──
  if (has('match-format-fix')) {
    const NUM = '①②③④⑤⑥⑦⑧⑨⑩'; // 注意：不含方括号，拼字符类时再包
    const strip = (s) => s.replace(/<[^>]+>/g, '');
    const lines = out.split('\n');
    // 裸序号行：左列汉字 + 全角空格 + 行尾单个序号（"园　　②"，兼容 <p> 包裹）
    const bareRe = new RegExp(`^([\\s\\S]{1,30}?)[\\s　]+([${NUM}])$`);
    // 对照行解析：可含多对"序号 内容"（"① 树林　　② 花"）
    const parseMapRow = (t) => {
      const o = {};
      const re = new RegExp(`([${NUM}])\\s*([^\\n${NUM}]{1,40}?)(?=[${NUM}]|$)`, 'g');
      let m;
      while ((m = re.exec(t)) !== null) o[m[1]] = m[2].trim();
      return o;
    };
    const bareRows = [];
    lines.forEach((ln, i) => {
      const t = strip(ln).trim();
      const m = bareRe.exec(t);
      if (m && /[\u4e00-\u9fa5]/.test(m[1])) bareRows.push({ idx: i, num: m[2], left: m[1].trim(), raw: ln });
    });
    if (bareRows.length >= 2) {
      // 收集所有对照行（跨行合并）
      const lookup = {};
      lines.forEach(ln => {
        const t = strip(ln).trim();
        if (bareRe.test(t)) return;
        Object.assign(lookup, parseMapRow(t));
      });
      const mapped = bareRows.filter(r => lookup[r.num]);
      // 至少一半裸序号行有对应内容、且 ≥2 项才重组（防误伤无对照行的连线题）
      if (mapped.length >= Math.max(2, Math.ceil(bareRows.length * 0.5))) {
        const mappedNums = new Set(mapped.map(r => r.num));
        const newLines = lines.map((ln, i) => {
          const row = bareRows.find(r => r.idx === i);
          if (row && lookup[row.num]) {
            const escLeft = row.left.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(`(${escLeft})[\\s　]+(${row.num})`);
            return ln.replace(re, `$1　　　　${row.num}${lookup[row.num]}`);
          }
          const t = strip(ln).trim();
          const cm = parseMapRow(t);
          if (Object.keys(cm).some(k => mappedNums.has(k))) return null; // 删除已被回填到行尾的对照行
          return ln;
        }).filter(x => x !== null);
        const merged = newLines.join('\n');
        if (merged !== out) {
          issues.push({ severity: 'info', type: 'match-format', message: `已重组连线题格式：右列序号与内容合并并排（${mapped.length} 项），删除下方对照行` });
          fixed += 1;
          out = merged;
        }
      }
    }
  }

  // ── 1.5.5b. 连线题两列文本 → 左右分栏结构（规则 match-format-fix 配套：
  //     AI 只输出"左　　右"文本行（纯内容、无序号），代码组装为 match-question 结构，
  //     docxBuilder 才能渲染成可连线的左右方框布局；右列带序号的行由 1.5.5 处理，不重复组装）──
  if (has('match-format-fix')) {
    try {
      const isTwoColLine = (t) => {
        if (!t || t.length > 80) return false;
        const m = t.match(/^(.{1,20}?)\s{2,}(.{1,20})$/);
        if (!m) return false;
        const left = m[1].trim();
        const right = m[2].trim();
        if (!left || !right) return false;
        if (/[（(]\s{1,12}[)）]/.test(t)) return false; // 括号作答空（空格在括号内）不是两列分隔
        if (/[：:＿【】]/.test(t) || /分/.test(left) || /分/.test(right)) return false;
        if (/[①②③④⑤⑥⑦⑧⑨⑩]/.test(right)) return false; // 右列带序号 → 留给 1.5.5 裸序号重组
        return true;
      };
      const tpl = document.createElement('template');
      tpl.innerHTML = out;
      const ps = Array.from(tpl.content.querySelectorAll('p'));
      let i = 0;
      while (i < ps.length) {
        const text = (ps[i].textContent || '').trim();
        if (isTwoColLine(text)) {
          const group = [ps[i]];
          let j = i + 1;
          while (j < ps.length && isTwoColLine((ps[j].textContent || '').trim())) {
            group.push(ps[j]);
            j += 1;
          }
          if (group.length >= 2) {
            const leftItems = [];
            const rightItems = [];
            for (const g of group) {
              const m = (g.textContent || '').trim().match(/^(.{1,20}?)\s{2,}(.{1,20})$/);
              leftItems.push(m[1].trim());
              rightItems.push(m[2].trim());
            }
            const div = document.createElement('div');
            div.className = 'match-question';
            const colL = document.createElement('div');
            colL.className = 'match-col';
            const colR = document.createElement('div');
            colR.className = 'match-col';
            // 🔧 右列由代码乱序（Fisher-Yates）：AI 只需保证"左——右"配对正确，
            //    乱序交给代码 → 杜绝"AI 自行乱序导致错配"与"逐行并排暴露答案"两类历史问题
            const rightItemsShuffled = rightItems.slice();
            for (let s = rightItemsShuffled.length - 1; s > 0; s--) {
              const r = Math.floor(Math.random() * (s + 1));
              [rightItemsShuffled[s], rightItemsShuffled[r]] = [rightItemsShuffled[r], rightItemsShuffled[s]];
            }
            group.forEach((_, idx) => {
              const li = document.createElement('div');
              li.className = 'match-item';
              li.textContent = leftItems[idx];
              const ri = document.createElement('div');
              ri.className = 'match-item';
              ri.textContent = rightItemsShuffled[idx];
              colL.appendChild(li);
              colR.appendChild(ri);
            });
            div.appendChild(colL);
            div.appendChild(colR);
            const parent = group[0].parentNode;
            const ref = group[group.length - 1].nextSibling;
            for (const g of group) parent.removeChild(g);
            parent.insertBefore(div, ref);
            issues.push({ severity: 'info', type: 'match-structure', message: `连线题已组装为左右分栏结构（${group.length} 项配对）` });
            fixed += 1;
            i = j;
            continue;
          }
        }
        i += 1;
      }
      out = tpl.innerHTML;
    } catch (e) {
      console.warn('⚠️ 连线题结构组装失败（不影响其他修复）:', e.message);
    }
  }

  // ── 1.5.6. 排版语义标记自洽检测（规则 text-format-fix：题干要求加点/画线但正文无对应标记 → 静默计数）──
  if (has('text-format-fix')) {
    const bodyText = out.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
    // 加点=emphasis-dot、画线=underline-sentence（加点严禁用 <u>，<u> 仅用于填空横线）
    const markCount = (out.match(/<span[^>]*class=["'][^"']*emphasis-dot[^"']*["'][^>]*>|<u[^>]*class=["'][^"']*underline-sentence[^"']*["'][^>]*>/gi) || []).length;
    const claims = bodyText.match(/(圈出加点字|给加点字|加点字|画线(?:的)?(?:词语|句子|部分)|划(?:出|一划)|描出|用.{0,3}线(?:画出|划出))/g) || [];
    if (claims.length > 0 && markCount === 0) {
      silentCount('text-format', `题干要求加点/画线（${claims[0]}）但正文无对应标记（emphasis-dot/underline-sentence）——题目不自洽，请抽检`);
    }
    // 🔧 加点字兜底：题干含"加点"时，AI 用无 class 的 <u>汉字</u>（下划线=错误表示）→ 自动转为 emphasis-dot 加点标记
    //    （填空横线 <u>＿＿＿</u> 内容为下划线字符非汉字、带 class 的 <u> 均不受影响）
    if (/加点/.test(bodyText)) {
      const beforeDot = out;
      out = out.replace(/<u>([\u4e00-\u9fa5]{1,6})<\/u>/g, '<span class="emphasis-dot">$1</span>');
      if (out !== beforeDot) {
        issues.push({ severity: 'info', type: 'emphasis-dot', message: '加点字已由 <u> 下划线自动转为 emphasis-dot 加点标记' });
        fixed += 1;
      }
    }
  }

  // ── 1.5.7b. 教辅内容充足性（规则 teaching-volume-guard：静默）──
  if (has('teaching-volume-guard') && genType && genType !== 'exam') {
    const bodyText = out.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&emsp;/g, ' ');
    const pureLen = bodyText.replace(/\s+/g, '').length;
    const GT_CHECKS = {
      reading: { re: /短文|阅读|选文/, label: '选文（短文）', minLen: 80 },
      summary: { re: null, label: '正文篇幅', minLen: 200 },
    };
    const c = GT_CHECKS[genType];
    if (c) {
      if (c.re && !c.re.test(bodyText)) silentCount('teaching-volume', `「${genType}」缺少${c.label}——内容可能单薄，请抽检`);
      if (c.minLen && pureLen < c.minLen) silentCount('teaching-volume', `「${genType}」正文过短（${pureLen}字），内容单薄，请抽检`);
    }
    // 题集类题量兜底（题量底线由教辅结构蓝本注入，此处仅静默计数防单薄）
    if (['practice', 'special', 'review', 'dictation'].includes(genType)) {
      const qCount = (bodyText.match(/\d+[.、．]/g) || []).length;
      if (qCount > 0 && qCount < 5) silentCount('teaching-volume', `「${genType}」题目数仅 ${qCount} 道，疑单薄，请抽检`);
    }
  }

  // ── 1.5.8. 书写格按学段（规则 writing-grid-fix：
  //    按 学科×学段 允许载体列表检查全卷载体是否越界——不在允许列表的格子 class 自动剥离保留文字
  //    （如中段以上卷冒出的田字格/四线三格、非语英学科混入的格子），数据源=排版规格库 WRITING_CARRIER；
  //    未显式定义学科的卷不检测；越界剥离是确定性操作，安全可修复）──
  if (has('writing-grid-fix')) {
    const allowed = getCarrierAllowlist(subject, stage);
    if (allowed) {
      const defaultLabel = allowed.includes('line') ? '横线' : (allowed.join('或') || '正常书写');
      const stripList = Object.keys(GRID_CLASS_LABEL).filter(cls => !allowed.includes(cls));
      if (stripList.length) {
        try {
          const tpl = document.createElement('template');
          tpl.innerHTML = out;
          const exactCls = (el, cls) => new RegExp(`(^|\\s)${cls}(?=\\s|$)`).test(el.className || '');
          let stripped = 0;
          const strippedLabels = new Set();
          for (const cls of stripList) {
            for (const el of tpl.content.querySelectorAll(`[class*="${cls}"]`)) {
              if (!exactCls(el, cls)) continue;
              el.className = (el.className || '').replace(new RegExp(`(^|\\s)${cls}(?=\\s|$)`), ' ').replace(/\s+/g, ' ').trim();
              if (!el.className) el.removeAttribute('class');
              stripped += 1;
              strippedLabels.add(GRID_CLASS_LABEL[cls]);
            }
          }
          if (stripped > 0) {
            out = tpl.innerHTML;
            issues.push({
              severity: 'info', type: 'writing-grid',
              message: `已自动剥离 ${stripped} 处${[...strippedLabels].join('、')}（「${subject}」该学段不应使用——保留文字，卷面已规范为${defaultLabel}）`,
            });
            fixed += stripped;
          }
        } catch (e) {
          console.warn('⚠️ 书写格越界剥离失败（不影响其他修复）:', e.message);
        }
      }
    }
  }

  // ── 1.6. 大题标题明细式（规则 title-detail-fix：旧式"（X分）"→"共N题，每题X分，共X分"）──
  if (has('title-detail-fix')) {
    try {
      const tpl = document.createElement('template');
      tpl.innerHTML = out;
      const heads = Array.from(tpl.content.querySelectorAll('h2, h3, h4'));
      heads.forEach((h, i) => {
        const t = (h.textContent || '').trim();
        if (!/^[一二三四五六七八九十]+、/.test(t) || !/[（(]\s*\d{1,3}\s*分\s*[)）]\s*$/.test(t) || /共\s*\d+\s*题/.test(t)) return;
        const scoreMatch = t.match(/[（(]\s*(\d{1,3})\s*分\s*[)）]\s*$/);
        if (!scoreMatch) return;
        const totalScore = parseInt(scoreMatch[1], 10);
        let count = 0;
        let node = h.nextSibling;
        const end = heads[i + 1] || null;
        while (node && node !== end) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = node.tagName.toLowerCase();
            if (tag === 'p' || tag === 'li' || tag === 'div') {
              const tt = (node.textContent || '').trim();
              if (/^\d+[.、．]/.test(tt)) count += 1;
            }
          }
          node = node.nextSibling;
        }
        if (count <= 0) return;
        const perScore = count > 1 && totalScore % count === 0 ? totalScore / count : null;
        const detail = perScore != null ? `共${count}题，每题${perScore}分，共${totalScore}分` : `共${count}题，共${totalScore}分`;
        const newT = t.replace(/[（(]\s*\d{1,3}\s*分\s*[)）]\s*$/, `（${detail}）`);
        if (newT !== t) {
          h.textContent = newT;
          issues.push({ severity: 'info', type: 'title-detail', message: `大题标题已补全明细式：${newT}` });
          fixed += 1;
        }
      });
      out = tpl.innerHTML;
    } catch (e) {
      console.warn('⚠️ 大题标题明细化失败（不影响其他修复）:', e.message);
    }
  }

  // ── 2. 大题级：分值账目 + 载体结构校验（DOM 内直接操作，避免字符串与 DOM 序列化差异）──
  {
    let tpl = null;
    try {
      tpl = document.createElement('template');
      tpl.innerHTML = out;
      const heads = Array.from(tpl.content.querySelectorAll('h2, h3, h4'));
      heads.forEach((head, i) => {
        const title = (head.textContent || '').trim();
        if (!title) return;
        // 兼容明细式（"共X分"）与旧式（"（X分）"）两种标题取总分（title-detail-fix 可能已改写标题）
        const cm = title.match(/共\s*(\d{1,3})\s*分/);
        const sm = title.match(/[（(]\s*(\d{1,3})\s*分/);
        const scoreMatch = cm || sm;
        if (!scoreMatch) return;
        const totalScore = parseInt(scoreMatch[1], 10);
        // 收集本大题 DOM 节点（下一个大题标题之前）
        const secNodes = [];
        let node = head.nextSibling;
        const end = heads[i + 1] || null;
        while (node && node !== end) {
          secNodes.push(node);
          node = node.nextSibling;
        }
        let secHtml = '';
        for (const n of secNodes) secHtml += n.outerHTML || n.textContent || '';
        if (!secHtml) return;

        // 2a 前的初始载体（仅用于触发拼音空位对齐判断；2a 删/补空位后由下方重算覆盖）
        const pinyinGroups = countPinyinGroups(secHtml);
        const blanksBefore = countBlanks(secHtml);

        // 2a. 看拼音写词语/拼音填空空位对齐（规则 pinyin-blank-fill：缺空自动补、多余自动删）
        if (has('pinyin-blank-fill') && pinyinGroups >= 2 && blanksBefore >= 1 && pinyinGroups !== blanksBefore) {
          if (pinyinGroups > blanksBefore) {
            const missing = pinyinGroups - blanksBefore;
            const { recovered } = fixMissingPinyinBlanksInDom(secNodes, missing);
            issues.push({
              severity: 'info',
              type: 'pinyin-blank-mismatch',
              message: `已自动补 ${missing} 个拼音空位（大题「${title}」拼音${pinyinGroups}组/空位${blanksBefore}个）${recovered ? '' : '，部分补全失败请抽检'}`,
            });
            fixed += 1;
          } else {
            // 🔧 空位数多于拼音组数（如"拼音2字却给4个田字格"）→ 自动删除多余空位
            const excess = blanksBefore - pinyinGroups;
            const { removed } = fixExcessPinyinBlanksInDom(secNodes, excess);
            issues.push({
              severity: 'info',
              type: 'pinyin-blank-mismatch',
              message: `已删除 ${excess} 个多余拼音空位（大题「${title}」拼音${pinyinGroups}组/空位${blanksBefore}个）${removed ? '' : '，部分删除失败请抽检'}`,
            });
            fixed += 1;
          }
        }

        // 🔧 2a 后：重算序列化与载体（反映 2a 对空位的删/补，后续 2b~2h 均以修正后的 DOM 为准，
        //    避免"分值换算"仍按删除前的旧空位数校验）
        let secHtml2 = '';
        for (const n of secNodes) secHtml2 += n.outerHTML || n.textContent || '';
        const secText2 = secNodes.map(n => n.textContent || '').join('');
        const blanks = countBlanks(secHtml2);
        const pinyinOpts = countPinyinOptions(secHtml2);
        const options = countOptions(secHtml2);
        const matchSides = countMatchSides(secHtml2);

        // 2d. 连线项不对称（规则 match-symmetric-guard：静默）
        if (has('match-symmetric-guard') && matchSides && matchSides.total % 2 !== 0) {
          silentCount('match-asymmetric', `大题「${title}」连线题左右项数不对称（共 ${matchSides.total} 项）`);
        }

        // 2e. 选择题选项过少（规则 option-count-guard：静默）
        if (has('option-count-guard') && /选一选|选择|选出/.test(secText2.slice(0, 400)) && options > 0 && options < 2) {
          silentCount('option-missing', `大题「${title}」选项数过少(${options})`);
        }

        // 2e2. 分值自动分配（规则 score-distribute-fix，per-section：只处理当前大题）
        //    大题内小题分值之和≠大题分时，按各小题单位数从大题总分重算单位分值并重写小题标题——
        //    分值账目是确定性算法，不依赖 AI 算术。⚠️ 必须在 score-label-fix（2f）之前执行：
        //    2f 会把"每题X分，共X分"等标题改写为"（共X分）"，丢失单位数信息导致解析错乱；
        //    且只能 DOM 操作（p.textContent），不得序列化 out——外层 heads.forEach 结束后统一 out = tpl.innerHTML。
        if (has('score-distribute-fix')) {
          try {
            // 🔧 仅对带卷首满分标记的完整卷执行（裁剪/片段输入不重分配，防误伤——与 score-sum 同一门槛）
            const headText = out.slice(0, 400).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
            if (/满分[:：]?\s*\d+(?:\.\d+)?\s*分/.test(headText)) {
              const granularity = /^primary/.test(stage) ? 1 : 0.5; // 小学整数分、初高中 0.5 粒度
              const parseUnitCount = (t) => {
                const cm = t.match(/共\s*(\d{1,3})\s*(?:题|空|线|字|词)/);
                if (cm) return parseInt(cm[1], 10);
                const pm = t.match(/每(?:题|空|线|字|词)\s*(\d+(?:\.\d+)?)\s*分[^）)]*?共\s*(\d{1,3}(?:\.\d+)?)\s*分/);
                if (pm && parseFloat(pm[1]) > 0) return Math.round(parseFloat(pm[2]) / parseFloat(pm[1]));
                return null; // 标题未写明单位数 → 调用方用子题数兜底（如"（共4分）"但有 (1)-(4) 子题）
              };
              const parseUnitName = (t) => {
                const um = t.match(/每(题|空|线|字|词)\s*\d+(?:\.\d+)?\s*分/);
                return um ? um[1] : '题';
              };
              const secScoreM = head.textContent.match(/共\s*(\d{1,3})\s*分/) || head.textContent.match(/[（(]\s*(\d{1,3})\s*分\s*[)）]/);
              const secScore = secScoreM ? parseFloat(secScoreM[1]) : null;
              if (secScore == null) return;
              const subHeadPs = secNodes.filter(n => n.nodeType === Node.ELEMENT_NODE && n.tagName.toLowerCase() === 'p'
                && /^\s*\d+[.、．]/.test((n.textContent || '').trim())
                && /[（(][^）)]*?\d+(?:\.\d+)?\s*分/.test(n.textContent || ''));
              if (subHeadPs.length < 2) return; // 至少 2 个小题才重分配（单题大题可能是阅读/写作整题）
              // 当前小题分值之和（"共X分"总分优先）
              let subSum = 0;
              for (const p of subHeadPs) {
                const t2 = (p.textContent || '').trim();
                const totalM = t2.match(/共\s*(\d+(?:\.\d+)?)\s*分/);
                const singleM = t2.match(/[（(][^）)]*?(\d+(?:\.\d+)?)\s*分[^）)]*?[)）]/);
                subSum += parseFloat((totalM || singleM)[1]);
              }
              if (Math.abs(subSum - secScore) <= 0.01) return; // 账目已闭合，不动
              // 触发重分配：单位分 = 大题分 ÷ 总单位数（粒度向下），余数从第一题起逐单位补差
              // 单位数：标题明确（共N题/空/线）优先；无则数该小题的子题行（(1)(2)...）兜底
              const unitCounts = [];
              for (let si = 0; si < subHeadPs.length; si++) {
                const p = subHeadPs[si];
                const endP = subHeadPs[si + 1] || null;
                let sub = 0;
                let sn = p.nextSibling;
                while (sn && sn !== endP) {
                  if (sn.nodeType === Node.ELEMENT_NODE && sn.tagName.toLowerCase() === 'p') {
                    // 🔧 数行内所有子题号（(1)(2)(3)(4) 可同一行，如"（1）一坐石桥（2）一群飞鸟…"）
                    sub += (sn.textContent.match(/[（(]\d+[)）]/g) || []).length;
                  }
                  sn = sn.nextSibling;
                }
                unitCounts.push(parseUnitCount(p.textContent || '') ?? Math.max(sub, 1));
              }
              const U = unitCounts.reduce((s, c) => s + c, 0);
              if (U === 0) return;
              const uRaw = secScore / U;
              const uBase = Math.floor(uRaw / granularity) * granularity;
              let bonusUnits = Math.round((secScore - uBase * U) / granularity);
              let redistributed = 0;
              for (let si = 0; si < subHeadPs.length; si++) {
                const p = subHeadPs[si];
                const t2 = (p.textContent || '').trim();
                const c = unitCounts[si];
                const take = Math.min(bonusUnits, c);
                const unitScore = uBase + (take > 0 ? granularity : 0);
                bonusUnits -= take;
                const totalScore = unitScore * c;
                const unit = parseUnitName(t2);
                const newT2 = t2.replace(/[（(][^）)]*[)）]\s*$/, `（每${unit}${unitScore}分，共${totalScore}分）`);
                if (newT2 !== t2) { p.textContent = newT2; redistributed += 1; }
              }
              if (redistributed > 0) {
                issues.push({ severity: 'info', type: 'score-distribute', message: `分值已自动重分配（大题「${(head.textContent || '').slice(0, 16)}」${redistributed} 处小题标题按大题总分重算，账目闭合）` });
                fixed += 1;
              }
            }
          } catch (e) {
            console.warn('⚠️ 分值自动分配失败（不影响其他修复）:', e.message);
          }
        }

        // 2f. 分值标注修正（规则 score-label-fix：每空/每线/每题分标注与载体数对齐）
        if (has('score-label-fix')) {
          // 🔧 载体只取真实载体（填空数/连线数）——拼音选项（读音题括号）不是"空位"，不能当载体验证"每空X分"
          const carrierTotal = blanks || (matchSides ? matchSides.left : 0) || (/连/.test(title) ? countMatchLines(secText2) : 0);
          const newTitle = fixScoreLabel(title, totalScore, carrierTotal, countSubQuestions(secText2));
          if (newTitle !== title) {
            head.textContent = newTitle;
            issues.push({ severity: 'info', type: 'score-label', message: `分值标注已对齐：${newTitle}` });
            fixed += 1;
          }
        }

        // 2g. 小题标题分值标注校验（规则 score-label-fix，p 级标题）
        if (has('score-label-fix')) {
          const subHeadPs = secNodes.filter(n => n.nodeType === Node.ELEMENT_NODE && n.tagName.toLowerCase() === 'p');
          const subTitles = [];
          for (const p of subHeadPs) {
            const t = (p.textContent || '').trim();
            if (!/^\s*(?:\d+[.、．]|[(（]\d+[)）])/.test(t)) continue;
            // 🔧 括号内任意位置含分值即视为标题（兼容"（共12分）""（每空1分，共6分）"等写法）
            if (!/[（(][^）)]*?\d{1,3}\s*分/.test(t)) continue;
            subTitles.push({ p, text: t });
          }
          subTitles.forEach((st, i) => {
            const nodesBetween = [];
            let n = st.p.nextSibling;
            const endNode = subTitles[i + 1] ? subTitles[i + 1].p : null;
            while (n && n !== endNode) { nodesBetween.push(n); n = n.nextSibling; }
            let segHtml = st.p.outerHTML;
            for (const nb of nodesBetween) segHtml += nb.outerHTML || nb.textContent || '';
            const segText = st.text + nodesBetween.map(x => x.textContent || '').join('');
            const sBlanks = countBlanks(segHtml);
            const sMatch = countMatchSides(segHtml);
            // 🔧 载体只取真实填空载体——拼音选项（读音题括号）不是"空位"，
            //    "每空X分"不得用拼音选项组数验证（否则读音题"每空1分"被误判合法）
            const carrier = sBlanks || (sMatch ? sMatch.left : 0) || (/连/.test(st.text) ? countMatchLines(segText) : 0);
            const cm2 = st.text.match(/共\s*(\d{1,3})\s*分/);
            const sm2 = st.text.match(/[（(]\s*(\d{1,3})\s*分/);
            const scoreM = cm2 || sm2;
            if (!scoreM) return;
            const sScore = parseInt(scoreM[1], 10);
            // 🔧 无填空载体时也继续校验（如读音题"每空1分"→ 由 fixScoreLabel 按子题数改"每题X分"）
            const newT = fixScoreLabel(st.text, sScore, carrier, countSubNumbered(segText));
            if (newT !== st.text) {
              st.p.textContent = newT;
              issues.push({ severity: 'info', type: 'score-label', message: `小题分值标注已对齐：${newT}` });
              fixed += 1;
            }
          });
        }

        // 2h. 大题标题"每题X分"与实际各题分值一致性（规则 score-label-fix）：
        //     标题"每题8分"但各题实际 12/6/8/6 分不一致 → 改为"共N题，共X分"
        if (has('score-label-fix') && /每题\s*\d{1,3}\s*分/.test(head.textContent || '')) {
          const subHeadPs = secNodes.filter(n => n.nodeType === Node.ELEMENT_NODE && n.tagName.toLowerCase() === 'p');
          const scores = [];
          for (const p of subHeadPs) {
            const t = (p.textContent || '').trim();
            if (!/^\s*\d+[.、．]/.test(t)) continue;
            // 🔧 括号内任意位置取分值（兼容"（共12分）"写法）
            const sm = t.match(/[（(][^）)]*?(\d{1,3})\s*分/);
            if (sm) scores.push(parseInt(sm[1], 10));
          }
          const uniq = new Set(scores);
          if (scores.length >= 2 && uniq.size >= 2) {
            const subCount = countSubQuestions(secText2);
            const newT = head.textContent.replace(
              /[（(][^）)]*?每题\s*\d{1,3}\s*分[^）)]*?[)）]/,
              `（共${subCount}题，共${totalScore}分）`
            );
            if (newT !== head.textContent) {
              head.textContent = newT;
              issues.push({ severity: 'info', type: 'score-label', message: `大题各题分值不一致，标题已改为"共N题共X分"：${newT}` });
              fixed += 1;
            }
          }
        }
      });
      out = tpl.innerHTML;
    } catch (e) {
      console.warn('⚠️ 大题级质检失败（不影响其他修复）:', e.message);
    }
  }

  // ── 2i. 分值账目总和（规则 score-sum-guard：大题内小题分值之和=大题分、全卷各大题之和=满分 → 静默计数）──
  if (has('score-sum-guard')) {
    try {
      const headText = out.slice(0, 400).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
      const fm = headText.match(/满分[:：]?\s*(\d+(?:\.\d+)?)\s*分/);
      const fullScore = fm ? parseFloat(fm[1]) : null;
      // 仅对带卷首满分标记的完整卷做账目校验（裁剪/片段输入不校验，防误报）
      if (fullScore != null) {
        const tpl = document.createElement('template');
        tpl.innerHTML = out;
        const heads = Array.from(tpl.content.querySelectorAll('h2, h3, h4'));
        let sectionTotal = 0;
        let sectionCount = 0;
        heads.forEach((h, i) => {
          const title = (h.textContent || '').trim();
          const cm = title.match(/共\s*(\d{1,3})\s*分/);
          const sm = title.match(/[（(]\s*(\d{1,3})\s*分/);
          const isDetail = !!cm; // 仅明细式"共X题，共X分"标题做小题和校验（短式标题信息不全，跳过防误报）
          const secScore = cm ? parseFloat(cm[1]) : sm ? parseFloat(sm[1]) : null;
          if (secScore == null) return;
          sectionTotal += secScore;
          sectionCount += 1;
          // 大题内小题分值（题号行"（X分）"式）
          let node = h.nextSibling;
          const end = heads[i + 1] || null;
          let subSum = 0;
          let subCount = 0;
          while (node && node !== end) {
            if (node.nodeType === Node.ELEMENT_NODE && node.tagName.toLowerCase() === 'p') {
              const t2 = (node.textContent || '').trim();
              if (/^\s*\d+[.、．]/.test(t2)) {
                // 🔧 小题分值优先取"共X分"总分（如"（共4题，每题2分，共8分）"→8，而非"每题2分"的2）；
                //    无"共X分"时再取括号内单值（"（共4分）"→4）——此前误取"每X分"导致账目校验严重低估
                const totalM = t2.match(/共\s*(\d+(?:\.\d+)?)\s*分/);
                const singleM = t2.match(/[（(][^）)]*?(\d+(?:\.\d+)?)\s*分[^）)]*?[)）]/);
                const pm = totalM || singleM;
                if (pm) { subSum += parseFloat(pm[1]); subCount += 1; }
              }
            }
            node = node.nextSibling;
          }
          if (isDetail && subCount > 0 && Math.abs(subSum - secScore) > 0.01) {
            silentCount('score-sum', `大题「${title.slice(0, 22)}」小题分值之和(${subSum})≠大题分(${secScore})`);
          }
        });
        if (sectionCount > 1 && Math.abs(sectionTotal - fullScore) > 0.01) {
          silentCount('score-sum', `全卷大题分值之和(${sectionTotal})≠满分(${fullScore})`);
        }
      }
    } catch (e) {
      console.warn('⚠️ 分值账目总和检查失败（不影响其他修复）:', e.message);
    }
  }

  // ── 2j. 质量兜底检测（低段0.5分 / 连一连空壳 / 看图缺图 / 田字格载体 / 作文格，均静默计数）──
  {
    const bodyText = out.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&emsp;/g, ' ');
    // 2j-1 低段 0.5 分（规则 low-score-guard：小学卷一律整数分）
    if (has('low-score-guard')) {
      const dm = out.match(/[（(][^）)]*?(\d+\.\d+)\s*分/);
      if (dm) silentCount('low-score', `小学卷出现小数分值（${dm[1]}分）——小学一律整数分，请抽检`);
    }
    // 2j-2 连一连空壳（规则 match-format-fix：有"连一连"题干但无配对内容）
    if (has('match-format-fix') && /连一连|连起来/.test(bodyText)) {
      const twoCol = (out.match(/[\u4e00-\u9fa5]{1,20}\u3000{2,}\S{1,20}/g) || []).length;
      if (!/match-question/.test(out) && twoCol === 0) {
        silentCount('match-empty', '检测到"连一连"题干但无配对内容（连一连题疑似空壳），请抽检');
      }
    }
    // 2j-3 看图/写话缺配图标记（规则 image-block-fix）
    if (has('image-block-fix') && /看图写话|写话|看图/.test(bodyText) && !/\[IMAGE\]/.test(out)) {
      silentCount('image-missing', '含"看图/写话"的题无 [IMAGE] 配图标记块，请抽检');
    }
    // 2j-4 田字格载体缺失（规则 writing-grid-fix：题干要求田字格但无格子）
    if (has('writing-grid-fix') && /田字格中写|在田字格|方格中写/.test(bodyText) && !/tian-zi-ge/.test(out)) {
      silentCount('writing-grid', '题干要求"田字格中写"但正文无田字格格子——作答载体缺失，请抽检');
    }
    // 2j-5 写话/作文无作文格 → 自动补方格区（看图写话/写话/习作/作文/写作均适用）
    if (has('writing-grid-fix') && /看图写话|写话|习作|作文|写作/.test(bodyText) && !/zuo-wen-ge/.test(out)) {
      try {
        const tpl2 = document.createElement('template');
        tpl2.innerHTML = out;
        const ps2 = Array.from(tpl2.content.querySelectorAll('p'));
        const kwRe = /看图写话|写话|习作|作文|写作/;
        const targetPs = ps2.filter(p => kwRe.test(p.textContent || '') && (p.textContent || '').length < 60);
        if (targetPs.length > 0) {
          const lastP = targetPs[targetPs.length - 1];
          const zwg = document.createElement('div');
          zwg.className = 'zuo-wen-ge';
          const fillCells = getMergedSpec().ZUOWEN_FILL_CELLS || 160;
          for (let k = 0; k < fillCells; k++) {
            const s = document.createElement('span');
            s.innerHTML = '&emsp;';
            zwg.appendChild(s);
          }
          lastP.parentNode.insertBefore(zwg, lastP.nextSibling);
          out = tpl2.innerHTML;
          issues.push({ severity: 'info', type: 'writing-grid', message: `写话/作文题已自动补作文格（zuo-wen-ge ${fillCells}格）` });
          fixed += 1;
        } else {
          silentCount('writing-grid', '含写话/作文题但无作文格且未找到可补位置（zuo-wen-ge），请抽检');
        }
      } catch (e) {
        console.warn('⚠️ 作文格自动补齐失败:', e.message);
        silentCount('writing-grid', '含写话/作文题但正文无作文格（zuo-wen-ge），请抽检');
      }
    }
    // 2j-5a 作文格位置纠正：格子出现在所属题干之前 → 移到题干之后（模型常见顺序错误：
    //    先输出 <div class="zuo-wen-ge"> 再写题干，卷面变成"格子在上、题目在下"）
    if (has('writing-grid-fix') && /<div[^>]*class=["'][^"']*zuo-wen-ge/.test(out)) {
      try {
        const tpl3 = document.createElement('template');
        tpl3.innerHTML = out;
        const zwgList = Array.from(tpl3.content.querySelectorAll('div.zuo-wen-ge'));
        const kwRe = /看图写话|写话|习作|作文|写作/;
        let moved = 0;
        for (const zwg of zwgList) {
          // 1) 格子之前已有题干段落 → 顺序正确，跳过
          let prev = zwg.previousElementSibling;
          let hasBefore = false;
          while (prev) {
            if (kwRe.test(prev.textContent || '')) { hasBefore = true; break; }
            prev = prev.previousElementSibling;
          }
          if (hasBefore) continue;
          // 2) 格子跑到了题干上方 → 向后找最近的题干段落，把格子移到其后
          let next = zwg.nextElementSibling;
          let anchor = null;
          while (next) {
            if (kwRe.test(next.textContent || '')) { anchor = next; break; }
            next = next.nextElementSibling;
          }
          if (anchor && anchor.parentNode === zwg.parentNode) {
            zwg.parentNode.insertBefore(zwg, anchor.nextSibling);
            moved += 1;
          }
        }
        if (moved > 0) {
          out = tpl3.innerHTML;
          issues.push({ severity: 'info', type: 'writing-grid-order', message: `已将 ${moved} 处作文格移动到题干之后（顺序纠正）` });
          fixed += moved;
        }
      } catch (e) {
        console.warn('⚠️ 作文格位置纠正失败:', e.message);
      }
    }
    // 2j-6 语文低段连线题数量超限（规则 match-format-fix：全卷连线≤2道，超限标记）
    if (has('match-format-fix') && subject.includes('语文') && /^primary/.test(stage)) {
      const mqCount = (out.match(/match-question/g) || []).length;
      const twoColLines = (out.match(/[\u4e00-\u9fa5]{1,20}\u3000{2,}\S{1,20}/g) || []).length;
      const total = mqCount + Math.ceil(twoColLines / 2);
      if (total > 2) {
        silentCount('match-empty', `语文低段连线题数量(${total})超过2道上限——题型重复，请抽检`);
      }
    }
  }

  // ── 2k. 书写作答空间保障（规则 answer-area-fix：
  //      题有分值 + 无选项/括号/填空格/专用格线 → 按 学科×学段 度量题后有效作答行
  //      （blank-line 横线行 / 纯横线字符行 / 带高空白块；纯空行与题间空行不计），
  //      不足时按排版规格库 ANSWER_REGION 补差：语文/英语/科学横线、其余空白——
  //      卷面惯例而非课标要求，参数可在排版规格库调整）──
  if (has('answer-area-fix')) {
    try {
      const region = getAnswerRegion(subject, stage);
      const lhMm = region.lineHeightMm || 8;
      const needRows = (score) => Math.max(0, Math.ceil(score * (region.linePerScore || 1)));
      // 只处理正文区（答案区/参考答案不做补差）
      const ansStart = out.match(/<div[^>]*class=["'][^"']*answer-section[^"']*["'][^>]*>/i);
      const bodyPart = ansStart ? out.slice(0, ansStart.index) : out;
      const ansPart = ansStart ? out.slice(ansStart.index) : '';
      const tplK = document.createElement('template');
      tplK.innerHTML = bodyPart;
      const headsK = Array.from(tplK.content.querySelectorAll('h2, h3, h4'));
      let fixedK = 0;
      const padP = (carrier) => {
        const p = document.createElement('p');
        const span = document.createElement('span');
        span.innerHTML = '&emsp;';
        if (carrier === 'line') {
          span.className = 'blank-line';
        } else {
          p.className = 'blank-area';
          p.setAttribute('style', `height:${lhMm}mm`);
        }
        p.appendChild(span);
        return p;
      };
      // 🔧 本地非全局正则（PAREN_BLANK_RE/BLANK_TAG_RE 为 /g 有状态，.test 会受 lastIndex 干扰）
      const parenBlankTest = /[（(]\s*[　\u3000 ]{1,12}\s*[)）]/;
      const blankTagTest = /<span[^>]*class=["'][^"']*blank-\d+[^"']*["'][^>]*>[\s\S]*?<\/span>|<u[^>]*class=["'][^"']*blank-\d+[^"']*["'][^>]*>[\s\S]*?<\/u>/i;
      // 🔧 填空载体变体（防把填空/查字典题误当解答题补差）：
      //    引号空位 “　　　　”、双括号空位 ((　))、裸全角空格空位（如"除去部首还有　　　　画"）
      const fullWidthBlankTest = /[“"][　\s\u3000]{2,}[”"]|[(（]{1,2}[　\s\u3000]{2,}[)）]{1,2}|[　\u3000]{2,}/;
      headsK.forEach((head, i) => {
        const title = (head.textContent || '').trim();
        const cm = title.match(/共\s*(\d{1,3})\s*分/);
        const sm = title.match(/[（(]\s*(\d{1,3})\s*分/);
        const scoreMatch = cm || sm;
        if (!scoreMatch) return;
        const secNodes = [];
        let node = head.nextSibling;
        const end = headsK[i + 1] || null;
        while (node && node !== end) { secNodes.push(node); node = node.nextSibling; }
        if (secNodes.length === 0) return;
        // 大题内小题（题号行："1." 或 "（1）"）；无题号行时整大题视为一个作答项（如书面表达）
        const itemPs = secNodes.filter(n => n.nodeType === Node.ELEMENT_NODE && n.tagName.toLowerCase() === 'p'
          && /^\s*(?:\d+[.、．]|[(（]\d+[)）])/.test((n.textContent || '').trim()));
        const items = itemPs.length > 0
          ? itemPs.map((p, k) => {
              const t = (p.textContent || '').trim();
              const tm = t.match(/共\s*(\d+(?:\.\d+)?)\s*分/);
              const im = t.match(/[（(][^）)]*?(\d+(?:\.\d+)?)\s*分[^）)]*?[)）]/);
              const m = tm || im;
              const seg = [];
              let sn = p.nextSibling;
              const e2 = itemPs[k + 1] || null;
              while (sn && sn !== e2) { seg.push(sn); sn = sn.nextSibling; }
              return { p, score: m ? parseFloat(m[1]) : null, seg };
            })
          : [{ p: head, score: parseFloat(scoreMatch[1]), seg: secNodes }];
        for (const it of items) {
          if (it.score == null || it.score <= 0 || it.score > 15) continue;
          // 题号行 + 作答段统一克隆扫描（含嵌套 p/div/section）
          const wrap = document.createElement('div');
          wrap.appendChild(it.p.cloneNode(true));
          for (const sn of it.seg) wrap.appendChild(sn.cloneNode(true));
          const scanEls = Array.from(wrap.querySelectorAll('p, div, section'));
          const segHtml = it.seg.map(n => n.outerHTML || n.textContent || '').join('');
          const segAll = (it.p.outerHTML || '') + segHtml; // 题号行自身的括号空位/填空格/选项也要参与载体判定
          const stem = (it.p.textContent || '').trim();
          // 已有载体/题型 → 跳过（填空括号、引号/全角空格空位、填空格、连线、专用格线、选项、圈选/判断/写作类）
          if (parenBlankTest.test(segAll) || blankTagTest.test(segAll) || fullWidthBlankTest.test(segAll)) continue;
          if (/match-question|match-item|zuo-wen-ge|square-grid|bracket-grid|tian-zi-ge|four-line-three|sixian-ge|pinyin-line|mi-zi-ge/.test(segAll)) continue;
          if (countOptions(segAll) > 0) continue;
          if (/(?:选择|选一选|选出|判断|连线|连一连|连起来|排序|填序号|涂色|√|×|对(?:的)?画|打[√×✓]|写话|习作|作文|写作|填一填|填空|填字)/.test(stem)) continue;
          // 度量有效作答行（纯空行/题间空行不计；内嵌填空下划线=已有载体 → 跳过）
          let rows = 0;
          let hasFillIn = false;
          for (const el of scanEls) {
            const tag = (el.tagName || '').toLowerCase();
            const html = el.outerHTML || '';
            const txt = (el.textContent || '').trim();
            if (tag === 'p') {
              if (/^[＿_\s]+$/.test(txt)) { rows += 1; continue; }          // 纯横线字符行
              if (/blank-line/.test(html)) { rows += 1; continue; }         // 含横线作答 span
              if (/[＿_]{2,}/.test(txt)) { hasFillIn = true; break; }        // 内嵌填空线（如"3+5=＿＿"）
            }
            const st = (el.getAttribute && el.getAttribute('style')) || '';
            const hm = st.match(/(?:^|;)\s*(?:height|min-height)\s*:\s*([\d.]+)\s*(mm|px|pt)/i);
            if (hm) {
              const mm = hm[2] === 'mm' ? parseFloat(hm[1]) : hm[2] === 'px' ? parseFloat(hm[1]) / 3.7795 : parseFloat(hm[1]) / 2.8346;
              if (mm >= lhMm * 0.6) rows += Math.max(1, Math.round(mm / lhMm)); // 带高空白块
            }
          }
          if (hasFillIn) continue;
          const need = needRows(it.score);
          if (rows >= need) continue;
          const diff = Math.min(need - rows, 15);
          const anchor = it.seg.length > 0 ? it.seg[it.seg.length - 1] : it.p;
          for (let d = 0; d < diff; d++) {
            anchor.parentNode.insertBefore(padP(region.carrier), anchor.nextSibling);
          }
          fixed += 1;
          fixedK += 1;
          issues.push({
            severity: 'info', type: 'answer-area',
            message: `已补作答空间：大题「${title.slice(0, 14)}」某题补 ${diff} 行${region.carrier === 'line' ? '横线' : '空白'}（分值${it.score}×系数${region.linePerScore}，原有效作答行${rows}）`,
          });
        }
      });
      if (fixedK > 0) out = tplK.innerHTML + ansPart;
      if (hadAnswerSection && !/answer-section/.test(out)) console.error('[answer-diag] 🎯 答案区在 2k（作答空间补差）段后丢失');
    } catch (e) {
      console.warn('⚠️ 作答空间保障失败（不影响其他修复）:', e.message);
    }
  }

  // ── 2l. 载体×题型正规化（规则 writing-grid-fix 配套，小题粒度，数据源=排版规格库 CARRIER_RULES）：
  //    forbid=表达/写话/习作类题内混入书写格 → 自动剥离 class 保留文字（确定性可修复）；
  //    must=写字/抄写类题该用格子却没用 → 静默提示抽检（程序不知道哪个字进格，无法自动补）──
  if (has('writing-grid-fix')) {
    try {
      const cr = getMergedSpec().CARRIER_RULES || { must: [], forbid: [] };
      const tplL = document.createElement('template');
      tplL.innerHTML = out;
      const headsL = Array.from(tplL.content.querySelectorAll('h2, h3, h4'));
      let fixedL = 0;
      const exactCls = (el, cls) => new RegExp(`(^|\\s)${cls}(?=\\s|$)`).test(el.className || '');
      const stripClasses = (root, carriers) => {
        let n = 0;
        const pool = [root, ...(root.querySelectorAll ? Array.from(root.querySelectorAll('span, div, u')) : [])];
        for (const el of pool) {
          for (const c of carriers) {
            if (exactCls(el, c)) {
              el.className = (el.className || '').replace(new RegExp(`(^|\\s)${c}(?=\\s|$)`), ' ').replace(/\s+/g, ' ').trim();
              if (!el.className) el.removeAttribute('class');
              n += 1;
            }
          }
        }
        return n;
      };
      headsL.forEach((head, i) => {
        const secNodes = [];
        let node = head.nextSibling;
        const end = headsL[i + 1] || null;
        while (node && node !== end) { secNodes.push(node); node = node.nextSibling; }
        if (secNodes.length === 0) return;
        const itemPs = secNodes.filter(n => n.nodeType === Node.ELEMENT_NODE && n.tagName.toLowerCase() === 'p'
          && /^\s*(?:\d+[.、．]|[(（]\d+[)）])/.test((n.textContent || '').trim()));
        const items = itemPs.length > 0
          ? itemPs.map((p, k) => {
              const seg = [];
              let sn = p.nextSibling;
              const e2 = itemPs[k + 1] || null;
              while (sn && sn !== e2) { seg.push(sn); sn = sn.nextSibling; }
              return { p, seg };
            })
          : [{ p: head, seg: secNodes }];
        for (const it of items) {
          const scope = [it.p, ...it.seg];
          const text = scope.map(n => n.textContent || '').join('');
          // forbid：表达/写话类题内混入书写格 → 剥离保留文字
          for (const fb of cr.forbid || []) {
            if (new RegExp(fb.keywords).test(text)) {
              for (const root of scope) {
                if (root.nodeType !== Node.ELEMENT_NODE) continue;
                fixedL += stripClasses(root, fb.carriers || []);
              }
            }
          }
          // must：写字/抄写类该用格子却没用 → 静默提示
          for (const mu of cr.must || []) {
            if (mu.subject && mu.subject !== subject) continue;
            if (Array.isArray(mu.stages) && mu.stages.length && !mu.stages.includes(stage)) continue;
            if (!new RegExp(mu.keywords).test(text)) continue;
            const html = scope.map(n => n.outerHTML || '').join('');
            if (!new RegExp(mu.carrier).test(html)) {
              silentCount('writing-grid', `「${subject}」题干含"${String(mu.keywords).split('|')[0]}…"书写要求，但题内无${GRID_CLASS_LABEL[mu.carrier] || mu.carrier}——载体缺失，请抽检`);
            }
          }
        }
      });
      if (fixedL > 0) {
        out = tplL.innerHTML;
        issues.push({ severity: 'info', type: 'writing-grid', message: `已剥离表达/写话/习作类题目中混入的书写格 ${fixedL} 处（保留文字，卷面已规范）` });
        fixed += fixedL;
      }
      if (hadAnswerSection && !/answer-section/.test(out)) console.error('[answer-diag] 🎯 答案区在 2l（载体×题型正规化）段后丢失');
    } catch (e) {
      console.warn('⚠️ 载体×题型正规化失败（不影响其他修复）:', e.message);
    }
  }

  // ── 3. 答案区一致性（规则 answer-section-fix：容器补全 / answer-coverage-guard：题号覆盖）──
  {
    // 3a. 答案区容器补全（规则 answer-section-fix）：<h2>参考答案… 无 answer-section 包裹 → 补包
    //    （docx 导出按 answer-section 拆分独立分节；与 useAiGenerator once 模式兜底幂等）
    if (has('answer-section-fix') && !/<div[^>]*class=["'][^"']*answer-section[^"']*["'][^>]*>[\s\S]*?<h2[^>]*>\s*参考答案/i.test(out)) {
      const newOut = out.replace(/(<h2[^>]*>\s*参考答案[\s\S]*?)$/i, (m, ansPart) => `<div class="answer-section">\n${ansPart}</div>`);
      if (newOut !== out) {
        out = newOut;
        issues.push({ severity: 'info', type: 'answer-section', message: '答案区已自动补包为独立 answer-section' });
        fixed += 1;
      }
      if (hadAnswerSection && !/answer-section/.test(out)) console.error('[answer-diag] 🎯 答案区在 3a（答案区容器补全）段后丢失');
    }

    // 3b. 答案区内容（answer-coverage-guard：静默）
    const ansMatch = out.match(/<div[^>]*class=["'][^"']*answer-section[^"']*["'][^>]*>([\s\S]*)$/i);
    if (ansMatch) {
      const ansText = stripTags(ansMatch[1]);
      if (has('answer-coverage-guard')) {
        const bodyText = stripTags(out.split(/<div[^>]*class=["'][^"']*answer-section/i)[0]);
        const bodyTopQ = (bodyText.match(/(?:^|\n)\s*\d+[.、．]/g) || []).length;
        const ansTopQ = (ansText.match(/(?:^|\n)\s*\d+[.、．]/g) || []).length;
        if (bodyTopQ > 3 && ansTopQ < bodyTopQ - 1) {
          silentCount('answer-coverage', `答案区题号数(${ansTopQ})明显少于正文(${bodyTopQ})`);
        }
      }
    }
  }

  return { html: out, issues, fixed, silent, silentDetails };
};

/** 统计大题内子题数（"1." 式小题编号） */
const countSubQuestions = (raw) => {
  const text = stripTags(raw);
  return (text.match(/(?:^|\n)\s*\d+[.、．]/g) || []).length;
};

/** 统计"（1）（2）"式子题编号数（小题分值标注用） */
const countSubNumbered = (raw) => {
  const text = stripTags(raw);
  return (text.match(/[(（]\s*\d+\s*[)）]/g) || []).length;
};

/**
 * 为"看拼音写词语/拼音填空"补齐缺失的空位（DOM 版）：
 * 在给定节点列表内的文本节点上，为"拼音组后紧跟汉字（且后无空位）"的位置补（　　）
 * @param {Array<Element|Text>} nodes DOM 节点列表
 * @param {number} missing 期望补全数
 * @returns {{recovered: boolean}}
 */
const fixMissingPinyinBlanksInDom = (nodes, missing) => {
  let recovered = 0;
  try {
    const re = new RegExp(`([${PINYIN_CHARS}]+)(?=\\s*[\\u4e00-\\u9fa5])`, 'g');
    for (const root of nodes) {
      if (recovered >= missing) break;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      for (const node of textNodes) {
        if (recovered >= missing) break;
        const t = node.nodeValue || '';
        let fixedText = t;
        let mm;
        let changed = false;
        re.lastIndex = 0;
        while ((mm = re.exec(fixedText)) !== null && recovered < missing) {
          // 该拼音组后紧跟汉字且后面没有空位 → 补（　　）
          const after = fixedText.slice(mm.index + mm[1].length);
          if (/[（(]\s*[　\s]{1,6}\s*[)）]/.test(after)) continue; // 已有空位
          fixedText = fixedText.slice(0, mm.index + mm[1].length) + '(　　　　)' + fixedText.slice(mm.index + mm[1].length);
          recovered += 1;
          changed = true;
        }
        if (changed) node.nodeValue = fixedText;
      }
    }
  } catch (e) {
    console.warn('⚠️ 拼音空位补齐失败:', e.message);
  }
  return { recovered: recovered >= missing };
};

/** 删除多余空位（空位数 > 拼音组数，如"拼音2字却给4个田字格"→ 删到 2 个） */
const fixExcessPinyinBlanksInDom = (nodes, excess) => {
  let removed = 0;
  try {
    const parenRe = /[（(]\s*[　\u3000 ]{1,12}\s*[)）]/g;
    for (const root of nodes) {
      if (removed >= excess) break;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      // 从后往前处理（避免索引偏移）：每段文本内也从最后一个空位删起
      for (let i = textNodes.length - 1; i >= 0 && removed < excess; i--) {
        const node = textNodes[i];
        const t = node.nodeValue || '';
        if (!parenRe.test(t)) continue;
        const matches = [...t.matchAll(parenRe)].reverse();
        let fixedText = t;
        for (const m of matches) {
          if (removed >= excess) break;
          fixedText = fixedText.slice(0, m.index) + fixedText.slice(m.index + m[0].length);
          removed += 1;
        }
        if (fixedText !== t) node.nodeValue = fixedText;
      }
    }
  } catch (e) {
    console.warn('⚠️ 拼音多余空位删除失败:', e.message);
  }
  return { removed: removed >= excess };
};

export default { auditExamPaper, normalizePinyinText, countBlanks, countPinyinGroups, countPinyinOptions, countOptions, countMatchSides, splitSections, fixScoreLabel };
