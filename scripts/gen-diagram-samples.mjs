/**
 * 生成「导图族样张」（docs/samples/*.svg）—— 可复现，不是一次性的手产物
 * ============================================================
 * 为什么要它：导图族 6 图种 + 思维导图两种版式，光看代码看不出"印出来长什么样"。
 *   仓库里直接放几个来源不明的 SVG 会腐坏（改了图种没人知道样张该不该跟着变）；
 *   有生成器就能随时重跑、diff 出"这次改动让图变成什么样"。
 *
 * 用法：node scripts/gen-diagram-samples.mjs
 * 产物：docs/samples/01…07-*.svg（**只提交 SVG**：矢量、纯文本、可压缩到 ~20%；
 *      PNG 版是给肉眼看的，体积大且可再生成，不入库）
 *
 * 与生产同一代码路径：直接 import src/utils/diagrams 的 buildDiagramSvg（纯函数，返回 SVG 字符串），
 * 不重写任何几何逻辑。注意：node 侧无 canvas → createCanvasMeasurer 返回 null，
 * 文本宽度走 estimateTextWidth 的估算分支（与"无 canvas 的浏览器环境"一致，故样张可稳定复现）。
 * ============================================================
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'docs', 'samples');

const { buildDiagramSvg } = await import(pathToFileURL(path.join(root, 'src/utils/diagrams/index.js')).href);

/** 样张清单：每题一个 spec（字段口径见 docs/design/导图族-图种规格.md） */
const SAMPLES = [
  {
    file: '01-思维导图-左右分布.svg',
    spec: {
      type: 'mindmap',
      layout: 'balanced',
      title: '函数的性质',
      children: [
        { title: '单调性', children: [{ title: '增函数' }, { title: '减函数' }] },
        { title: '奇偶性', children: [{ title: '奇函数' }, { title: '偶函数' }] },
        { title: '最值', children: [{ title: '最大值' }, { title: '最小值' }] },
      ],
    },
  },
  {
    file: '02-思维导图-向右生长.svg',
    spec: {
      type: 'mindmap',
      layout: 'right',
      title: '函数的性质',
      children: [
        { title: '单调性', children: [{ title: '增函数' }, { title: '减函数' }] },
        { title: '奇偶性', children: [{ title: '奇函数' }, { title: '偶函数' }] },
        { title: '最值', children: [{ title: '最大值' }, { title: '最小值' }] },
      ],
    },
  },
  {
    file: '03-括号图.svg',
    spec: {
      type: 'brace',
      title: '细胞的结构',
      children: [
        { title: '细胞膜', children: [{ title: '控制物质进出' }, { title: '进行细胞间信息交流' }] },
        { title: '细胞质', children: [{ title: '细胞质基质' }, { title: '细胞器' }] },
        { title: '细胞核', children: [{ title: '遗传信息库' }, { title: '控制代谢' }] },
      ],
    },
  },
  {
    file: '04-流程图.svg',
    spec: {
      type: 'flow',
      steps: [
        { text: '开始', kind: 'start' },
        { text: '读取题目条件', kind: 'process' },
        {
          text: '能否用基本不等式？',
          kind: 'decision',
          branches: [
            { label: '能', steps: [{ text: '凑定值后求最值' }] },
            { label: '不能', steps: [{ text: '换元或配方法' }] },
          ],
        },
        { text: '检验等号成立条件', kind: 'process' },
        { text: '结束', kind: 'end' },
      ],
    },
  },
  {
    file: '05-时间轴.svg',
    spec: {
      type: 'timeline',
      items: [
        { when: '1919年5月', text: '五四运动爆发', detail: '新民主主义革命开端' },
        { when: '1921年7月', text: '中国共产党成立' },
        { when: '1949年10月', text: '中华人民共和国成立' },
      ],
    },
  },
  {
    file: '06-鱼骨图.svg',
    spec: {
      type: 'fishbone',
      effect: '实验误差偏大',
      categories: [
        { name: '人', causes: ['读数不规范', '操作不熟练'] },
        { name: '机', causes: ['仪器未校准'] },
        { name: '料', causes: ['试剂变质'] },
        { name: '法', causes: ['步骤漏项'] },
      ],
    },
  },
  {
    file: '07-概念关系图.svg',
    spec: {
      type: 'concept',
      center: 'A',
      nodes: [
        { id: 'A', text: '函数' },
        { id: 'B', text: '定义域' },
        { id: 'C', text: '值域' },
        { id: 'D', text: '对应法则' },
        { id: 'E', text: '单调性' },
      ],
      links: [
        { from: 'A', to: 'B', label: '有' },
        { from: 'A', to: 'C', label: '有' },
        { from: 'A', to: 'D', label: '有' },
        { from: 'E', to: 'A', label: '研究' },
      ],
    },
  },
];

fs.mkdirSync(outDir, { recursive: true });
let bad = 0;
for (const { file, spec } of SAMPLES) {
  const { svg, width, height, type } = buildDiagramSvg(spec);
  const problems = [];
  if (!svg.startsWith('<svg ')) problems.push('svg 起头异常');
  if (/NaN|undefined|\bnull\b/.test(svg)) problems.push('SVG 里出现 NaN/undefined/null');
  if (!(width > 0 && height > 0)) problems.push('尺寸非法');
  if (problems.length) { bad++; console.error(`❌ ${file}：${problems.join('；')}`); continue; }
  fs.writeFileSync(path.join(outDir, file), svg, 'utf8');
  console.log(`✅ ${file}  ${type} ${width}×${height}  ${(Buffer.byteLength(svg, 'utf8') / 1024).toFixed(1)} KB`);
}
console.log(`\n产物目录：docs/samples（${SAMPLES.length} 个，失败 ${bad} 个）`);
if (bad) process.exit(1);
