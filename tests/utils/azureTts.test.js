import { describe, it, expect } from 'vitest';
import {
  normalizeRegion,
  buildTtsEndpoint,
  validateAzureConfig,
  assertSsmlSize,
  describeAzureError,
  safeAudioFileName,
  synthesizeSpeech,
  SSML_SOFT_LIMIT,
  DEFAULT_OUTPUT_FORMAT,
  AZURE_OUTPUT_FORMATS,
  AZURE_SPEECH_REGIONS,
} from '../../src/utils/azureTts.js';

/**
 * Azure 语音合成工具（2026-09-16）
 * 锁定：区域名脏输入容错、端点拼接、配置缺项提示、SSML 体积守卫、HTTP 失败码可读化。
 */
describe('区域名归一（脏输入是配置翻车首因）', () => {
  it('裸区域名原样归一（大小写/空格）', () => {
    expect(normalizeRegion('eastasia')).toBe('eastasia');
    expect(normalizeRegion('  EastAsia ')).toBe('eastasia');
  });

  it('粘贴完整端点/域名可自动提取区域', () => {
    expect(normalizeRegion('https://eastasia.tts.speech.microsoft.com/cognitiveservices/v1')).toBe('eastasia');
    expect(normalizeRegion('japaneast.tts.speech.microsoft.com')).toBe('japaneast');
    expect(normalizeRegion('https://eastasia.api.cognitive.microsoft.com/sts/v1.0/issueToken')).toBe('eastasia');
  });

  it('空值与非法字符不产生脏区域', () => {
    expect(normalizeRegion('')).toBe('');
    expect(normalizeRegion('   ')).toBe('');
    expect(normalizeRegion('east asia')).toBe('eastasia');
  });
});

describe('端点拼接', () => {
  it('按区域拼出 REST v1 端点', () => {
    expect(buildTtsEndpoint('eastasia')).toBe('https://eastasia.tts.speech.microsoft.com/cognitiveservices/v1');
  });

  it('区域为空时抛错（不拼出半截域名）', () => {
    expect(() => buildTtsEndpoint('')).toThrow(/region/i);
  });
});

describe('配置校验', () => {
  it('缺 Key / 缺区域分别给出可操作提示', () => {
    expect(validateAzureConfig({ key: '', region: 'eastasia' }).message).toContain('Azure 语音 Key');
    expect(validateAzureConfig({ key: 'abc123', region: '' }).message).toContain('区域');
  });

  it('齐备时返回归一后的 Key 与区域', () => {
    const r = validateAzureConfig({ key: '  abc123  ', region: 'EastAsia' });
    expect(r.ok).toBe(true);
    expect(r.key).toBe('abc123');
    expect(r.region).toBe('eastasia');
  });
});

describe('SSML 体积守卫', () => {
  it('正常长度通过并返回长度', () => {
    expect(assertSsmlSize('<speak/>')).toBe(8);
  });

  it('超限早失败并给出可执行建议（不等到 413）', () => {
    const big = 'x'.repeat(SSML_SOFT_LIMIT + 1);
    expect(() => assertSsmlSize(big)).toThrow(/按大题拆分/);
  });
});

describe('HTTP 失败码可读化', () => {
  it('逐条翻译关键状态码', () => {
    expect(describeAzureError(401)).toContain('Key 无效');
    expect(describeAzureError(403)).toContain('区域不匹配');
    expect(describeAzureError(404)).toContain('区域名');
    expect(describeAzureError(413)).toContain('拆分');
    expect(describeAzureError(429)).toContain('频繁');
  });

  it('5xx 归为服务端临时故障；未知码仍带状态与响应体', () => {
    expect(describeAzureError(503)).toContain('临时故障');
    expect(describeAzureError(418, 'teapot')).toContain('teapot');
  });

  it('响应体截断，不把整段服务端文本灌进界面', () => {
    const r = describeAzureError(400, 'y'.repeat(1000));
    expect(r.length).toBeLessThan(400);
  });
});

describe('音频文件名安全化', () => {
  it('去非法字符但保留中文', () => {
    expect(safeAudioFileName('初中英语/期中:听力*音频')).toBe('初中英语_期中_听力_音频');
  });

  it('空名回退默认，超长截断', () => {
    expect(safeAudioFileName('')).toBe('听力音频');
    expect(safeAudioFileName('a'.repeat(200)).length).toBe(80);
  });
});

describe('合成前置校验（不触网即拦）', () => {
  it('缺配置时抛错且不发请求', async () => {
    await expect(synthesizeSpeech('<speak/>', { key: '', region: 'eastasia' })).rejects.toThrow(/Key/);
  });

  it('SSML 超限时抛错', async () => {
    await expect(
      synthesizeSpeech('x'.repeat(SSML_SOFT_LIMIT + 1), { key: 'k', region: 'eastasia' })
    ).rejects.toThrow(/拆分/);
  });
});

describe('常量自洽', () => {
  it('默认输出格式在可选列表内', () => {
    expect(AZURE_OUTPUT_FORMATS.map((f) => f.value)).toContain(DEFAULT_OUTPUT_FORMAT);
  });

  it('区域建议项格式合法', () => {
    for (const r of AZURE_SPEECH_REGIONS) {
      expect(r.value).toMatch(/^[a-z0-9-]+$/);
      expect(r.label).toBeTruthy();
    }
  });
});
