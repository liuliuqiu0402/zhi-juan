#!/usr/bin/env node
/**
 * 🔎 导图出稿核验（出稿后核验 · 导图）
 * ============================================================
 * 用途：拿一份**真实生成并导出**的 HTML，逐项核验"导图这一路有没有真的走通、有没有静默变糊/静默丢内容"。
 *   本脚本**零项目依赖**（纯字符串核验，可直接 node 跑，不必进 vitest）。
 *
 * 用法：
 *   node scripts/verify-diagram-export.mjs                     # 自动找候选目录里最新的 .html
 *   node scripts/verify-diagram-export.mjs "D:\path\x.html"    # 指定文件
 *   node scripts/verify-diagram-export.mjs --all               # 核验候选目录里最近 5 份
 *
 * 核验项（每条都对应一个已踩过或已识别的坑）：
 *   ① 有没有图：figure.k-diagram-figure 数量（0 = 模型没出导图块，或块没被渲染）
 *   ② 块有没有渲染：残留 class="k-diagram" = 模型出的块没渲染成功 → JSON 原文会露在正文里
 *   ③ 规格留存：data-k-spec 是否存在且是合法 JSON（排版页/换版式靠它重画）
 *   ④ 图种合法：spec.type 是否属于导图族 6 图种
 *   ⑤ 印刷可读性：SVG 宽度 > 760px 会被等比缩小，缩到多少倍、13px 字等效多少 pt（印不清就报）
 *   ⑥ SVG 健康度：坐标串里有没有 NaN / undefined（算坏了才会出现）
 *   ⑦ 自适应：<svg> 是否带 max-width:100%（不带会撑破 A4 版心）
 * ============================================================
 */
import fs from 'node:fs';
import path from 'node:path';

const PRINT_SAFE_WIDTH = 760;       // 与 src/utils/diagramBlock.js 的 PRINT_SAFE_WIDTH 同值
const VALID_TYPES = ['mindmap', 'brace', 'flow', 'timeline', 'fishbone', 'concept'];
const TYPE_LABEL = {
  mindmap: '思维导图', brace: '括号图', flow: '流程图',
  timeline: '时间轴', fishbone: '鱼骨图', concept: '概念关系图',
};

const CANDIDATE_DIRS = [
  'D:\\智卷工坊数据\\导出',
  path.join(process.env.USERPROFILE || '', 'Downloads'),
  path.join(process.env.USERPROFILE || '', 'Documents'),
];

const unesc = (s) => String(s)
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** 找候选目录里最新的 .html（跳过已核验过的 _verified） */
function findNewest(limit = 1) {
  const hits = [];
  for (const dir of CANDIDATE_DIRS) {
    let names = [];
    try { names = fs.readdirSync(dir); } catch { continue; }
    for (const n of names) {
      if (!/\.html?$/i.test(n)) continue;
      const full = path.join(dir, n);
      try {
        const st = fs.statSync(full);
        if (st.isFile()) hits.push({ full, mtime: st.mtimeMs, size: st.size });
      } catch { /* ignore */ }
    }
  }
  hits.sort((a, b) => b.mtime - a.mtime);
  return hits.slice(0, limit);
}

