// 2026-09：各教辅类型栏目标题风格套（COLUMN_STYLE_SETS）
// 结构语义确定性保留：仅当栏目名恰与该类型默认套（a）逐一相同时替换字面（note 不变），
// exam 蓝本不轮换；b/c/d 为手动固定套（与名称样式同款交互）；subject 定制栏目与默认套不同名时防误伤原样返回。
import { describe, it, expect } from 'vitest';
import {
  COLUMN_STYLE_SETS,
  applyColumnStyle,
  applyTaskColumnStyle,
  resolveColumnStyleId,
  buildTeachingInjection,
  TEACHING_STAGE_NAMES,
  TEACHING_SUBJECT_BLUEPRINTS,
} from '../../src/config/teachingBlueprints.js';

const mkSections = (names) => names.map((name) => ({ name, note: `note-${name}` }));

describe('栏目标题风格套（2026-09）', () => {
  it('8 个教辅类型每型 4 套（a 默认 + b/c/d），且每套栏目数与默认套一致', () => {
    const types = ['practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review'];
    expect(Object.keys(COLUMN_STYLE_SETS).sort()).toEqual([...types].sort());
    for (const t of types) {
      const pool = COLUMN_STYLE_SETS[t];
      const n = pool.a.columns.length;
      expect(['a', 'b', 'c', 'd'].every((id) => pool[id].columns.length === n), `${t} 套内栏目数不一致`).toBe(true);
    }
  });

  it('applyColumnStyle：命中默认套名才替换并保留 note；类型/套未知或栏目不匹配原样返回', () => {
    const trio = mkSections(['基础建构任务', '探究进阶任务', '迁移创新任务']);
    const out = applyColumnStyle(trio, 'practice', 'c');
    expect(out.map((s) => s.name)).toEqual(['知识奠基', '变式进阶', '综合创新']);
    expect(out[0].note).toBe('note-基础建构任务');

    const summary = mkSections(['知识框架', '重点梳理', '易错辨析', '典型例题']);
    expect(applyColumnStyle(summary, 'summary', 'b').map((s) => s.name)).toEqual(['结构导图', '要点详解', '误区警示', '示范例题']);

    // 未知类型/未知套/名称不匹配 → 原样
    expect(applyColumnStyle(trio, 'summary', 'b')[0].name).toBe('基础建构任务');
    expect(applyColumnStyle(trio, 'practice', 'x')[0].name).toBe('基础建构任务');
    const custom = mkSections(['看拼音写词语', '积累默写', '书写格']);
    expect(applyColumnStyle(custom, 'dictation', 'b').map((s) => s.name)).toEqual(['看拼音写词语', '积累默写', '书写格']);
    // 兼容别名仍指向 practice
    expect(applyTaskColumnStyle(trio, 'd')[0].name).toBe('夯实基础');
  });

  it('buildTeachingInjection：非 exam 类型指定套生效、默认原样；subject 定制不同名不误伤；exam 蓝本不经此函数', () => {
    const b = buildTeachingInjection({ genType: 'practice', stage: 'primary_high', subject: '数学', columnStyle: 'b' });
    expect(b).toContain('基础过关');
    expect(b).not.toContain('基础建构任务');
    const rev = buildTeachingInjection({ genType: 'review', stage: 'middle', subject: '语文', columnStyle: 'b' });
    expect(rev).toContain('结构导图');
    expect(rev).not.toContain('知识框架');
    const sum = buildTeachingInjection({ genType: 'summary', stage: 'primary_high', subject: '数学', columnStyle: 'c' });
    expect(sum).toContain('思维地图');
    const def = buildTeachingInjection({ genType: 'practice', stage: 'primary_high', subject: '语文' });
    expect(def).toContain('基础建构任务');
    // 语文 dictation 定制栏目（看拼音写词语/积累默写/书写格）与默认套不同名 → 套不生效
    const zhDict = buildTeachingInjection({ genType: 'dictation', stage: 'primary_low', subject: '语文', columnStyle: 'b' });
    expect(zhDict).toContain('看拼音写词语');
    expect(zhDict).not.toContain('必背闯关');
  });

  it('resolveColumnStyleId：手动固定直达；空=自动——无范围键回默认 a，同范围稳定、跨范围错开', () => {
    expect(resolveColumnStyleId('practice', 'b', '')).toBe('b');
    expect(resolveColumnStyleId('practice', 'c', 'Unit 1 Try your best')).toBe('c');
    expect(resolveColumnStyleId('practice', '', '')).toBe('a');
    expect(resolveColumnStyleId('practice', '', 'Unit 1')).toBe(resolveColumnStyleId('practice', '', 'Unit 1'));
    const poolIds = ['a', 'b', 'c', 'd'];
    expect(poolIds).toContain(resolveColumnStyleId('practice', '', 'Unit 1 Try your best'));
    // 同范围稳定 → 注入两次得到同一套
    const a = buildTeachingInjection({ genType: 'practice', stage: 'primary_high', subject: '数学', columnStyle: resolveColumnStyleId('practice', '', 'Unit 1') });
    const b = buildTeachingInjection({ genType: 'practice', stage: 'primary_high', subject: '数学', columnStyle: resolveColumnStyleId('practice', '', 'Unit 1') });
    expect(a).toBe(b);
  });

  it('注入清除出处措辞（2026-09 全文不标出处）：summary/review/reading/special 教辅结构不出现"出处"', () => {
    for (const [t, s] of [['summary', '数学'], ['review', '语文'], ['reading', '语文'], ['special', '数学']]) {
      const inj = buildTeachingInjection({ genType: t, stage: 'primary_high', subject: s });
      expect(inj, `${t}|${s}`).not.toContain('出处');
    }
  });

  it('🔴 自动轮换落点实测（2026-09-10）：同范围稳定、跨范围错开——practice 的 Unit1→c 与产物一致', () => {
    // 实测值：Unit 1 Try your best→c（与九年级英语 Unit1 课时练产物实际使用的套一致）
    expect(resolveColumnStyleId('practice', '', 'Unit 1 Try your best')).toBe('c');
    // 连续单元错开（4 个一组覆盖 a/b/c/d，不出现"所有单元一个样"）
    const seq = ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4'].map((s) => resolveColumnStyleId('practice', '', s));
    expect(new Set(seq).size).toBe(4);
    // 同范围两次稳定
    expect(resolveColumnStyleId('practice', '', 'Unit 1')).toBe(resolveColumnStyleId('practice', '', 'Unit 1'));
    // 无范围键（整册）→ 默认套 a
    expect(resolveColumnStyleId('practice', '', '')).toBe('a');
  });

  it('🔴 栏目说明与套名解绑：注入文本中「说明」部分不得出现任何套名（防换套后名与说明不符）', () => {
    // 说明按"层级/位置"给（基础层→进阶→综合），对 4 套名字均成立；若把套名写进说明，
    // 换套后就会出现"标题叫 A、说明里写着 B"的错位——此测试锁住该不变量。
    // 全量覆盖：8 类型 × 4 套 × 全部学段 ×（各学科定制 + 通用 + 跨学科样本）。
    const stages = Object.keys(TEACHING_STAGE_NAMES);
    const subjects = [...Object.keys(TEACHING_SUBJECT_BLUEPRINTS), '', '物理', '数学'];
    const combos = [];
    for (const stage of stages) for (const subject of subjects) combos.push({ stage, subject });

    let checked = 0;
    for (const [type, pool] of Object.entries(COLUMN_STYLE_SETS)) {
      const names = [...new Set(Object.values(pool).flatMap((s) => s.columns))];
      for (const c of combos) {
        for (const id of ['a', 'b', 'c', 'd']) {
          const inj = buildTeachingInjection({ genType: type, ...c, columnStyle: id });
          if (!inj) continue;
          for (const line of inj.split('\n')) {
            if (!line.startsWith('· ')) continue;
            const note = line.includes('——') ? line.split('——').slice(1).join('——') : '';
            for (const n of names) {
              expect(note.includes(n), `${type}/${id} [${c.stage}/${c.subject || '-'}] 说明含套名「${n}」：${line}`).toBe(false);
            }
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(100); // 防"组合没跑满"导致空转假通过
  });
});
