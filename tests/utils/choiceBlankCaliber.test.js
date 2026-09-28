// 🔴 2026-09-28 "选择类作答位"口径收口守卫（唯一口径 = src/config/layoutSpec.js buildAnswerSpaceInstruction）
// ============================================================
// 唯一口径：
//   · 括号**一律半角**（span.blank-N 载体渲染自带半角括号；与 contentCleaner 归一同形）；
//   · 位置**按学科**：外语类 → 题首；中文科目（含无学科兜底） → 题干末尾。
// 本文件锁"四处同源"+回潮守卫：
//   ① examValidator 2e0（choice-first-blank-fix）输出**半角 span**，不再产字面全角「（　）」；
//   ② examValidator 2j-6 位置归并**方向按学科条款**（非多数票、非"同数题首优先"）；
//   ③ validatorRules choice-answer-position-guard / choice-first-blank-fix 两条 description 同源；
//   ④ layoutSpec buildAnswerSpaceInstruction 头注与实现一致 + ANSWER_REGION.carrier 头注写实值 'blank-area'。
//   + src 内旧口径字面回潮守卫（注释留痕除外）。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { auditExamPaper } from '../../src/utils/examValidator.js';
import { normalizeBlankMarkers } from '../../src/utils/contentCleaner.js';
import {
  buildAnswerSpaceInstruction,
  getChoiceBlankPosition,
  isForeignLangSubject,
  FOREIGN_LANG_SUBJECT_RE,
} from '../../src/config/layoutSpec.js';
import { getValidatorRule } from '../../src/config/validatorRules.js';

const ROOT = path.resolve(__dirname, '../..');
const readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const OPTS = (subject) => ({ subject, stage: 'primary_high', genType: 'exam' });
const ANS = '<div class="answer-section"><h2>参考答案</h2><p>1. A</p></div>';
// span 空位匹配（audit 的 DOM 往返会把 `&emsp;` 序列化为等价的 U+2003，故两种写法都认）
const SPAN2 = '<span class="blank-2">(?:&emsp;|\u2003)</span>';

// ── 位置单一出口 ──
describe('选择类作答位·位置按学科（单一出口 layoutSpec.getChoiceBlankPosition）', () => {
  it('外语类（含"外语"/语言名）→ head；中文科目/无学科 → tail', () => {
    for (const s of ['英语', '初中英语', '日语', '俄语', '法语', '德语', '西班牙语', '韩语', '外语']) {
      expect(isForeignLangSubject(s), `${s} 应判为外语类`).toBe(true);
      expect(getChoiceBlankPosition(s), `${s} 位置应题首`).toBe('head');
    }
    for (const s of ['语文', '数学', '物理', '化学', '历史', '科学', '']) {
      expect(getChoiceBlankPosition(s), `${s || '无学科'} 位置应题干末尾`).toBe('tail');
    }
    expect(FOREIGN_LANG_SUBJECT_RE.test('七年级英语')).toBe(true); // 语言名包含即纳入
  });

  it('与 buildAnswerSpaceInstruction 条款方向一致（外语题首 / 中文题干末尾）', () => {
    expect(buildAnswerSpaceInstruction('英语', 'high')).toContain('位置在题号之前的题首');
    expect(buildAnswerSpaceInstruction('语文', 'high')).toContain('位置在题干末尾');
    expect(buildAnswerSpaceInstruction()).toContain('位置在题干末尾'); // 无学科兜底落中文支
  });
});

// ── ① 2e0：半角 span ──
describe('① 2e0（choice-first-blank-fix）：输出半角 span，与 contentCleaner 归一产物同形', () => {
  it('题首下划线空 → 半角 span 载体（blank-2）；不再产字面全角「（　）」', () => {
    const html = '<h2>六、单项选择（每题1.5分，共15分）</h2>'
      + '<p><u class="blank-8">&emsp;</u>26. 题干一</p>'
      + '<p>A. x　B. y　C. z</p>';
    const r = auditExamPaper(html, OPTS('英语'));
    expect(r.html).toMatch(new RegExp(`${SPAN2}26\\.`));
    expect(r.html, '不得再生产字面全角括号位').not.toContain('（　）26.');
    expect(r.html, '题首下划线空应已被替换').not.toContain('<u class="blank-8">');
    expect(r.issues.some((x) => x.type === 'choice-first-blank')).toBe(true);
  });

  it('裸空（全角空格起头）→ 同样半角 span 载体', () => {
    const html = '<h2>六、单项选择（每题1.5分，共15分）</h2>'
      + '<p>　　26. 题干一</p>'
      + '<p>A. x　B. y　C. z</p>';
    const r = auditExamPaper(html, OPTS('英语'));
    expect(r.html).toMatch(new RegExp(`${SPAN2}26\\.`));
    expect(r.html).not.toContain('（　）26.');
  });

  it('与 contentCleaner 归一同形：全角「（　）」经归一层 → blank-2 span（宽度锚同源）', () => {
    // contentCleaner 把「（　）」（1 全角空格内宽）收敛为 span.blank-N，N=spaceBlankWidth(1)=2；
    // 2e0 的归一目标经同一 spaceBlankWidth 取宽 → 两者逐字同形（消除"题首全角、其余半角"并存）。
    const norm = normalizeBlankMarkers('<p>（　）26. 题干一</p>');
    expect(norm).toContain('<span class="blank-2">&emsp;</span>26.');
  });
});

