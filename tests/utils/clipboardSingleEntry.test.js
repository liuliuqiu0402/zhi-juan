import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
/**
 * 结构性不变量：剪贴板读取与公式还原的**唯一入口**
 * ============================================================
 * 2026-09 用户实证过两次"公式粘贴/导入后只剩字母和加减号"，根因都是**同一个类**：
 *   某个"把外部内容带进来"的入口自己写了一份读取逻辑，而那份只拿得到纯文本
 *   （Word 的纯文本版本只会把公式线性化成裸字符）。
 * 逐个补没有意义（补了 A，B 还会漏），所以把不变量钉死：
 *   ① 读剪贴板只允许有 utils/pastedMath.readClipboardRich 一个实现；
 *   ② 任何把 HTML 送进编辑器的通道（Ctrl+V 粘贴 / v-model 载入 / setContent）
 *      都必须先过 convertPastedMathInHtml；
 *   ③ Word 导入的边界（parseWord）同样必须过。
 * 本测试直接对源码做自动对账 —— 新加入口时若忘了接线，这里立刻红。
 * ============================================================
 */

const ROOT = path.join(process.cwd(), 'src');

/** 递归收集源码文件（只关心会写逻辑的扩展名） */
const collect = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return collect(p);
  return /\.(js|ts|vue)$/.test(e.name) ? [p] : [];
});

/** 去掉注释再匹配：说明文字里提到"某处曾直接读剪贴板"不该被判为违规 */
const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const FILES = collect(ROOT).map((f) => ({ file: f, src: stripComments(fs.readFileSync(f, 'utf8')) }));
const rel = (f) => path.relative(process.cwd(), f).replace(/\\/g, '/');

