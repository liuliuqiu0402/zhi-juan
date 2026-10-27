// 生成/更新【分值标注】整块快照（**刻意的一步**）。
// 用途：`tests/config/scoreClauseSnapshot.test.js` 对整块做**逐字比对**——任何拆分、合并、换词、调序都会红。
// 只有确认新文本确实是想要的（并且真机验证过标分结果）才运行本脚本更新快照，并把快照一起提交。
// 用法：node scripts/snapshotScoreClause.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPromptTemplate } from '../src/config/promptLibrary.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests/fixtures/scoreClause.exam.snapshot.txt');
const tpl = getPromptTemplate({ grade: 'primary_low', subject: '数学', genType: 'exam' }).template;
const block = (tpl.match(/(?:^|\n)【分值标注】\n([\s\S]*?)(?=\n\n【)/) || [, ''])[1].trim();
if (!block) {
  console.error('✗ 没取到【分值标注】块，未写入');
  process.exit(1);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${block}\n`, 'utf8');
console.log(`✓ 已写入快照：${path.relative(ROOT, OUT)}（${block.length} 字，${block.split('\n').length} 条）`);
