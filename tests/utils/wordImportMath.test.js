import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { convertPastedMathInHtml, hasPastedMath } from '@/utils/pastedMath.js';
import { useFileHandler } from '@/composables/useFileHandler.js';

/**
 * Word 上传（教材原文/排版内容）链路保公式（2026-09 用户实证回归）
 * ------------------------------------------------------------
 * 根因两层：
 *   ① python-docx **不支持 OMML**：`para.runs` 只返回 `<w:r>`，公式内容在 `<m:oMath>` 的
 *      `<m:r>` 里 → 整块被跳过，只剩公式周围那几个 `<w:t>`（"只留了字母和加减号"）。
 *   ② JS 侧 `parseWord` 拿到脚本输出后**没有做公式还原**。
 * 修法：脚本把 OMML **原样**输出（保持段落内的文档顺序），JS 侧 parseWord 边界
 *      交给与粘贴同一条链路（utils/pastedMath）转 `$…$` —— 全链路只有一种公式表示。
 */

// vitest 的 import.meta.url 不是 file:// 方案（fileURLToPath 会抛），故按项目根定位脚本
const SCRIPT = path.resolve(process.cwd(), 'python-scripts', 'word_to_html.py');

/** 找一个可用且装了 python-docx 的解释器（CI 是 node-only，找不到就跳过脚本级用例） */
const findPython = () => {
  for (const cmd of ['python', 'python3']) {
    const r = spawnSync(cmd, ['-c', 'import docx, lxml'], { timeout: 60000 });
    if (r.status === 0) return cmd;
  }
  return null;
};
const PY = findPython();

/** 用 python-docx 现场造一份带 OMML 公式的 docx（公式夹在文字中间，与真实教材同形） */
const OMML_DOCX_GEN = `
import sys
from docx import Document
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

NS = nsdecls('m', 'w')
R = lambda t: '<m:r><m:rPr/><m:t>%s</m:t></m:r>' % t
P = lambda t: '<m:r><m:rPr><m:nor/><m:sty m:val="p"/></m:rPr><m:t>%s</m:t></m:r>' % t
SQRT = '<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>%s</m:e></m:rad>' % R('ab')
FRAC = '<m:f><m:fPr/><m:num>%s</m:num><m:den>%s</m:den></m:f>' % (R('a+b'), P('2'))

doc = Document()
p = doc.add_paragraph()
p.add_run('3.2 基本不等式 ')
p._p.append(parse_xml('<m:oMath %s>%s%s%s</m:oMath>' % (NS, SQRT, P('\\u2a7d'), FRAC)))
p.add_run(' (a, b ')
p._p.append(parse_xml('<m:oMath %s>%s</m:oMath>' % (NS, P('\\u2a7e0'))))
p.add_run(') 55')
doc.save(sys.argv[1])
`;

describe('useFileHandler.parseWord：Word 导入边界必须做公式还原', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('🔴 脚本输出的 OMML 在 parseWord 边界被还原成 $…$（否则后续进 DOM 就再也找不回）', async () => {
    const omml = '<m:oMath><m:f><m:num><m:r><m:t>a+b</m:t></m:r></m:num>'
      + '<m:den><m:r><m:t>2</m:t></m:r></m:den></m:f></m:oMath>';
    const raw = `<p>3.2 基本不等式 ${omml} 55</p>`;
    window.electronAPI = { parseWord: vi.fn(async () => ({ html: raw })) };

    const r = await useFileHandler().parseWord('C:/x/教材.docx');
    expect(r.success).toBe(true);
    expect(r.html).toContain('$\\frac{a+b}{2}$');
    expect(hasPastedMath(r.html), '不得残留 OMML').toBe(false);
  });

  it('脚本报错时保持原样返回失败（不吞异常）', async () => {
    window.electronAPI = { parseWord: vi.fn(async () => { throw new Error('Python 转换脚本缺失'); }) };
    const r = await useFileHandler().parseWord('C:/x/教材.docx');
    expect(r.success).toBe(false);
    expect(r.error).toContain('Python');
  });
});

describe('useFileHandler.readTextFile：导入 .txt/.md 时 UTF-8 必须正确解码', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('🔴 base64 → 中文还原（直接 atob 得到的是 latin1 字节流，中文会全成乱码）', async () => {
    const text = '第3章 不等式\n基本不等式：$\\sqrt{ab}\\leqslant\\frac{a+b}{2}$';
    window.electronAPI = { readFile: vi.fn(async () => Buffer.from(text, 'utf8').toString('base64')) };
    expect(await useFileHandler().readTextFile('C:/x/教材.txt')).toBe(text);
  });
});

describe.skipIf(!PY)('word_to_html.py：段落内的 OMML 必须原样输出且保序', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zwg-word-'));
  const genPy = path.join(tmpDir, 'gen.py');
  const docx = path.join(tmpDir, 'fixture.docx');
  fs.writeFileSync(genPy, OMML_DOCX_GEN, 'utf8');

  it('公式夹在文字中间 → 输出顺序与原文一致，且公式不丢', () => {
    const gen = spawnSync(PY, [genPy, docx], { timeout: 60000, encoding: 'utf8' });
    expect(gen.status, gen.stderr || '').toBe(0);

    const out = spawnSync(PY, [SCRIPT, docx], { timeout: 60000, encoding: 'utf8' });
    expect(out.status, out.stderr || '').toBe(0);
    const { html } = JSON.parse(out.stdout);

    expect(html.match(/<m:oMath/g) || []).toHaveLength(2);
    const iTitle = html.indexOf('3.2 基本不等式');
    const iFirst = html.indexOf('<m:oMath');
    const iMid = html.indexOf('(a, b');
    expect(iTitle).toBeGreaterThan(-1);
    expect(iFirst, '公式必须排在标题文字之后').toBeGreaterThan(iTitle);
    expect(iMid, '公式必须排在 "(a, b" 之前（顺序不能被打乱）').toBeGreaterThan(iFirst);

    // 交给 JS 链路 → 逐字保真
    const converted = convertPastedMathInHtml(html);
    expect(converted).toContain('$\\sqrt{ab}\\leqslant\\frac{a+b}{2}$');
    expect(converted).toContain('$\\geqslant 0$');
    expect(hasPastedMath(converted)).toBe(false);
  });
});
