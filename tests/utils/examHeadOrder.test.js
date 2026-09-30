// 📄 卷首结构兜底（排版/渲染侧结构性保险）：重排已存在的结构件 + 保守边界（2026-09-30）
// ============================================================
// 用户裁定："卷首顺序**不是排版模块指定的**…这种结构性的，排版模块可以做个**兜底保险**。"
// 源头在模型侧条款（【卷面格式】"卷首固定顺序"）；渲染侧只做**结构重排**：把已存在的
// "(考试时间…满分…)"一行移到占位标题 <h1> 之后。**缺件不补、不造**（缺件属模型侧职责）。
// 边界（保守）：仅 h1 之后前 8 个顶层块内查找；遇 h2 大题标题或题号行即放弃；已紧跟标题则不动；幂等。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeExamHeadOrder } from '../../src/utils/contentCleaner.js';

const TIME = '<p>（考试时间：60分钟　满分：100分）</p>';
const H1 = '<h1>二年级语文上册第一单元·阅读综合检测</h1>';
// 取顶层块文本序列，便于断言顺序
const order = (html) => {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  return [...doc.body.children].map((el) => (el.textContent || '').replace(/[\s\u3000]+/g, ' ').trim());
};

describe('卷首结构兜底：重排', () => {
  it('时间行在导语之后 → 移到 h1 之后（导语被顺推）', () => {
    const src = `${H1}<p class="exam-head-lead">亲爱的小朋友，欢迎参加本次闯关！</p>${TIME}<h2>一、走进拼音山谷</h2>`;
    const out = normalizeExamHeadOrder(src);
    expect(order(out).slice(0, 4)).toEqual([
      '二年级语文上册第一单元·阅读综合检测',
      '（考试时间：60分钟 满分：100分）',
      '亲爱的小朋友，欢迎参加本次闯关！',
      '一、走进拼音山谷',
    ]);
  });

  it('时间行在密封线之后 → 也移到 h1 之后（密封线顺推）', () => {
    const src = `${H1}<div class="seal-line">学校＿＿ 班级＿＿ 姓名＿＿</div>${TIME}<h2>一、走进拼音山谷</h2>`;
    const out = normalizeExamHeadOrder(src);
    expect(order(out).slice(0, 3)).toEqual([
      '二年级语文上册第一单元·阅读综合检测',
      '（考试时间：60分钟 满分：100分）',
      '学校＿＿ 班级＿＿ 姓名＿＿',
    ]);
  });
});

describe('卷首结构兜底：保守边界（不该动的一律不动）', () => {
  it('时间行已紧跟 h1 → 原样返回（幂等）', () => {
    const src = `${H1}${TIME}<p>亲爱的小朋友，欢迎参加本次闯关！</p><h2>一、走进拼音山谷</h2>`;
    expect(normalizeExamHeadOrder(src)).toBe(src);
  });

  it('重复调用结果一致（幂等）', () => {
    const src = `${H1}<p class="exam-head-lead">导语</p>${TIME}<h2>一、走进拼音山谷</h2>`;
    const once = normalizeExamHeadOrder(src);
    expect(normalizeExamHeadOrder(once)).toBe(once);
  });

  it('遇 h2 大题标题即放弃（正文已开始，不再上移）', () => {
    const src = `${H1}<p>导语</p><h2>一、走进拼音山谷</h2>${TIME}`;
    expect(normalizeExamHeadOrder(src)).toBe(src);
  });

  it('遇题号行即放弃（正文已开始）', () => {
    const src = `${H1}<p>1. 看拼音写词语。</p>${TIME}`;
    expect(normalizeExamHeadOrder(src)).toBe(src);
  });

  it('超出 h1 后前 8 个顶层块 → 不查找、不动（防误伤正文深处）', () => {
    const filler = Array.from({ length: 8 }, (_, i) => `<p>说明第${i + 1}条。</p>`).join('');
    const src = `${H1}${filler}${TIME}<h2>一、走进拼音山谷</h2>`;
    expect(normalizeExamHeadOrder(src)).toBe(src);
  });

  it('缺时间行 → 缺件不补（不造结构）', () => {
    const src = `${H1}<p>导语</p><h2>一、走进拼音山谷</h2>`;
    expect(normalizeExamHeadOrder(src)).toBe(src);
  });

  it('无 h1 的片段 → 原样返回', () => {
    const src = `<p>导语</p>${TIME}<h2>一、走进拼音山谷</h2>`;
    expect(normalizeExamHeadOrder(src)).toBe(src);
  });

  it('空串/空值原样返回（不抛错）', () => {
    expect(normalizeExamHeadOrder('')).toBe('');
    expect(normalizeExamHeadOrder()).toBe('');
  });
});

describe('接线（防漏通道）', () => {
  it('排版模块导出链与生成模块预览合成都必须调用（单一实现、两处消费）', () => {
    const root = path.resolve(__dirname, '../..');
    const ts = fs.readFileSync(path.join(root, 'src/modules/TypesetModule.vue'), 'utf8');
    const gen = fs.readFileSync(path.join(root, 'src/modules/GenerateModule.vue'), 'utf8');
    for (const [f, s] of [['TypesetModule', ts], ['GenerateModule', gen]]) {
      expect(s, `${f} 未引入 normalizeExamHeadOrder`).toContain('normalizeExamHeadOrder');
    }
    expect(ts).toContain('normalizeExamHeadOrder(markExamBigCategory(');
    // 单一实现：不得在模块内自带副本
    expect(ts).not.toContain('function normalizeExamHeadOrder');
    expect(gen).not.toContain('function normalizeExamHeadOrder');
  });
});
