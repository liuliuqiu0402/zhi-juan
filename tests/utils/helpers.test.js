import { describe, it, expect, vi } from 'vitest';
import { formatTime, truncate, generateId, deepClone, debounce } from '@/utils/helpers';

describe('formatTime', () => {
  it('格式化时间戳为 yyyy-MM-dd HH:mm', () => {
    const result = formatTime(new Date('2025-01-15 14:30:00').getTime());
    expect(result).toBe('2025-01-15 14:30');
  });

  it('空值返回空字符串', () => {
    expect(formatTime(0)).toBe('');
    expect(formatTime(null)).toBe('');
    expect(formatTime(undefined)).toBe('');
    expect(formatTime('')).toBe('');
  });
});

describe('truncate', () => {
  it('超长文本截断并加...', () => {
    expect(truncate('1234567890', 5)).toBe('12345...');
  });

  it('长度不足不截断', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('空值返回空', () => {
    expect(truncate('', 5)).toBe('');
    expect(truncate(null, 5)).toBe('');
  });
});

describe('generateId', () => {
  it('生成带前缀的唯一ID', () => {
    const id = generateId('test');
    expect(id).toMatch(/^test_\d+_[a-f0-9]+$/);
  });

  it('连续生成的ID不重复', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId('x'));
    }
    expect(ids.size).toBe(100);
  });
});

describe('deepClone', () => {
  it('深拷贝嵌套对象', () => {
    const original = { a: 1, b: { c: 2 } };
    const cloned = deepClone(original);
    cloned.b.c = 3;
    expect(original.b.c).toBe(2);
    expect(cloned.b.c).toBe(3);
  });
});

describe('debounce', () => {
  it('延迟执行回调', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('短时间内多次调用只执行一次', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    debounced();
    debounced();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