describe('① 读剪贴板只允许一个入口', () => {
  it('除 utils/pastedMath.js 外，src 下不得直接调 clipboard.read / readText', () => {
    const offenders = FILES
      .filter(({ file }) => !file.endsWith(path.join('utils', 'pastedMath.js')))
      .filter(({ src }) => /navigator\s*\.\s*clipboard\s*\.\s*(read|readText)\s*\(/.test(src))
      .map(({ file }) => rel(file));
    expect(offenders, `这些文件绕过了唯一入口，会只拿到纯文本（公式必丢）：\n${offenders.join('\n')}`).toEqual([]);
  });

  it('唯一入口本身必须优先取 text/html（公式只在这一份里），且回退纯文本', () => {
    const src = FILES.find(({ file }) => file.endsWith(path.join('utils', 'pastedMath.js'))).src;
    expect(src).toMatch(/readClipboardRich/);
    expect(src, '必须先试 text/html').toMatch(/text\/html/);
    expect(src, '读不到富文本时要回退纯文本').toMatch(/readText/);
    expect(src, '读出来的 HTML 必须顺手还原公式').toMatch(/convertPastedMathInHtml\(\s*html\s*\)/);
  });
});

describe('② HTML 入编辑器：三条通道都必须先还原公式', () => {
  const src = FILES.find(({ file }) => file.endsWith(path.join('components', 'RichTextEditor.vue'))).src;

  it('Ctrl+V 粘贴通道（transformPastedHTML）', () => {
    expect(src).toMatch(/transformPastedHTML[\s\S]{0,800}convertPastedMathInHtml/);
  });

  it('v-model / setContent 载入通道（prepareHtmlForLoad 是唯一预处理链）', () => {
    expect(src, '载入链必须含公式还原').toMatch(/prepareHtmlForLoad\s*=[\s\S]{0,600}convertPastedMathInHtml/);
    // 对外 setContent 与内部 trySetContent 都必须走同一条链（防再出现"各写一份"）
    expect(src).toMatch(/commands\.setContent\(prepareHtmlForLoad\(/);
    expect(src).toMatch(/processed\s*=\s*prepareHtmlForLoad\(/);
    // 旧的两处 9 段式内联预处理链应已收敛，不得复活
    expect(src, '预处理链不得再内联重复').not.toMatch(/commands\.setContent\(ensureCarrierContent\(/);
  });
});

describe('③ Word 导入边界（parseWord）必须还原公式', () => {
  it('useFileHandler.parseWord 的返回值过 convertPastedMathInHtml', () => {
    const src = FILES.find(({ file }) => file.endsWith(path.join('composables', 'useFileHandler.js'))).src;
    expect(src).toMatch(/parseWord[\s\S]{0,900}convertPastedMathInHtml\(\s*result\.html\s*\)/);
  });

  it('word_to_html.py 必须原样输出 OMML（python-docx 读不到，只能交给 JS 侧还原）', () => {
    const py = fs.readFileSync(path.join(process.cwd(), 'python-scripts', 'word_to_html.py'), 'utf8');
    expect(py, '必须按文档顺序遍历子节点（否则公式与文字错位）').toMatch(/walk_inline_html/);
    expect(py, '必须识别 oMath / oMathPara').toMatch(/_M_OMATH/);
    expect(py, '三处调用点都要改用保序的段落行内构建').not.toMatch(/get_run_html\(run, doc_images\)\s+for run in /);
  });
});

describe('④ 纯文本框"原文"字段与「导入文件」入口', () => {
  /** 取源码里所有自闭合 <textarea .../> 的开标签 */
  const textareaTags = (src) => src.match(/<textarea\b[\s\S]*?\/>/g) || [];

  it('🔴 任何绑定 rawText 的 <textarea> 都必须绑 @paste="handleMathPaste"（否则粘贴公式只剩字母）', () => {
    const offenders = [];
    for (const { file, src } of FILES) {
      for (const tag of textareaTags(src)) {
        if (/v-model="[^"]*rawText"/.test(tag) && !/@paste="handleMathPaste"/.test(tag)) offenders.push(rel(file));
      }
    }
    expect(offenders, `这些原文文本框只收纯文本且没接保公式粘贴：\n${offenders.join('\n')}`).toEqual([]);
  });

  it('原文编辑器提供「📁 导入文件」入口（整本教材靠框选复制极易漏页漏段）', () => {
    const src = FILES.find(({ file }) => file.endsWith('GenerateModule.vue')).src;
    expect(src, '按钮必须接上处理函数').toMatch(/@click="importRawTextFile"/);
    expect(src).toMatch(/const importRawTextFile = async/);
    expect(src, '.docx 必须走已含公式还原的 parseWord（不得另写一套解析）')
      .toMatch(/importRawTextFile[\s\S]{0,1600}parseWord\(filePath\)/);
  });
});

describe('⑤ 读剪贴板必须走 Electron 主进程（渲染进程 API 会被权限/焦点策略拦掉）', () => {
  const main = fs.readFileSync(path.join(process.cwd(), 'main.js'), 'utf8');
  const preload = fs.readFileSync(path.join(process.cwd(), 'preload.js'), 'utf8');

  it('main.js 提供 read-clipboard handler，且用主进程 clipboard.readHTML 取富文本那份', () => {
    expect(main).toMatch(/ipcMain\.handle\('read-clipboard'/);
    expect(main, '必须用主进程 clipboard.readHTML（不受渲染进程权限限制）').toMatch(/clipboard\.readHTML\(\)/);
    expect(main, '一并回可用格式清单，便于诊断"哪一份没拿到"').toMatch(/availableFormats\(\)/);
  });

  it('🔴 main.js 必须另读 CF_HTML 原始字节（readHTML 会被 Chromium 剥掉条件注释 → 注释里的 OMML 丢失）', () => {
    expect(main).toMatch(/clipboard\.readBuffer\('HTML Format'\)/);
    expect(main).toMatch(/htmlRawBase64/);
  });

  it('preload 暴露 readClipboard', () => {
    expect(preload).toMatch(/readClipboard:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('read-clipboard'\)/);
  });

  it('readClipboardRich 优先主进程通路，浏览器 API 只作兜底', () => {
    const src = FILES.find(({ file }) => file.endsWith(path.join('utils', 'pastedMath.js'))).src;
    expect(src).toMatch(/readClipboard\(\)[\s\S]{0,1200}navigator\s*\.\s*clipboard/);
  });

  it('🔴 readClipboardRich 优先用 CF_HTML 原始片段（注释完好），readHTML 版本只作兜底', () => {
    const src = FILES.find(({ file }) => file.endsWith(path.join('utils', 'pastedMath.js'))).src;
    expect(src).toMatch(/parseCfHtml\(bytes\)/);
    expect(src).toMatch(/html\s*=\s*htmlFromRawBytes\s*\|\|\s*htmlFromReadHtml/);
  });
});

describe('⑥ 目录「从文件导入」（不赌剪贴板格式）', () => {
  const tocModules = ['TextbookModule.vue', 'TemplateModule.vue'];

  it('教材库与模板库都提供入口，且共用同一读文件实现', () => {
    for (const name of tocModules) {
      const src = FILES.find(({ file }) => file.endsWith(name)).src;
      expect(src, `${name} 缺少入口按钮`).toMatch(/@click="importTocFromFile"/);
      expect(src, `${name} 未共用 useTocFileImport`).toMatch(/useTocFileImport/);
      expect(src, `${name} 未接上处理函数`).toMatch(/const importTocFromFile = async/);
    }
  });

  it('useTocFileImport：.docx 走 parseWord（含公式还原）+ htmlToPlainLines 压成一行一条', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/composables/useTocFileImport.js'), 'utf8');
    expect(src).toMatch(/parseWord\(filePath\)/);
    expect(src).toMatch(/htmlToPlainLines\(r\.html\)/);
  });

  it('🔴 目录编辑表格含公式时给出印刷形态预览（纯文本输入框里没法渲染，用户会误判"公式没保住"）', () => {
    for (const name of tocModules) {
      const src = FILES.find(({ file }) => file.endsWith(name)).src;
      expect(src, `${name} 缺公式预览`).toMatch(/v-if="hasMath\(item\.title\)"/);
      expect(src, `${name} 预览必须"先转义再渲染"（标题是外部输入）`)
        .toMatch(/renderMathInHtml\(escapeHtml\(item\.title\)\)/);
    }
  });

  it('导入弹窗提供「剪贴板诊断」入口（否则用户只能看到"丢了"，无法自查原因）', () => {
    for (const name of tocModules) {
      const src = FILES.find(({ file }) => file.endsWith(name)).src;
      expect(src).toMatch(/@click="showClipboardDiagnosis"/);
      expect(src).toMatch(/await diagnoseClipboard\(\)/);
    }
  });
});
