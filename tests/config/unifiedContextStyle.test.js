import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  styleOptions,
  styleInstructions,
  styleOptionsForType,
  DEFAULT_STYLE_BY_TYPE,
  STYLE_REQUIRED_TYPES,
  isStyleRequiredForType,
} from '../../src/config/expertKnowledge.js';
import { getPromptTemplate } from '../../src/config/promptLibrary.js';
import { parseStyleFromInstruction } from '../../src/utils/instructionStyle.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

/**
 * 🔴 2026-09-28（用户裁定）：课标卷型（unified_context）情境口径归两课标 + 由必选降为可选、严肃卷面为默认。
 *    ① 风格描述与注入句锚到"本学科课程标准界定的情境类型"，**不得点具体题型名**、**不得出现"豁免/例外"**；
 *    ② 注入句与 framework 预生成提示**同源**（不暗示"每一小题都被同一叙事场景包裹"）；
 *    ③ exam 不再强制该风格；不选＝严肃卷面分支（不注入统一情境框架、无卷首导入语、大题标题走严肃功能性命名）；
 *       选＝统一情境框架注入 与 卷首导入语 **同向**（同一开关的两面，规则只在 promptLibrary EXAM_BASE 一处规定）；
 *    ④ 回潮守卫：旧措辞「贯穿所有题目 / 同一场景内 / 每一题都」零出现。
 * 🔴 2026-09-30（用户裁定·只给课标要求、不给做法）：② 的**否定句写法**本身被判定为**否定式植入**（要读懂须先
 *    激活"每一小题都被同一叙事场景包裹"这一图式，且"不要求"是许可语气）→ **整句删除**；守卫由"要求该句存在"
 *    改为"该句零出现"。同时删除情境链路的**做法层**（场景清单/组织序列/叙事弧线/组织指定），只留课标要求。
 */

/** 具体题型名（禁止出现在风格描述与注入句里） */
const QUESTION_TYPE_NAMES = [
  '选择题', '填空题', '判断题', '计算题', '简答题', '连线题', '排序题', '应用题', '听力题', '默写题',
];
/** 待禁字面（风格描述与注入句不得出现） */
const BANNED_WORDS = ['豁免', '例外'];
/** 旧口径回潮守卫字面（全库零出现） */
const LEGACY_PHRASES = ['贯穿所有题目', '同一场景内', '每一题都'];

const unifiedOption = () => styleOptions.find((o) => o.value === 'unified_context');
const examTemplate = () => getPromptTemplate({ grade: 'primary_low', subject: '语文', genType: 'exam' }).template;

describe('课标卷型（unified_context）：情境口径归两课标 + 由必选降为可选', () => {
  it('注入句：锚到"本学科课程标准界定的情境类型"，且不含任何题型枚举', () => {
    const s = styleInstructions.unified_context;
    expect(s).toContain('本学科课程标准界定的情境类型');
    expect(s).toContain('主题与设问在全卷连贯');
    for (const q of QUESTION_TYPE_NAMES) {
      expect(s, `注入句不得点题型名「${q}」`).not.toContain(q);
    }
    for (const w of BANNED_WORDS) {
      expect(s, `注入句不得出现「${w}」`).not.toContain(w);
    }
  });

  it('tip/desc：锚到义教 + 高中两课标；不含"豁免/例外"与任何题型名', () => {
    const opt = unifiedOption();
    expect(opt).toBeTruthy();
    const text = `${opt.desc}${opt.tip}`;
    expect(text).toContain('本学科课程标准界定的情境类型');
    expect(text, '义教课标情境表述').toContain('真实而富有意义的学习情境');
    expect(text, '高中课标情境表述').toContain('以具体情境为载体');
    // 🔴 2026-09-30（用户裁定·去指向性诱导）：该句**已整句删除**，守卫随之**反向**——
    //    它是**否定式植入**（要读懂须先激活"每一小题都被同一叙事场景包裹"这一图式；且"不要求"＝许可语气，
    //    反而把逐题包裹合法化），与本项目"去否定式列举（防反向植入）"同款裁定。不得回潮。
    expect(text, '否定式植入句不得回潮').not.toContain('不要求每一小题');
    expect(text, '同义改写（叙事场景包裹）亦不得回潮').not.toContain('叙事场景包裹');
    // 做法层同样不得回潮：情境链路只给课标要求，"与之相适的题目在其下展开"这类组织指定已删
    expect(text, '风格块不得再给组织做法').not.toContain('在其下展开');
    for (const w of [...BANNED_WORDS, ...QUESTION_TYPE_NAMES]) {
      expect(text, `tip/desc 不得含「${w}」`).not.toContain(w);
    }
  });

  it('exam 不再强制该风格：required=false；仅 exam 可选，其余 6 类恢复必选', () => {
    expect(unifiedOption().required, '课标卷型已由必选降为可选').toBe(false);
    // 🔴 2026-09-28（用户裁定·只让 exam 可选）：exam 保持可选（不选＝不注入组织风格的默认分支，
    //    卷面规则单源见 promptLibrary）；其余 6 类恢复必选；dictation/errorbook 无适用风格、免强制。
    const REQUIRED = ['practice', 'special', 'reading', 'summary', 'review', 'preview'];
    for (const t of REQUIRED) {
      expect(isStyleRequiredForType(t), `${t} 应恢复必选确认`).toBe(true);
    }
    for (const t of ['exam', 'dictation', 'errorbook']) {
      expect(isStyleRequiredForType(t), `${t} 不应强制风格确认`).toBe(false);
    }
    expect(isStyleRequiredForType(''), '未知类型不得强制').toBe(false);
  });

  it('必选判定单一事实源 STYLE_REQUIRED_TYPES：isStyleRequiredForType 只读该集合（防再漂移）', () => {
    expect(STYLE_REQUIRED_TYPES).toEqual(['practice', 'special', 'reading', 'summary', 'review', 'preview']);
    for (const t of Object.keys(DEFAULT_STYLE_BY_TYPE)) {
      expect(isStyleRequiredForType(t), `${t} 的必选判定须与 STYLE_REQUIRED_TYPES 一致`)
        .toBe(STYLE_REQUIRED_TYPES.includes(t));
    }
    // UI 生成前闸门 styleRequiredForCurrent = genTypes.some(isStyleRequiredForType)：
    //   对 6 必选类恒可触发（不再是恒 false 的死分支）
    for (const t of STYLE_REQUIRED_TYPES) {
      expect(isStyleRequiredForType(t), `闸门对 ${t} 应可达`).toBe(true);
    }
  });

  it('noApplicableStyleForCurrent 提示逻辑不变：仅 errorbook/dictation 无适用风格', () => {
    const applicable = (t) => styleOptionsForType(t).options.length > 0;
    expect(applicable('errorbook'), 'errorbook 无适用风格 → 弹窗显示"不适用"提示').toBe(false);
    expect(applicable('dictation'), 'dictation 无适用风格 → 弹窗显示"不适用"提示').toBe(false);
    // exam 仍有唯一可选项（课标卷型）→ 不显示"不适用"提示
    expect(applicable('exam')).toBe(true);
    expect(styleOptionsForType('exam').options.map((o) => o.value)).toEqual(['unified_context']);
    for (const t of STYLE_REQUIRED_TYPES) expect(applicable(t), `${t} 应有适用风格`).toBe(true);
  });

  it('默认落在严肃卷面分支：DEFAULT_STYLE_BY_TYPE.exam 不预设统一情境', () => {
    expect(DEFAULT_STYLE_BY_TYPE.exam).toBeFalsy();
    // 无默认风格 → withStyle 静默跳过（styleInstructions[''] 无键）
    expect(styleInstructions[DEFAULT_STYLE_BY_TYPE.exam || '']).toBeUndefined();
  });

  it('不选时：不注入统一情境框架、无卷首导语（严肃卷面分支）', () => {
    const tpl = examTemplate();
    // 模板正文自身不得携带风格注入标记（否则会抢占 parseStyleFromInstruction）
    expect(tpl).not.toMatch(/【\s*(?:命题风格|组织风格)\s*】/);
    // 未追加风格行 → 解析不出统一情境 → 不预生成情境框架
    const r = parseStyleFromInstruction(tpl);
    expect(r.isContextStyle).toBe(false);
    expect(r.isUnifiedContext).toBe(false);
    // 未采用统一情境 → 不写卷首导语 + 大题标题走严肃功能性命名（规则单一事实源：EXAM_BASE）
    expect(tpl, '把"未采用统一情境"分支写死在卷面格式里').toContain('未采用统一情境时');
    expect(tpl, '不写卷首导语').toContain('不写卷首导语');
    expect(tpl, '大题标题走严肃功能性命名').toContain('功能性');
  });

  it('选时：统一情境框架注入 与 卷首导语 同向（同一开关的两面，规则只在一处）', () => {
    const injected = `【组织风格】unified_context：${styleInstructions.unified_context}`;
    const r = parseStyleFromInstruction(injected);
    expect(r.isUnifiedContext, '选课标卷型 → 触发统一情境框架预生成').toBe(true);
    expect(r.isContextStyle).toBe(true);
    const tpl = examTemplate();
    // 开关单一事实源：以注入的组织风格为准
    // 🔴 2026-10-02（项4·受检后**保持原判**）：曾试改"以【组织风格】为准"（更可核对）——被本文件"不选时
    //   **不引用该块**"用例拦下：不选组织风格时该块不存在，**写块名＝假指针**（既定裁定）→ 原措辞（"随本委托
    //   注入的"，刻意不点名块）**保留**。此项即"与可执行冲突时，以可执行为准"的实例。
    expect(tpl, '是否采用统一情境以注入的组织风格为准（单一开关）').toContain('以随本委托注入的组织风格为准');
    expect(tpl, '采用统一情境 → 卷首导语即本卷统一情境').toContain('采用统一情境时');
    expect(tpl).toContain('卷首导语即本卷的');
    // 同一件事只有一处规定：全库仅 promptLibrary 规定"卷首导语↔大题标题"，其它文件不得另写一份
    const files = [];
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (/\.(js|vue|ts)$/.test(name)) files.push(p);
      }
    };
    walk(path.join(ROOT, 'src'));
    const owners = files
      .filter((f) => fs.readFileSync(f, 'utf8').includes('卷首导语'))
      .map((f) => path.relative(ROOT, f).replace(/\\/g, '/'));
    expect(owners, '卷首导语规则只允许出现在 promptLibrary.js').toEqual(['src/config/promptLibrary.js']);
  });

  it('回潮守卫：旧措辞「贯穿所有题目 / 同一场景内 / 每一题都」全库零出现', () => {
    const files = [];
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (/\.(js|vue|ts)$/.test(name)) files.push(p);
      }
    };
    walk(path.join(ROOT, 'src'));
    const hits = [];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      for (const ph of LEGACY_PHRASES) {
        if (src.includes(ph)) hits.push(`${path.relative(ROOT, f)} :: ${ph}`);
      }
    }
    expect(hits, `旧口径回潮：${hits.join('；')}`).toEqual([]);
  });
});
