/**
 * Generated docs content 压缩/解压工具
 * 对 content 字段做 deflate 压缩，base64 编码，以 __Z__ 为魔数前缀
 * 压缩前剥离超大头（AI 生成偶发嵌入数MB的 base64 图，撑爆云端行导致拉取超时）
 */
import pako from 'pako';

const MAGIC = '__Z__';

// 单张内联图片上限（base64 字符数 ≈ 150KB 原图）。AI 生成的 content 偶发嵌入
// 2MB+ 的 data:image（base64 几乎不可压缩），一条就撑爆整台设备的云端行
const MAX_INLINE_IMAGE = 200 * 1024;
const IMAGE_OMITTED_PLACEHOLDER = '<p style="text-align:center;color:#999;padding:8px 0;">〔图片过大，已省略〕</p>';

/** 剥离超大头：data:image base64 超过阈值的 <img> 替换为占位符 */
export function sanitizeContent(html) {
  if (!html || typeof html !== 'string') return html;
  let changed = false;
  const cleaned = html.replace(/<img[^>]*src=["']data:image[^>]*>/gi, (tag) => {
    const src = tag.match(/src=["'](data:image[^"']*)["']/i)?.[1] || '';
    if (src.length > MAX_INLINE_IMAGE) {
      changed = true;
      return IMAGE_OMITTED_PLACEHOLDER;
    }
    return tag;
  });
  if (!changed) return html;
  return cleaned;
}

/** 压缩单段文本，已压缩则透传（压缩前先剥离超大头） */
export function compressContent(text) {
  if (!text || typeof text !== 'string') return text;
  if (text.startsWith(MAGIC)) return text;
  try {
    const cleaned = sanitizeContent(text);
    const compressed = pako.deflate(cleaned);
    let binary = '';
    for (let i = 0; i < compressed.length; i++) {
      binary += String.fromCharCode(compressed[i]);
    }
    return MAGIC + btoa(binary);
  } catch { return text; }
}

/** 解压单段文本，未压缩则透传 */
export function decompressContent(text) {
  if (!text || typeof text !== 'string') return text;
  if (!text.startsWith(MAGIC)) return text;
  try {
    const base64 = text.slice(MAGIC.length);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return pako.inflate(bytes, { to: 'string' });
  } catch { return text; }
}

/** 压缩单条 doc 的 content 字段（浅拷贝） */
export function compressDocContent(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  if (doc.content) {
    return { ...doc, content: compressContent(doc.content) };
  }
  return doc;
}

/** 解压单条 doc 的 content 字段（浅拷贝） */
export function decompressDocContent(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  if (doc.content) {
    return { ...doc, content: decompressContent(doc.content) };
  }
  return doc;
}

/** 批量压缩 */
export function compressDocArray(docs) {
  if (!Array.isArray(docs)) return docs;
  return docs.map(compressDocContent);
}

/** 批量解压 */
export function decompressDocArray(docs) {
  if (!Array.isArray(docs)) return docs;
  return docs.map(decompressDocContent);
}
