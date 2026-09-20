const { app, BrowserWindow, ipcMain, dialog, Menu, shell, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { machineIdSync } = require('node-machine-id');
const { exec } = require('child_process');
// 🎧 Edge 免费语音（听力音频：逐句合成 + 帧级静音拼接）；按需 require，避免无该依赖时拖慢启动
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const isDev = !app.isPackaged;

// 动态存储路径
const getStoragePath = () => {
    // 优先使用用户文档目录，避免硬编码 D 盘
    const { app } = require('electron');
    const defaultPath = path.join(app.getPath('documents'), '智卷工坊数据');
    
    // 尝试从配置读取自定义路径
    try {
        const configPath = path.join(app.getPath('userData'), 'apiConfig.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            if (config.storagePath && fs.existsSync(config.storagePath)) {
                return config.storagePath;
            }
        }
    } catch (e) {
        // 忽略错误，使用默认路径
    }
    
    return defaultPath;
};

// 确保存储目录存在
const ensureStorageDir = () => {
    const storagePath = getStoragePath();
    if (!fs.existsSync(storagePath)) fs.mkdirSync(storagePath, { recursive: true });
    const subDirs = ['教材库', '教材库/图片', '教材库/缩略图', '模板库', '模板库/图片', '模板库/缩略图', '生成历史', '导出', '暂存区'];
    subDirs.forEach(dir => {
        const dirPath = path.join(storagePath, dir);
        if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
    });
};

// 自定义协议：用 app:// 替代 file://，保证 localStorage 持久化
// file:// 在 Chromium 中属于 opaque origin，重启后可能丢失 localStorage 数据
function registerCustomProtocol() {
    protocol.handle('app', (request) => {
        // 将 app://xxx 映射到 dist/xxx
        const url = request.url.replace('app://', '');
        const filePath = path.join(__dirname, 'dist', url);
        return net.fetch('file:///' + filePath.replace(/\\/g, '/'));
    });
}

// 创建窗口
function createWindow() {
    const win = new BrowserWindow({
        width: 1400, height: 900, minWidth: 1200, minHeight: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
            devTools: true
        },
        titleBarStyle: 'default',
        backgroundColor: '#f5f7fc'
    });

    // 完整菜单栏
    const menuTemplate = [
        {
            label: '文件',
            submenu: [
                { label: '刷新', role: 'reload' },
                { type: 'separator' },
                { label: '退出', role: 'quit' }
            ]
        },
        {
            label: '编辑',
            submenu: [
                { label: '撤销', role: 'undo' },
                { label: '重做', role: 'redo' },
                { type: 'separator' },
                { label: '剪切', role: 'cut' },
                { label: '复制', role: 'copy' },
                { label: '粘贴', role: 'paste' }
            ]
        },
        {
            label: '视图',
            submenu: [
                { label: '刷新', role: 'reload' },
                { label: '强制刷新', role: 'forceReload' },
                { type: 'separator' },
                { label: '开发者工具', accelerator: 'F12', role: 'toggleDevTools' },
                { label: '打开开发者工具', accelerator: 'CmdOrCtrl+Shift+I', click: () => win.webContents.openDevTools() }
            ]
        },
        {
            label: '工具',
            submenu: [
                { label: '系统设置', click: () => win.webContents.send('menu-event', 'settings') },
                { label: '指令库', click: () => win.webContents.send('menu-event', 'instruction') },
                { label: '历史记录', click: () => win.webContents.send('menu-event', 'history') }
            ]
        },
        {
            label: '帮助',
            submenu: [
                { label: '使用指南', click: () => win.webContents.send('menu-event', 'guide') },
                { type: 'separator' },
                { label: '关于', role: 'about' }
            ]
        }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

    if (isDev) {
        win.loadURL('http://localhost:5173');
    } else {
        // 用 app:// 自定义协议加载，保证 localStorage 可靠持久化
        win.loadURL('app://index.html');
    }
}

// ==================== IPC 通信 ====================

// 选择文件
ipcMain.handle('select-files', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [
            { name: '支持的文件', extensions: ['pdf', 'doc', 'docx', 'csv', 'xlsx', 'jpg', 'jpeg', 'png'] }
        ]
    });
    return result.filePaths;
});

// 选择文件夹
ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: '选择存储路径'
    });
    if (result.canceled) {
        return null;
    }
    return result.filePaths[0];
});

// 读取文件为 Base64
ipcMain.handle('read-file', async (event, filePath) => {
    if (!fs.existsSync(filePath)) {
        throw new Error(`ENOENT: ${filePath}`);
    }
    const buffer = fs.readFileSync(filePath);
    return buffer.toString('base64');
});

// 解析 Word（python-docx 高保真转换，保留着重号/上下标/缩进等全部格式）
ipcMain.handle('parse-word', async (event, filePath) => {
    return new Promise((resolve, reject) => {
        const { spawn } = require('child_process');
        const pyScript = path.join(__dirname, 'python-scripts', 'word_to_html.py');

        if (!fs.existsSync(pyScript)) {
            reject(new Error('Word 转换脚本缺失: python-scripts/word_to_html.py，请确保 python-docx 已安装 (pip install python-docx)'));
            return;
        }

        const proc = spawn('python', ['-u', pyScript, filePath], {
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        });

        let stdout = '', stderr = '';
        let resolved = false;

        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                proc.kill();
                console.warn('⚠️ Word 转换超时 (30s)');
                reject(new Error('Word 转换超时 (30s)，文件可能过大或格式异常'));
            }
        }, 30000);

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });

        proc.on('close', (code) => {
            clearTimeout(timeout);
            if (resolved) return;
            resolved = true;

            if (code !== 0) {
                console.error('❌ Word 转换失败:', stderr);
                reject(new Error(stderr || 'Word 转换失败，python-docx 进程异常退出'));
                return;
            }

            try {
                const result = JSON.parse(stdout);
                if (result.error) {
                    console.error('❌ Word 转换脚本报错:', result.error);
                    reject(new Error(result.error));
                } else {
                    console.log('✅ Word 转换成功 (python-docx)');
                    resolve({ html: result.html, messages: [] });
                }
            } catch (e) {
                console.error('❌ 解析转换结果失败:', e.message, stdout.substring(0, 200));
                reject(new Error('解析转换结果失败: ' + e.message));
            }
        });

        proc.on('error', (err) => {
            clearTimeout(timeout);
            if (resolved) return;
            resolved = true;
            console.error('❌ Python 进程启动失败:', err.message);
            reject(new Error('Python 进程启动失败，请确保 Python 已安装且 python-docx 可用: ' + err.message));
        });
    });
});

// 路径存在检查（教材/模板改名与加载自愈共用）
ipcMain.handle('path-exists', async (event, filePath) => {
    if (!filePath) return false;
    try { return fs.existsSync(filePath); } catch { return false; }
});

