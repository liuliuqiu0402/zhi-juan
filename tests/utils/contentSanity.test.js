// 内容合理性扫描（Content Sanity）单测：确定性违规信号检测（荒谬计数倒推 / 可数对象小数直写 / 近似等号 / 同单位换算数值突变 / 空位宽度单一化 / 双载体泄漏 / 任务可作答性错配）
import { describe, it, expect } from 'vitest';
import { detectCountingFakes, detectUnitMutations, detectUniformBlankWidths, detectCountDecimals, detectApproxEqualsSign, detectDoubleCarrierLeak, detectPhonemeConflicts, detectQuoteConflicts, sanityScan, sanityNoteOf } from '../../src/utils/contentSanity.js';

describe('contentSanity 内容合理性扫描', () => {
  it('荒谬计数情境：小数 + 可数量词 + （即N）倒推 → 检出', () => {
    expect(detectCountingFakes('共卖出 0.86 张（即 86 张），单价 3.2 元。')).toHaveLength(1);
    expect(detectCountingFakes('平均分给 0.09 人（即 9 人）平均承担。')).toHaveLength(1);
    // 正常的小数量（长度/金额/质量）不误报
    expect(detectCountingFakes('彩带长 1.2 米，每张标签 0.24 米。')).toEqual([]);
  });

  it('同单位换算数值突变（2.05 千米（换算后 205 千米））→ 检出；不同单位不误报', () => {
    expect(detectUnitMutations('全程计划行驶 2.05 千米（单位换算后为 205 千米）。')).toHaveLength(1);
    // 不同单位（千米→米）是正常换算，不命中同单位突变规则
    expect(detectUnitMutations('全长 2.05 千米，等于 2050 米。')).toEqual([]);
    expect(detectUnitMutations('一段路长 2.05 千米，就是 2.05 千米。')).toEqual([]); // 同数值同单位不报
  });

  it('sanityScan 汇总两类信号；无违规则为空', () => {
    expect(sanityScan('卖出 0.86 张（即 86 张），行驶 2.05 千米（换算为 205 千米）。').length).toBe(2);
    expect(sanityScan('彩带 1.2 米，标签长 0.24 米，可剪 5 张。')).toEqual([]);
    expect(sanityScan('')).toEqual([]);
  });

  it('sanityNoteOf：只陈述事实、不诱导改法；空信号无提示', () => {
    const issues = sanityScan('买入 0.5 千克苹果（即 0.5 千克），共 2.5 元。');
    expect(sanityNoteOf(issues)).toBe('');
    const note = sanityNoteOf(['计数对象被写成小数后倒推整数：0.09人（即9人）']);
    expect(note).toContain('内容自洽性扫描');
    expect(note).toContain('计数对象被写成小数后倒推整数');
    expect(sanityNoteOf([])).toBe('');
  });

  it('空位宽度单一化（≥5 处 blank-N 且档位全同，如全 blank-8）→ 检出（未按答案长度逐空定宽）', () => {
    const html = [
      '<p>1. 把 6.25 看成整数 <u class="blank-8">&emsp;</u>，积是 <u class="blank-8">&emsp;</u>。</p>',
      '<p>2. 得数保留两位小数：<u class="blank-8">&emsp;</u>。</p>',
      '<p>3. 商的小数部分数字 <span class="blank-8">&emsp;</span> 依次重复。</p>',
      '<p>4. 结果是 <span class="blank-8">&emsp;</span>。</p>',
      '<p>5. 应付 <u class="blank-8">&emsp;</u> 元。</p>',
    ].join('\n');
    expect(detectUniformBlankWidths(html)).toHaveLength(1);
    expect(sanityScan(html)).toHaveLength(1);
  });

  it('空位宽度有差异（blank-1/blank-2/blank-4 混用）或数量 <5 → 不误报', () => {
    const varied = [
      '<p>1. <u class="blank-1">&emsp;</u> <u class="blank-2">&emsp;</u> <u class="blank-4">&emsp;</u></p>',
      '<p>2. <u class="blank-1">&emsp;</u> <u class="blank-2">&emsp;</u> <u class="blank-4">&emsp;</u></p>',
    ].join('\n');
    expect(detectUniformBlankWidths(varied)).toEqual([]);
    const few = '<p>1. <u class="blank-8">&emsp;</u> <u class="blank-8">&emsp;</u> <u class="blank-8">&emsp;</u> <u class="blank-8">&emsp;</u></p>';
    expect(detectUniformBlankWidths(few)).toEqual([]); // 仅 4 处 → 不触发
    // math-circle 算式填空圈（固定 1.8em 一格一符）不计入
    const circles = '<p>' + '<span class="math-circle-blank-18">&nbsp;</span>'.repeat(6) + '</p>';
    expect(detectUniformBlankWidths(circles)).toEqual([]);
  });

  it('答案本来等长 → 正常宽度全一致不误报（宽度以答案长度为准，不为差异而差异）', () => {
    const html = [
      '<p>1. 商是 <u class="blank-2">&emsp;</u>。</p>',
      '<p>2. 余数是 <u class="blank-2">&emsp;</u>。</p>',
      '<p>3. 差是 <u class="blank-2">&emsp;</u>。</p>',
      '<p>4. 积是 <u class="blank-2">&emsp;</u>。</p>',
      '<p>5. 和是 <u class="blank-2">&emsp;</u>。</p>',
    ].join('\n');
    expect(detectUniformBlankWidths(html)).toEqual([]); // 全 2 字位（答案均 2 位数）→ 正常
  });

  it('任务-可作答性错配：给加点字"选择读音"却无选项 → 检出；有 A. 选项 → 不报', () => {
    const noOpt = '<p>1. 给加点字选择正确的读音。</p><p>孟浩然的"然"读作(　　　　)。</p>';
    expect(sanityScan(noOpt)).toHaveLength(1);
    const withOpt = '<p>2. 为加点字选择正确读音。</p><p>A. rán　B. zhǔ</p>';
    expect(sanityScan(withOpt)).toEqual([]);
  });

  it('任务-载体错配：声明"写在横线上"却只有括号空 → 检出；有横线空/书写行 → 不报', () => {
    const onlyParen = '<p>1. 把下面的字写在横线上。</p><p>（1）dé(　　　　)高望重</p>';
    expect(sanityScan(onlyParen)).toHaveLength(1);
    const withLine = '<p>2. 把下面的字写在横线上。</p><p>（1）dé <u class="blank-4">&emsp;</u></p>';
    expect(sanityScan(withLine)).toEqual([]);
  });
});

