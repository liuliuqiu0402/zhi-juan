// 生成/更新分值块快照（**刻意的一步**）。
// 覆盖两块：`【分值标注】` 与 `【卷面自洽】`（后者含"只出一次／不逐题复述"与其管辖域：只管标题与说明、不管标分）。
// 用途：`tests/config/scoreClauseSnapshot.test.js` 逐字比对——拆并、调序、换词都会红。
// 只有确认新文本确实是想要的（并且真机验证过标分结果）才运行本脚本更新快照，并把快照一起提交。
// 用法：node scripts/snapshotScoreClause.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPromptTemplate } from '../src/config/promptLibrary.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests/fixtures/scoreClause.exam.snapshot.txt');
const SEP = '\n\n===== 8< =====\n\n';
const BLOCKS = ['【分值标注】', '【卷面自洽】'];

const tpl = getPromptTemplate({ grade: 'primary_low', subject: '数学', genType: 'exam' }).template;
const grab = (head) => {
  const i = tpl.indexOf(`\n${head}\n`);
  if (i < 0) return '';
  const rest = tpl.slice(i + 1);
  const j = rest.indexOf('\n\n【');
  return (j < 0 ? rest : rest.slice(0, j)).trim();
};

const parts = [];
for (const head of BLOCKS) {
  const raw = grab(head);
  if (!raw) {
    console.error(`✗ 没取到 ${head}，未写入`);
    process.exit(1);
  }
  // 块名行作快照分节标题，正文不再重复一行块名
  const body = raw.startsWith(`${head}\n`) ? raw.slice(head.length + 1).trim() : raw;
  parts.push(`${head}\n${body}`);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${parts.join(SEP)}\n`, 'utf8');
const total = parts.reduce((a, p) => a + p.length, 0);
console.log(`✓ 已写入快照：${path.relative(ROOT, OUT)}（${BLOCKS.length} 块 / ${total} 字）`);
