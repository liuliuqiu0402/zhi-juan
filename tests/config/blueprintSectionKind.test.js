/**
 * 蓝图栏目性质 sectionKindOf（唯一出口）·单测
 * ============================================================
 * 用户裁定（2026-09-26）：蓝图结构里**有的能作大类层、有的不能**，须有区分；
 *   能作大类的正是与正规调研一致的那些（语文课标内容领域/实践活动名；英语"部分"前缀）。
 * 2026-09-27 实现为**按名称性质**判定的单一出口（不按学科名硬编码，将来新增学科自动纳入）。
 */
import { describe, it, expect } from 'vitest';
import { sectionKindOf, EXAM_BLUEPRINTS } from '../../src/config/examPaperBlueprints.js';

describe('蓝图栏目性质 sectionKindOf', () => {
  it('三类判定：领域型（可作大类）/ 部分前缀（可作部分层）/ 作答形式型（不设大类）', () => {
    expect(sectionKindOf('积累与运用'), '课标内容领域 → 大类').toBe('domain');
    expect(sectionKindOf('阅读与鉴赏')).toBe('domain');
    expect(sectionKindOf('语言文字运用')).toBe('domain');
    expect(sectionKindOf('听力·听音选图'), '带·前缀 → 部分层').toBe('part');
    expect(sectionKindOf('笔试·看图连线')).toBe('part');
    expect(sectionKindOf('直接写得数'), '作答形式名 → 不设大类').toBe('item');
    expect(sectionKindOf('选择题')).toBe('item');
    expect(sectionKindOf('非选择题')).toBe('item');
    expect(sectionKindOf('')).toBe('item');
  });

  it('全蓝图（全部栏目）：取值合法；且交叉校验与 2026-09-26 全键审计一致', () => {
    const byKind = { domain: 0, part: 0, item: 0 };
    let total = 0;
    for (const [key, bp] of Object.entries(EXAM_BLUEPRINTS)) {
      const subject = key.split('|')[0];
      for (const s of bp.sections || []) {
        const k = sectionKindOf(s.name);
        expect(['domain', 'part', 'item'], `${key} 的「${s.name}」性质非法`).toContain(k);
        byKind[k] += 1; total += 1;
        // 实测分布交叉校验（由本测试首跑得出，非事先假设）：域型（能力/内容领域名，如"积累与运用""写作"）
        //   只出现在**语言类学科**（语文/英语）；部分型（"·"前缀）只出现在英语；
        //   数学/理化生/道法/科学/信息/音体美/史地/思政等**一律为题型型**（不设大类层）。
        if (k === 'domain') expect(['语文', '英语'], `域型栏目应只在语言类学科：${key}「${s.name}」`).toContain(subject);
        if (k === 'part') expect(subject, `部分型栏目应只在英语：${key}「${s.name}」`).toBe('英语');
      }
    }
    expect(total, '蓝图栏目总数应 > 200（全键审计为 249）').toBeGreaterThan(200);
    expect(byKind.domain, '语文的内容领域应有域型栏目').toBeGreaterThan(0);
    expect(byKind.part, '英语的部分前缀应有部分型栏目').toBeGreaterThan(0);
    expect(byKind.item, '其余学科的题型名应占多数').toBeGreaterThan(byKind.domain);
  });
});
