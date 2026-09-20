// 高中「册次」维度回归（config/highVolumes + textbookMeta + gradeStage 认知层级）
// ============================================================
// 背景（2026-09-20 用户裁定）：高中教材按"必修／选择性必修"分册，**教材本身不绑定年级**——
// 各省教学用书目录里「册次」与「使用年级」是两栏并列（使用年级写的是区间"高一年级至高三年级"），
// 且"必修＝高一"在各省不成立（山东语文必修下排第二学年；广东思想政治/物理必修到高二上才完成）。
// 故高中导入/筛选一律"认册次、不认年级"。本文件把该口径的可判定部分全部锁住。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { HIGH_VOLUMES, highVolumeOptions, detectHighVolume, hasHighVolumePreset } from '../../src/config/highVolumes.js';
import { autoDetectTextbookMeta } from '../../src/utils/textbookMeta.js';
import { resolveCompetency, gradeDisplayLabel, resolveStageKey, extractGradeNum } from '../../src/utils/gradeStage.js';
import { resolveListeningParams } from '../../src/config/listeningAudioProfile.js';
import { reconcileDomains } from '../../src/utils/domainReconciler.js';

describe('detectHighVolume：只认字面（必修/选择性必修），不做任何推测', () => {
  it('必修 的四种印法都归一到 必修N', () => {
    for (const n of ['必修第一册', '必修1', '必修一', '必修①', '必修 第一册', '数学A（必修2）']) {
      const r = detectHighVolume(n);
      expect(r.isHigh, n).toBe(true);
      expect(r.volume, n).toMatch(/^必修[1-2]$/);
    }
  });

  it('选择性必修先于必修判定（`必修1` 是 `选择性必修1` 的子串，先匹配短式必误配）', () => {
    expect(detectHighVolume('选择性必修第一册').volume).toBe('选择性必修1');
    expect(detectHighVolume('选择性必修2').volume).toBe('选择性必修2');
    expect(detectHighVolume('英语选择性必修第四册').volume).toBe('选择性必修4');
    // 哨兵掩码的第二道保险：即便选择性必修模式未命中，必修模式也不得吃到它的尾巴
    expect(detectHighVolume('选择性必修').volume).toBe('');
    expect(detectHighVolume('选择性必修').isHigh).toBe(true);
  });

  it('按上/中/下分册的写法（语文、历史）', () => {
    expect(detectHighVolume('语文必修上册').volume).toBe('必修上');
    expect(detectHighVolume('统编版语文必修下').volume).toBe('必修下');
    expect(detectHighVolume('选择性必修中册').volume).toBe('选择性必修中');
    expect(detectHighVolume('历史必修下册').volume).toBe('必修下');
  });

  it('🔴 册次不与"必修"紧邻时**留空不猜**（"历史必修（中外历史纲要下）"的"下"不紧邻必修）', () => {
    // 宁可留空让用户在界面挑（历史：必修上/下册 + 选择性必修1-3），也不放宽成"必修后任意位置找上/下"——
    // 放宽会把"必修1 下册练习"这类误配成"必修下"。沿用本仓库"猜错比不猜更糟"的既有口径。
    const r = detectHighVolume('历史必修（中外历史纲要下）');
    expect(r.isHigh).toBe(true);
    expect(r.volume).toBe('');
  });

  it('识别是通用正则、不靠枚举 —— B版必修第四册这类没进预设清单的也能认', () => {
    expect(detectHighVolume('数学B版必修第四册').volume).toBe('必修4');
    expect(HIGH_VOLUMES['数学'].some(v => v.id === '必修4')).toBe(false); // 预设只列 A 版两册
  });

  it('只写"高中"或不带序号：判为高中但册次留空（由用户界面补），不瞎猜', () => {
    const r = detectHighVolume('高中英语同步练习');
    expect(r.isHigh).toBe(true);
    expect(r.volume).toBe('');
  });

  it('非高中名称不误判', () => {
    for (const n of ['六年级上册语文', '七年级数学下册', '小学语文一年级', '']) {
      expect(detectHighVolume(n).isHigh, n).toBe(false);
    }
  });
});

describe('highVolumeOptions：预设只作界面候选', () => {
  it('按学科给该科清单，且都返回结构完整的 {id,label}', () => {
    expect(highVolumeOptions('语文').map(v => v.id)).toContain('选择性必修中');
    expect(highVolumeOptions('物理')).toHaveLength(6);
    for (const [subject, list] of Object.entries(HIGH_VOLUMES)) {
      for (const v of list) {
        expect(v.id, `${subject}:${v.id}`).toBeTruthy();
        expect(v.label, `${subject}:${v.id}`).toBeTruthy();
      }
    }
  });

  it('学科未定 → 合并全部（学科还没选也能挑册次）；学科已定但无清单 → 空（自由填写）', () => {
    const merged = highVolumeOptions('');
    expect(merged.length).toBeGreaterThan(highVolumeOptions('物理').length);
    expect(new Set(merged.map(v => v.id)).size).toBe(merged.length); // 去重
    expect(highVolumeOptions('音乐')).toEqual([]);
    expect(hasHighVolumePreset('音乐')).toBe(false);
    expect(hasHighVolumePreset('物理')).toBe(true);
  });
});

describe('autoDetectTextbookMeta：高中认册次、不认年级', () => {
  it('册次字面命中 → stage=高中 + volume', () => {
    expect(autoDetectTextbookMeta('人教版高中英语必修第一册')).toMatchObject({ stage: '高中', volume: '必修1' });
    expect(autoDetectTextbookMeta('数学A（选择性必修3）')).toMatchObject({ stage: '高中', volume: '选择性必修3' });
    expect(autoDetectTextbookMeta('统编版语文必修上册')).toMatchObject({ stage: '高中', volume: '必修上' });
  });

  it('🔴 高中绝不回填年级（认册次、不认年级）', () => {
    for (const n of ['人教版高中英语必修第一册', '物理选择性必修2', '高中化学']) {
      expect(autoDetectTextbookMeta(n).grade, n).toBe('');
    }
  });

  it('小学 1-6 年级识别不受影响（册次识别不抢学段）', () => {
    // 🔴 中文数字年级是本轮一并修的缺陷：原正则只写 `([1-6])年级`，教材名常见的"六年级上册"识别不到
    expect(autoDetectTextbookMeta('六年级上册·语文')).toMatchObject({ stage: '小学', grade: '六年级', volume: '' });
    expect(autoDetectTextbookMeta('③年级数学下册')).toMatchObject({ stage: '小学', grade: '三年级' });
    expect(autoDetectTextbookMeta('6年级数学下册')).toMatchObject({ stage: '小学', grade: '六年级' });
  });

  it('初中仍留空（文件名无学段信息，猜错比不猜更糟）', () => {
    const m = autoDetectTextbookMeta('七年级数学下册');
    expect(m.stage).toBe('');
    expect(m.grade).toBe('');
    expect(m.volume).toBe('');
  });
});

describe('resolveCompetency：认知层级只判学段、不看年级数字', () => {
  it('🔴 回归锁：高中年级为空曾被误判成小学口径"识记与理解"', () => {
    // 旧写法 `extractGradeNum(grade) <= 6 ? '识记与理解' : ...`：
    // extractGradeNum('') === 0 → 0 <= 6 成立 → 高中卷被判成"识记与理解"（小学低段口径）
    expect(resolveCompetency('高中', '')).toBe('应用与分析');
    expect(resolveCompetency('高中', '', '英语必修第一册')).toBe('应用与分析');
    // 第二处反例：册次样式串里没有中文数词/可 parse 的数字，同样落到 0
    expect(resolveCompetency('高中', '选择性必修2')).toBe('应用与分析');
    expect(resolveCompetency('初中', '')).toBe('应用与分析');
    expect(resolveCompetency('初中', '八年级')).toBe('应用与分析');
  });

  it('小学（含未标年级的小学教材）→ 识记与理解', () => {
    expect(resolveCompetency('小学', '一年级')).toBe('识记与理解');
    expect(resolveCompetency('小学', '⑥年级')).toBe('识记与理解');
    expect(resolveCompetency('小学', '', '六年级上册·语文')).toBe('识记与理解');
  });
});

describe('gradeDisplayLabel：只作提示/标题文案，高中优先册次', () => {
  it('高中 → 册次；未填册次退回年级（不把老数据变成空白）', () => {
    expect(gradeDisplayLabel('高中', '', '必修1')).toBe('必修1');
    expect(gradeDisplayLabel('高中', '高一', '选择性必修2')).toBe('选择性必修2');
    expect(gradeDisplayLabel('高中', '高一', '')).toBe('高一');
    expect(gradeDisplayLabel('高中', '', '')).toBe('');
  });

  it('其他学段 → 年级原样（不受册次影响）', () => {
    expect(gradeDisplayLabel('小学', '三年级', '必修1')).toBe('三年级');
    expect(gradeDisplayLabel('初中', '八年级', '')).toBe('八年级');
  });

  it('🔴 输出的册次不得被判定函数当作年级（resolveStageKey 仍只认学段）', () => {
    expect(resolveStageKey('高中', gradeDisplayLabel('高中', '', '必修1'))).toBe('high');
  });
});

describe('源码锁：全项目不再有"按年级数字判认知层级"的旧写法', () => {
  const SRC = path.resolve(process.cwd(), 'src');
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });

  it('`extractGradeNum(...) <= 6` 只允许出现在 gradeStage.js 的说明注释里', () => {
    const offenders = [];
    for (const file of walk(SRC)) {
      if (!/\.(js|ts|vue)$/.test(file)) continue;
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, i) => {
        if (!/extractGradeNum\([^)]*\)\s*<=\s*6/.test(line)) return;
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // 注释里作为反例保留
        offenders.push(`${path.relative(SRC, file)}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});

// ── 本轮审计发现的其它"按年级/学段"缺陷（回归锁） ──────────────────────────────
describe('extractGradeNum：学段前缀必须一起算（初/高）', () => {
  it('🔴 回归锁：`初一` 曾落成 1（只判了"高"没判"初"）→ 初中听力语速按年级细分取不到 7 档', () => {
    expect(extractGradeNum('初一')).toBe(7);
    expect(extractGradeNum('初二')).toBe(8);
    expect(extractGradeNum('初三')).toBe(9);
    expect(extractGradeNum('高一')).toBe(10);
    expect(extractGradeNum('高三')).toBe(12);
    // 小学不带学段前缀，行为不变
    expect(extractGradeNum('一年级')).toBe(1);
    expect(extractGradeNum('六年级')).toBe(6);
    expect(extractGradeNum('七年级')).toBe(7);
  });

  it('听力语速：初中写"初一"与写"七年级"必须同档（110 词/分）', () => {
    // 原缺陷：'初一' → extractGradeNum=1 → LISTENING_GRADE_WPM[1] 不存在 → 静默用八年级的 120
    expect(resolveListeningParams({ stage: '初中', grade: '初一' }).wpm).toBe(110);
    expect(resolveListeningParams({ stage: '初中', grade: '七年级' }).wpm).toBe(110);
    expect(resolveListeningParams({ stage: '初中', grade: '初三' }).wpm).toBe(130);
    // 高中不看年级（册次也不影响音频参数），固定高考档
    expect(resolveListeningParams({ stage: '高中', grade: '必修1' }).wpm).toBe(150);
    expect(resolveListeningParams({ stage: '高中', grade: '' }).wpm).toBe(150);
  });
});

describe('领域对账：高中判定收口到学段唯一事实源', () => {
  const anchors = [
    { name: '函数', specificConcepts: ['单调性'], bind: { status: 'literal' } },
    { name: '概率', specificConcepts: ['随机事件'], bind: { status: 'literal' } },
  ];
  const content = '函数 单调性 概率 随机事件';

  it('🔴 回归锁：stage 传五档键 high 与中文「高中」结果一致（原写法只认中文，传 high 会拿义教领域名对账）', () => {
    const zh = reconcileDomains({ genType: 'exam', subject: '数学', stage: '高中', content, anchors });
    const key = reconcileDomains({ genType: 'exam', subject: '数学', stage: 'high', content, anchors });
    expect(zh).not.toBeNull();
    expect(key).toEqual(zh);
  });

  it('高中缺位提示用高中课标领域名，绝不出现义教领域名', () => {
    const r = reconcileDomains({ genType: 'exam', subject: '数学', stage: 'high', content, anchors });
    expect(r.missingDomains.length).toBeGreaterThan(0);
    expect(r.missingDomains.join('、')).not.toMatch(/数与代数|图形与几何|综合与实践/);
    expect(r.missingDomains.join('、')).toMatch(/几何与代数/);
  });
});