// 移动文件（目录安全 + 失败返回不抛错，供渲染进程做事务式改名）
ipcMain.handle('move-file', async (event, sourcePath, targetPath) => {
    try {
        if (!sourcePath || !targetPath) return { success: false, error: '路径无效' };
        if (!fs.existsSync(sourcePath)) return { success: false, error: '源文件不存在' };
        const targetDir = path.dirname(targetPath);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        if (fs.existsSync(targetPath)) {
            const stat = fs.statSync(targetPath);
            if (stat.isDirectory()) return { success: false, error: '目标目录已存在' };
            fs.unlinkSync(targetPath);
        }
        fs.renameSync(sourcePath, targetPath);
        return { success: true, target: targetPath };
    } catch (e) {
        return { success: false, error: e.message || '移动失败' };
    }
});

// 删除文件
ipcMain.handle('delete-file', async (event, filePath) => {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { success: true };
});

// 删除目录
ipcMain.handle('delete-directory', async (event, dirPath) => {
    if (fs.existsSync(dirPath)) fs.rmSync(dirPath, { recursive: true, force: true });
    return { success: true };
});

// 创建目录
ipcMain.handle('create-directory', async (event, dirPath) => {
    fs.mkdirSync(dirPath, { recursive: true });
    return { success: true };
});

// 创建缩略图
ipcMain.handle('create-thumbnail', async (event, sourcePath, destPath, width = 80, height = 80) => {
    return new Promise((resolve, reject) => {
        const { spawn } = require('child_process');
        const pythonScript = path.join(__dirname, 'create_thumbnail.py');
        
        // 如果 .png 不存在，尝试 .jpg
        let actualSource = sourcePath;
        if (!fs.existsSync(sourcePath)) {
            const jpgPath = sourcePath.replace(/\.png$/, '.jpg');
            if (fs.existsSync(jpgPath)) {
                actualSource = jpgPath;
            }
        }
        
        const args = [pythonScript, actualSource, destPath, String(width), String(height)];
        
        console.log('🖼️ 生成缩略图:', actualSource, '→', destPath);
        
        const proc = spawn('python', args);
        let stdout = '', stderr = '';
        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });
        proc.on('close', (code) => {
            if (code !== 0) {
                console.error('缩略图失败:', stderr);
                reject(new Error(stderr || '失败'));
            } else {
                console.log('✅ 缩略图成功:', stdout.trim());
                resolve({ success: true, path: stdout.trim() });
            }
        });
        proc.on('error', (err) => {
            reject(err);
        });
    });
});

// 获取机器码
ipcMain.handle('get-machine-id', () => {
    return machineIdSync();
});

// 获取默认存储路径（供渲染进程降级使用）
ipcMain.handle('get-default-storage-path', () => {
    return path.join(app.getPath('documents'), '智卷工坊数据');
});

// 读取应用配置文件（供渲染进程恢复丢失的 localStorage 配置）
ipcMain.handle('get-app-config', () => {
    try {
        const configPath = path.join(app.getPath('userData'), 'apiConfig.json');
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }
    } catch { /* ignore */ }
    return null;
});

// 🔧 新增：加密/解密（用于安全存储 API Key）
ipcMain.handle('encrypt-text', async (event, text) => {
  try {
    const { safeStorage } = require('electron');
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(text);
      return Buffer.from(encrypted).toString('base64');
    }
    // 🔧 修复：降级路径补 enc_ 前缀（与渲染进程 encrypt() 的 base64 兜底一致），
    //    保证 decrypt 能正确识别——无前缀 base64 会被误判为明文 Key
    return 'enc_' + Buffer.from(text, 'utf-8').toString('base64');
  } catch (e) {
    return 'enc_' + Buffer.from(text, 'utf-8').toString('base64');
  }
});

ipcMain.handle('decrypt-text', async (event, encryptedBase64) => {
  try {
    const { safeStorage } = require('electron');
    const buffer = Buffer.from(encryptedBase64, 'base64');
    if (safeStorage.isEncryptionAvailable()) {
      // 仅对 safeStorage 自己加密过的值调用解密；其他格式（如 WebCrypto 的 enc_wc_*）
      // 会在此抛异常 → 进入 catch → 返回 null，由渲染进程回退到 WebCrypto 解密
      return safeStorage.decryptString(buffer);
    }
    return null; // 🔧 修复：safeStorage 不可用且无法确认可解密时返回 null，绝不返回乱码
  } catch (e) {
    // 🔧 关键修复：解密失败返回 null，绝不返回 Buffer.from(...).toString('utf-8') 乱码。
    //    乱码含 U+FFFD 等非 Latin-1 字符，会被渲染进程当作 API Key 放进 Authorization 头，
    //    导致 fetch 抛 "Failed to read the 'headers' property from 'RequestInit': String contains non ISO-8859-1 code point"
    return null;
  }
});

// 保存应用配置到文件（供主进程读取 storagePath 等）
ipcMain.handle('save-app-config', async (event, config) => {
    try {
        const configPath = path.join(app.getPath('userData'), 'apiConfig.json');
        let existing = {};
        try {
            if (fs.existsSync(configPath)) {
                existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            }
        } catch { /* ignore */ }
        const merged = { ...existing, ...config };
        fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf-8');
        // 如果 storagePath 变了，确保新目录存在
        if (config.storagePath && !fs.existsSync(config.storagePath)) {
            fs.mkdirSync(config.storagePath, { recursive: true });
        }
        return true;
    } catch (e) {
        console.error('保存配置失败:', e);
        return false;
    }
});

// ==================== 保存文件对话框 ====================
ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog({
    title: options?.title || '保存文件',
    defaultPath: options?.defaultPath,
    filters: options?.filters || [{ name: '所有文件', extensions: ['*'] }],
  });
  return { filePath: result.filePath, canceled: result.canceled };
});

// ==================== Azure 语音合成（英语听力音频 · 2026-09-16） ====================
// 为什么放主进程：渲染进程直连会因自定义头 Ocp-Apim-Subscription-Key 触发 CORS 预检而被拦；
//   主进程 fetch 无同源限制，且能把音频直接写盘（避免几十 MB 二进制穿过 IPC）。
// 🔴 Key 安全：Key 由渲染进程按次传入（来自设置页加密存储的解密值），本进程仅用于本次请求——
//   不落盘、不写日志、不回显；日志只记结果字节数。
ipcMain.handle('azure-tts-to-file', async (event, payload = {}) => {
  const {
    ssml = '', key = '', region = '',
    outputFormat = 'audio-24khz-160kbitrate-mono-mp3',
    suggestedName = '听力音频.mp3',
    timeoutMs = 180000,
  } = payload || {};

  try {
    if (!String(key).trim()) return { ok: false, error: '未配置 Azure 语音 Key（请在「设置 → Azure 语音合成」中填写）' };
    // 🔒 区域严格格式校验：本进程具外发能力，禁止把 region 拼成任意主机
    const r = String(region).trim().toLowerCase();
    if (!/^[a-z0-9-]{3,30}$/.test(r)) {
      return { ok: false, error: 'Azure 语音区域格式非法（应形如 eastasia）' };
    }
    if (!String(ssml).trim()) return { ok: false, error: 'SSML 内容为空' };

    // 先选保存位置：用户取消则不发起请求，不浪费配额
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '保存听力音频',
      defaultPath: suggestedName,
      filters: [{ name: 'MP3 音频', extensions: ['mp3'] }],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(30000, Number(timeoutMs) || 180000));
    let resp;
    try {
      resp = await fetch(`https://${r}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': String(key).trim(),
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': outputFormat,
          'User-Agent': 'zhijuan-workshop',
        },
        body: String(ssml),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!resp.ok) {
      let detail = '';
      try { detail = await resp.text(); } catch { /* 无响应体 */ }
      return {
        ok: false,
        error: `Azure 语音合成失败（HTTP ${resp.status}）${detail ? '：' + String(detail).slice(0, 200) : ''}`,
      };
    }

    const buf = Buffer.from(await resp.arrayBuffer());
    await fs.promises.writeFile(filePath, buf);
    console.log(`🎧 听力音频已保存：${filePath}（${buf.length} 字节）`);
    return { ok: true, path: filePath, bytes: buf.length };
  } catch (e) {
    if (e && e.name === 'AbortError') return { ok: false, error: '合成超时，请检查网络后重试' };
    return { ok: false, error: e?.message || '音频生成失败' };
  }
});

// ==================== Edge 免费语音合成（英语听力音频 · 2026-09-19） ====================
// 走免费 Edge 神经音色（无需 Azure Key）。Edge 不支持 SSML <break>（实测致 websocket 断开），
//   故"逐句合成 + 帧级静音拼接"：每句单独合成，段间用与合成流同参数（24kHz/96kbps 单声道
//   MPEG-2 Layer III）的静音帧字节级拼接出整卷 mp3，全程纯 Node、无 ffmpeg 依赖。
// 🔴 参数同源：静音帧的采样率/码率必须与 OUTPUT_FORMAT 一致，否则播放端会爆音/断帧。

/** Edge 固定输出：24kHz 单声道 MPEG-2 Layer III，每帧 24ms；码率决定帧长 */
const EDGE_SILENT_FRAME = {
  'audio-24khz-96kbitrate-mono-mp3': { bitrateIndex: 10, frameLen: 288 }, // 96kbps → 288B/帧
  'audio-24khz-48kbitrate-mono-mp3': { bitrateIndex: 6, frameLen: 144 },  // 48kbps → 144B/帧
};
const EDGE_OUTPUT_FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3;
const EDGE_MS_PER_FRAME = 24;

/** 生成指定时长的静音 MP3 帧（纯 Node，头 FF F3 xx C4，其余全零解出静音） */
function makeSilentMp3Frames(durationMs, format = EDGE_OUTPUT_FORMAT) {
  const d = Number(durationMs);
  if (!d || d <= 0) return Buffer.alloc(0);
  const { bitrateIndex, frameLen } = EDGE_SILENT_FRAME[format] || EDGE_SILENT_FRAME[EDGE_OUTPUT_FORMAT];
  const count = Math.max(0, Math.round(d / EDGE_MS_PER_FRAME));
  if (!count) return Buffer.alloc(0);
  // MPEG-2(v2) Layer III(01) mono(11)：FF F3 [idx<<4|sampIdx(1)<<2] C4
  const header = Buffer.from([0xff, 0xf3, (bitrateIndex << 4) | 0x04, 0xc4]);
  const frame = Buffer.alloc(frameLen);
  header.copy(frame, 0);
  const out = Buffer.alloc(frameLen * count);
  for (let i = 0; i < count; i++) frame.copy(out, frameLen * i);
  return out;
}

/** 帧计数（同时校验整段是否真 MP3）：统计可解析的合法层 III 帧 */
function countMp3Frames(buf) {
  const layer3v2 = [0,8000,16000,24000,32000,40000,48000,56000,64000,80000,96000,112000,128000,144000,160000];
  let pos = 0, frames = 0;
  while (pos < buf.length - 4) {
    if (buf[pos] !== 0xff || (buf[pos+1] & 0xe0) !== 0xe0) { pos++; continue; }
    const ver = (buf[pos+1] >> 3) & 3;
    if (ver === 1) { pos++; continue; } // reserved
    const bitrateIdx = (buf[pos+2] >> 4) & 15;
    const sampIdx = (buf[pos+2] >> 2) & 3;
    if (bitrateIdx === 15 || sampIdx === 3) { pos++; continue; }
    const bps = layer3v2[bitrateIdx] || 0;
    if (!bps) { pos++; continue; }
    const sampRate = [44100,48000,32000][sampIdx] / (ver === 3 ? 1 : 2);
    const padding = (buf[pos+2] >> 1) & 1;
    const frameLen = ver === 3 ? Math.floor(144*bps/sampRate)+padding : Math.floor(72*bps/sampRate)+padding;
    if (frameLen < 24 || pos + frameLen > buf.length) { pos++; continue; }
    frames++;
    pos += frameLen;
  }
  return frames;
}

/** 逐句合成到一个临时目录，返回该句音频 Buffer */
async function edgeSynthesizeSegment(voice, text, ratePercent, outDir, idx) {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(voice, EDGE_OUTPUT_FORMAT);
    const rate = Number(ratePercent) ? { rate: `${Math.round(Number(ratePercent))}%` } : {};
    const { audioFilePath } = await tts.toFile(outDir, text, rate);
    const buf = fs.readFileSync(audioFilePath);
    try { fs.unlinkSync(audioFilePath); } catch {}
    if (!buf.length || countMp3Frames(buf) === 0) {
      throw new Error(`第 ${idx + 1} 句合成结果为空或帧结构异常（可能是网络/音色问题）`);
    }
    return buf;
  } finally {
    try { tts.close(); } catch {}
  }
}

/** 逐句合成重试次数（同句重试；退避见 edgeSynthesizeSegmentWithRetry） */
const EDGE_SYNTH_ATTEMPTS = 3;

/**
 * 🔁 逐句合成失败时的可操作报错（2026-09-20 用户实测后新增）
 * ============================================================
 * 原实现只把库的原始错误抛出来（"逐句合成中断：Stream closed before the synthesis completed..."），
 * 用户既不知道卡在第几段，也不知道该改什么。这里补上"段序 / 题号 / 角色 / 音色 / 文本前 40 字"，
 * 并给出下一步动作——这类断流多数是免费通道偶发，重试即可。
 */
function describeEdgeFailure(seg, index, total, err) {
  const t = String(seg.text || '');
  const preview = t.length > 40 ? `${t.slice(0, 40)}…` : t;
  const where = seg.itemNo ? `第 ${seg.itemNo} 题` : '框架段（标题/指令/播报等）';
  return [
    `逐句合成中断：第 ${index + 1}/${total} 段重试 ${EDGE_SYNTH_ATTEMPTS} 次仍失败`,
    `· 位置：${where}${seg.role ? `　角色：${seg.role}` : ''}　音色：${seg.voice}`,
    `· 文本：${preview}`,
    `· 底层错误：${err && err.message ? err.message : String(err)}`,
    '· 处理建议：Edge 免费通道偶发断流，稍后重试通常即可；若总卡在同一段，请检查该段文本（是否超长、是否含下划线填空占位等特殊符号）。',
  ].join('\n');
}

/**
 * 带重试的逐句合成
 * ============================================================
 * 🔴 为什么必须重试：Edge 免费通道是**非官方**接口，长卷合成中偶发断流属常态
 *   （实测错误 "Stream closed before the synthesis completed (no turn.end received)"），
 *   原实现"一次失败＝整卷中止"，一卷 50 段录到第 48 段断掉，前功尽弃。
 *   同句重试通常就过；仍失败才报错，且报错必须能定位到具体那一段。
 */
async function edgeSynthesizeSegmentWithRetry(seg, outDir, index, total) {
  let lastErr = null;
  for (let attempt = 1; attempt <= EDGE_SYNTH_ATTEMPTS; attempt++) {
    try {
      return await edgeSynthesizeSegment(seg.voice, seg.text, seg.ratePercent, outDir, index);
    } catch (e) {
      lastErr = e;
      if (attempt < EDGE_SYNTH_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt === 1 ? 600 : 1500));
      }
    }
  }
  throw new Error(describeEdgeFailure(seg, index, total, lastErr));
}

/** 文件名安全化：把 Windows 非法字符（ : \ / * ? " < > | 与换行）换成下划线，保留中文；→ 与渲染端 Azure 同规格 */
function safeAudioFileName(name = '', fallback = '听力音频') {
  const s = String(name || '').replace(/[\\/:*?"<>|\r\n\t]/g, '_').trim();
  return (s || fallback).slice(0, 80);
}

// 🔊 音色试听（2026-09-19 用户要求"每个音色选项都要能试听"）：
//    合成一小段样例回传 base64，界面用 <audio> 直接播放 —— 不落盘、不弹保存框、不留临时文件。
//    走主进程的理由与正式合成一致：规避渲染进程跨域/鉴权，且复用同一套音色校验。
const EDGE_PREVIEW_TEXT = "Good morning, everyone. Welcome to our school radio programme.";
ipcMain.handle('edge-tts-preview', async (event, payload = {}) => {
  const voice = /^[a-zA-Z]{2,3}-[a-zA-Z]{2,3}-[A-Za-z0-9-]{1,60}$/.test(String(payload.voice || ''))
    ? String(payload.voice) : '';
  if (!voice) return { ok: false, error: '音色名不合法' };
  const text = String(payload.text || '').trim() || EDGE_PREVIEW_TEXT;
  const ratePercent = Number.isFinite(Number(payload.ratePercent)) ? Math.round(Number(payload.ratePercent)) : 0;
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-preview-'));
  try {
    const buf = await edgeSynthesizeSegment(voice, text, ratePercent, outDir, 0);
    return { ok: true, base64: buf.toString('base64'), mime: 'audio/mpeg' };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    try { fs.rmSync(outDir, { recursive: true, force: true }); } catch {}
  }
});

ipcMain.handle('edge-tts-to-file', async (event, payload = {}) => {
  const { segments = [], suggestedName = '听力音频.mp3' } = payload || {};
  if (!Array.isArray(segments) || !segments.length) {
    return { ok: false, error: '没有可合成的分段（听力原文为空）' };
  }
  // 逐句字段白名单校验：voice/text 必须为串，ratePercent/gapAfterMs 取有限数值，防脏 payload 注入
  // itemNo/role 只为**失败时报出"卡在第几题"**用（2026-09-20），不参与合成
  const sanitized = segments.map((s, i) => {
    const voice = /^[a-zA-Z]{2,3}-[a-zA-Z]{2,3}-[A-Za-z0-9-]{1,60}$/.test(String(s.voice || ''))
      ? String(s.voice) : 'en-US-AriaNeural';
    const text = String(s.text || '').trim();
    const ratePercent = Number.isFinite(Number(s.ratePercent)) ? Math.round(Number(s.ratePercent)) : 0;
    const gapAfterMs = Number.isFinite(Number(s.gapAfterMs)) && Number(s.gapAfterMs) > 0 ? Math.round(Number(s.gapAfterMs)) : 0;
    if (!text) return null;
    return {
      voice,
      text,
      ratePercent,
      gapAfterMs,
      chimeBefore: s.chimeBefore === true,
      itemNo: s.itemNo === null || s.itemNo === undefined ? null : String(s.itemNo).slice(0, 12),
      role: String(s.role || '').slice(0, 12),
      idx: i,
    };
  }).filter(Boolean);
  if (!sanitized.length) return { ok: false, error: '所有分段均为空文本，无法合成' };

  // 🔴 提示音素材（"叮咚"）：正规听力音频在题与题之间、换节处必有提示音（2026-09-19 用户裁定：
  //    用内置素材，不加编码器依赖）。素材与合成流同格式（24kHz/96kbps 单声道 MP3），字节级可拼。
  //    缺失时降级为"无提示音"，并在返回里如实说明，不静默。
  let chimeBuf = null;
  try {
    chimeBuf = fs.readFileSync(path.join(__dirname, 'assets', 'listening-chime.mp3'));
  } catch (e) {
    console.warn('🎧 提示音素材未找到，本次不插入提示音：', e.message);
  }
  const wantsChime = sanitized.some((s) => s.chimeBefore);
  const chimeNote = wantsChime && !chimeBuf ? '（提示音素材缺失，本次未插入提示音）' : '';

  // 先选保存位置：用户取消则不发起请求，不浪费配额/流量
  const safeName = safeAudioFileName(String(suggestedName).replace(/\.mp3$/i, ''), '听力音频');
  let filePath;
  try {
    const { canceled, filePath: fp } = await dialog.showSaveDialog({
      title: '保存听力音频（Edge 免费合成）',
      defaultPath: `${safeName}.mp3`,
      filters: [{ name: 'MP3 音频', extensions: ['mp3'] }],
    });
    if (canceled || !fp) return { ok: false, canceled: true };
    filePath = fp;
  } catch (e) {
    return { ok: false, error: `无法打开保存对话框：${e.message}` };
  }

  // 临时目录：逐句合成落盘 + 读回字节拼接（用完即清）
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-tts-'));
  try {
    const parts = [];
    for (let i = 0; i < sanitized.length; i++) {
      const seg = sanitized[i];
      try {
        // 段前提示音：题与题的边界、换节处（素材后跟 250ms 静音，避免"叮"紧贴语音）
        if (seg.chimeBefore && chimeBuf) {
          parts.push(chimeBuf);
          parts.push(makeSilentMp3Frames(250));
        }
        const buf = await edgeSynthesizeSegmentWithRetry(seg, outDir, i, sanitized.length);
        parts.push(buf);
        if (seg.gapAfterMs) parts.push(makeSilentMp3Frames(seg.gapAfterMs));
      } catch (e) {
        // 已带"段序/题号/角色/文本"的可操作报错（见 describeEdgeFailure），此处不再套壳，避免信息被压扁
        return { ok: false, error: e.message };
      }
    }
    const total = Buffer.concat(parts);
    if (countMp3Frames(total) === 0) {
      return { ok: false, error: '拼接后的音频不含有效 MP3 帧，已中止落盘' };
    }
    await fs.promises.writeFile(filePath, total);
    console.log(`🎧 Edge 听力音频已保存：${filePath}（${total.length} 字节，${sanitized.length} 段${chimeBuf ? '，含提示音' : ''}）`);
    return { ok: true, path: filePath, bytes: total.length, segments: sanitized.length, note: chimeNote };
  } finally {
    try { fs.rmSync(outDir, { recursive: true, force: true }); } catch {}
  }
});

// ==================== 静默生成 PDF ====================
ipcMain.handle('export-pdf', async (event, htmlContent, outputPath, options = {}) => {
  let puppeteer = null;
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    console.error('puppeteer 模块加载失败:', e.message);
    return { success: false, error: 'PDF 导出依赖 Puppeteer（Chromium），当前环境未找到。请运行 npm install puppeteer 或在浏览器中使用「打印→另存为PDF」功能。' };
  }
  let browser = null;

  // 🔧 答案区独立编号：将含 answer-section 的文档拆为「正文」「答案」两份 PDF 分别渲染，
  //    puppeteer 页脚"共X页"只统计各自段内页数（正文不含答案页、答案页从 1 重新编号），
  //    最后用 pdf-lib 按正文→答案顺序合并为一个 PDF。
  //    无答案区（学生版）保持单次渲染原逻辑。
  const splitAnswerSection = (html) => {
    const bodyOpen = html.match(/<body[^>]*>/i);
    const bodyClose = html.match(/<\/body>/i);
    const answerRe = /<div\s+class="[^"]*answer-section[^"]*"[^>]*>/i;
    if (!bodyOpen || !bodyClose) return null;
    const headPrefix = html.slice(0, bodyOpen.index + bodyOpen[0].length);
    const bodyInner = html.slice(bodyOpen.index + bodyOpen[0].length, bodyClose.index);
    const bodySuffix = html.slice(bodyClose.index);
    const answerMatch = bodyInner.match(answerRe);
    if (!answerMatch) return null;
    return {
      bodyHtml: headPrefix + bodyInner.slice(0, answerMatch.index) + bodySuffix,
      answerHtml: headPrefix + bodyInner.slice(answerMatch.index) + bodySuffix,
    };
  };

  try {
    // 确保输出目录存在
    const outDir = path.dirname(outputPath);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    browser = await puppeteer.launch({ headless: true });
    // 🔧 密封线试卷（页面壳自带 A4 页边距）传 margin=0，避免与 Puppeteer 边距双重留白；
    //    普通文档保持默认 20mm。
    const mm = Number(options.margin);
    const margin = Number.isFinite(mm) ? mm : 20;
    // 🔧 卷面规范：PDF 页脚页码（与 docx 页脚"第X页　共X页"一致）；
    //    底部边距不足 10mm 时页脚无渲染空间，强制抬到 10mm
    const bottom = Math.max(margin, 10);
    const pdfOptions = {
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: '<div style="width:100%;text-align:center;font-size:9px;color:#000000;font-family:SimSun,serif;">第 <span class="pageNumber"></span> 页　共 <span class="totalPages"></span> 页</div>',
      margin: { top: `${margin}mm`, bottom: `${bottom}mm`, left: `${margin}mm`, right: `${margin}mm` }
    };

    const renderToPdf = async (page, content, outPath) => {
      await page.setContent(content, { waitUntil: 'networkidle0' });
      await page.pdf({ ...pdfOptions, path: outPath });
    };

    const parts = splitAnswerSection(htmlContent);
    if (!parts) {
      // 无答案区：单次渲染（原逻辑）
      const page = await browser.newPage();
      await renderToPdf(page, htmlContent, outputPath);
    } else {
      // 有答案区：正文/答案分次渲染，合并为一个 PDF
      const tmpDir = path.join(__dirname, '.temp_pdf');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const bodyPath = path.join(tmpDir, `body_${Date.now()}.pdf`);
      const answerPath = path.join(tmpDir, `answer_${Date.now()}.pdf`);
      const page = await browser.newPage();
      await renderToPdf(page, parts.bodyHtml, bodyPath);
      await renderToPdf(page, parts.answerHtml, answerPath);

      let pdfLib = null;
      try {
        pdfLib = require('pdf-lib');
      } catch (e) {
        console.error('pdf-lib 模块加载失败，回退单文件导出:', e.message);
        // 回退：合并失败时直接输出正文 PDF（保留原导出能力）
        fs.copyFileSync(bodyPath, outputPath);
      }
      if (pdfLib) {
        const bodyPdf = await pdfLib.PDFDocument.load(await fs.promises.readFile(bodyPath));
        const answerPdf = await pdfLib.PDFDocument.load(await fs.promises.readFile(answerPath));
        const merged = await pdfLib.PDFDocument.create();
        const bodyPages = await merged.copyPages(bodyPdf, bodyPdf.getPageIndices());
        bodyPages.forEach((p) => merged.addPage(p));
        const answerPages = await merged.copyPages(answerPdf, answerPdf.getPageIndices());
        answerPages.forEach((p) => merged.addPage(p));
        await fs.promises.writeFile(outputPath, await merged.save());
      }
      // 清理临时文件
      try { fs.unlinkSync(bodyPath); } catch {}
      try { fs.unlinkSync(answerPath); } catch {}
      try { fs.rmdirSync(tmpDir); } catch {}
    }
    return { success: true, path: outputPath };
  } catch (error) {
    console.error('PDF生成失败:', error);
    return { success: false, error: error.message };
  } finally {
    if (browser) await browser.close();
  }
});

// ==================== Word COM 后处理（田字格/四线三格）====================
ipcMain.handle('word-com-process', async (event, buffer) => {
  // 用项目目录而非系统 Temp，避免 Word Protected View 拦截
  var tmpDir = path.join(__dirname, '.temp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  var tmpPath = path.join(tmpDir, 'tzg_com_' + Date.now() + '.docx');

  console.log('[COM] 开始处理，临时文件:', tmpPath);

  try {
    // 1. 写入临时文件
    const buf = Buffer.from(buffer);
    fs.writeFileSync(tmpPath, buf);
    console.log('[COM] 临时文件已写入, 大小:', buf.length);

    // 2. 调用 PowerShell COM
    const result = await new Promise(function (resolve) {
      const psScript = path.join(__dirname, 'scripts', 'word-com-process.ps1');
      console.log('[COM] PS 脚本路径:', psScript);
      if (!fs.existsSync(psScript)) {
        console.error('[COM] PS 脚本不存在!');
        resolve({ success: false, error: 'PS 脚本未找到: ' + psScript });
        return;
      }
      console.log('[COM] 启动 PowerShell...');

      var spawn = require('child_process').spawn;
      var ps = spawn('powershell.exe', [
        '-NoProfile', '-ExecutionPolicy', 'Bypass',
        '-File', psScript, '-DocPath', tmpPath
      ], { windowsHide: true });

      var timer = setTimeout(function () {
        try { ps.kill(); } catch (_) { }
        console.error('[COM] 超时（180s）');
        resolve({ success: false, error: 'COM 处理超时（180s）' });
      }, 180000);

      var stdout = '';
      var stderr = '';
      ps.stdout.on('data', function (d) { stdout += d.toString(); });
      ps.stderr.on('data', function (d) { stderr += d.toString(); });

      ps.on('close', function (code) {
        clearTimeout(timer);
        console.log('[COM] PS 退出码:', code);
        console.log('[COM] stdout:', stdout.substring(0, 2000));
        if (stderr) console.log('[COM] stderr:', stderr.substring(0, 500));
        try {
          if (code === 0 && stdout.trim()) {
            var parsed = JSON.parse(stdout.trim());
            console.log('[COM] 解析结果:', JSON.stringify(parsed));
            resolve(parsed);
          } else {
            console.error('[COM] 失败, code:', code);
            resolve({ success: false, error: stderr || stdout || ('PS 退出码 ' + code) });
          }
        } catch (e2) {
          console.error('[COM] JSON 解析失败:', e2.message);
          resolve({ success: false, error: '解析结果失败: ' + e2.message });
        }
      });

      ps.on('error', function (err) {
        clearTimeout(timer);
        console.error('[COM] 启动 PS 失败:', err.message);
        resolve({ success: false, error: '启动 PS 失败: ' + err.message });
      });
    });

    // 3. 读取处理后的文件
    if (result.success && fs.existsSync(tmpPath)) {
      var processed = fs.readFileSync(tmpPath);
      console.log('[COM] 成功! 文件大小:', processed.length);
      console.log('[COM] 统计:', JSON.stringify(result.processed));
      return {
        success: true,
        buffer: processed.buffer.slice(processed.byteOffset, processed.byteOffset + processed.byteLength),
        processed: result.processed
      };
    }
    console.log('[COM] 失败:', result.error);
    return result;
  } catch (e) {
    console.error('[COM] 异常:', e.message);
    return { success: false, error: e.message };
  } finally {
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) { }
  }
});

// PDF 转图片
ipcMain.handle('pdf-to-images', async (event, pdfPath, outputDir, pageRange) => {
    return new Promise((resolve, reject) => {
        const { spawn } = require('child_process');
        const pythonScript = path.join(__dirname, 'python-scripts', 'pdf_to_images.py');
        const args = [pythonScript, pdfPath, outputDir];
        
        if (pageRange) {
            if (typeof pageRange === 'string' && pageRange.includes(',')) {
                const pages = pageRange.split(',');
                pages.forEach(p => args.push(p.trim()));
            } else {
                args.push(pageRange);
            }
        }
        
        console.log('📄 [main.js] pdf-to-images 参数:', args);
        
        const proc = spawn('python', args);
        let stdout = '', stderr = '';
        let resolved = false;
        
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                proc.kill();
                console.warn('⚠️ PDF转图片超时，强制返回');
                resolve({ total_pages: 0, message: 'timeout' });
            }
        }, 120000); // 2分钟超时
        
        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });
        proc.on('close', (code) => {
            clearTimeout(timeout);
            if (resolved) return;
            resolved = true;
            if (code !== 0) {
                console.error('❌ PDF转图片失败:', stderr);
                reject(new Error(stderr || 'PDF转换失败'));
            } else {
                try {
                    resolve(JSON.parse(stdout));
                } catch (e) {
                    resolve({ total_pages: 0, message: stdout });
                }
            }
        });
        proc.on('error', (err) => {
            clearTimeout(timeout);
            if (resolved) return;
            resolved = true;
            reject(err);
        });
    });
});


// ✅ 批量 PDF 转图片（循环调用 Python，每次一页）
ipcMain.handle('pdf-pages-to-images', async (event, pdfPath, outputDir, pages) => {
    return new Promise(async (resolve, reject) => {
        try {
            const { spawn } = require('child_process');
            const pythonScript = path.join(__dirname, 'python-scripts', 'pdf_to_images.py');
            let totalPages = 0;
            
            for (const page of pages) {
                await new Promise((res, rej) => {
                    const args = [pythonScript, pdfPath, outputDir, String(page)];
                    const proc = spawn('python', args);
                    let out = '', err = '';
                    let resolved = false;
                    
                    const timeout = setTimeout(() => {
                        if (!resolved) {
                            resolved = true;
                            proc.kill();
                            console.warn(`⚠️ 第${page}页转换超时，跳过`);
                            res(); // 跳过这页，继续下一页
                        }
                    }, 30000); // 单页30秒超时
                    
                    proc.stdout.on('data', (d) => { out += d.toString(); });
                    proc.stderr.on('data', (d) => { err += d.toString(); });
                    proc.on('close', (code) => {
                        clearTimeout(timeout);
                        if (resolved) return;
                        resolved = true;
                        if (code !== 0) {
                            console.warn(`⚠️ 第${page}页转换失败:`, err);
                            res(); // 失败也继续
                        } else {
                            try { const r = JSON.parse(out); totalPages = r.total_pages || totalPages; } catch (e) {}
                            res();
                        }
                    });
                    proc.on('error', (err) => {
                        clearTimeout(timeout);
                        if (resolved) return;
                        resolved = true;
                        console.warn(`⚠️ 第${page}页进程错误:`, err.message);
                        res();
                    });
                });
            }
            resolve({ success: true, total_pages: totalPages });
        } catch (error) { reject(error); }
    });
});

// 检测并切割分栏图片
ipcMain.handle('split-columns', async (event, imagePath, outputDir) => {
    return new Promise((resolve) => {
        const { spawn } = require('child_process');
        const scriptPath = path.join(__dirname, 'python-scripts', 'split_columns.py');
        
        if (!fs.existsSync(scriptPath)) {
            resolve({ columns: 1, splits: [], regions: [], sub_images: [] });
            return;
        }
        
        const proc = spawn('python', [scriptPath, imagePath, outputDir]);
        let stdout = '';
        
        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        
        proc.on('close', (code) => {
            if (code !== 0) {
                resolve({ columns: 1, splits: [], regions: [], sub_images: [] });
            } else {
                try {
                    resolve(JSON.parse(stdout));
                } catch {
                    resolve({ columns: 1, splits: [], regions: [], sub_images: [] });
                }
            }
        });
        proc.on('error', () => {
            resolve({ columns: 1, splits: [], regions: [], sub_images: [] });
        });
    });
});

// ==================== PaddleOCR-VL 统一多模态识别（替代 Ollama 多模态模型）====================
ipcMain.handle('paddleocr-vl-chat', async (event, { prompt, imageBase64List, options }) => {
    return new Promise((resolve) => {
        const { spawn } = require('child_process');
        const pythonScript = path.join(__dirname, 'python-scripts', 'paddleocr_vl_chat.py');
        
        if (!fs.existsSync(pythonScript)) {
            resolve({ success: false, error: 'PaddleOCR-VL 脚本不存在: ' + pythonScript });
            return;
        }
        
        const mode = (options && options.mode) || 'pipeline';
        const maxTokens = (options && options.maxTokens) || null;
        
        // 将 base64 图片写入临时文件
        const tempDir = path.join(app.getPath('temp'), 'paddleocr_vl');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tempFiles = [];
        try {
            const list = Array.isArray(imageBase64List) ? imageBase64List : [imageBase64List];
            for (let i = 0; i < list.length; i++) {
                const tmpPath = path.join(tempDir, `ocr_${Date.now()}_${i}.png`);
                fs.writeFileSync(tmpPath, Buffer.from(list[i], 'base64'));
                tempFiles.push(tmpPath);
            }
        } catch (e) {
            resolve({ success: false, error: '临时文件写入失败: ' + e.message });
            return;
        }
        
        // 构建命令行参数
        const args = [pythonScript, '--mode', mode];
        if (prompt) {
            args.push('--prompt', prompt);
        }
        if (mode === 'chat' && maxTokens) {
            args.push('--max-tokens', String(maxTokens));
        }
        tempFiles.forEach(f => args.push('--image', f));
        
        console.log(`🔍 [PaddleOCR-VL] 模式=${mode}, ${tempFiles.length} 张图片...`);
        if (prompt) {
            console.log(`📝 [PaddleOCR-VL] 指令: ${prompt.substring(0, 100)}...`);
        }
        
        // 释放 GPU 显存：卸载 Ollama 模型，避免与 PaddleOCR-VL 争抢显存
        const { execSync } = require('child_process');
        try {
            const psOutput = execSync('ollama ps', { encoding: 'utf-8', timeout: 5000 });
            const lines = psOutput.split('\n').filter(l => l.trim() && !l.startsWith('NAME'));
            for (const line of lines) {
                const modelName = line.trim().split(/\s+/)[0];
                if (modelName && !modelName.startsWith('NAME')) {
                    console.log(`🔧 [PaddleOCR-VL] 正在卸载 Ollama 模型释放显存: ${modelName}`);
                    execSync(`ollama stop ${modelName}`, { timeout: 10000 });
                    console.log(`   ✅ 已卸载: ${modelName}`);
                }
            }
        } catch (e) {
            console.warn('⚠️ [PaddleOCR-VL] 卸载 Ollama 模型失败（可能无模型运行）:', e.message?.substring(0, 80));
        }
        
        const proc = spawn('python', args, {
            env: {
                ...process.env,
                PYTHONUNBUFFERED: '1',          // 禁用 Python 输出缓冲，pipe 通信必须
                PYTHONIOENCODING: 'utf-8',       // 确保中文输出不乱码
            }
        });
        let stdout = '';
        let stderr = '';
        let resolved = false;
        
        // chat 模式超时更短，pipeline 模式保持较长
        const baseTimeout = mode === 'chat' ? 120000 : 300000;
        const timeoutMs = Math.max(baseTimeout, tempFiles.length * (mode === 'chat' ? 60000 : 120000));
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                console.warn(`⚠️ PaddleOCR-VL 超时（${timeoutMs/1000}秒），stderr: ${stderr.substring(0, 300)}`);
                // 先尝试优雅终止，再强制杀进程树，避免 GPU 显存泄漏
                try { proc.kill('SIGTERM'); } catch {}
                setTimeout(() => {
                    try { 
                        const { execSync } = require('child_process');
                        execSync(`taskkill /f /t /pid ${proc.pid}`, { timeout: 5000 });
                    } catch {}
                }, 3000);
                resolve({ success: false, error: `PaddleOCR-VL 超时（${timeoutMs/1000}秒）` });
            }
        }, timeoutMs);
        
        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => {
            const msg = data.toString();
            stderr += msg;
            // 实时转发初始化进度，方便排查超时原因
            process.stderr.write(`[PaddleOCR-VL] ${msg}`);
        });
        
        const cleanup = () => {
            tempFiles.forEach(f => {
                try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
            });
        };
        
        proc.on('close', (code) => {
            clearTimeout(timeout);
            cleanup();
            if (resolved) return;
            resolved = true;
            
            if (stderr) {
                console.log('[PaddleOCR-VL stderr]:', stderr.substring(0, 500));
            }
            
            if (code !== 0) {
                console.error('❌ PaddleOCR-VL 失败:', stderr || stdout);
                try {
                    const errorResult = JSON.parse(stdout);
                    resolve(errorResult);
                } catch {
                    resolve({ success: false, error: stderr || stdout || 'PaddleOCR-VL 执行失败' });
                }
            } else {
                try {
                    const result = JSON.parse(stdout);
                    console.log(`✅ PaddleOCR-VL 完成: ${result.total_length || 0}字, ${result.page_count || 0}页`);
                    resolve(result);
                } catch (e) {
                    console.error('❌ PaddleOCR-VL JSON 解析失败:', e.message);
                    resolve({ success: false, error: 'JSON 解析失败: ' + stdout.substring(0, 200) });
                }
            }
        });
        
        proc.on('error', (err) => {
            clearTimeout(timeout);
            cleanup();
            if (resolved) return;
            resolved = true;
            console.error('❌ PaddleOCR-VL 进程错误:', err.message);
            resolve({ success: false, error: '无法启动 Python 进程: ' + err.message });
        });
    });
});

// 写书签
ipcMain.handle('add-pdf-bookmarks-to-path', async (event, pdfPath, bookmarks, outputPath) => {
    return new Promise((resolve, reject) => {
        const { spawn } = require('child_process');
        const pythonScript = path.join(__dirname, 'python-scripts', 'add_bookmarks.py');
        const scriptPath = fs.existsSync(pythonScript) ? pythonScript : path.join(__dirname, 'add_bookmarks.py');
        
        // 写入临时文件，避免命令行参数传递特殊字符
        const tmpFile = pdfPath.replace('.pdf', '_bookmarks_tmp.json');
        fs.writeFileSync(tmpFile, JSON.stringify(bookmarks, null, 2), 'utf-8');
        
        const args = [scriptPath, pdfPath, tmpFile];
        if (outputPath) {
            args.push(outputPath);
        }
        
        console.log('📝 写书签:', scriptPath, pdfPath);
        console.log('📝 书签数量:', bookmarks.length);
        
        const proc = spawn('python', args);
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });
        
        const timeout = setTimeout(() => {
            proc.kill();
            try { fs.unlinkSync(tmpFile); } catch {}
            reject(new Error('书签生成超时（30秒）'));
        }, 30000);
        
        proc.on('close', (code) => {
            clearTimeout(timeout);
            // 清理临时文件
            try { fs.unlinkSync(tmpFile); } catch {}
            
            console.log('[Python stdout]:', stdout);
            if (stderr) console.log('[Python stderr]:', stderr);
            
            if (code !== 0) {
                console.error('❌ Python 失败:', stderr || stdout);
                reject(new Error(stderr || stdout || 'Python脚本执行失败'));
            } else {
                const resultPath = outputPath || pdfPath.replace('.pdf', '_带书签.pdf');
                if (fs.existsSync(resultPath)) {
                    console.log('✅ 带书签PDF生成:', resultPath);
                    resolve(resultPath);
                } else {
                    reject(new Error('输出文件未生成: ' + resultPath));
                }
            }
        });
        proc.on('error', (err) => {
            clearTimeout(timeout);
            try { fs.unlinkSync(tmpFile); } catch {}
            reject(err);
        });
    });
});

// ✅ 新增：从PDF中提取目录树（书签）
ipcMain.handle('extract-pdf-outline', async (event, pdfPath) => {
    try {
        console.log('📖 [main.js] 开始从PDF提取目录树:', pdfPath);
        
        const { spawn } = require('child_process');
        const pythonScript = path.join(__dirname, 'python-scripts', 'extract_outline.py');
        
        // 检查Python脚本是否存在
        if (!fs.existsSync(pythonScript)) {
            throw new Error(`Python脚本不存在: ${pythonScript}`);
        }
        
        return new Promise((resolve, reject) => {
            const proc = spawn('python', [pythonScript, pdfPath]);
            let stdout = '', stderr = '';
            
            proc.stdout.on('data', (data) => { stdout += data.toString(); });
            proc.stderr.on('data', (data) => { stderr += data.toString(); console.error('  [Python stderr]', data.toString()); });
            
            proc.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(stderr));
                } else {
                    // ✅ 清理非 JSON 内容，只提取 JSON 部分
                    let cleanOutput = stdout;
                    const jsonMatch = stdout.match(/\{.*\}/s);
                    if (jsonMatch) {
                        cleanOutput = jsonMatch[0];
                    }
                    try {
                        const result = JSON.parse(cleanOutput);
                        resolve(result.output);
                    } catch (e) {
                        console.error('JSON解析失败，原始输出:', stdout);
                        reject(new Error('解析输出失败: ' + stdout.substring(0, 200)));
                    }
                }
            });
            
            proc.on('error', (error) => {
                console.error(' [main.js] 无法启动Python进程:', error);
                reject(new Error('无法启动Python进程: ' + error.message));
            });
        });
    } catch (error) {
        console.error('❌ [main.js] 提取PDF目录失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

// ==================== Ollama 服务检测 ====================
async function checkOllamaService() {
    const http = require('http');
    const { exec } = require('child_process');
    
    // 重试机制：等待 Ollama 启动
    const maxRetries = 5;
    const retryDelay = 2000; // 2秒
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const result = await new Promise((resolve, reject) => {
                const req = http.get('http://localhost:11434/api/tags', (res) => {
                    if (res.statusCode === 200) {
                        console.log('[✅] Ollama service is running');
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                });
                
                req.on('error', () => resolve(false));
                req.setTimeout(2000, () => {
                    req.destroy();
                    resolve(false);
                });
            });
            
            if (result) {
                // Ollama 已就绪，检查 GPU
                await checkOllamaGPU();
                return true;
            }
            
            // 未就绪，等待后重试
            if (attempt < maxRetries - 1) {
                console.log(`[] Waiting for Ollama... (${attempt + 1}/${maxRetries})`);
                await new Promise(r => setTimeout(r, retryDelay));
            }
        } catch (e) {
            // 忽略错误，继续重试
        }
    }
    
    // 所有重试失败，才显示提示
    console.warn('[⚠️] Ollama service not detected after retries');
    handleOllamaNotRunning();
    return false;
}

// 检查 Ollama 是否使用 GPU
function checkOllamaGPU() {
    return new Promise((resolve) => {
        exec('ollama ps', (error, stdout, stderr) => {
            if (error || !stdout) {
                console.warn('[⚠️] Cannot check GPU status');
                resolve('unknown');
                return;
            }
            
            // PROCESSOR 列格式: "100% GPU", "100% CPU", 或 "X%/Y% CPU/GPU"（分层加载）
            if (stdout.includes('100% CPU')) {
                console.warn('[⚠️] Ollama 纯 CPU 模式，建议重启 Ollama 以启用 GPU 加速');
                resolve('CPU');
            } else if (stdout.includes('GPU')) {
                console.log('[✅] GPU acceleration confirmed');
                resolve('GPU');
            } else {
                console.log('[ℹ️] No models loaded yet');
                resolve('none');
            }
        });
    });
}

// IPC: 获取 Ollama GPU 状态（供前端调用）
ipcMain.handle('get-ollama-gpu-status', async () => {
    const { exec } = require('child_process');
    
    return new Promise((resolve) => {
        exec('ollama ps', (error, stdout, stderr) => {
            if (error || !stdout || stdout.trim() === '') {
                resolve({ status: 'none', message: 'No models loaded yet' });
                return;
            }
            
            if (stdout.includes('GPU')) {
                resolve({ status: 'GPU', message: 'GPU acceleration active' });
            } else if (stdout.includes('CPU')) {
                resolve({ status: 'CPU', message: 'Running on CPU (slower)' });
            } else {
                resolve({ status: 'unknown', message: 'Unknown status' });
            }
        });
    });
});

// ==================== Python 依赖检测 ====================
ipcMain.handle('check-python-deps', async () => {
  const { exec } = require('child_process');
  
  return new Promise((resolve) => {
    // 必备 5 项（与 requirements.txt 一致）；paddleocr_vl 为可选（本地 OCR，见 requirements-ocr.txt）
    const deps = {
      PyMuPDF: false,
      Pillow: false,
      numpy: false,
      opencv: false,
      pythonDocx: false,    // python-docx：Word 导入（word_to_html.py）
      paddleocr_vl: false,  // PaddleOCR-VL pipeline（可选：本地 OCR / VLM 多模态引擎）
      pythonPath: '',       // 实际使用的解释器路径（应用未指定路径，取 PATH 中第一个 python）
      pythonVersion: ''
    };
    
    // 各依赖探测 + 解释器信息探测；全部完成后统一返回
    const checks = [
      ['PyMuPDF', 'import fitz'],
      ['Pillow', 'import PIL'],
      ['numpy', 'import numpy'],
      ['opencv', 'import cv2'],
      ['pythonDocx', 'import docx'],                          // python-docx
      ['paddleocr_vl', 'from paddleocr import PaddleOCRVL']   // PaddleOCR-VL pipeline
    ];
    
    const total = checks.length + 1;  // +1 = 解释器信息探测
    let done = 0;
    const finish = () => { done++; if (done === total) resolve(deps); };
    
    checks.forEach(([name, importStmt]) => {
      exec(`python -c "${importStmt}; print('OK')"`, (err) => {
        deps[name] = !err;
        finish();
      });
    });
    
    // 解释器信息：应用使用 PATH 中第一个 python（用于排查"装了依赖却报缺失"）
    exec(`python -c "import sys; print(sys.executable); print(sys.version.split()[0])"`, (err, stdout) => {
      if (!err && stdout) {
        const lines = String(stdout).trim().split(/\r?\n/);
        deps.pythonPath = (lines[0] || '').trim();
        deps.pythonVersion = (lines[1] || '').trim();
      }
      finish();
    });
  });
});

function handleOllamaNotRunning() {
    const { dialog } = require('electron');
    
    // 延迟显示，避免阻塞启动
    setTimeout(() => {
        dialog.showMessageBox({
            type: 'warning',
            title: 'Ollama 服务未运行',
            message: '检测到 Ollama AI 服务未启动',
            detail: '智卷工坊需要 Ollama 服务才能使用 AI 功能。\n\n重要提示：\n• 不要从开始菜单启动 Ollama（无法启用 GPU）\n• 请从命令行启动：\n  1. 打开 PowerShell 或 CMD\n  2. 运行：ollama serve\n  3. 重启本应用\n\n安装 Ollama：https://ollama.com/download',
            buttons: ['我知道了', '打开 Ollama 官网'],
            defaultId: 0,
            cancelId: 0
        }).then((result) => {
            if (result.response === 1) {
                shell.openExternal('https://ollama.com/download');
            }
        });
    }, 1000);
}

// ==================== 应用启动 ====================
app.whenReady().then(async () => {
    // 注册自定义协议（必须在 ready 后调用）
    registerCustomProtocol();
    ensureStorageDir();
    
    // 🔧 新增：检测 Ollama 服务
    await checkOllamaService();
    
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });