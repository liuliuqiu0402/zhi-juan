/**
 * 目录「从文件导入」——选文件 → "一行一条"的目录文本
 * ============================================================
 * 🔴 为什么要有（2026-09 用户提出）：目录里的公式走「从剪贴板导入」时，成败取决于剪贴板的格式
 *    （要赌 Word 有没有把富文本那一份放进去）。而"导入文件"拿的是**文件本身**，是最完整的数据源，
 *    也不受剪贴板权限/格式限制。
 *
 * 🔴 只做"文件 → 文本"这一段，解析（`parseClipboardText`）与入库各库自管：
 *    教材库走 asyncImportProcess、模板库走 syncImportProcess，两者流程不同，
 *    但"读文件"这段完全一样 —— 收在这里，防止两个模块各写一份后各自演化。
 *
 * 🔴 `.docx` 必须走 `useFileHandler.parseWord`（与"排版模块上传 Word"同一条链路）：
 *    公式 OMML → `$…$`、图片内嵌 base64 都已处理好；再过 `htmlToPlainLines` 压成一行一条，
 *    公式就原样留在标题里（目录列表/预览处由 KaTeX 出印刷形态）。
 * ============================================================
 */
import { useFileHandler } from './useFileHandler.js';
import { htmlToPlainLines } from '../utils/clipboardText.js';

export function useTocFileImport() {
  const { selectFiles, parseWord, readTextFile } = useFileHandler();

  /**
   * 让用户选一个文件，转成"一行一条"的目录文本。
   * @returns {Promise<string|null>} 目录文本；用户取消返回 null；
   *   格式不支持 / 读不出内容 / 解析失败 → 抛 Error（调用方负责提示，勿静默）
   */
  const pickTocTextFromFile = async () => {
    const files = await selectFiles();
    if (!files || !files.length) return null; // 用户取消

    const filePath = files[0];
    const ext = (filePath.split('.').pop() || '').toLowerCase();

    let text = '';
    if (ext === 'docx') {
      const r = await parseWord(filePath);
      if (!r || !r.success) throw new Error('Word 解析失败：' + (r?.error || '未知错误'));
      text = htmlToPlainLines(r.html); // 段落/标题一行一条；公式保住 $…$
    } else if (ext === 'txt' || ext === 'md') {
      text = await readTextFile(filePath);
    } else {
      throw new Error(`暂不支持该格式：.${ext}\n支持 .docx / .txt / .md`);
    }

    if (!String(text || '').trim()) throw new Error('文件里没读到内容，请检查文件是否为空');
    console.log(`📁 目录文件已读取：${filePath.split('\\').pop()}（${text.length} 字）`);
    return text;
  };

  return { pickTocTextFromFile };
}

export default { useTocFileImport };
