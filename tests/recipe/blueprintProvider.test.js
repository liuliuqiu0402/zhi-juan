// 蓝图库持久化测试（用户自定义蓝图优先于内置）
// ============================================================
// 🔴 目的：锁定"蓝图结构可维护"的契约——
//    - 用户在蓝图库面板保存后持久化（localStorage），生成时用户版优先
//    - 删除用户蓝图后回退内置；新建（内置无此 key）可独立存在
//    - 非 exam 资料类型无蓝图（findBlueprint 返回 null）
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest';
import {
  findBlueprint, saveUserBlueprint, deleteUserBlueprint, listAllBlueprints, previewWithRegion,
} from '@/config/blueprintProvider.js';

const BP_KEY = '语文|primary_low';

beforeEach(() => {
  try { localStorage.removeItem('wisdom_blueprint_library_v1'); } catch {}
});

describe('蓝图持久化与用户版优先', () => {
  it('保存后 findBlueprint 返回用户版（source=user），删除后回退内置', () => {
    // 初始：内置版
    const builtin = findBlueprint({ genType: 'exam', subject: '语文', stage: 'primary_low' });
    expect(builtin.source).toBe('builtin');
    expect(builtin.fullScore).toBe(100);
    // 保存用户版
    saveUserBlueprint(BP_KEY, {
      label: '语文·低段自定义', fullScore: 120, duration: '90分钟',
      sections: [{ name: '基础知识', score: 60, note: '自定义' }, { name: '阅读', score: 60, note: '自定义' }],
    });
    const user = findBlueprint({ genType: 'exam', subject: '语文', stage: 'primary_low' });
    expect(user.source).toBe('user');
    expect(user.fullScore).toBe(120);
    expect(user.sections[0].name).toBe('基础知识');
    // 删除 → 回退内置
    expect(deleteUserBlueprint(BP_KEY)).toBe(true);
    expect(findBlueprint({ genType: 'exam', subject: '语文', stage: 'primary_low' }).source).toBe('builtin');
  });

  it('listAllBlueprints 合并内置+用户覆盖+用户新建', () => {
    saveUserBlueprint('物理|middle', { label: '物理·初中自定义', fullScore: 90, duration: '90分钟', sections: [{ name: '选择', score: 90, note: '' }] });
    saveUserBlueprint('综合实践|middle', { label: '综合实践·初中新建', fullScore: 100, duration: '60分钟', sections: [{ name: '填空', score: 100, note: '' }] });
    const all = listAllBlueprints();
    // 内置已有 key → 用户覆盖
    const phys = all.find(b => b.key === '物理|middle');
    expect(phys.source).toBe('user');
    expect(phys.fullScore).toBe(90);
    // 内置无此 key → 用户新建（额外条目）
    const bio = all.find(b => b.key === '综合实践|middle');
    expect(bio.source).toBe('user');
    // 内置蓝本仍列出
    expect(all.find(b => b.key === '语文|primary_low').source).toBe('builtin');
    expect(all.length).toBe(55); // 54 内置（含音体美信 5 学段）+ 1 新建
  });

  it('非 exam 类型无蓝图', () => {
    expect(findBlueprint({ genType: 'practice', subject: '语文', stage: 'primary_low' })).toBeNull();
  });

  it('省市覆盖对用户版不生效（用户版整体优先）', () => {
    saveUserBlueprint(BP_KEY, { label: 'x', fullScore: 100, duration: '60分钟', sections: [{ name: 'A', score: 100, note: '' }] });
    const user = findBlueprint({ genType: 'exam', subject: '语文', stage: 'primary_low', region: '江苏·南通' });
    expect(user.source).toBe('user');
    expect(user.fullScore).toBe(100); // 未被江苏南通 150 分覆盖
  });
});

describe('省市预览 previewWithRegion（蓝图库面板显示层）', () => {
  it('内置蓝本按省市覆盖显示（初中语文 120 → 江苏·南通 150）', () => {
    const bp = listAllBlueprints().find(b => b.key === '语文|middle');
    const previewed = previewWithRegion(bp, '江苏·南通');
    expect(previewed.fullScore).toBe(150);
    expect(previewed.duration).toBe('150分钟');
    expect(previewed.preview).toBe(true);
    // 板块和 = 新总分（末大题修正闭合）
    expect(previewed.sections.reduce((s, x) => s + x.score, 0)).toBe(150);
    // 基础蓝本不受影响
    expect(bp.fullScore).toBe(120);
  });

  it('无省市/用户自定义蓝本不覆盖', () => {
    const bp = listAllBlueprints().find(b => b.key === '语文|middle');
    expect(previewWithRegion(bp, '').fullScore).toBe(120);
    saveUserBlueprint('语文|middle', { label: 'x', fullScore: 130, duration: '60分钟', sections: [{ name: 'A', score: 130, note: '' }] });
    const userBp = listAllBlueprints().find(b => b.key === '语文|middle');
    expect(previewWithRegion(userBp, '江苏·南通').fullScore).toBe(130); // 用户版不被省市覆盖
  });
});
