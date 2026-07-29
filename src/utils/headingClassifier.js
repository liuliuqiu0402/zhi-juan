/**
 * 🧠 语义文档结构分析器
 * 
 * 借鉴 LaTeX exam 文档类的核心思想：用题目语义模型描述文档结构。
 * LLM 只返回段落索引（数字），不返回任何文字内容——从根上杜绝答题本能。
 *
 * 链路：提取段落 → LLM 分析结构 → 生成语义 HTML（纯一条线，无正则兜底）
 */

import { apiConfig } from '../config/apiConfig.js';

// ── 配置 ──
const OLLAMA_BASE = apiConfig.ollamaBaseUrl || 'http://localhost:11434';
const MODEL = apiConfig.ollamaHeadingModel || 'qwen2.5:7b';
const TIMEOUT_MS = 60000;

let preWarmed = false;

(async function preWarmModel() {
  try {
    const resp = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt: '预',
        stream: false,
        options: { num_predict: 1, temperature: 0 },
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (resp.ok) {
      preWarmed = true;
      console.log(`🔥 [标题分类] 模型 ${MODEL} 预热完成`);
    }
  } catch (e) {
    console.log(`⏳ [标题分类] 预热未完成（${e.message}），首次调用将冷启动`);
  }
})();

// ── 分类 Prompt（行式输出，只做标题/正文二分类） ──
const CLASSIFY_PROMPT = `判断每段是标题还是正文。每段附带格式提示 [字号][加粗][居中]。

H1=主标题 H2=大板块 H3=子标题 H4=小标题 P=正文

判断要点：
- Python已根据字号/加粗/居中预标了部分段落（标注在行末的[已标h1][已标h2]等）。这些预标通常正确，除非内容明显不符。
- 编号+类别名(选择题/填空/阅读/判断/简答/习作/作文)→标题
- 编号+完整句子(有谓语+句末标点)→正文
- 格式强化：大字号+加粗+居中→增强标题信号，但内容才是最终依据

输出格式（每行 索引|标签，不要 [] 不要文字 不要空格）：
0|H1
1|H2
2|P
3|H4

示例（输入→输出）：

示例：
[0]第五单元测试卷[18pt][加粗][居中] → 0|H1
[1]一、选择题[14pt][加粗] → 1|H2
[2]1.下列加点字注音完全正确的一项…[12pt] → 2|P
[3]①填空题[12pt][加粗] → 3|H4
[4]在一个三角形中已知AB=3BC=4求面…[12pt] → 4|P

现在标注：
`;

// ── 视觉特征提取 ──

function extractVisualFeatures(el) {
  const parentStyle = (el.getAttribute('style') || '').toLowerCase();
  const textAlign = (parentStyle.match(/text-align\s*:\s*([^;]+)/) || [])[1]?.trim() || null;
  let fontSize = null, fontWeight = null, fontFamily = null;

  const firstSpan = el.querySelector('span');
  if (firstSpan) {
    const spanStyle = (firstSpan.getAttribute('style') || '').toLowerCase();
    fontSize = (spanStyle.match(/font-size\s*:\s*([^;]+)/) || [])[1]?.trim() || null;
    fontFamily = (spanStyle.match(/font-family\s*:\s*'?([^';]+)'?/) || [])[1]?.trim() || null;
  }

  const hasStrongTag = el.querySelector('strong, b') !== null;
  const inlineBold = /font-weight\s*:\s*(bold|[6-9]00)/.test(parentStyle);
  if (hasStrongTag || inlineBold) fontWeight = 'bold';

  return { fontSize, fontWeight, textAlign, fontFamily };
}

// ── 段落提取 ──

export function extractParagraphsFromHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const items = [];
  const blockElements = doc.body.querySelectorAll('h1, h2, h3, h4, h5, h6, p, div, li');
  let index = 0;

  for (const el of blockElements) {
    const text = el.textContent.trim();
    if (!text || text.length < 2) continue;
    const cleanText = text.replace(/<[^>]*>/g, '').trim();
    if (!cleanText || cleanText.length < 2) continue;

    items.push({
      index,
      text: cleanText,
      innerHTML: el.innerHTML,  // 🔑 保留原始内容（图片/表格/排版标记）
      tag: el.tagName.toLowerCase(),
      visual: extractVisualFeatures(el),
    });
    index++;
  }
  return items;
}

function formatVisualHints(v) {
  if (!v) return '';
  const parts = [];
  if (v.fontSize) parts.push(v.fontSize);
  if (v.fontWeight === 'bold') parts.push('加粗');
  if (v.textAlign === 'center') parts.push('居中');
  return parts.length > 0 ? '[' + parts.join('][') + ']' : '';
}

// ── Prompt 构建 ──

function buildPrompt(paragraphs) {
  const lines = paragraphs.map(p => {
    const truncated = p.text.length > 30 ? p.text.slice(0, 30) + '…' : p.text;
    const hints = formatVisualHints(p.visual);
    // 🔑 注入 Python 视觉检测的已有标签，LLM 以此为基准做审核
    const pythonTag = /^h[1-6]$/.test(p.tag) ? `[已标${p.tag}]` : '';
    return `[${p.index}]${truncated}${hints}${pythonTag}`;
  });
  const prompt = CLASSIFY_PROMPT + lines.join('\n');
  console.log(`🧠 [标题分类] Prompt: ${prompt.length}字符, ${paragraphs.length}段, 每段≤30字, 模型=${MODEL}`);
  return prompt;
}

