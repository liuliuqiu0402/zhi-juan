import { ref } from 'vue';
import * as pdfjsLib from 'pdfjs-dist';

// Vite 环境下正确引用 Worker 的方式
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export function useFileHandler() {
  const isProcessing = ref(false);
  const progress = ref(0);
  const statusText = ref('');

  // 获取 PDF 总页数
  const getPdfTotalPages = async (filePath) => {
    try {
      const loadingTask = pdfjsLib.getDocument(filePath);
      const pdfDoc = await loadingTask.promise;
      return pdfDoc.numPages;
    } catch (error) {
      console.error('获取 PDF 页数失败:', error);
      return 0;
    }
  };

  // 获取文件总页数（支持 PDF/Word/图片）
  const getTotalPages = async (filePath) => {
    const ext = filePath.split('.').pop().toLowerCase();
    if (ext === 'pdf') {
      return await getPdfTotalPages(filePath);
    }
    // Word 和图片默认为 1 页
    return 1;
  };

  // PDF 转图片
  const pdfToImages = async (pdfPath, outputDir, pageRange = null) => {
      try {
          let args = [pdfPath, outputDir];
          if (pageRange) {
            args.push(pageRange);
          }
          const result = await window.electronAPI.pdfToImages(pdfPath, outputDir, pageRange);
          return { success: true, totalPages: result.total_pages };
      } catch (error) {
          console.error('PDF 转图片失败:', error);
          return { success: false, error: error.message };
      }
  };  
  // ✅ 批量 PDF 转图片
  const pdfPagesToImages = async (pdfPath, outputDir, pages) => {
    try {
      const result = await window.electronAPI.pdfPagesToImages(pdfPath, outputDir, pages);
      return { success: true, totalPages: result.total_pages || pages.length };
    } catch (error) {
      console.warn('批量转换失败，回退逐页:', error.message);
      for (const page of pages) {
        await pdfToImages(pdfPath, outputDir, String(page));
      }
      return { success: true };
    }
  };

  // 添加 PDF 书签
  const addPdfBookmarks = async (pdfPath, bookmarks, outputPath = null) => {
    try {
      const resultPath = await window.electronAPI.addPdfBookmarksToPath(pdfPath, bookmarks, outputPath);
      return { success: true, outputPath: resultPath };
    } catch (error) {
      console.error('添加书签失败:', error);
      return { success: false, error: error.message };
    }
  };

  // 解析 Word 文档
  const parseWord = async (filePath) => {
    try {
      const result = await window.electronAPI.parseWord(filePath);
      return { success: true, html: result.html };
    } catch (error) {
      console.error('解析 Word 失败:', error);
      return { success: false, error: error.message };
    }
  };

  // 移动文件
  const moveFile = async (source, target) => {
    try {
      const result = await window.electronAPI.moveFile(source, target);
      return { success: result.success };
    } catch (error) {
      console.error('移动文件失败:', error);
      return { success: false, error: error.message };
    }
  };

  // 删除文件
  const deleteFile = async (filePath) => {
    try {
      await window.electronAPI.deleteFile(filePath);
      return { success: true };
    } catch (error) {
      console.error('删除文件失败:', error);
      return { success: false, error: error.message };
    }
  };

  // 删除目录
  const deleteDirectory = async (dirPath) => {
    try {
      await window.electronAPI.deleteDirectory(dirPath);
      return { success: true };
    } catch (error) {
      console.error('删除目录失败:', error);
      return { success: false, error: error.message };
    }
  };

  // 创建目录
  const createDirectory = async (dirPath) => {
    try {
      await window.electronAPI.createDirectory(dirPath);
      return { success: true };
    } catch (error) {
      console.error('创建目录失败:', error);
      return { success: false, error: error.message };
    }
  };

  // 创建缩略图
  const createThumbnail = async (sourcePath, destPath, width = 80, height = 80) => {
    try {
      const result = await window.electronAPI.createThumbnail(sourcePath, destPath, width, height);
      return { success: result.success };
    } catch (error) {
      console.error('创建缩略图失败:', error);
      return { success: false, error: error.message };
    }
  };

  // 选择文件
  const selectFiles = async () => {
    try {
      const files = await window.electronAPI.selectFiles();
      return files || [];
    } catch (error) {
      console.error('选择文件失败:', error);
      return [];
    }
  };

  return {
    isProcessing,
    progress,
    statusText,
    getTotalPages,
    pdfToImages,
    pdfPagesToImages,
    addPdfBookmarks,
    parseWord,
    moveFile,
    deleteFile,
    deleteDirectory,
    createDirectory,
    createThumbnail,
    selectFiles
  };
}