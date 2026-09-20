/**
 * 粘贴文本配音：语种判定 + 中文翻译提示词契约（2026-09-20 新增功能）
 * ============================================================
 * 背景：听力配音原本只能从"已生成记录里的听力原文"进入。现扩展为可**直接粘贴文本**：
 *   · 粘贴英文 → 走现有规则解析（不够可信再由 AI 兜底），与老路径完全同源；
 *   · 粘贴中文 → 先用「翻译提示词」译为英语听力稿，**共用同一份 JSON 契约**，
 *     故下游（校验/出声/朗读稿）零改动。
 * 本测试锁两件事：语种分流判定、翻译提示词的关键约束（防被改坏成"把中文指令也翻了"）。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { detectSourceLanguage, cjkRatio, parseListeningStructure } from '../../src/utils/listeningExtract.js';
import {
  LISTENING_TRANSLATE_SYSTEM,
  buildListeningTranslateMessages,
  buildListeningTranslateUser,
} from '../../src/config/listeningTranslatePrompt.js';
import { LISTENING_STRUCT_SCHEMA } from '../../src/config/listeningExtractPrompt.js';
import { buildListeningStoryboard } from '../../src/utils/listeningScript.js';
import { LISTENING_VOICE_DEFAULTS } from '../../src/config/listeningAudioProfile.js';

const ROOT = path.resolve(__dirname, '../..');
const gmSource = () => fs.readFileSync(path.join(ROOT, 'src', 'modules', 'GenerateModule.vue'), 'utf8');

describe('粘贴文本：语种分流判定', () => {
  it('英文听力原文判为 en（走规则解析）', () => {
    const en = '第一节，听下面5段对话。\n1. M: Excuse me, where is the library?\nW: It is next to the bank.';
    // 注意：即便夹带中文指令，只要材料主体是英文，仍按英文处理（比例口径）
    expect(cjkRatio('M: Excuse me, where is the library?')).toBe(0);
    expect(detectSourceLanguage(en)).toBe('en');
  });

  it('中文素材判为 zh（必须先翻译）', () => {
    expect(detectSourceLanguage('小明今天去图书馆借了一本书，他很喜欢这本书。')).toBe('zh');
    expect(detectSourceLanguage('第一段材料：请听一段关于校园生活的短文。')).toBe('zh');
  });

  it('阈值与中文噪声守卫同源（0.5）：一半一半时判为 zh，宁可按中文处理', () => {
    // 'abcd' 4 字母 + '中文' 2 字 → 2/(2+4)=0.33 <0.5 → en
    expect(detectSourceLanguage('中文abcd')).toBe('en');
    // 'abc' 3 字母 + '中文测试' 4 字 → 4/7≈0.57 >0.5 → zh
    expect(detectSourceLanguage('中文测试abc')).toBe('zh');
  });

  it('空文本按 en 处理（不触发翻译，交由后续"无材料"提示）', () => {
    expect(detectSourceLanguage('')).toBe('en');
  });
});

describe('中文翻译提示词：契约与关键约束', () => {
  it('messages 结构为 system + user，且 user 里带上**同一份** JSON 契约', () => {
    const msgs = buildListeningTranslateMessages('小明去图书馆。');
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('system');
    expect(msgs[1].role).toBe('user');
    // 契约必须与"搬运"路径同源（否则下游解析会不一致）
    expect(msgs[1].content).toContain(LISTENING_STRUCT_SCHEMA);
    expect(msgs[1].content).toContain('小明去图书馆。');
  });

  it('🔴 明确要求"中文的导语/指令/题号范围保持中文"——不许把考试指令翻成英文', () => {
    expect(LISTENING_TRANSLATE_SYSTEM).toContain('一律原样保留中文');
    for (const field of ['intro', 'instruction', 'range']) {
      expect(LISTENING_TRANSLATE_SYSTEM, `缺 ${field} 的保持中文规则`).toContain(field);
    }
  });

  it('🔴 明确"只译材料正文、信息等价、不增删信息"，且与"搬运"路径职责区分', () => {
    expect(LISTENING_TRANSLATE_SYSTEM).toContain('只翻译听力材料正文');
    expect(LISTENING_TRANSLATE_SYSTEM).toContain('不得增删信息');
    expect(LISTENING_TRANSLATE_SYSTEM).toContain('只输出 JSON');
    // 角色口径与搬运路径一致（M/W/N）
    expect(LISTENING_TRANSLATE_SYSTEM).toContain('"M"');
    expect(LISTENING_TRANSLATE_SYSTEM).toContain('"W"');
    expect(LISTENING_TRANSLATE_SYSTEM).toContain('"N"');
  });

  it('user 文本为空时也不抛错（防御空粘贴）', () => {
    expect(buildListeningTranslateUser()).toBe('以下是用户粘贴的中文听力素材（可能含排版残留或中文播音指令）。请译为英语听力稿并按契约结构化：\n\n');
    expect(() => buildListeningTranslateMessages()).not.toThrow();
  });
});

/**
 * 端到端：中文素材 → （翻译提示词的模型响应，此处以固定 JSON 代替）→ 结构 → 出声
 * ============================================================
 * 这段锁的是"中文这条路走通"本身：翻译后的结构必须能**真的出材料段**
 * （中文原文直读会被噪声守卫丢成 0 段，见 listeningPipelineLock）；且中英各归其位——
 * 英语正文进材料段、中文播音指令保持中文播报，标题里的英文仍按 Unit one 读。
 * 模型响应用固定 JSON 代替：本测试不调网络，锁的是**契约与下游出声**，不是模型文采。
 */
