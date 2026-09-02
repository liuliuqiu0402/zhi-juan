import { ref } from 'vue';
import storage from '@/utils/storage';
import { STORAGE_KEYS } from '@/constants/storageKeys.js'; // localStorage 业务 key 唯一事实源（曾字面量散落）

export function useBackup() {
  const isExporting = ref(false);
  const isImporting = ref(false);
  const backupStatus = ref('');

  /**
   * 导出全部数据为 JSON 文件
   */
  const exportData = async () => {
    isExporting.value = true;
    backupStatus.value = '正在收集数据...';
    
    try {
      const allKeys = await storage.getAllKeys();
      const backupData = {
        version: '2.0.0',
        exportedAt: new Date().toISOString(),
        appName: '智卷工坊',
        keys: {}
      };

      for (const key of allKeys) {
        const value = await storage.getItem(key);
        if (value !== null && value !== undefined) {
          backupData.keys[key] = value;
        }
      }

      // 也包含 localStorage 中的配置
      const apiConfig = localStorage.getItem(STORAGE_KEYS.API_CONFIG);
      if (apiConfig) {
        backupData.keys['_localStorage_apiConfig'] = JSON.parse(apiConfig);
      }
      const storagePath = localStorage.getItem(STORAGE_KEYS.STORAGE_PATH);
      if (storagePath) {
        backupData.keys['_localStorage_storagePath'] = storagePath;
      }
      const hasLaunched = localStorage.getItem(STORAGE_KEYS.HAS_LAUNCHED);
      if (hasLaunched) {
        backupData.keys['_localStorage_hasLaunched'] = true;
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `智卷工坊_备份_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      const keyCount = Object.keys(backupData.keys).length;
      backupStatus.value = `✅ 导出成功！共备份 ${keyCount} 项数据`;
    } catch (e) {
      console.error('备份导出失败:', e);
      backupStatus.value = '❌ 导出失败：' + e.message;
    } finally {
      isExporting.value = false;
      setTimeout(() => { backupStatus.value = ''; }, 5000);
    }
  };

  /**
   * 从 JSON 文件恢复数据
   */
  const importData = async (file) => {
    isImporting.value = true;
    backupStatus.value = '正在恢复数据...';

    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      if (!backupData.version || !backupData.keys) {
        throw new Error('无效的备份文件格式');
      }

      let restoredCount = 0;
      let skippedCount = 0;

      for (const [key, value] of Object.entries(backupData.keys)) {
        // localStorage 数据恢复
        if (key.startsWith('_localStorage_')) {
          const localKey = key.replace('_localStorage_', '');
          if (localKey === STORAGE_KEYS.API_CONFIG) {
            localStorage.setItem(STORAGE_KEYS.API_CONFIG, JSON.stringify(value));
            restoredCount++;
          } else if (localKey === STORAGE_KEYS.STORAGE_PATH) {
            localStorage.setItem(STORAGE_KEYS.STORAGE_PATH, String(value));
            restoredCount++;
          } else if (localKey === 'hasLaunched') {
            localStorage.setItem(STORAGE_KEYS.HAS_LAUNCHED, 'true');
            restoredCount++;
          }
          continue;
        }

        // IndexedDB 数据恢复：检查是否已有数据
        const existing = await storage.getItem(key);
        if (existing !== null && existing !== undefined) {
          skippedCount++;
          continue; // 已有数据，跳过（防止覆盖）
        }

        await storage.setItem(key, value);
        restoredCount++;
      }

      backupStatus.value = `✅ 恢复完成！已恢复 ${restoredCount} 项` + 
        (skippedCount > 0 ? `，跳过 ${skippedCount} 项（已存在）` : '');
    } catch (e) {
      console.error('备份恢复失败:', e);
      backupStatus.value = '❌ 恢复失败：' + e.message;
    } finally {
      isImporting.value = false;
      setTimeout(() => { backupStatus.value = ''; }, 8000);
    }
  };

  /**
   * 打开文件选择器并导入
   */
  const selectAndImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        await importData(file);
      }
    };
    input.click();
  };

  return {
    isExporting,
    isImporting,
    backupStatus,
    exportData,
    importData,
    selectAndImport
  };
}
