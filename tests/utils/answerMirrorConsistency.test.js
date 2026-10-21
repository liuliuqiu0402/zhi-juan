// 回归：正文标题被 B 合成后，**答案区同名大题标题必须镜像同一括注**（2026-10-21 真机实证）
// ============================================================
// 真机现象（二年级数学·阶段测评）：正文「一、直接写出得数（第1、2小题各6分，第3小题2分，共14分）」，
//   答案区却是「一、直接写出得数（共14分）」——两处不一致。
// 本文件用**最小同形样本**把这件事钉住（不依赖真机产物）。
// ============================================================
import { describe, it, expect } from 'vitest';
import { auditExamPaper } from '../../src/utils/examValidator.js';

const run = (h) => auditExamPaper(h, { subject: '数学', stage: 'primary_mid', genType: 'exam' }).html;
const heads = (h) => [...h.matchAll(/<h[2-4]>([\s\S]*?)<\/h[2-4]>/g)].map((m) => m[1].trim());

// 同档：三道小题都由逐题标分合成「每题X分」
const SAME = [
  '<h1>阶段测评</h1>',
  '<h3>一、直接写出得数（共14分）</h3>',
  '<p>1. 3×5＝____　2×6＝____　4×3＝____　5×5＝____　6×2＝____　1×5＝____（每式1分，共6分）</p>',
  '<p>2. 4×6＝____　3×3＝____　5×2＝____　6×6＝____　2×2＝____　5×4＝____（每式1分，共6分）</p>',
  '<p>3. 6×2＋6＝____　5×4－5＝____（每式1分，共2分）</p>',
  '<h2>参考答案与评分标准</h2>',
  '<h3>一、直接写出得数（共14分）</h3>',
  '<p>1.（6分）15　12　12　25　12　5</p>',
  '<p>2.（6分）24　9　10　36　4　20</p>',
  '<p>3.（2分）18　15</p>',
].join('\n');

describe('正文↔答案区 标题一致（B 合成后）', () => {
  it('多档合成：两处括注必须相同', () => {
    const hs = heads(run(SAME));
    const both = hs.filter((t) => t.startsWith('一、'));
    expect(both.length).toBe(2);
    expect(both[0], '正文按逐题总分合成').toBe('一、直接写出得数（第1、2小题各6分，第3小题2分，共14分）');
    expect(both[1], '答案区须镜像同一括注').toBe(both[0]);
  });

  it('答案区原本写成裸（14分）：仍须镜像到与正文一致', () => {
    const hs = heads(run(SAME.replace(/<h3>一、直接写出得数（共14分）<\/h3>\s*<p>1\./, '<h3>一、直接写出得数（14分）</h3>\n<p>1.')));
    const both = hs.filter((t) => t.startsWith('一、'));
    expect(both.length).toBe(2);
    expect(both[1], '答案区须镜像同一括注').toBe(both[0]);
  });

  it('答案区标题写成加粗段落（真机形态）时也必须镜像', () => {
    const html = SAME.replace(
      '<h2>参考答案与评分标准</h2>\n<h3>一、直接写出得数（共14分）</h3>',
      '<h2>参考答案与评分标准</h2>\n<p><strong>一、直接写出得数（共14分）</strong></p>',
    );
    const out = run(html);
    const hs = heads(out);
    const both = hs.filter((t) => t.startsWith('一、'));
    expect(both.length, '正文一处标题').toBe(1);
    expect(both[0]).toBe('一、直接写出得数（第1、2小题各6分，第3小题2分，共14分）');
    // 答案区（段落形态）里的那处标题也必须同步为同一括注（按“同一括注出现两处”判，不限定是否保留 <strong>）
    const label = '第1、2小题各6分，第3小题2分，共14分';
    expect((out.match(new RegExp(label, 'g')) || []).length, '正文＋答案区各一处同一括注').toBe(2);
  });
});
