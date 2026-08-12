/**
 * Generated docs content 压缩/解压工具
 * 对 content 字段做 deflate 压缩，base64 编码，以 __Z__ 为魔数前缀
 * 仅作用于 IndexedDB 读写边界，云端始终保持未压缩（兼容多版本设备）
 */
import pako from 'pako';

const MAGIC = '__Z__';

/** 压缩单段文本，已压缩则透传 */
export function compressContent(text) {
  if (!text || typeof text !== 'string') return text;
  if (text.startsWith(MAGIC)) return text;
  try {
    const compressed = pako.deflate(text);
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
