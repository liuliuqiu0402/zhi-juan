import { describe, it, expect } from 'vitest';
import { parseCfHtml } from '@/utils/cfHtml.js';
import { convertPastedMathInHtml, hasPastedMath } from '@/utils/pastedMath.js';

/**
 * CF_HTML 解析（Windows 剪贴板 "HTML Format" 原始字节 → HTML 片段）
 * ------------------------------------------------------------
 * 🔴 本模块存在的理由：Word 复制公式时，OMML 写在**条件注释**里
 *    （`<!--[if gte msEquation 12]><m:oMath>…<![endif]-->`，右边再放一张兜底图片）。
 *    Electron 的 `clipboard.readHTML()` 拿到的是经 Chromium 处理过的 HTML —— **注释被丢掉**，
 *    于是只剩图片、公式凭空消失。原始 CF_HTML 字节里注释完好，必须自己解。
 */

const enc = new TextEncoder();
const R = (t) => `<m:r><m:rPr/><m:t>${t}</m:t></m:r>`;
const OMML = `<m:oMath><m:f><m:num>${R('a+b')}</m:num><m:den>${R('2')}</m:den></m:f></m:oMath>`;

/** 造一份真实结构的 CF_HTML 字节（头部 10 位定宽偏移 + 正文 UTF-8） */
const buildCfHtml = (fragment, { withFragment = true } = {}) => {
  const pre = `<html><body>${withFragment ? '<!--StartFragment-->' : ''}`;
  const post = `${withFragment ? '<!--EndFragment-->' : ''}</body></html>`;
  const body = pre + fragment + post;
  const keys = withFragment
    ? ['Version:0.9', 'StartHTML:', 'EndHTML:', 'StartFragment:', 'EndFragment:']
    : ['Version:0.9', 'StartHTML:', 'EndHTML:'];
  const pad = (n) => String(n).padStart(10, '0');
  const headFor = (vals) => keys.map((k, i) => (i === 0 ? k : k + pad(vals[i]))).join('\r\n') + '\r\n\r\n';

  const headLen = enc.encode(headFor(keys.map(() => 0))).length; // 定宽 10 位 → 与数值无关
  const startHtml = headLen;
  const endHtml = headLen + enc.encode(body).length;
  const startFragment = headLen + enc.encode(pre).length;
  const endFragment = startFragment + enc.encode(fragment).length;
  const head = withFragment
    ? headFor([0, startHtml, endHtml, startFragment, endFragment])
    : headFor([0, startHtml, endHtml]);
  return enc.encode(head + body);
};

describe('parseCfHtml', () => {
  it('🔴 取出 Fragment 区间，且**注释完好**（OMML 就在注释里，丢了就再也找不回）', () => {
    const fragment = `<p>基本不等式 </p><!--[if gte msEquation 12]>${OMML}<![endif]--><img src="file:///C:/clip_image001.png">`;
    const out = parseCfHtml(buildCfHtml(fragment));
    expect(out).toContain('<m:oMath>');
    expect(out).toContain('<!--[if gte msEquation 12]>');
    expect(out, '不含头部').not.toContain('StartFragment:');
  });

  it('🔴 按**字节**偏移切片：中文不会因多字节字符被切坏', () => {
    const fragment = '<p>第三章 基本不等式：分式的性质</p>';
    expect(parseCfHtml(buildCfHtml(fragment))).toBe(fragment);
  });

  it('没有 Fragment 标记时退回整段 HTML（StartHTML/EndHTML）', () => {
    const out = parseCfHtml(buildCfHtml('<p>第1章 集合 2</p>', { withFragment: false }));
    expect(out).toContain('第1章 集合 2');
  });

  it('非 CF_HTML 字节 / 空输入 / 偏移越界 → 返回空串（调用方自行回退）', () => {
    expect(parseCfHtml(enc.encode('就是一段普通文本，没有头部'))).toBe('');
    expect(parseCfHtml(new Uint8Array(0))).toBe('');
    expect(parseCfHtml(null)).toBe('');
    const broken = enc.encode('Version:0.9\r\nStartHTML:0000000010\r\nEndHTML:9999999999\r\n\r\n<html></html>');
    expect(parseCfHtml(broken)).toBe('');
  });

  it('🔴 端到端：原始字节 → parseCfHtml → convertPastedMathInHtml 拿到 $…$（readHTML 那条路拿不到）', () => {
    const fragment = `<p>3.2 基本不等式 <!--[if gte msEquation 12]>${OMML}<![endif]--> 55</p>`;
    const raw = parseCfHtml(buildCfHtml(fragment));
    expect(hasPastedMath(raw), '原始片段里应当能认出公式标记').toBe(true);
    expect(convertPastedMathInHtml(raw)).toContain('$\\frac{a+b}{2}$');
  });
});
