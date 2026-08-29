// stripXss 回归测试：XSS 向量剥离 + 排版结构零影响
// 背景：AI 生成内容经 v-html 渲染/innerHTML 导出前，在唯一源头（safeContent）调用 stripXss。
//       要求：1) 可执行向量（script/on*/javascript:/iframe 等）被剥离
//             2) 排版结构（class/style 内联样式/表格/田字格等）完整保留 —— 负向剥离不碰排版
import { describe, it, expect } from 'vitest';
import { stripXss } from '@/utils/contentCleaner.js';

describe('stripXss：剥离可执行向量', () => {
  it('剥离 <script> 块（含内联代码）', () => {
    const html = '<p>题目</p><script>alert(1)</script><p>答案</p>';
    const out = stripXss(html);
    expect(out).not.toContain('script');
    expect(out).not.toContain('alert(1)');
    expect(out).toContain('题目');
    expect(out).toContain('答案');
  });

  it('剥离未闭合 <script> 兜底', () => {
    const out = stripXss('<p>正文<script>alert(2)');
    expect(out).not.toContain('script');
    expect(out).not.toContain('alert(2)');
    expect(out).toContain('正文');
  });

  it('剥离 on* 事件属性（onerror/onclick）', () => {
    const html = '<img src="x.png" onerror="alert(1)"><p onclick="evil()">正文</p>';
    const out = stripXss(html);
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('alert(1)');
    expect(out).not.toContain('evil()');
    expect(out).toContain('<img src="x.png"');
    expect(out).toContain('正文');
  });

  it('掐断 javascript: 协议（href/src，含带引号与无引号）', () => {
    const out = stripXss('<a href="javascript:alert(1)">链接</a><img src=\'javascript:evil()\'>');
    expect(out).not.toContain('javascript:');
    expect(out).not.toContain('alert(1)');
    expect(out).not.toContain('evil()');
    expect(out).toContain('链接');
  });

  it('剥离 iframe/object/embed 危险嵌入标签', () => {
    const html = '<iframe src="https://evil.com"></iframe><p>正文</p><embed src="x.swf">';
    const out = stripXss(html);
    expect(out).not.toContain('iframe');
    expect(out).not.toContain('embed');
    expect(out).not.toContain('evil.com');
    expect(out).toContain('正文');
  });

  it('剥离 <link>/<meta>/<base>/<form>（元信息与表单注入）', () => {
    const html = '<meta http-equiv="refresh" content="0;url=https://evil.com"><link rel="stylesheet" href="https://evil.com/x.css"><p>正文</p>';
    const out = stripXss(html);
    expect(out).not.toContain('meta');
    expect(out).not.toContain('link');
    expect(out).not.toContain('evil.com');
    expect(out).toContain('正文');
  });
});

describe('stripXss：排版结构零影响（负向剥离不碰排版）', () => {
  it('保留 class/style 内联样式/结构标签（田字格/占位框等排版依赖）', () => {
    const html = '<div class="tian-zi-ge" style="width:24px;height:24px;border:1px solid #000;">字</div>'
      + '<div class="graph-placeholder" data-graph-raw="x" style="padding:12px;background:#f0f6fb;">[图形占位]</div>'
      + '<span class="emphasis-dot">加点字</span>';
    const out = stripXss(html);
    expect(out).toContain('class="tian-zi-ge"');
    expect(out).toContain('style="width:24px;height:24px;border:1px solid #000;"');
    expect(out).toContain('class="graph-placeholder"');
    expect(out).toContain('data-graph-raw="x"');
    expect(out).toContain('class="emphasis-dot"');
    expect(out).toContain('加点字');
  });

  it('保留表格/四线三格/密封线等排版结构', () => {
    const html = '<table><tr><td class="zuo-wen-ge">作文格</td></tr></table>'
      + '<div class="seal-line">密封线</div>'
      + '<div class="four-line-three">abc</div>';
    const out = stripXss(html);
    expect(out).toContain('<table>');
    expect(out).toContain('class="zuo-wen-ge"');
    expect(out).toContain('class="seal-line"');
    expect(out).toContain('class="four-line-three"');
    expect(out).toContain('作文格');
    expect(out).toContain('密封线');
  });

  it('保留空位/选项/作答区等作答载体结构', () => {
    const html = '<span class="blank-1">&emsp;</span><div class="option">A. 对</div><div class="blank-line"></div>';
    const out = stripXss(html);
    expect(out).toContain('class="blank-1"');
    expect(out).toContain('class="option"');
    expect(out).toContain('class="blank-line"');
    expect(out).toContain('&emsp;');
  });

  it('保留正常 URL（http/https 不受影响）', () => {
    const html = '<a href="https://www.gov.cn/zhengce/content/202204/content_5686199.htm">课标链接</a>';
    const out = stripXss(html);
    expect(out).toContain('https://www.gov.cn');
    expect(out).toContain('课标链接');
  });

  it('对空/非字符串输入安全返回', () => {
    expect(stripXss('')).toBe('');
    expect(stripXss(null)).toBeNull();
    expect(stripXss(undefined)).toBeUndefined();
    expect(stripXss(123)).toBe(123);
  });
});