// ── ② 2j-6：方向按学科 ──
describe('② 2j-6：位置归并方向按学科条款（非多数票）', () => {
  it('外语类：即便多数在句末，也归并到题首', () => {
    const html = '<h2>二、判断正误（每题2分，共10分）</h2>'
      + '<p class="question">(    )6. 句子一</p>'
      + '<p class="question">(    )7. 句子二</p>'
      + '<p class="question">8. 句子三 (    )</p>'
      + '<p class="question">9. 句子四 (    )</p>'
      + '<p class="question">10. 句子五 (    )</p>' + ANS;
    const r = auditExamPaper(html, OPTS('英语'));
    expect(r.html, '外语类方向恒为题首').toContain('(    )8. 句子三');
    expect(r.html).toContain('(    )10. 句子五');
    expect(r.html, '句末形态应已被搬走').not.toContain('8. 句子三 (    )');
    expect(r.issues.some((i) => i.type === 'answer-blank-position-fix')).toBe(true);
    expect((r.silentDetails || []).some((d) => d.type === 'answer-blank-position')).toBe(false);
  });

  it('中文科目：即便多数在题首，也归并到题干末尾（旧"多数票/题首优先"不得回潮）', () => {
    const html = '<h2>二、判断正误（每题2分，共10分）</h2>'
      + '<p class="question">(    )6. 句子一</p>'
      + '<p class="question">(    )7. 句子二</p>'
      + '<p class="question">(    )8. 句子三</p>'
      + '<p class="question">9. 句子四 (    )</p>'
      + '<p class="question">10. 句子五 (    )</p>' + ANS;
    const r = auditExamPaper(html, OPTS('语文'));
    expect(r.html, '中文科目方向为题干末尾').toContain('6. 句子一 (    )');
    expect(r.html).toContain('8. 句子三 (    )');
    expect(r.html, '题首形态应已被搬走').not.toContain('(    )6. 句子一');
    expect(r.issues.some((i) => i.type === 'answer-blank-position-fix')).toBe(true);
  });
});

// ── ③ validatorRules 两条 description ──
describe('③ validatorRules 两条 description 同源（按学科位置 + 半角基准）', () => {
  const OLD = ['答案括号应在题首', '答案括号应在题干前（题首）', '归一为全角'];

  it('choice-answer-position-guard：按学科位置 + 半角，不含旧"应在题首"口径', () => {
    const d = getValidatorRule('choice-answer-position-guard').description;
    expect(d).toContain('按学科');
    expect(d).toContain('外语');
    expect(d).toContain('题干末尾');
    expect(d).toContain('半角');
    for (const old of OLD) expect(d, `旧口径不得回潮：${old}`).not.toContain(old);
  });

  it('choice-first-blank-fix：半角 span 归一目标，不含旧全角「（　）」口径', () => {
    const d = getValidatorRule('choice-first-blank-fix').description;
    expect(d).toContain('半角圆括号空位');
    expect(d).toContain('<span class="blank-N">&emsp;</span>');
    expect(d).toContain('按学科');
    for (const old of [...OLD, '归一为圆括号空位（　）', '（　）']) {
      expect(d, `旧全角口径不得回潮：${old}`).not.toContain(old);
    }
  });
});

// ── ④ layoutSpec 头注与实现一致 ──
describe('④ layoutSpec 头注与实现一致（按学科位置 + 一律半角；carrier 头注 = blank-area）', () => {
  const src = readSrc('src/config/layoutSpec.js');

  it('buildAnswerSpaceInstruction 头注：按学科位置 + 一律半角，旧"双双定死：题首 + 圆括号空位（　）"已废', () => {
    expect(src, '旧头注口径不得回潮').not.toContain('位置与形态双双定死');
    expect(src).not.toContain('在题干前（题首）且用');
    expect(src).toContain('其作答位**形态与位置按学科定死**');
    expect(src).toContain('括号**一律半角**');
    expect(src).toContain('**外语类**在题号之前的题首');
    expect(src).toContain('**中文科目**在题干末尾');
  });

  it('ANSWER_REGION.carrier 头注写实值 blank-area（非旧 "blank"）', () => {
    expect(src).toContain("'line' 横线（文字书写引导）/ 'blank-area' 无线空白行（答题卡风格）");
    expect(src, '旧 "blank" 头注不得回潮').not.toContain("'line' 横线（文字书写引导）/ 'blank' 无线空白行");
  });
});

// ── 回潮守卫：src 内旧口径字面（注释留痕除外）──
describe('回潮守卫：src 内不再出现旧口径字面（注释留痕除外）', () => {
  const SRC_FILES = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (/\.(js|vue|ts)$/.test(name)) SRC_FILES.push(p);
    }
  };
  walk(path.join(ROOT, 'src'));
  // 去注释：块注释 + 行注释（"注释留痕除外"——历史口径只允许躺在注释里）
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const OLD_CALIBER = [
    '答案括号应在题首',
    '答案括号应在题干前（题首）',
    '答案括号应放题干前',
    '归一为全角',
    '归一为圆括号空位（　）',
    '全角圆括号空位',
  ];

  it('src 代码/配置（去注释后）零出现旧口径字面', () => {
    const hits = [];
    for (const f of SRC_FILES) {
      const clean = stripComments(fs.readFileSync(f, 'utf8'));
      for (const p of OLD_CALIBER) if (clean.includes(p)) hits.push(`${path.relative(ROOT, f).replace(/\\/g, '/')} :: ${p}`);
    }
    expect(hits, `旧口径字面回潮：\n${hits.join('\n')}`).toEqual([]);
  });
});
