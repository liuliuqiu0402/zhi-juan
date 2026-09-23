/**
 * 生成「KaTeX 内联样式」模块（供 PDF/HTML 导出使用）
 * ============================================================
 * 🔴 为什么需要内联：PDF 导出走 Electron 主进程 `page.setContent(html)`（见 main.js export-pdf），
 *    该页面没有 base URL、也没有网络 —— `katex.min.css` 里 `url(fonts/xx.woff2)` 这类**相对路径
 *    字体根本解析不到**，KaTeX 会退化成系统字体：分式叠排/根号/大括号等依赖字模度量的排版全走形。
 *    故导出用的 CSS 必须把字体**内联为 data URL**，让 HTML 自带字形（渲染器侧无需任何外部文件）。
 *
 * 产物：src/utils/katexInlineCss.js（导出常量 KATEX_INLINE_CSS，约 350KB）
 * 🔧 只在导出链路**动态 import** 该模块 —— 普通页面（编辑器/预览）用的是 Vite 打包的
 *    `katex/dist/katex.min.css`（字体走构建产物，无需内联），不背这份体积。
 *
 * 重新生成：npm run katex:inline（升级 katex 版本后需重跑）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const katexDist = path.join(root, 'node_modules', 'katex', 'dist');
const cssPath = path.join(katexDist, 'katex.min.css');
const fontDir = path.join(katexDist, 'fonts');
const outPath = path.join(root, 'src', 'utils', 'katexInlineCss.js');

if (!fs.existsSync(cssPath)) {
  console.error(`✗ 找不到 ${cssPath}，请先 npm install katex`);
  process.exit(1);
}

let css = fs.readFileSync(cssPath, 'utf8');

// ① woff2 → data URL（Chromium 系一律支持 woff2）
let inlined = 0;
css = css.replace(/url\(fonts\/([A-Za-z0-9_-]+)\.woff2\)/g, (_m, name) => {
  const p = path.join(fontDir, `${name}.woff2`);
  if (!fs.existsSync(p)) {
    console.error(`✗ 缺字体文件 ${p}`);
    process.exit(1);
  }
  inlined += 1;
  return `url(data:font/woff2;base64,${fs.readFileSync(p).toString('base64')})`;
});

// ② 去掉 woff/ttf 兜底（同一字模的冗余格式，留着等于把体积翻三倍）
css = css.replace(
  /,\s*url\(fonts\/[A-Za-z0-9_-]+\.(?:woff|ttf)\)\s*format\("(?:woff|truetype)"\)/g,
  ''
);

// ③ 自检：不允许残留任何未内联的相对字体引用（否则导出会静默丢字形）
const leftover = css.match(/url\(fonts\/[^)]+\)/g);
if (leftover) {
  console.error(`✗ 仍有未内联的字体引用 ${leftover.length} 处：${leftover.slice(0, 3).join(', ')}`);
  process.exit(1);
}

const banner = `/**
 * ⚠️ 本文件由 scripts/build-katex-inline.mjs 自动生成，请勿手改。
 *    用途：PDF/HTML 导出时内联 KaTeX 样式与字体（离线自带字形）。
 *    重新生成：npm run katex:inline
 */`;

fs.writeFileSync(
  outPath,
  `${banner}\nexport const KATEX_INLINE_CSS = ${JSON.stringify(css)};\n\nexport default KATEX_INLINE_CSS;\n`,
  'utf8'
);

const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
console.log(`✓ 已生成 src/utils/katexInlineCss.js（内联 ${inlined} 个 woff2 字体，${kb}KB）`);
