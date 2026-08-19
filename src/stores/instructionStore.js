import { defineStore } from 'pinia';
import {
  loadInstructionLib,
  saveInstructionLib,
  addCustomInstruction as addCustom,
  updateCustomInstruction as updateCustom,
  deleteCustomInstruction as deleteCustom,
  resetAllOverrides as resetOverrides,
  getOverriddenBlocks as getOverrides,
  exportOverridesAsText as exportOverrides
} from '../config/instructionLib.js';

export const useInstructionStore = defineStore('instruction', {
  state: () => ({
    list: loadInstructionLib()
  }),

  getters: {
    // 已选中的片段数量
    selectedCount: (state) => state.list.filter(i => i.selected).length,

    // 所有类别
    categories: (state) => {
      const cats = new Set();
      state.list.forEach(i => cats.add(i.category));
      return Array.from(cats);
    },

    // 所有学科
    subjects: (state) => {
      const subs = new Set();
      state.list.forEach(i => {
        if (i.subject) i.subject.split(',').forEach(s => subs.add(s.trim()));
      });
      return Array.from(subs).filter(Boolean);
    },

    // 是否全选（仅针对可勾选的片段类型）
    allSelected: (state) => {
      const fragments = state.list.filter(i => i.type === 'fragment');
      return fragments.length > 0 && fragments.every(i => i.selected);
    }
  },

  actions: {
    // 重新加载
    reload() {
      this.list = loadInstructionLib();
    },

    // 🔧 启动时不再自动同步（改为手动上推按钮）
    syncToCloudIfNeeded() {
      // no-op：单向数据由用户通过 📤 按钮手动推送
    },

    // 保存自定义指令到 localStorage
    _save() {
      const custom = this.list.filter(i => !i.builtin && !i._deleted);
      saveInstructionLib(custom);
    },

    // 添加指令
    addInstruction(data) {
      const newIns = addCustom(data);
      this.list = loadInstructionLib();
      this._save();  // ☁️ 新增后同步到云端
      return newIns;
    },

    // 更新指令
    updateInstruction(id, data) {
      updateCustom(id, data);
      this.list = loadInstructionLib();
      this._save();  // ☁️ 修改后同步到云端
    },

    // 删除指令
    removeInstruction(id) {
      const ins = this.list.find(i => i.id === id);
      if (ins) {
        if (ins.builtin) {
          ins._deleted = true;
        } else {
          deleteCustom(id);
        }
        this.list = loadInstructionLib().filter(i => !i._deleted);
        this._save();
      }
    },

    // 切换全选
    toggleSelectAll() {
      const fragments = this.list.filter(i => i.type === 'fragment');
      const newState = !fragments.every(i => i.selected);
      fragments.forEach(i => { i.selected = newState; });
    },

    // 批量删除选中的
    batchDelete() {
      const selectedIds = this.list.filter(i => i.selected).map(i => i.id);
      const customToDelete = [];
      const builtinToMark = [];

      for (const id of selectedIds) {
        const ins = this.list.find(i => i.id === id);
        if (!ins) continue;
        if (ins.builtin) {
          ins._deleted = true;
          builtinToMark.push(id);
        } else {
          customToDelete.push(id);
        }
      }

      // 删除自定义指令
      for (const id of customToDelete) {
        deleteCustom(id);
      }

      // 更新列表：过滤掉已删除的
      this.list = this.list.filter(i => !i._deleted && !customToDelete.includes(i.id));
      this._save();
    },

    // 获取所有覆盖条目（编辑过 builtin 的）
    getOverrides() {
      return getOverrides();
    },

    // 重置所有覆盖，恢复 builtin 源码版本
    resetAllOverrides() {
      const result = resetOverrides();
      this.list = loadInstructionLib();
      return result;
    },

    // 导出所有覆盖为文本（供复制给开发者分析）
    exportOverrides() {
      return exportOverrides();
    }
  }
});