function verify(file) {
  const html = fs.readFileSync(file, 'utf8');
  const st = fs.statSync(file);
  const out = { file, sizeKB: +(st.size / 1024).toFixed(1), mtime: st.mtime.toLocaleString() };

  // ① 图与残留
  out.figures = (html.match(/class="[^"]*k-diagram-figure[^"]*"/g) || []).length;
  out.leftoverBlocks = (html.match(/class="[^"]*k-diagram(?![-\w])/g) || []).length;
  out.syntaxLeftover = (html.match(/&lt;div class="k-diagram"|<div class="k-diagram"/g) || []).length;

  // ③ 规格 + ④ 图种
  const specs = [];
  for (const m of html.matchAll(/data-k-spec="([^"]*)"/g)) {
    const raw = unesc(m[1]);
    let spec = null, bad = false;
    try { spec = JSON.parse(raw); } catch { bad = true; }
    specs.push({ type: spec?.type, layout: spec?.layout, bad, rawLen: raw.length });
  }
  out.specs = specs;
  out.specBad = specs.filter((s) => s.bad).length;
  out.specUnknownType = specs.filter((s) => !s.bad && !VALID_TYPES.includes(s.type)).map((s) => s.type);
  out.specTypes = [...new Set(specs.filter((s) => !s.bad).map((s) => `${TYPE_LABEL[s.type] || s.type}${s.layout ? `(${s.layout})` : ''}`))];

  // ⑤⑥⑦ SVG
  out.svgs = [];
  for (const m of html.matchAll(/<svg\b[^>]*>/g)) {
    const tag = m[0];
    const w = Number((tag.match(/\bwidth="(\d+(?:\.\d+)?)"/) || [])[1]);
    const h = Number((tag.match(/\bheight="(\d+(?:\.\d+)?)"/) || [])[1]);
    out.svgs.push({ w: Number.isFinite(w) ? w : null, h: Number.isFinite(h) ? h : null, responsive: /max-width:\s*100%/.test(tag) });
  }
  out.svgNaN = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)]
    .some((m) => /NaN|undefined/.test(m[0])) ? '疑似' : '无';
  const body = html.replace(/data-k-spec="[^"]*"/g, '');   // 规格本身不算"正文泄漏"
  out.jsonLeakInBody = /"children"\s*:|"title"\s*:/.test(body) ? '发现' : '无';

  // 评级
  const issues = [];
  if (!out.figures && !out.leftoverBlocks) issues.push('正文里根本没有导图 —— 模型没按约定出块，或生成时没走"导图式"风格');
  if (out.leftoverBlocks) issues.push(`有 ${out.leftoverBlocks} 个导图块没渲染成功（JSON 原文会露在正文里）`);
  if (out.specBad) issues.push(`${out.specBad} 张图的 data-k-spec 不是合法 JSON（排版页无法重画）`);
  if (out.specUnknownType.length) issues.push(`不认识的图种：${out.specUnknownType.join('、')}`);
  if (out.jsonLeakInBody === '发现') issues.push('正文里疑似有裸 JSON 泄漏');
  if (out.svgNaN === '疑似') issues.push('SVG 坐标串里有 NaN/undefined');
  for (const s of out.svgs) {
    if (s.w && s.w > PRINT_SAFE_WIDTH) {
      const ratio = PRINT_SAFE_WIDTH / s.w;
      issues.push(`有图宽 ${s.w}px（超 A4 版心）→ 缩到 ${ratio.toFixed(2)} 倍，13px 字≈${(13 * ratio * 0.75).toFixed(1)}pt（印出来可能偏小）`);
    }
    if (!s.responsive) issues.push(`有 <svg> 缺 max-width:100%（会撑破版心）`);
  }
  out.issues = issues;
  return out;
}

function report(r) {
  console.log('\n════════════════════════════════════════');
  console.log(`📄 ${r.file}`);
  console.log(`   ${r.sizeKB} KB · ${r.mtime}`);
  console.log(`   导图 figure：${r.figures} 张   未渲染残留：${r.leftoverBlocks} 个`);
  console.log(`   图种：${r.specTypes.join('、') || '无'}`);
  console.log(`   SVG 尺寸：${r.svgs.map((s) => `${s.w}x${s.h}${s.responsive ? '' : '(缺自适应)'}`).join(' | ') || '无'}`);
  console.log(`   规格 JSON：${r.specs.length} 份，坏 ${r.specBad} 份`);
  console.log(`   健康度：NaN/undefined=${r.svgNaN}；正文裸 JSON=${r.jsonLeakInBody}`);
  if (r.issues.length) {
    console.log('   ⚠️ 待处理：');
    for (const i of r.issues) console.log(`      - ${i}`);
  } else {
    console.log('   ✅ 全部核验项通过');
  }
}

const args = process.argv.slice(2);
const explicit = args.find((a) => !a.startsWith('--'));
const all = args.includes('--all');

const files = explicit ? [path.resolve(explicit)] : findNewest(all ? 5 : 1).map((h) => h.full);
if (!files.length) {
  console.log('没找到可核验的 HTML。候选目录：');
  for (const d of CANDIDATE_DIRS) console.log('  - ' + d);
  console.log('请把导出格式选为「HTML」后重跑本脚本，或直接把文件路径作为参数传入。');
  process.exit(2);
}
let bad = 0;
for (const f of files) {
  const r = verify(f);
  report(r);
  if (r.issues.length) bad++;
}
console.log(`\n合计核验 ${files.length} 份，${bad ? `${bad} 份有待处理项` : '全部通过'}\n`);
process.exit(bad ? 1 : 0);