describe('contentSanity 2026-09 A-101 产物审计回归（可数对象小数直写 / 近似等号 / 双载体泄漏）', () => {
  it('可数对象个数直写小数（1.5 张书签）→ 检出', () => {
    expect(detectCountDecimals('小雅买了 1.5 张书签，一共要付多少元？')).toHaveLength(1);
    expect(detectCountDecimals('如果卖出 2.5 件笔筒，总利润是多少元？')).toHaveLength(1);
    // 比率/单价/连续量小数不误报（倍/元/米/千克/小时 均非可数对象量词）
    expect(detectCountDecimals('定价为成本的 1.5 倍，每件杯垫售价 2.5 元。')).toEqual([]);
    expect(detectCountDecimals('彩带长 1.2 米，剪成长 0.24 米的小段。')).toEqual([]);
    // "个/名/步"高频比率共现 → 不在此检测器直报（保留在倒推检测内）
    expect(detectCountDecimals('增长了 0.5 个百分点')).toEqual([]);
  });

  it('取整说理与位数语境的"小数+量词"不误报（2026-09 用户实证两例）', () => {
    // 取整说理："0.25 本不足 1 本" 是纪律要求写的取整理由（余下不足 1 个单位），非真实计数
    expect(detectCountDecimals('估算约 6 本，因为 0.25 本不足 1 本，不能进 1，只能舍去。')).toEqual([]);
    expect(detectCountDecimals('精确结果是 6.25 本，不够 1 本的部分舍去，取整得 6 本。')).toEqual([]);
    // 位数语境："4.5 位数不够" = 4.5 的（小数）位数不够（省略"的"），"位数"是抽象位数
    expect(detectCountDecimals('把 4.5 和 0.25 的小数点同时向右移动两位，4.5 位数不够，补 0 成 450。')).toEqual([]);
    // 真违规不受影响
    expect(detectCountDecimals('小雅买了 1.5 张书签，一共要付多少元？')).toHaveLength(1);
  });

  it('近似值语境（保留 X 位小数）算式用 ＝ → 检出；用 ≈ 不报；非近似句不报', () => {
    expect(detectApproxEqualsSign('(1) 得数保留一位小数：7.2 × 0.09＝(　　　　)')).toHaveLength(1);
    expect(detectApproxEqualsSign('(1) 得数保留一位小数：7.2 × 0.09≈(　　　　)')).toEqual([]);
    expect(detectApproxEqualsSign('(1) 4.6 × 2.8＝(　　　　)。')).toEqual([]); // 精确计算用 ＝ 正常
    expect(detectApproxEqualsSign('(1) 得数保留一位小数：7.2 × 0.09＝0.648≈0.6')).toEqual([]); // 结果已写、无空位
  });

  it('双载体泄漏：空位前残留 ≥2 空白宽 → 检出（归一链已剥除后的兜底）', () => {
    expect(detectDoubleCarrierLeak('0.09＝　　　<span class="blank-8">&emsp;</span>')).toHaveLength(1);
    expect(detectDoubleCarrierLeak('0.09＝<span class="blank-8">&emsp;</span>')).toEqual([]);
    expect(detectDoubleCarrierLeak('0.09＝ <span class="blank-8">&emsp;</span>')).toEqual([]); // 单空格=自然间隔
  });

  it('sanityScan 汇总新信号；去重后不重复计数', () => {
    expect(sanityScan('1. 小雅买了 1.5 张书签。(1) 得数保留一位小数：7.2 × 0.09＝(　　)')).toHaveLength(2);
    expect(sanityScan('(1) 得数保留一位小数：7.2 × 0.09≈(　　)，买了 2 张书签。')).toEqual([]);
  });
});

