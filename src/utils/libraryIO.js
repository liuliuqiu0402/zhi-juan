/**
 * 库导入/导出工具（通用）
 * ============================================================
 * 各工具库（蓝图/指令/规则/渲染契约/排版规格）共用，
 * 导出 localStorage 数据为 JSON 文件，或从 JSON 文件导入。
 * ============================================================
 */

/** 导出库数据为 JSON 文件 */
export function exportLibrary(libName, data) {
  const payload = JSON.stringify({ library: libName, data, exportedAt: new Date().toISOString() }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wisdom_${libName}_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 从 JSON 文件导入库数据（返回 data 字段，或整个解析对象） */
export function importLibrary(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        resolve(parsed.data || parsed);
      } catch (err) {
        reject(new Error('JSON 解析失败：' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

/** 读取 localStorage 库数据 */
export function readLib(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
}

/** 写入 localStorage 库数据 */
export function writeLib(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); return true; } catch { return false; }
}
