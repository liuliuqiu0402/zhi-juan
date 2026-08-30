// 教辅结构蓝本库测试（类型 × 学段 三维度覆盖 + 注入块组装）
// ============================================================
// 🔴 目的：锁定"教辅 8 类 × 5 学段"结构标准齐全的契约——
//    - 每类型都有栏目框架 + 5 学段参数（题量/字数/时长底线）
//    - buildTeachingInjection 输出栏目框架与底线，注入到非 exam 生成指令尾部
//    - exam 不经过教辅蓝本（走 examPaperBlueprints）
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  TEACHING_BLUEPRINTS, TEACHING_GEN_TYPES,
  getTeachingBlueprint, buildTeachingInjection,
} from '@/config/teachingBlueprints.js';
import { setLibToggle } from '@/utils/libToggles.js';

const STAGES = ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'];

describe('教辅蓝本三维度覆盖（类型 × 学段）', () => {
  it('8 类教辅全部有蓝本（不含 exam）', () => {
    expect(TEACHING_GEN_TYPES.sort()).toEqual(
      ['practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review'].sort()
    );
    for (const g of TEACHING_GEN_TYPES) {
      expect(TEACHING_BLUEPRINTS[g].sections.length, `类型 ${g} 缺栏目框架`).toBeGreaterThanOrEqual(2);
      expect(TEACHING_BLUEPRINTS[g].label).toBeTruthy();
    }
  });

  it('每个类型都覆盖 5 个学段要求（题量底线为程序护栏配置，教辅不含考试时长）', () => {
    for (const g of TEACHING_GEN_TYPES) {
      for (const s of STAGES) {
        const bp = getTeachingBlueprint({ genType: g, stage: s });
        expect(bp, `${g}|${s} 蓝本缺失`).toBeTruthy();
        expect(bp.stageParams.volume, `${g}|${s} 缺题量/篇幅底线（程序护栏配置）`).toBeTruthy();
        expect('duration' in bp.stageParams, `${g}|${s} 教辅不应含时长`).toBe(false);
        expect(bp.stageKey).toBe(s);
      }
    }
  });

  it('exam 不经过教辅蓝本', () => {
    expect(getTeachingBlueprint({ genType: 'exam', stage: 'middle' })).toBeNull();
    expect(buildTeachingInjection({ genType: 'exam', stage: 'middle' })).toBe('');
  });

  it('8 类型 × 5 学段学段要求全部完善（无空 note）', () => {
    for (const g of TEACHING_GEN_TYPES) {
      for (const s of STAGES) {
        const bp = getTeachingBlueprint({ genType: g, stage: s });
        expect(bp.stageParams.note?.trim(), `${g}|${s} 学段要求为空`).toBeTruthy();
      }
    }
  });

  it('学段键归一：中文学段标签/年级可命中', () => {
    expect(getTeachingBlueprint({ genType: 'practice', stage: '小学低段' }).stageKey).toBe('primary_low');
    expect(getTeachingBlueprint({ genType: 'practice', stage: '初中' }).stageKey).toBe('middle');
    expect(getTeachingBlueprint({ genType: 'practice', stage: '二年级' }).stageKey).toBe('primary_low');
    expect(getTeachingBlueprint({ genType: 'practice', stage: '五年级' }).stageKey).toBe('primary_high');
    expect(getTeachingBlueprint({ genType: 'reading', stage: '高一' }).stageKey).toBe('high');
  });
});

describe('buildTeachingInjection（教辅结构注入块）', () => {
  it('输出栏目框架 + 学段要求（题量/时长不注入 prompt）', () => {
    const inject = buildTeachingInjection({ genType: 'reading', stage: 'middle' });
    expect(inject).toContain('【教辅结构（通用·阅读训练·初中）');
    expect(inject).toContain('栏目框架');
    expect(inject).toContain('原创选文');
    expect(inject).toContain('分层设题');
    expect(inject).toContain('学段要求');
    expect(inject).toContain('区分观点与事实'); // 初中阅读学段要求（非连续性文本已改中性的"材料形式多样"）
    expect(inject).not.toContain('题量与时长');
    expect(inject).not.toContain('500-900字'); // 篇幅底线归程序护栏，不注入 AI
  });

  it('学段差异化：低段与高段学段要求不同', () => {
    const low = buildTeachingInjection({ genType: 'reading', stage: 'primary_low' });
    const high = buildTeachingInjection({ genType: 'reading', stage: 'high' });
    expect(low).toContain('选文短小');
    expect(high).toContain('多角度理解与思辨');
  });

  it('课时练含三段式栏目与学段要求（内容底线不注入）', () => {
    const inject = buildTeachingInjection({ genType: 'practice', stage: 'primary_mid' });
    expect(inject).toContain('基础建构任务');
    expect(inject).toContain('探究进阶任务');
    expect(inject).toContain('迁移创新任务');
    expect(inject).toContain('学段要求');
    expect(inject).not.toContain('栏目完整、板块分明');
  });

  it('默写积累含学科中立栏目（篇幅底线不注入）', () => {
    const inject = buildTeachingInjection({ genType: 'dictation', stage: 'primary_low' });
    expect(inject).toContain('基础默写');
    expect(inject).not.toContain('4-8条');
  });

  it('错题本含五段结构（原题→归因→解法→变式→策略）', () => {
    const inject = buildTeachingInjection({ genType: 'errorbook', stage: 'middle' });
    expect(inject).toContain('原题重现');
    expect(inject).toContain('错误归因');
    expect(inject).toContain('正确解法');
    expect(inject).toContain('同类变式');
    expect(inject).toContain('解题策略');
  });
});

describe('教辅蓝本学科维度（三维度：学科×类型×学段）', () => {
  it('语文已定制：课时练栏目学科化（字词句/语段/写话），标记 custom', () => {
    const bp = getTeachingBlueprint({ genType: 'practice', stage: 'primary_low', subject: '语文' });
    expect(bp.custom).toBe(true);
    expect(bp.subject).toBe('语文');
    expect(bp.key).toBe('语文|practice|primary_low');
    const sections = bp.sections.map((s) => s.name).join('|');
    expect(sections).toContain('基础建构任务');
    expect(sections).toContain('探究进阶任务');
    expect(sections).toContain('迁移创新任务');
  });

  it('语文课时练栏目导向含学科语义（语段阅读/写话）', () => {
    const inject = buildTeachingInjection({ genType: 'practice', stage: 'primary_mid', subject: '语文' });
    expect(inject).toContain('语文·课时练');
    expect(inject).toContain('语段阅读与表达运用');
    expect(inject).toContain('生活化口语表达或写话');
  });

  it('未注册学科回退通用默认：栏目为通用、注入标"通用·"', () => {
    const bp = getTeachingBlueprint({ genType: 'practice', stage: 'middle', subject: '未知学科' });
    expect(bp.custom).toBe(false);
    expect(bp.subject).toBe('未知学科');
    const inject = buildTeachingInjection({ genType: 'practice', stage: 'middle', subject: '未知学科' });
    expect(inject).toContain('通用·课时练');
    // 学段要求仍按学段注入（初中）
    expect(inject).toContain('学段要求');
  });

  it('语文全 8 类教辅均有学科定制栏目', () => {
    for (const g of ['practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review']) {
      const bp = getTeachingBlueprint({ genType: g, stage: 'primary_mid', subject: '语文' });
      expect(bp?.custom, `语文 ${g} 未学科定制`).toBe(true);
      expect(bp.sections.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('数学已定制：课时练栏目学科化（情境考查/真实问题解决），标记 custom', () => {
    const bp = getTeachingBlueprint({ genType: 'practice', stage: 'primary_low', subject: '数学' });
    expect(bp.custom).toBe(true);
    expect(bp.subject).toBe('数学');
    const inject = buildTeachingInjection({ genType: 'practice', stage: 'primary_low', subject: '数学' });
    expect(inject).toContain('数学·课时练');
    expect(inject).toContain('核心知识点，在情境中考查');
    expect(inject).toContain('真实问题解决');
  });

  it('数学全 8 类教辅均有学科定制栏目（默写积累改造为公式法则/情境填空）', () => {
    for (const g of ['practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review']) {
      const bp = getTeachingBlueprint({ genType: g, stage: 'middle', subject: '数学' });
      expect(bp?.custom, `数学 ${g} 未学科定制`).toBe(true);
      expect(bp.sections.length).toBeGreaterThanOrEqual(2);
    }
    const dict = buildTeachingInjection({ genType: 'dictation', stage: 'middle', subject: '数学' });
    expect(dict).toContain('数学·默写积累');
    expect(dict).toContain('公式法则');
    expect(dict).toContain('情境填空');
  });

  it('英语已定制：课时练含语篇/交际语义，默写积累为词汇句型/语音/四线三格', () => {
    const bp = getTeachingBlueprint({ genType: 'practice', stage: 'primary_low', subject: '英语' });
    expect(bp.custom).toBe(true);
    const inject = buildTeachingInjection({ genType: 'practice', stage: 'primary_low', subject: '英语' });
    expect(inject).toContain('英语·课时练');
    expect(inject).toContain('语篇语境中的综合运用');
    expect(inject).toContain('真实交际任务');
    const dict = buildTeachingInjection({ genType: 'dictation', stage: 'primary_low', subject: '英语' });
    expect(dict).toContain('英语·默写积累');
    expect(dict).toContain('词汇句型');
    expect(dict).toContain('书写载体规格');
    expect(dict).not.toContain('四线三格'); // 载体硬编码已移除，交由书写载体规则按学段限定
    // 英语中/高学段默写纸同样不得出现四线三格（书写格仅英语中段由载体规则注入）
    const dictHigh = buildTeachingInjection({ genType: 'dictation', stage: 'high', subject: '英语' });
    expect(dictHigh).not.toContain('四线三格');
  });

  it('英语全 8 类教辅均有学科定制栏目', () => {
    for (const g of ['practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review']) {
      const bp = getTeachingBlueprint({ genType: g, stage: 'middle', subject: '英语' });
      expect(bp?.custom, `英语 ${g} 未学科定制`).toBe(true);
      expect(bp.sections.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('科学已定制：课时练含观察/实验/生活实践语义，默写积累改造为科学概念/观察记录', () => {
    const bp = getTeachingBlueprint({ genType: 'practice', stage: 'primary_low', subject: '科学' });
    expect(bp.custom).toBe(true);
    const inject = buildTeachingInjection({ genType: 'practice', stage: 'primary_low', subject: '科学' });
    expect(inject).toContain('科学·课时练');
    expect(inject).toContain('生活现象与观察');
    expect(inject).toContain('观察与实验任务');
    expect(inject).toContain('观察自然、制作模型');
    const dict = buildTeachingInjection({ genType: 'dictation', stage: 'middle', subject: '科学' });
    expect(dict).toContain('科学·默写积累');
    expect(dict).toContain('科学概念');
    expect(dict).toContain('观察记录');
  });

  it('科学全 8 类教辅均有学科定制栏目', () => {
    for (const g of ['practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review']) {
      const bp = getTeachingBlueprint({ genType: g, stage: 'primary_mid', subject: '科学' });
      expect(bp?.custom, `科学 ${g} 未学科定制`).toBe(true);
      expect(bp.sections.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('物理已定制：课时练含实验探究/作图计算语义，学科级学段要求（初中/高中两档）', () => {
    const bp = getTeachingBlueprint({ genType: 'practice', stage: 'middle', subject: '物理' });
    expect(bp.custom).toBe(true);
    const inject = buildTeachingInjection({ genType: 'practice', stage: 'middle', subject: '物理' });
    expect(inject).toContain('物理·课时练');
    expect(inject).toContain('概念、规律与公式');
    expect(inject).toContain('实验探究任务');
    expect(inject).toContain('生活、科技、工程应用');
    expect(inject).toContain('从生活走向物理'); // 学科级学段要求·初中（课标课程理念）
    const high = buildTeachingInjection({ genType: 'practice', stage: 'high', subject: '物理' });
    expect(high).toContain('物理观念与科学思维'); // 学科级学段要求·高中
    const dict = buildTeachingInjection({ genType: 'dictation', stage: 'middle', subject: '物理' });
    expect(dict).toContain('物理·默写积累');
    expect(dict).toContain('概念规律');
    expect(dict).toContain('单位常量');
  });

  it('物理全 8 类教辅均有学科定制栏目', () => {
    for (const g of ['practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review']) {
      const bp = getTeachingBlueprint({ genType: g, stage: 'middle', subject: '物理' });
      expect(bp?.custom, `物理 ${g} 未学科定制`).toBe(true);
      expect(bp.sections.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('其余 10 科（化学/生物/历史/地理/思政/道法/信息/音乐/美术/体育）全 8 类均有学科定制', () => {
    const rest = ['化学', '生物', '历史', '地理', '思想政治', '道德与法治', '信息科技', '音乐', '美术', '体育'];
    for (const subj of rest) {
      const stage = subj === '思想政治' ? 'high' : subj === '信息科技' ? 'primary_mid' : 'middle';
      for (const g of ['practice', 'special', 'preview', 'reading', 'summary', 'dictation', 'errorbook', 'review']) {
        const bp = getTeachingBlueprint({ genType: g, stage, subject: subj });
        expect(bp?.custom, `${subj} ${g} 未学科定制`).toBe(true);
        expect(bp.sections.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('理科新科：化学默写积累为化学用语/概念规律，历史课时练含时间轴/论从史出，体育课时练含动作要领', () => {
    const chem = buildTeachingInjection({ genType: 'dictation', stage: 'middle', subject: '化学' });
    expect(chem).toContain('化学·默写积累');
    expect(chem).toContain('化学用语');
    expect(chem).toContain('2022年版义务教育化学课标核心素养');
    const hist = buildTeachingInjection({ genType: 'practice', stage: 'middle', subject: '历史' });
    expect(hist).toContain('历史·课时练');
    expect(hist).toContain('时间轴/地图情境');
    expect(hist).toContain('论从史出');
    const pe = buildTeachingInjection({ genType: 'practice', stage: 'middle', subject: '体育' });
    expect(pe).toContain('体育·课时练');
    expect(pe).toContain('动作要领');
  });
});

describe('教辅结构条目停用（工具库开关）', () => {
  it('停用学科定制 → 无教辅结构注入（null）', () => {
    // 前置：语文课时练是学科定制
    expect(getTeachingBlueprint({ genType: 'practice', stage: 'primary_low', subject: '语文' }).custom).toBe(true);
    setLibToggle('blueprint', '语文|practice', false);
    expect(getTeachingBlueprint({ genType: 'practice', stage: 'primary_low', subject: '语文' })).toBeNull();
    expect(buildTeachingInjection({ genType: 'practice', stage: 'primary_low', subject: '语文' })).toBe('');
    setLibToggle('blueprint', '语文|practice', true);
    expect(getTeachingBlueprint({ genType: 'practice', stage: 'primary_low', subject: '语文' }).custom).toBe(true);
  });

  it('停用通用回退行（无学科定制）只影响该学科，其他学科不受影响', () => {
    // 前置：未知学科 practice 无学科定制（通用回退）
    expect(getTeachingBlueprint({ genType: 'practice', stage: 'primary_low', subject: '未知学科' }).custom).toBe(false);
    setLibToggle('blueprint', '未知学科|practice', false);
    expect(getTeachingBlueprint({ genType: 'practice', stage: 'primary_low', subject: '未知学科' })).toBeNull();
    // 其他学科（数学，学科定制）不受影响
    expect(getTeachingBlueprint({ genType: 'practice', stage: 'primary_low', subject: '数学' }).custom).toBe(true);
    setLibToggle('blueprint', '未知学科|practice', true);
  });
});

describe('回归：教辅结构注入无数字区间（防诱导 AI 精确计数）', () => {
  const RANGE_RE = /\d\s*[-–—~～至]\s*\d/;
  it('全部 类型×学段×学科 注入块不含数字区间（题量/篇幅底线归程序护栏 volume，不注入）', () => {
    const subjects = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '思想政治', '道德与法治', '信息科技', '音乐', '美术', '体育', '科学', '未知学科', ''];
    const stages = ['primary_low', 'primary_mid', 'primary_high', 'middle', 'high'];
    for (const g of TEACHING_GEN_TYPES) {
      for (const s of stages) {
        for (const subj of subjects) {
          const inject = buildTeachingInjection({ genType: g, stage: s, subject: subj });
          if (!inject) continue;
          expect(RANGE_RE.test(inject), `${subj || '*'} ${g} ${s} 注入含数字区间：\n${inject}`).toBe(false);
        }
      }
    }
  });

  it('栏目框架 note 已去数字（summary/review/special/preview 抽查）', () => {
    const summary = buildTeachingInjection({ genType: 'summary', stage: 'primary_high', subject: '' });
    expect(summary).toContain('列出易错点并辨析');
    expect(summary).not.toContain('2-3');
    const review = buildTeachingInjection({ genType: 'review', stage: 'primary_high', subject: '' });
    expect(review).not.toContain('2-3');
    expect(review).not.toContain('3-5');
    const special = buildTeachingInjection({ genType: 'special', stage: 'primary_high', subject: '语文' });
    expect(special).toContain('按本单元内容分板块');
    expect(special).not.toContain('2-4');
    const preview = buildTeachingInjection({ genType: 'preview', stage: 'primary_low', subject: '数学' });
    expect(preview).toContain('明确本课时概念与技能目标');
    expect(preview).toContain('自检题检测预习效果');
    expect(preview).not.toContain('1-2');
    expect(preview).not.toContain('2-4');
  });
});
