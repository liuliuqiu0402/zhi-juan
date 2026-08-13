/**
 * 诊断脚本：测量云端 generated_docs 表的真实数据量
 * 用途：确认 pull_generated_docs 超时的根因（行数据是否过大）
 * 运行：node scripts/diag-cloud-size.cjs
 */
const fs = require('fs');
const path = require('path');

// 读取 .env 中的 Supabase 配置
const envText = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0) {
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
    env[k] = v;
  }
}

const SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const ANON_KEY = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('❌ 未找到 Supabase 配置');
  process.exit(1);
}

(async () => {
  const base = SUPABASE_URL.replace(/\/$/, '');
  const headers = {
    apikey: ANON_KEY,
    Authorization: 'Bearer ' + ANON_KEY,
    'Content-Type': 'application/json',
  };

  console.log('🔍 查询 generated_docs 表...');
  const t0 = Date.now();
  // 只选 id 和 updated_at，先看有哪些行
  const listRes = await fetch(base + '/rest/v1/generated_docs?select=id,updated_at', { headers });
  const list = await listRes.json();
  console.log('📋 行列表（' + (Date.now() - t0) + 'ms）:');
  if (!Array.isArray(list)) {
    console.log('  查询失败:', JSON.stringify(list).slice(0, 300));
    return;
  }
  for (const row of list) {
    console.log('  -', row.id, '| updated:', row.updated_at);
  }

  // 逐行测量 data 大小
  console.log('\n📦 逐行测量 data 体积:');
  let total = 0;
  for (const row of list) {
    const id = encodeURIComponent(row.id);
    const t1 = Date.now();
    const res = await fetch(base + '/rest/v1/generated_docs?select=data&id=eq.' + id, { headers });
    const json = await res.json();
    const ms = Date.now() - t1;
    if (Array.isArray(json) && json.length > 0) {
      const sizeBytes = JSON.stringify(json[0].data).length;
      total += sizeBytes;
      const sizeKB = (sizeBytes / 1024).toFixed(1);
      const docs = Array.isArray(json[0].data) ? json[0].data.length : '?';
      const compressedCount = Array.isArray(json[0].data)
        ? json[0].data.filter(d => typeof d.content === 'string' && d.content.startsWith('__Z__')).length
        : 0;
      console.log('  -', row.id, '| 条数:', docs, '| 体积:', sizeKB + 'KB', '| 已压缩content:', compressedCount + '/' + docs, '| 单行读取耗时:', ms + 'ms');
    } else {
      console.log('  -', row.id, '| 读取失败或为空, 耗时:', ms + 'ms');
    }
  }
  console.log('\n💾 云端 generated_docs 总数据量 ≈ ' + (total / 1024 / 1024).toFixed(2) + 'MB');
})();