describe('contentSanity 2026-09 同词音标资料内冲突检测（如 Chinese 末 s 实为 /z/ 而非 /ʃ/）', () => {
  it('同一单词在同一份资料内出现两套不同音标 → 检出（资料内不自洽）', () => {
    const html = '<p>school /skuːl/ 中 s 发 /s/。</p><p>比较：school /skul/ 的美式读法。</p>';
    expect(detectPhonemeConflicts(html)).toHaveLength(1);
    expect(detectPhonemeConflicts(html)[0]).toContain('school');
  });

  it('同词同音标重复出现 → 不误报', () => {
    expect(detectPhonemeConflicts('school /skuːl/，go to school /skuːl/。')).toEqual([]);
  });

  it('词形大小写不同视为同词（Chinese /ˌtʃaɪˈniːz/ 与 chinese /ˈtʃaɪnəs/）→ 检出', () => {
    expect(detectPhonemeConflicts('Chinese /ˌtʃaɪˈniːz/。chinese /ˈtʃaɪnəs/ 是误拼。')).toHaveLength(1);
  });

  it('跨行 HTML 中抽取正常；无音标或无词对 → 不报', () => {
    expect(detectPhonemeConflicts('<p>Chinese /ˌtʃaɪˈniːz/ 一词中 s 发 /z/。</p>')).toEqual([]);
    expect(detectPhonemeConflicts('<p>字母 s 在不同单词中有不同发音。</p>')).toEqual([]);
    expect(detectPhonemeConflicts('')).toEqual([]);
  });
});

describe('contentSanity 2026-09 同份资料引文复现一致性检测', () => {
  it('同一句引文两处高度近似但写法不一致（编辑距离≤2）→ 检出', () => {
    const html = '第1题：“床前明月光，疑是地上霜”。第2题：“床前明月光，疑是地霜”。';
    expect(detectQuoteConflicts(html)).toHaveLength(1);
    expect(detectQuoteConflicts(html)[0]).toContain('引文复现写法不一致');
  });

  it('同一句引文两处完全一致 → 不误报；不同引文 → 不报', () => {
    expect(detectQuoteConflicts('“春眠不觉晓”与“春眠不觉晓”都出自本诗。')).toEqual([]);
    expect(detectQuoteConflicts('“两个黄鹂鸣翠柳”与“一行白鹭上青天”都是对仗句。')).toEqual([]);
  });

  it('引文写法差异过大（编辑距离>2，非同一句）→ 不报', () => {
    expect(detectQuoteConflicts('“朝辞白帝彩云间”与“千里江陵一日还”同出《早发白帝城》。')).toEqual([]);
  });

  it('三种成对引号（弯引号/直双引号/单弯引号）分别识别；英文撇号不作引文', () => {
    expect(detectQuoteConflicts('“Study hard”与 "study hard" 大小写略异。')).toEqual([]); // 弯+直各自单现，不成冲突对
    expect(detectQuoteConflicts('“床前明月光，疑是地上霜”与 ‘床前明月光，疑是地霜’。')).toHaveLength(1);
    expect(detectQuoteConflicts("Let's go. children's book isn't here.")).toEqual([]);
  });

  it('sanityScan 汇总含引文冲突；HTML 标签剥离后正常', () => {
    expect(sanityScan('<p>“床前明月光，疑是地上霜”</p><p>“床前明月光，疑是地霜”</p>')).toHaveLength(1);
    expect(sanityScan('<p>“春眠不觉晓”</p><p>“春眠不觉晓”</p>')).toEqual([]);
  });
});