// ── LLM 调用（流式） ──

async function callOllama(paragraphs) {
  const prompt = buildPrompt(paragraphs);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    console.log(`🧠 [标题分类] → ${MODEL} (${paragraphs.length}段, ${preWarmed ? '已预热' : '冷启动'})`);

    const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: true,
        options: { temperature: 0.1, num_predict: 2048 },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (!response.ok) {
      console.warn(`⚠️ [标题分类] HTTP ${response.status}`);
      return null;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line);
          if (chunk.response) fullResponse += chunk.response;
        } catch { /* skip */ }
      }
    }

    console.log(`✅ [标题分类] 响应: ${fullResponse.length} 字符`);
    return parseClassification(fullResponse);

  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      console.warn(`⏱️ [标题分类] 超时 (${TIMEOUT_MS / 1000}s)`);
    } else {
      console.warn(`⚠️ [标题分类] 调用失败: ${e.message}`);
    }
    return null;
  }
}

// ── 响应解析（行式） ──

function parseClassification(raw) {
  const map = new Map();
  const validLevels = new Set(['H1', 'H2', 'H3', 'H4', 'P']);
  const lines = raw.split('\n');
  for (const line of lines) {
    const match = line.trim().match(/\[?(\d+)\]?.*?[\|：:]\s*(H[1-4]|P)\b/i);
    if (match) {
      const idx = parseInt(match[1], 10);
      const level = match[2].toUpperCase();
      if (validLevels.has(level)) map.set(idx, level);
    }
  }
  if (map.size === 0) {
    console.warn('⚠️ [标题分类] 行式解析无有效结果');
    console.log('🔍 原始响应(前500):', raw.slice(0, 500));
    return null;
  }
  console.log(`✅ [标题分类] 解析 ${map.size} 个分类`);
  return map;
}

// ── 后置校验 ──

function validateClassification(classification, paragraphs) {
  const validated = new Map(classification);

  let h1Found = false;
  for (const [idx, level] of [...validated.entries()].sort((a,b)=>a[0]-b[0])) {
    if (level === 'H1') {
      if (h1Found) { console.log(`🔧 [校验] 多H1(idx=${idx})→H2`); validated.set(idx, 'H2'); }
      h1Found = true;
    }
  }
  for (const [idx, level] of [...validated.entries()]) {
    if (level !== 'P') {
      const p = paragraphs[idx];
      if (p && p.text && p.text.length > 80) {
        console.log(`🔧 [校验] 长文本${p.text.length}字→P`);
        validated.set(idx, 'P');
      } else if (p && p.text && p.text.length > 40 && /[。！？…]$/.test(p.text.trim())) {
        console.log(`🔧 [校验] 句末标点+长文本→P`);
        validated.set(idx, 'P');
      }
    }
  }
  return validated;
}

// ── 分类应用到原文 DOM（只改标签，不动内容、不动顺序） ──

function applyClassificationToHTML(html, classification) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const blockElements = doc.body.querySelectorAll('h1, h2, h3, h4, h5, h6, p, div, li');

  let index = 0;
  for (const el of blockElements) {
    const text = el.textContent.trim();
    if (!text || text.length < 2) continue;
    const cleanText = text.replace(/<[^>]*>/g, '').trim();
    if (!cleanText || cleanText.length < 2) continue;

    const level = classification.get(index);
    if (!level) { index++; continue; }

    const currentTag = el.tagName.toLowerCase();
    const targetTag = level === 'P' ? 'p' : level.toLowerCase();
    if (currentTag === targetTag) { index++; continue; }

    const newEl = doc.createElement(targetTag);
    newEl.innerHTML = el.innerHTML;
    const origStyle = el.getAttribute('style');
    if (origStyle) newEl.setAttribute('style', origStyle);
    const origClass = el.getAttribute('class');
    if (origClass) newEl.setAttribute('class', origClass);

    el.replaceWith(newEl);
    index++;
  }

  const result = doc.body.innerHTML;
  console.log(`🧠 [标题分类] 应用完成: ${classification.size} 个段落已重标标签`);
  return result;
}

// ── 主入口 ──

/**
 * 🧠 使用 LLM 解析文档结构，生成语义化的 HTML。
 * 
 * 借鉴 LaTeX exam：不是给段落打标签，而是理解"这是一道选择题，有4个选项"。
 * LLM 只输出索引（数字），不输出文字——从架构上杜绝答题本能。
 *
 * @param {string} html - 输入 HTML
 * @returns {Promise<string|null>} 结构化 HTML，失败返回 null
 */
export async function classifyHeadingsViaLLM(html) {
  const paragraphs = extractParagraphsFromHTML(html);
  if (paragraphs.length === 0) {
    console.log('🧠 [标题分类] 无段落，跳过');
    return null;
  }
  console.log(`🧠 [标题分类] ${paragraphs.length}段, 全部送入 LLM`);

  const classification = await callOllama(paragraphs);
  if (!classification) {
    console.log('🧠 [标题分类] 失败，返回 null（保留 Python 视觉输出）');
    return null;
  }

  const validated = validateClassification(classification, paragraphs);
  const result = applyClassificationToHTML(html, validated);
  console.log(`🧠 [标题分类] ✅ 完成: ${validated.size} 个分类${classification.size !== validated.size ? ` (修正${classification.size - validated.size})` : ''}`);
  return result;
}

/**
 * 检测 Ollama 服务是否可用
 */
export async function isOllamaAvailable() {
  try {
    const resp = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}
