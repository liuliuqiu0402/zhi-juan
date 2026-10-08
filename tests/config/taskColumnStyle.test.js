// 2026-09：各教辅类型栏目标题风格套（COLUMN_STYLE_SETS）
// 结构语义确定性保留：仅当栏目名恰与该类型默认套（a）逐一相同时替换字面（note 不变），
// exam 蓝本不轮换；''=自动轮换（按次：每次生成推进一格 a→b→c→d→a，持久化），a/b/c/d=手动固定套；
// subject 定制栏目与默认套不同名时防误伤原样返回。
import { describe, it, expect } from 'vitest';
import {
  COLUMN_STYLE_SETS,
  applyColumnStyle,
  applyTaskColumnStyle,
  resolveColumnStyleId,
  resolveColumnStyleChoices,
  peekAutoColumnStyleId,
  advanceAutoColumnStyleId,
  __resetColumnStyleCounters,
  buildTeachingInjection,
  TEACHING_STAGE_NAMES,
  TEACHING_SUBJECT_BLUEPRINTS,
  ERRORBOOK_FACET_NAMES,
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
    const trio = mkSections(['基础建构', '探究进阶', '迁移创新']);
    const out = applyColumnStyle(trio, 'practice', 'c');
    expect(out.map((s) => s.name)).toEqual(['知识梳理', '变式练习', '综合提升']);
    expect(out[0].note).toBe('note-基础建构');

    // 🔴 2026-09-28（正规形态）：summary 补「方法提炼」栏后默认套为 5 栏
    const summary = mkSections(['知识框架', '重点梳理', '易错辨析', '典型例题', '方法提炼']);
    expect(applyColumnStyle(summary, 'summary', 'b').map((s) => s.name)).toEqual(['知识梳理', '要点详解', '易错辨析', '例题解析', '方法提炼']);

    // 未知类型/未知套/名称不匹配 → 原样
    expect(applyColumnStyle(trio, 'summary', 'b')[0].name).toBe('基础建构');
    expect(applyColumnStyle(trio, 'practice', 'x')[0].name).toBe('基础建构');
    // 2026-10-08（第 5 批 dictation〔169〕·乙案）：语文 dictation 名池学段中立化（原"看拼音写词语/积累默写/书写格"）
    //   ⇒ 样本随实况更新；仍与默认套 a 不同名 ⇒ 原样返回
    const custom = mkSections(['字词积累', '积累默写', '书写呈现']);
    expect(applyColumnStyle(custom, 'dictation', 'b').map((s) => s.name)).toEqual(['字词积累', '积累默写', '书写呈现']);
    // 兼容别名仍指向 practice
    expect(applyTaskColumnStyle(trio, 'd')[0].name).toBe('基础巩固');
  });

  it('buildTeachingInjection：非 exam 类型指定套生效、默认原样；subject 定制不同名不误伤；exam 蓝本不经此函数', () => {
    const b = buildTeachingInjection({ genType: 'practice', stage: 'primary_high', subject: '数学', columnStyle: 'b' });
    expect(b).toContain('基础练习');
    expect(b).not.toContain('基础建构');
    const rev = buildTeachingInjection({ genType: 'review', stage: 'middle', subject: '语文', columnStyle: 'b' });
    expect(rev).toContain('知识概览');
    expect(rev).not.toContain('知识框架');
    const sum = buildTeachingInjection({ genType: 'summary', stage: 'primary_high', subject: '数学', columnStyle: 'c' });
    expect(sum).toContain('知识网络');
    const def = buildTeachingInjection({ genType: 'practice', stage: 'primary_high', subject: '语文' });
    expect(def).toContain('基础建构');
    // 语文 dictation 定制栏目（字词积累/积累默写/书写呈现；2026-10-08〔169〕学段中立化前＝"看拼音写词语/积累默写/书写格"）
    //   与默认套不同名 → 套不生效
    const zhDict = buildTeachingInjection({ genType: 'dictation', stage: 'primary_low', subject: '语文', columnStyle: 'b' });
    expect(zhDict).toContain('字词积累');
    expect(zhDict).not.toContain('内容积累');
  });

  it('resolveColumnStyleId：手动固定直达；空=自动取「当前待用套」（不推进）', () => {
    __resetColumnStyleCounters();
    expect(resolveColumnStyleId('practice', 'b')).toBe('b');
    expect(resolveColumnStyleId('practice', 'c')).toBe('c');
    expect(resolveColumnStyleId('practice', '')).toBe('a');
    // 手动固定不影响自动计数（peek 仍是 a）
    expect(resolveColumnStyleId('practice', 'd')).toBe('d');
    expect(resolveColumnStyleId('practice', '')).toBe('a');
    // 未知类型（exam）无风格套 → a
    expect(resolveColumnStyleId('exam', '')).toBe('a');
    expect(resolveColumnStyleId('exam', 'b')).toBe('a');
    // 自动取的是同一值 → 注入两次得到同一套（预览与本次生成一致）
    const ins1 = buildTeachingInjection({ genType: 'practice', stage: 'primary_high', subject: '数学', columnStyle: resolveColumnStyleId('practice', '') });
    const ins2 = buildTeachingInjection({ genType: 'practice', stage: 'primary_high', subject: '数学', columnStyle: resolveColumnStyleId('practice', '') });
    expect(ins1).toBe(ins2);
    expect(ins1).toContain('基础建构');
  });

  it('注入清除出处措辞（2026-09 全文不标出处）：summary/review/reading/special 教辅结构不出现"出处"', () => {
    for (const [t, s] of [['summary', '数学'], ['review', '语文'], ['reading', '语文'], ['special', '数学']]) {
      const inj = buildTeachingInjection({ genType: t, stage: 'primary_high', subject: s });
      expect(inj, `${t}|${s}`).not.toContain('出处');
    }
  });

  it('🔴 自动轮换=按次（2026-09-10 改）：每生成一次换下一套 a→b→c→d→a，各类型独立计数', () => {
    __resetColumnStyleCounters();
    // 起始待用套 = 默认套 a
    expect(peekAutoColumnStyleId('practice')).toBe('a');
    expect(resolveColumnStyleId('practice', '')).toBe('a');
    // 生成一次 → 推进一格
    expect(advanceAutoColumnStyleId('practice')).toBe('b');
    expect(peekAutoColumnStyleId('practice')).toBe('b');
    expect(resolveColumnStyleId('practice', '')).toBe('b');
    expect(advanceAutoColumnStyleId('practice')).toBe('c');
    expect(advanceAutoColumnStyleId('practice')).toBe('d');
    // 4 套循环回起点
    expect(advanceAutoColumnStyleId('practice')).toBe('a');
    // 手动固定：不推进、不改变待用套
    expect(resolveColumnStyleId('practice', 'c')).toBe('c');
    expect(peekAutoColumnStyleId('practice')).toBe('a');
    // 各资料类型独立计数（summary 未生成过 → 仍是 a）
    expect(peekAutoColumnStyleId('summary')).toBe('a');
    // 未知类型 → a，且推进无效
    expect(peekAutoColumnStyleId('exam')).toBe('a');
    expect(advanceAutoColumnStyleId('exam')).toBe('a');
  });

  it('🔴 按次轮换的注入效果：同一类型连续三次生成的栏目标题依次为 a/b/c 三套', () => {
    __resetColumnStyleCounters();
    const titles = [];
    for (let i = 0; i < 3; i++) {
      const id = resolveColumnStyleId('practice', '');
      const inj = buildTeachingInjection({ genType: 'practice', stage: 'primary_high', subject: '数学', columnStyle: id });
      titles.push(inj.split('\n').filter((l) => l.startsWith('· '))[0]);
      advanceAutoColumnStyleId('practice');
    }
    expect(titles[0]).toContain('基础建构');
    expect(titles[1]).toContain('基础练习');
    expect(titles[2]).toContain('知识梳理');
  });

  it('🔴 栏目说明与套名解绑：注入文本中「说明」部分不得出现任何套名（防换套后名与说明不符）', () => {
    // 说明按"层级/位置"给（基础层→进阶→综合），对 4 套名字均成立；若把套名写进说明，
    // 换套后就会出现"标题叫 A、说明里写着 B"的错位——此测试锁住该不变量。
    // 全量覆盖：8 类型 × 4 套 × 全部学段 ×（各学科定制 + 通用 + 跨学科样本）。
    // 🔓 2026-09-17（栏目名去「任务」后新增的口径）：practice 三栏改名「基础建构／探究进阶／迁移创新」后，
    //    a 套名与**课标层名**重叠——「迁移创新」既是本栏默认名，也是英语课标活动类型名／语文课标层名，
    //    说明里出现它属课标口径（且该栏固定承载该层，换套后说明仍与该层相符），不构成"标题与说明错位"；
    //    纯风格套名（含 b/c/d 全部、以及 a 中非课标词的基础建构/探究进阶）仍一律禁止出现在说明里。
    const KEEP_IN_NOTE = new Set(['迁移创新']);
    const stages = Object.keys(TEACHING_STAGE_NAMES);
    const subjects = [...Object.keys(TEACHING_SUBJECT_BLUEPRINTS), '', '物理', '数学'];
    const combos = [];
    for (const stage of stages) for (const subject of subjects) combos.push({ stage, subject });

    let checked = 0;
    for (const [type, pool] of Object.entries(COLUMN_STYLE_SETS)) {
      const names = [...new Set(Object.values(pool).flatMap((s) => s.columns))].filter((n) => !KEEP_IN_NOTE.has(n));
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

// 2026-09-28：「名称样式/组织风格」下拉候选去重 —— 与默认套 a 逐字相同的套无信息量，应被滤除
//   单一事实源：resolveColumnStyleChoices 只按 COLUMN_STYLE_SETS 的 columns 内容逐字比较（无类型名硬编码）；
//   errorbook 四套同源 ERRORBOOK_FACET_NAMES → b/c/d 与 a 等价被滤除、且四套全同故「自动轮换」亦隐藏；
//   其余类型 b/c/d 均异于 a → 候选不变，行为零变化。
describe('栏目风格套候选去重（resolveColumnStyleChoices · 单一事实源）', () => {
  it('errorbook：b/c/d 与默认套 a 逐字相同 → 候选中被滤除，仅剩 a（「自动轮换」亦因无套可轮换而滤除）', () => {
    const errorbookPool = COLUMN_STYLE_SETS.errorbook;
    // 前提核验：四套确为同一份 ERRORBOOK_FACET_NAMES（内容逐字相同，仅数组实例不同）
    expect(errorbookPool.a.columns).toEqual(ERRORBOOK_FACET_NAMES);
    for (const id of ['b', 'c', 'd']) {
      expect(errorbookPool[id].columns).toEqual(errorbookPool.a.columns);
    }
    const { ids, autoRotatable } = resolveColumnStyleChoices(errorbookPool);
    // 等价项已被滤除：候选只剩默认套 a
    expect(ids).toEqual(['a']);
    expect(ids).not.toContain('b');
    expect(ids).not.toContain('c');
    expect(ids).not.toContain('d');
    // 四套全同 → 无套可轮换 → 「🔄 自动轮换」候选项一并滤除（autoRotatable=false 即调用方不产出该项）
    expect(autoRotatable).toBe(false);
  });

  it('其它类型候选不受影响：b/c/d 均异于 a → 四套齐全且可轮换', () => {
    const untouched = ['practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'review'];
    for (const t of untouched) {
      const { ids, autoRotatable } = resolveColumnStyleChoices(COLUMN_STYLE_SETS[t]);
      expect(ids, `${t} 候选被误改`).toEqual(['a', 'b', 'c', 'd']);
      expect(autoRotatable, `${t} 轮换开关被误改`).toBe(true);
    }
  });

  it('滤除依据是逐字比较（非类型名硬编码）：同内容异名亦滤、仅顺序不同不滤', () => {
    const sameCols = ['分项一', '分项二', '分项三'];
    // 合成"易错题本式"内容池（键名与 errorbook 无关）→ 仍按内容滤除 b，保留差异套 c
    const synthetic = { a: { columns: [...sameCols] }, b: { columns: [...sameCols] }, c: { columns: ['分项一', '分项二', '分项四'] } };
    expect(resolveColumnStyleChoices(synthetic)).toEqual({ ids: ['a', 'c'], autoRotatable: true });
    // 把 errorbook 那套内容原样搬到任意键名下 → 结果与 errorbook 完全一致（内容决定，与类型名无关）
    const renamed = { a: COLUMN_STYLE_SETS.errorbook.a, b: COLUMN_STYLE_SETS.errorbook.b, c: COLUMN_STYLE_SETS.errorbook.c, d: COLUMN_STYLE_SETS.errorbook.d };
    expect(resolveColumnStyleChoices(renamed)).toEqual({ ids: ['a'], autoRotatable: false });
    // 逐字（含顺序）比较：栏目名仅顺序不同即视为不同套，不得误滤
    const reordered = { a: { columns: ['甲', '乙', '丙'] }, b: { columns: ['乙', '甲', '丙'] } };
    expect(resolveColumnStyleChoices(reordered).ids).toEqual(['a', 'b']);
  });

  it('健壮性：无 a／空池／非对象 → 空候选不轮换（不误伤调用方）', () => {
    expect(resolveColumnStyleChoices(undefined)).toEqual({ ids: [], autoRotatable: false });
    expect(resolveColumnStyleChoices({})).toEqual({ ids: [], autoRotatable: false });
    expect(resolveColumnStyleChoices({ b: { columns: ['x'] } })).toEqual({ ids: [], autoRotatable: false });
  });
});
