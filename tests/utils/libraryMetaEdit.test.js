// 元数据补标规则回归（2026-09-20 用户："要不然老数据就不能按规则归类了"）
// ============================================================
// 锁三条联动规则：①册次只对高中有意义；②填了册次就清遗留年级；③没册次时不碰年级（不把标识抹白）。
// 规则写错的后果很具体：会存下"小学 + 必修1"这种矛盾组合（而册次被生成链路当教材标识用），
// 或者把老数据里的"高二"一并抹掉、反而比改版前更没有标识。
import { describe, it, expect } from 'vitest';
import {
  STAGE_CHOICES, applyLibraryMetaEdit, needsMetaBackfill,
} from '../../src/utils/libraryMetaEdit.js';

const book = (extra = {}) => ({ id: 'b1', name: '某教材', stage: '', subject: '', ...extra });

describe('applyLibraryMetaEdit：字段联动规则', () => {
  it('补标学段与学科（老数据最典型的用法）', () => {
    const b = book();
    const r = applyLibraryMetaEdit(b, { stage: '初中', subject: '英语' });
    expect(r.changed).toBe(true);
    expect(b.stage).toBe('初中');
    expect(b.subject).toBe('英语');
  });

  it('🔴 规则①：学段改成非高中 → 册次一律清空（不留"小学 + 必修1"这种矛盾组合）', () => {
    const b = book({ stage: '高中', volume: '必修1', subject: '英语' });
    applyLibraryMetaEdit(b, { stage: '小学' });
    expect(b.stage).toBe('小学');
    expect(b.volume).toBe('');
  });

  it('🔴 规则②：高中填了册次 → 清掉遗留年级（与导入落库/存量回填同一口径）', () => {
    const b = book({ stage: '高中', subject: '英语', grade: '高一' });
    applyLibraryMetaEdit(b, { stage: '高中', volume: '选择性必修2' });
    expect(b.volume).toBe('选择性必修2');
    expect(b.grade).toBe('');
  });

  it('🔴 规则③：高中但没拿到册次 → 不碰遗留年级（老数据的"高二"至少还能显示）', () => {
    const b = book({ stage: '高中', subject: '英语', grade: '高二' });
    const r = applyLibraryMetaEdit(b, { stage: '高中', volume: '' });
    expect(b.grade).toBe('高二');
    expect(r.changed).toBe(false); // 什么都没变，不该报"已修改"
  });

  it('只改学科时，其余字段一律沿用现值（不误清）', () => {
    const b = book({ stage: '高中', volume: '必修1', subject: '' });
    applyLibraryMetaEdit(b, { subject: '数学' });
    expect(b).toMatchObject({ stage: '高中', subject: '数学', volume: '必修1' });
  });

  it('清空学科 → 存空串（界面归入「未标注学科」，而不是变成 undefined/未定义）', () => {
    const b = book({ stage: '小学', subject: '语文' });
    applyLibraryMetaEdit(b, { subject: '' });
    expect(b.subject).toBe('');
    expect(needsMetaBackfill(b)).toBe(true);
  });

  it('不改 name / id（补标只动元数据，与改名、路径自愈互不干扰）', () => {
    const b = book({ stage: '高中' });
    applyLibraryMetaEdit(b, { stage: '初中', subject: '物理', volume: '必修1' });
    expect(b.name).toBe('某教材');
    expect(b.id).toBe('b1');
  });

  it('幂等：同一份补标重复执行两次，第二次应报"未变更"', () => {
    const b = book();
    expect(applyLibraryMetaEdit(b, { stage: '小学', subject: '数学' }).changed).toBe(true);
    expect(applyLibraryMetaEdit(b, { stage: '小学', subject: '数学' }).changed).toBe(false);
  });

  it('空条目/无参 → 不抛错、报未变更', () => {
    expect(applyLibraryMetaEdit(null, { stage: '小学' }).changed).toBe(false);
    expect(applyLibraryMetaEdit(undefined).changed).toBe(false);
  });
});

describe('needsMetaBackfill：缺学段或学科即为待补', () => {
  it('两类缺失都算，都补上就不算', () => {
    expect(needsMetaBackfill({ stage: '小学', subject: '数学' })).toBe(false);
    expect(needsMetaBackfill({ stage: '', subject: '数学' })).toBe(true);
    expect(needsMetaBackfill({ stage: '小学', subject: '' })).toBe(true);
    expect(needsMetaBackfill({})).toBe(true);
    expect(needsMetaBackfill()).toBe(true);
  });
});

describe('STAGE_CHOICES：与全项目三档学段名一致（不许出现"高一"这类年级值）', () => {
  it('恰好三档，且是中文粗学段名', () => {
    expect(STAGE_CHOICES).toEqual(['小学', '初中', '高中']);
  });
});
