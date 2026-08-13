/**
 * 云端清洗脚本：剥离 generated_docs 表中超大头
 * 背景：AI 生成偶发嵌入 2MB+ 的 base64 图片，撑爆设备行导致 pull 超时
 * 逻辑：逐行读取 → 解压 content → 剥离 >200KB 的 data:image → 抬高 savedAt（清洗版胜出合并）→ 压缩 → 写回
 * 用法：
 *   node scripts/cleanup-cloud-huge-images.cjs --dry   （演练，只报告不写）
 *   node scripts/cleanup-cloud-huge-images.cjs          （实际执行）
 */
const fs = require('fs');
const path = require('path');
const pako = require('pako');

const DRY = process.argv.includes('--dry');

const envText = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
}
const SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const ANON_KEY = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !ANON_KEY) { console.error('❌ 未找到 Supabase 配置'); process.exit(1); }

const headers = { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY, 'Content-Type': 'application/json' };
const base = SUPABASE_URL.replace(/\/$/, '');

const MAGIC = '__Z__';
const MAX_INLINE_IMAGE = 200 * 1024;
const PLACEHOLDER = '<p style="text-align:center;color:#999;padding:8px 0;">〔图片过大，已省略〕</p>';

function decompressText(text) {
  if (!text || typeof text !== 'string' || !text.startsWith(MAGIC)) return text;
  try {
    const binary = Buffer.from(text.slice(MAGIC.length), 'base64').toString('binary');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return pako.inflate(bytes, { to: 'string' });
  } catch { return text; }
}

function compressText(text) {
  if (!text || typeof text !== 'string') return text;
  if (text.startsWith(MAGIC)) return text;
  try {
    const compressed = pako.deflate(text);
    return MAGIC + Buffer.from(compressed).toString('base64');
  } catch { return text; }
}

/** 与 contentCompress.js 保持一致的剥图逻辑 */
function sanitizeContent(html) {
  if (!html || typeof html !== 'string') return html;
  let changed = false;
  const cleaned = html.replace(/<img[^>]*src=["']data:image[^>]*>/gi, (tag) => {
    const src = tag.match(/src=["'](data:image[^"']*)["']/i)?.[1] || '';
    if (src.length > MAX_INLINE_IMAGE) { changed = true; return PLACEHOLDER; }
    return tag;
  });
  return changed ? cleaned : html;
}

(async () => {
  console.log((DRY ? '🔍 DRY-RUN 演练（不写回）' : '🧹 实际清洗执行') + '\n');

  // ① 列出所有行
  const listRes = await fetch(base + '/rest/v1/generated_docs?select=id,data', { headers });
  const rows = await listRes.json();
  if (!Array.isArray(rows)) { console.error('❌ 查询失败:', JSON.stringify(rows).slice(0, 200)); return; }

  for (const row of rows) {
    if (!Array.isArray(row.data) || row.data.length === 0) continue;
    if (String(row.id).endsWith(':deleted')) continue;

    const before = JSON.stringify(row.data).length;
    let changedDocs = 0;
    const processed = row.data.map((doc) => {
      if (!doc || typeof doc.content !== 'string') return doc;
      const plain = decompressText(doc.content);
      const cleaned = sanitizeContent(plain);
      if (cleaned !== plain) {
        changedDocs++;
        // 抬高 savedAt：保证清洗版在设备端合并时胜出（覆盖本地旧大头版）
        return { ...doc, content: compressText(cleaned), savedAt: Date.now() };
      }
      // 未变化但未压缩的 content 顺手压缩（统一云端存储格式）
      return doc.content.startsWith(MAGIC) ? doc : { ...doc, content: compressText(doc.content) };
    });
    const after = JSON.stringify(processed).length;

    if (changedDocs > 0 || after !== before) {
      console.log(
        '  · ' + row.id.padEnd(28) +
        '| 剥图 ' + changedDocs + ' 条' +
        ' | 体积 ' + (before / 1024).toFixed(0) + 'KB → ' + (after / 1024).toFixed(0) + 'KB' +
        ' (省 ' + ((before - after) / 1024).toFixed(0) + 'KB)'
      );
      if (!DRY) {
        const id = encodeURIComponent(row.id);
        const upd = await fetch(base + '/rest/v1/generated_docs?id=eq.' + id, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify({ data: processed, updated_at: new Date().toISOString() }),
        });
        if (upd.ok) console.log('    ✅ 已写回');
        else console.log('    ❌ 写回失败:', upd.status, (await upd.text()).slice(0, 120));
      }
    } else {
      console.log('  · ' + row.id.padEnd(28) + '| 无需处理（已清洁）');
    }
  }

  console.log('\n' + (DRY ? '🔍 演练完成（未做任何修改）' : '🧹 清洗完成') + '，可用 diag-cloud-size.cjs 复查');
})();