describe('中文素材 → 翻译 → 出声（端到端，模型响应以固定 JSON 代替）', () => {
  const MODEL_JSON = JSON.stringify({
    intro: '',
    items: [
      {
        no: 1,
        instruction: '第一节，听下面一段对话，回答第1题。',
        range: '',
        repeat: 2,
        lines: [
          { role: 'M', text: 'Excuse me, could you tell me the way to the library?' },
          { role: 'W', text: 'Sure. Go along this street and turn left at the bank.' },
        ],
      },
    ],
  });
  const storyboard = () => {
    const struct = parseListeningStructure(MODEL_JSON);
    return buildListeningStoryboard({
      items: struct.items,
      intro: struct.intro,
      stage: 'primary_high',
      grade: '',
      title: '六年级英语上册 Unit 1 测试卷',
      announceTitle: true,
      soundCheck: false,
      announceShortItemNo: true,
      voicePoolInput: [LISTENING_VOICE_DEFAULTS.M, LISTENING_VOICE_DEFAULTS.W],
      overrides: {},
    });
  };
  const segsOf = (sb, kind) => sb.segments.filter((s) => s.kind === kind);

  it('🔴 翻译后的结构能真的出材料段（这正是"必须先翻译"的原因）', () => {
    const sb = storyboard();
    const material = segsOf(sb, 'material');
    expect(material.length).toBe(2);
    expect(material.map((s) => s.text).join(' ')).toContain('Excuse me');
    // 对话按角色分音色（M/W 不串）
    expect(material[0].voice).toBe(LISTENING_VOICE_DEFAULTS.M);
    expect(material[1].voice).toBe(LISTENING_VOICE_DEFAULTS.W);
  });

  it('🔴 材料段内不得残留中文（中文素材本该译成英语才读）', () => {
    const sb = storyboard();
    for (const s of [...segsOf(sb, 'material'), ...segsOf(sb, 'repeat')]) {
      expect(s.text, `材料段混入中文：${s.text}`).not.toMatch(/[\u4e00-\u9fa5]/);
    }
  });

  it('🔴 中文播音指令保持中文、由中文音色播报（不许被译者翻成英文）', () => {
    const sb = storyboard();
    const instruction = segsOf(sb, 'instruction');
    expect(instruction.length).toBe(1);
    expect(instruction[0].text).toContain('听下面一段对话');
    expect(instruction[0].voice).toMatch(/^zh-/);
  });

  it('两遍朗读：材料 + 重复各一遍，文本一致（遍数由结构里的 repeat 决定，与来源无关）', () => {
    const sb = storyboard();
    expect(segsOf(sb, 'repeat').map((s) => s.text)).toEqual(segsOf(sb, 'material').map((s) => s.text));
  });

  it('中英混排标题：英文段按 Unit one 读、且用英文音色（与"粘贴来源"无关）', () => {
    const sb = storyboard();
    const title = segsOf(sb, 'title');
    expect(title.map((s) => s.text).join(' ')).toContain('Unit one');
    const en = title.find((s) => /Unit one/.test(s.text));
    expect(en.voice).not.toMatch(/^zh-/);
  });
});

/**
 * 源码接线锁（GenerateModule.vue）
 * ============================================================
 * "模板加了、脚本忘了"这类错误只在**点开弹窗那一刻**才炸（Vue 模板里引用未声明的标识符
 * 是运行时错误，构建期不报）。故此处把粘贴面板用到的每个标识符逐一与脚本声明对齐。
 */
describe('粘贴配音：面板接线（模板 ↔ 脚本一致）', () => {
  const PANEL_BINDINGS = [
    'listeningPasteMode',
    'listeningPasteText',
    'listeningPasteTitle',
    'listeningPasteStage',
    'listeningPasteGrade',
    'PASTE_STAGE_OPTIONS',
    'pasteGradeOptions',
    'onPasteStageChange',
    'openListeningPaste',
    'parseListeningPaste',
  ];

  it('🔴 面板用到的每个标识符都在脚本里声明（防只在运行时才炸的未定义引用）', () => {
    const src = gmSource();
    for (const name of PANEL_BINDINGS) {
      expect(src, `模板用了 ${name}，但脚本里没有声明`).toMatch(new RegExp(`\\bconst\\s+${name}\\b`));
    }
  });

  it('两条入口共用同一份公共复位；记录入口显式关掉粘贴面板', () => {
    const src = gmSource();
    expect(src).toMatch(/\bconst resetListeningPanel\b/);
    // 记录入口不得残留粘贴态（否则从"粘贴"切到某条记录会看到旧粘贴面板）
    expect(src).toMatch(/const openListeningTool[\s\S]{0,200}listeningPasteMode\.value = false/);
  });

  it('中文分流与翻译提示词经 import 引入（不内联提示词，防两套契约）', () => {
    const src = gmSource();
    expect(src).toContain("import { buildListeningTranslateMessages } from '../config/listeningTranslatePrompt.js';");
    expect(src).toMatch(/import \{[^}]*\bdetectSourceLanguage\b[^}]*\} from '\.\.\/utils\/listeningExtract\.js';/);
    // 分流必须走 detectSourceLanguage（与解析器的中文噪声守卫同阈值），不得自己写一套 CJK 判断
    expect(src).toMatch(/const lang = detectSourceLanguage\(text\)/);
  });

  it('学段为空不放行：先提示再返回（学段决定语速与作答留白，不能默认猜一个）', () => {
    const src = gmSource();
    const body = src.slice(src.indexOf('const parseListeningPaste'));
    expect(body).toMatch(/if \(!listeningPasteStage\.value\)[\s\S]{0,200}return;/);
  });
});
