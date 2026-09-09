// 2026-09：课时练三阶栏目标题风格套（TASK_COLUMN_STYLE_SETS）
// 结构语义确定性保留：只替换"基础建构/探究进阶/迁移创新"三阶栏目标题字面（note/层级语义不变），
// 默认套 a 之外提供 b/c/d 手动固定套（与名称样式同款交互）；exam 蓝本与其他教辅类型不轮换。
import { describe, it, expect } from 'vitest';
import {
  TASK_COLUMN_STYLE_SETS,
  applyTaskColumnStyle,
  buildTeachingInjection,
} from '../../src/config/teachingBlueprints.js';

const defaultTrio = () => [
  { name: '基础建构任务', note: '覆盖本课时全部核心知识点' },
  { name: '探究进阶任务', note: '变式与综合运用' },
  { name: '迁移创新任务', note: '开放性任务' },
  { name: '附赠栏目', note: '不动' },
];

describe('课时练栏目标题风格套（2026-09）', () => {
  it('提供 4 套（a 默认 + b/c/d），每套 3 个栏目标题', () => {
    const ids = Object.keys(TASK_COLUMN_STYLE_SETS);
    expect(ids).toEqual(['a', 'b', 'c', 'd']);
    for (const s of Object.values(TASK_COLUMN_STYLE_SETS)) expect(s.columns.length).toBe(3);
    expect(TASK_COLUMN_STYLE_SETS.a.columns).toEqual(['基础建构任务', '探究进阶任务', '迁移创新任务']);
  });

  it('applyTaskColumnStyle：仅替换默认三阶名，保留 note 与其余栏目；未知套回默认', () => {
    const out = applyTaskColumnStyle(defaultTrio(), 'c');
    expect(out.map((s) => s.name)).toEqual(['知识奠基', '变式进阶', '综合创新', '附赠栏目']);
    expect(out[0].note).toBe('覆盖本课时全部核心知识点');
    expect(applyTaskColumnStyle(defaultTrio(), 'x')[0].name).toBe('基础建构任务');
    // 非默认三阶结构不误伤
    const other = [{ name: '原创选文', note: 'a' }, { name: '分层设题', note: 'b' }];
    expect(applyTaskColumnStyle(other, 'b').map((s) => s.name)).toEqual(['原创选文', '分层设题']);
  });

  it('buildTeachingInjection：practice 指定套生效、默认套原样；其他类型不轮换', () => {
    const b = buildTeachingInjection({ genType: 'practice', stage: 'primary_high', subject: '数学', columnStyle: 'b' });
    expect(b).toContain('基础过关');
    expect(b).not.toContain('基础建构任务');
    const d = buildTeachingInjection({ genType: 'practice', stage: 'primary_high', subject: '英语', columnStyle: 'd' });
    expect(d).toContain('实践挑战');
    const def = buildTeachingInjection({ genType: 'practice', stage: 'primary_high', subject: '语文' });
    expect(def).toContain('基础建构任务');
    // 非 practice 忽略 style（review 栏目结构不变）
    const rev = buildTeachingInjection({ genType: 'review', stage: 'middle', subject: '数学', columnStyle: 'b' });
    expect(rev).toContain('知识框架');
    expect(rev).not.toContain('基础过关');
  });
});
