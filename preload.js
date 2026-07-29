const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // 文件操作
    selectFiles: () => ipcRenderer.invoke('select-files'),
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    parseWord: (filePath) => ipcRenderer.invoke('parse-word', filePath),
    moveFile: (source, target) => ipcRenderer.invoke('move-file', source, target),
    deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
    deleteDirectory: (dirPath) => ipcRenderer.invoke('delete-directory', dirPath),
    createDirectory: (dirPath) => ipcRenderer.invoke('create-directory', dirPath),
    createThumbnail: (source, dest, w, h) => ipcRenderer.invoke('create-thumbnail', source, dest, w, h),
    
    // Python 脚本调用
    pdfToImages: (pdfPath, outputDir, pageRange) => ipcRenderer.invoke('pdf-to-images', pdfPath, outputDir, pageRange),
    pdfPagesToImages: (pdfPath, outputDir, pages) => ipcRenderer.invoke('pdf-pages-to-images', pdfPath, outputDir, pages),
    splitColumns: (imagePath, outputDir) => ipcRenderer.invoke('split-columns', imagePath, outputDir),
    addPdfBookmarksToPath: (pdfPath, bookmarks, outputPath) => ipcRenderer.invoke('add-pdf-bookmarks-to-path', pdfPath, bookmarks, outputPath),
    extractPdfOutline: (pdfPath) => ipcRenderer.invoke('extract-pdf-outline', pdfPath),
    
    // 系统信息
    getMachineId: () => ipcRenderer.invoke('get-machine-id'),
    
    // 菜单事件监听
    onMenuEvent: (callback) => ipcRenderer.on('menu-event', callback),

    // 新增：静默导出 PDF
    exportPdf: (htmlContent, outputPath) => ipcRenderer.invoke('export-pdf', htmlContent, outputPath),
    showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),

    // Word COM 后处理：将标记 .docx 转换为原生表格/形状（田字格、四线三格）
    wordComProcess: (buffer) => ipcRenderer.invoke('word-com-process', buffer),

    // 🔧 新增：加密/解密（用于安全存储 API Key）
    encrypt: (text) => ipcRenderer.invoke('encrypt-text', text),
    decrypt: (encrypted) => ipcRenderer.invoke('decrypt-text', encrypted),

    // 🔧 新增：获取 Ollama GPU 状态
    getOllamaGpuStatus: () => ipcRenderer.invoke('get-ollama-gpu-status'),

    // 🔧 新增：检测 Python 依赖
    checkPythonDeps: () => ipcRenderer.invoke('check-python-deps'),

    // PaddleOCR-VL 统一多模态识别（替代 Ollama 多模态模型）
    // options.mode: 'pipeline'（文档解析/OCR）| 'chat'（VLM 对话）
    // options.maxTokens: chat 模式最大 token 数
    paddleOcrVLChat: (prompt, imageBase64List, options) => ipcRenderer.invoke('paddleocr-vl-chat', { prompt, imageBase64List, options }),
});