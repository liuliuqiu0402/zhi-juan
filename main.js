const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { machineIdSync } = require('node-machine-id');
const { exec } = require('child_process');

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
                { label: '图形库', click: () => win.webContents.send('menu-event', 'graph') },
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
        win.loadFile(path.join(__dirname, 'dist', 'index.html'));
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

// 移动文件
ipcMain.handle('move-file', async (event, sourcePath, targetPath) => {
    if (!fs.existsSync(sourcePath)) return { success: false, error: '源文件不存在' };
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
    fs.renameSync(sourcePath, targetPath);
    return { success: true, target: targetPath };
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

// 🔧 新增：加密/解密（用于安全存储 API Key）
ipcMain.handle('encrypt-text', async (event, text) => {
  try {
    const { safeStorage } = require('electron');
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(text);
      return Buffer.from(encrypted).toString('base64');
    }
    return Buffer.from(text, 'utf-8').toString('base64');
  } catch (e) {
    return Buffer.from(text, 'utf-8').toString('base64');
  }
});

ipcMain.handle('decrypt-text', async (event, encryptedBase64) => {
  try {
    const { safeStorage } = require('electron');
    const buffer = Buffer.from(encryptedBase64, 'base64');
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(buffer);
    }
    return buffer.toString('utf-8');
  } catch (e) {
    return Buffer.from(encryptedBase64, 'base64').toString('utf-8');
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

// ==================== 静默生成 PDF ====================
ipcMain.handle('export-pdf', async (event, htmlContent, outputPath) => {
  let puppeteer = null;
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    console.error('puppeteer 模块加载失败:', e.message);
    return { success: false, error: 'PDF 导出依赖 Puppeteer（Chromium），当前环境未找到。请运行 npm install puppeteer 或在浏览器中使用「打印→另存为PDF」功能。' };
  }
  let browser = null;
  
  try {
    // 确保输出目录存在
    const outDir = path.dirname(outputPath);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' }
    });
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
    const deps = {
      PyMuPDF: false,
      Pillow: false,
      numpy: false,
      opencv: false,
      paddleocr_vl: false  // PaddleOCR-VL pipeline（VLM 多模态引擎）
    };
    
    // 并行检查各依赖
    const checks = [
      ['PyMuPDF', 'import fitz'],
      ['Pillow', 'import PIL'],
      ['numpy', 'import numpy'],
      ['opencv', 'import cv2'],
      ['paddleocr_vl', 'from paddleocr import PaddleOCRVL']  // PaddleOCR-VL pipeline
    ];
    
    let done = 0;
    checks.forEach(([name, importStmt]) => {
      exec(`python -c "${importStmt}; print('OK')"`, (err) => {
        deps[name] = !err;
        done++;
        if (done === checks.length) resolve(deps);
      });
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
    ensureStorageDir();
    
    // 🔧 新增：检测 Ollama 服务
    await checkOllamaService();
    
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });