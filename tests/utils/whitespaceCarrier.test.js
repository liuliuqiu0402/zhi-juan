// 纯空白"装饰标记"→ 填空横线 回归（模型把课文填空空位误包成 <span class="emphasis-dot">&nbsp;×N</span>，
// 空位在、字被抽走 → 加点/画线无字可加，实为书写空位）
import { describe, it, expect } from 'vitest';
import { normalizeBlankMarkers, normalizeWhitespaceCarriers } from '../../src/utils/contentCleaner.js';

const NB = '&nbsp;';

describe('normalizeWhitespaceCarriers（纯空白装饰标记→填空横线，精确规则不误伤）', () => {
  it('emphasis-dot 包 8×NBSP（课文填空空位误包形态）→ u.blank-4 横线，不留空壳标记', () => {
    const html = `<p>空气是那么<span class="emphasis-dot">${NB.repeat(8)}</span>，天空是那么<span class="emphasis-dot">${NB.repeat(8)}</span>，使我总想高歌一曲。</p>`;
    const out = normalizeBlankMarkers(html);
    expect(out).not.toContain('emphasis-dot');
    expect(out.match(/<u class="blank-\d+">&emsp;<\/u>/g) || []).toHaveLength(2);
    expect(out).toContain('<u class="blank-4">&emsp;</u>'); // 8×NBSP(0.5em) ≈ 4em → blank-4
  });

  it('有可见字的真加点标记不误伤', () => {
    const html = '<p>给加点字选择正确读音：<span class="emphasis-dot">清</span></p>';
    const out = normalizeWhitespaceCarriers(html);
    expect(out).toContain('<span class="emphasis-dot">清</span>');
    expect(normalizeBlankMarkers(html)).toContain('emphasis-dot');
  });

  it('单空格空壳（排版分隔级）→ 拆壳保留空白，不画线', () => {
    const html = `<p>甲<span class="emphasis-dot">${NB}</span>乙</p>`;
    const out = normalizeWhitespaceCarriers(html);
    expect(out).not.toContain('emphasis-dot');
    expect(out).not.toContain('<u ');
    expect(out).toContain('甲');
    expect(out).toContain('乙');
  });
});
