import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf-8');

/**
 * Azure 语音 Key 安全口径（用户 2026-09-16 定版：「key 还是跟模型 key 一样…
 * 提交时不进库，保证 key 的安全」）
 * ============================================================
 * 本条把口径锁成可回归的不变量，防止以后有人顺手把该字段加进上推/Cookie 白名单。
 * ============================================================
 */
describe('Azure 语音 Key：与模型 Key 同口径存储，但不进云端', () => {
  const apiCfg = read('src/config/apiConfig.js');
  const appVue = read('src/App.vue');
  const mainJs = read('main.js');

  it('与模型 Key 同口径：saveConfig 中做清洗 + 加密落盘', () => {
    expect(apiCfg).toMatch(/cleanAndSync\('azureSpeechKey'/);
    expect(apiCfg).toMatch(/toSave\.azureSpeechKey = await encrypt\(toSave\.azureSpeechKey\)/);
  });

  it('🔴 不进库：云端上推白名单（App.vue dsCfg）不含 azureSpeechKey', () => {
    const m = appVue.match(/const dsCfg = \{[\s\S]*?\};/);
    expect(m, '未找到 App.vue 的上推白名单 dsCfg').toBeTruthy();
    expect(m[0]).not.toContain('azureSpeechKey');
  });

  it('🔴 不落旁路：Cookie 桥接白名单（cookieCore）不含 azureSpeechKey', () => {
    const m = apiCfg.match(/const cookieCore = \{[\s\S]*?\n    \};/);
    expect(m, '未找到 apiConfig 的 Cookie 白名单 cookieCore').toBeTruthy();
    expect(m[0]).not.toContain('azureSpeechKey');
  });

  it('主进程仅按次使用 Key：请求头带上，但日志不打印 Key', () => {
    const start = mainJs.indexOf("ipcMain.handle('azure-tts-to-file'");
    expect(start, '未找到 azure-tts-to-file 处理器').toBeGreaterThan(-1);
    const endMarker = mainJs.indexOf('静默生成 PDF', start);
    const block = mainJs.slice(start, endMarker > start ? endMarker : start + 6000);

    // 正向：确实把 Key 放进请求头（否则功能不通）
    expect(block).toContain('Ocp-Apim-Subscription-Key');
    // 反向：日志不得回显 Key
    const logged = [...block.matchAll(/console\.log\(([^)]*)\)/g)].map((m) => m[1]).join(' ');
    expect(logged).not.toMatch(/\bkey\b/i);
  });

  it('主进程对外发地址做区域格式白名单校验（防拼成任意主机）', () => {
    const start = mainJs.indexOf("ipcMain.handle('azure-tts-to-file'");
    const endMarker = mainJs.indexOf('静默生成 PDF', start);
    const block = mainJs.slice(start, endMarker > start ? endMarker : start + 6000);
    expect(block).toMatch(/\/\^\[a-z0-9-\]\{3,30\}\$\//);
  });

  it('设置页提供该 Key 的填写入口，且标注不上传云端', () => {
    const sm = read('src/modules/SettingsModule.vue');
    expect(sm).toContain('settings.azureSpeechKey');
    expect(sm).toContain('不会上传云端');
  });
});
