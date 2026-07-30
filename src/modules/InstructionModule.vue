<template>
  <div class="embedded-page">
    <div class="page-header">
      <h2>📋 指令库</h2>
      <div class="header-actions">
        <button class="btn-small" @click="insFontSize = Math.max(11, insFontSize - 1)">A-</button>
        <span style="font-size:12px;color:var(--text-muted);">{{ insFontSize }}px</span>
        <button class="btn-small" @click="insFontSize = Math.min(18, insFontSize + 1)">A+</button>
        <button class="btn" @click="instructionStore.toggleSelectAll()">{{ instructionStore.allSelected ? '取消全选' : '全选' }}</button>
        <button class="btn btn-delete" v-if="instructionStore.selectedCount > 0" @click="instructionStore.batchDelete()">🗑️ 批量删除</button>
        <button class="btn-primary" @click="addInstruction">➕ 新增指令</button>
      </div>
    </div>

    <!-- 搜索筛选行 -->
    <div class="lib-filter-row">
      <input type="text" v-model="insSearch" placeholder="🔍 搜索指令..." class="search-input" />
      <select v-model="insFilterCategory">
        <option value="">全部类别</option>
        <option v-for="c in instructionStore.categories" :key="c" :value="c">{{ c }}</option>
      </select>
      <select v-model="insFilterType">
        <option value="">全部类型</option>
        <option value="full">完整指令</option>
        <option value="fragment">指令片段</option>
      </select>
      <select v-model="insFilterPhase">
        <option value="">全部阶段</option>
        <option value="分析">分析</option>
        <option value="生成">生成</option>
      </select>
      <select v-model="insFilterSubject">
        <option value="">全部学科</option>
        <option v-for="s in instructionStore.subjects" :key="s" :value="s">{{ s }}</option>
      </select>
      <span class="selected-hint">已勾选 {{ instructionStore.selectedCount }} 条</span>
    </div>

    <!-- 指令列表表格 -->
    <div class="ins-table-container">
      <table class="ins-table" :style="{ fontSize: insFontSize + 'px' }">
        <thead :style="{ fontSize: insFontSize + 'px' }">
          <tr>
            <th style="width:40px;">序号</th>
            <th style="width:40px;">勾选</th>
            <th>名称</th>
            <th style="width:160px;">类别</th>
            <th style="width:60px;">类型</th>
            <th style="width:120px;">学科</th>
            <th style="width:140px;">操作</th>
          </tr>
        </thead>
        <tbody :style="{ fontSize: insFontSize + 'px' }">
          <tr v-for="(ins, idx) in filteredInstructions" :key="ins.id">
            <td class="ins-index">{{ idx + 1 }}</td>
            <td><input type="checkbox" v-model="ins.selected" :disabled="ins.type === 'full'" /></td>
            <td class="ins-name-cell">
              <span class="instruction-name">{{ ins.name }}</span>
            </td>
            <td><span class="instruction-category">{{ ins.category }}</span></td>
            <td><span class="ins-type-badge">{{ ins.type === 'full' ? '整段' : '片段' }}</span></td>
            <td><span v-if="ins.subject" class="ins-subject-badge">{{ ins.subject }}</span></td>
            <td class="ins-actions-cell">
              <button v-if="ins.type === 'full'" class="btn-small" @click="loadInstruction(ins)">📥</button>
              <button class="btn-small" @click="viewInstruction(ins)">👁️</button>
              <button class="btn-small" @click="editInstruction(ins)">✏️</button>
              <button class="btn-small btn-delete" @click="deleteInstruction(ins.id)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="filteredInstructions.length === 0" class="empty-tip">暂无匹配指令</div>

    <!-- 新增/编辑指令弹窗 -->
    <div v-if="showInsEditor" class="modal-mask" @click.self="showInsEditor = false">
      <div class="modal" style="max-width: 500px;">
        <h3>{{ editingInsId ? '✏️ 编辑指令' : '➕ 新增指令' }}</h3>
        <div class="form-group">
          <label>名称</label>
          <input type="text" v-model="insFormName" placeholder="指令名称" />
        </div>
        <div class="form-group">
          <label>类别</label>
          <select v-model="insFormCategory">
            <option v-for="c in instructionStore.categories" :key="c" :value="c">{{ c }}</option>
            <option value="自定义">自定义</option>
          </select>
        </div>
        <div class="form-group">
          <label>类型</label>
          <select v-model="insFormType">
            <option value="fragment">指令片段（勾选注入）</option>
            <option value="full">完整指令（加载替换）</option>
          </select>
        </div>
        <div class="form-group">
          <label>适用学科（空=通用，逗号分隔）</label>
          <input type="text" v-model="insFormSubject" placeholder="语文,数学" />
        </div>
        <div v-if="editingInsId" class="form-group" style="opacity:0.75;">
          <label>三维匹配字段（编辑不可改，仅展示）</label>
          <div style="display:flex;gap:8px;font-size:12px;color:var(--text-muted);">
            <span>🏷️ 学段：<b>{{ editingInsOriginalStage || '通用' }}</b></span>
            <span>📋 资料类型：<b>{{ editingInsOriginalGenType || '通用' }}</b></span>
          </div>
        </div>
        <div class="form-group">
          <label>内容</label>
          <textarea v-model="insFormContent" rows="6" placeholder="指令内容..."></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showInsEditor = false">取消</button>
          <button class="btn-primary" @click="saveInstruction">💾 保存</button>
        </div>
      </div>
    </div>

    <!-- 查看指令弹窗 -->
    <div v-if="showInsViewer" class="modal-mask" @click.self="showInsViewer = false">
      <div class="modal large-modal" style="max-width: 700px;">
        <h3>👁️ 查看指令</h3>
        <div v-if="viewingIns" class="viewer-content">
          <div class="viewer-meta">
            <span class="viewer-label">名称：</span><strong>{{ viewingIns.name }}</strong>
            <span class="ins-type-badge">{{ viewingIns.type === 'full' ? '完整指令' : '指令片段' }}</span>
            <span class="instruction-category">{{ viewingIns.category }}</span>
            <span v-if="viewingIns.subject" class="ins-subject-badge">{{ viewingIns.subject }}</span>
          </div>
          <div class="viewer-body">
            <pre>{{ viewingIns.content }}</pre>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showInsViewer = false">关闭</button>
          <button class="btn-primary" @click="showInsViewer = false; editInstruction(viewingIns)">✏️ 编辑</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useInstructionStore } from '@/stores/instructionStore.js';
import { useDialog } from '@/composables/useDialog.js';
import { APP_EVENTS } from '@/constants/events.js';

const router = useRouter();
const instructionStore = useInstructionStore();
const { showAlertDialogFn, showConfirmDialogFn } = useDialog();

const insFontSize = ref(13);
const insSearch = ref('');
const insFilterCategory = ref('');
const insFilterType = ref('');
const insFilterPhase = ref('');
const insFilterSubject = ref('');
const showInsEditor = ref(false);
const editingInsId = ref(null);
const insFormName = ref('');
const insFormCategory = ref('通用约束');
const insFormType = ref('fragment');
const insFormSubject = ref('');
const insFormContent = ref('');
// 🔧 三维匹配关键字段（编辑时从原始条目读取，保存时必须保留）
const editingInsOriginalType = ref('fragment');
const editingInsOriginalStage = ref('');
const editingInsOriginalGenType = ref('');

// 查看指令
const viewingIns = ref(null);
const showInsViewer = ref(false);

const filteredInstructions = computed(() => {
  let list = instructionStore.list;
  if (insSearch.value) {
    const kw = insSearch.value.toLowerCase();
    list = list.filter(i => i.name.includes(kw) || i.content.includes(kw));
  }
  if (insFilterCategory.value) list = list.filter(i => i.category === insFilterCategory.value);
  if (insFilterType.value) list = list.filter(i => i.type === insFilterType.value);
  if (insFilterPhase.value === '分析') {
    list = list.filter(i => i.category.startsWith('分析-'));
  } else if (insFilterPhase.value === '生成') {
    list = list.filter(i => i.category.startsWith('生成-') || !i.category.startsWith('分析-'));
  }
  if (insFilterSubject.value) {
    list = list.filter(i => i.subject && i.subject.split(',').includes(insFilterSubject.value));
  }
  return list;
});

const loadInstruction = (ins) => {
  if (ins.type === 'full') {
    router.push('/generate');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent(APP_EVENTS.LOAD_INSTRUCTION, { detail: ins.content }));
    }, 100);
  }
};

const addInstruction = () => {
  editingInsId.value = null;
  insFormName.value = '';
  insFormCategory.value = '通用约束';
  insFormType.value = 'fragment';
  insFormSubject.value = '';
  insFormContent.value = '';
  showInsEditor.value = true;
};

const editInstruction = (ins) => {
  editingInsId.value = ins.id;
  insFormName.value = ins.name;
  insFormCategory.value = ins.category;
  insFormType.value = ins.type || 'fragment';
  insFormSubject.value = ins.subject || '';
  insFormContent.value = ins.content;
  // 🔧 记录原始三维匹配字段，编辑保存时必须保留
  editingInsOriginalType.value = ins.type || 'fragment';
  editingInsOriginalStage.value = ins.stage || '';
  editingInsOriginalGenType.value = ins.genType || '';
  showInsEditor.value = true;
};

const saveInstruction = async () => {
  if (!insFormName.value.trim()) { await showAlertDialogFn('请输入名称'); return; }
  if (!insFormContent.value.trim()) { await showAlertDialogFn('请输入内容'); return; }

  // 🔧 三维匹配保护：type 从 fragment→full 会破坏 getMatchingBlockInstructions（只匹配 fragment）
  if (editingInsId.value && editingInsOriginalType.value === 'fragment' && insFormType.value === 'full') {
    const confirmed = await showConfirmDialogFn('⚠️ 将类型从「指令片段」改为「完整指令」后，该指令将不再参与三维度智能匹配（学科×学段×资料类型自动注入）。确定要修改吗？');
    if (!confirmed) return;
  }

  const data = {
    name: insFormName.value.trim(),
    category: insFormCategory.value,
    type: insFormType.value,
    subject: insFormSubject.value.trim(),
    // 🔧 从原始条目保留三维匹配关键字段（编辑表单不展示但必须保留）
    stage: editingInsId.value ? editingInsOriginalStage.value : '',
    genType: editingInsId.value ? editingInsOriginalGenType.value : '',
    content: insFormContent.value.trim()
  };

  if (editingInsId.value) {
    instructionStore.updateInstruction(editingInsId.value, data);
  } else {
    instructionStore.addInstruction(data);
  }

  showInsEditor.value = false;
};

const deleteInstruction = async (id) => {
  const confirmed = await showConfirmDialogFn('确定删除该指令？');
  if (!confirmed) return;
  instructionStore.removeInstruction(id);
};

const viewInstruction = (ins) => {
  viewingIns.value = ins;
  showInsViewer.value = true;
};
</script>

<style scoped>
.embedded-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px 24px;
  overflow-y: auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-light);
}

.page-header h2 {
  font-size: 20px;
  color: var(--primary);
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.lib-filter-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.lib-filter-row .search-input {
  width: 200px;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #ddd;
  font-size: 12px;
}
.lib-filter-row select {
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid #ddd;
  font-size: 12px;
}
.selected-hint {
  font-size: 12px;
  color: var(--primary-light);
  margin-left: auto;
}

.ins-table-container {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--border-light);
  border-radius: 8px;
}
.ins-table {
  width: 100%;
  border-collapse: collapse;
  font-size: inherit;
  table-layout: fixed;
  border: 1px solid var(--border-light);
}
.ins-table thead {
  position: sticky;
  top: 0;
  z-index: 10;
}
.ins-table th {
  background: var(--bg);
  padding: 10px 8px;
  text-align: center;
  font-weight: 600;
  color: var(--primary);
  border-bottom: 2px solid var(--border-light);
  white-space: nowrap;
}
.ins-table th,
.ins-table td {
  border: 1px solid #e8e8e8;
}
.ins-table thead th {
  border-bottom: 2px solid #d0d0d0;
}
.ins-table td {
  padding: 6px 8px;
  border-bottom: 1px solid #f0f0f0;
  vertical-align: middle;
  text-align: center;
  font-size: inherit;
}
.ins-table td:nth-child(3) {
  text-align: left;
  font-size: inherit;
}
.ins-table tbody tr:hover {
  background: var(--bg-card);
}
.ins-index {
  color: var(--text-muted);
  text-align: center;
  font-size: inherit;
  flex-shrink: 0;
}
.ins-name-cell {
  text-align: left !important;
}
.ins-actions-cell {
  display: flex;
  gap: 2px;
  justify-content: center;
  flex-wrap: nowrap;
}
.ins-actions-cell .btn-small {
  padding: 2px 6px;
  font-size: 12px;
  white-space: nowrap;
}

.instruction-name {
  font-weight: 500;
  color: var(--primary);
}

.instruction-category {
  font-size: inherit;
  padding: 2px 10px;
  background: var(--primary-lighter);
  border-radius: 20px;
  color: var(--primary-light);
}

.ins-type-badge {
  font-size: inherit;
  padding: 2px 6px;
  background: var(--success-light);
  border-radius: 10px;
  color: var(--success);
}

.ins-subject-badge {
  font-size: inherit;
  padding: 2px 6px;
  background: var(--primary-lighter);
  border-radius: 10px;
  color: var(--primary-light);
}

.empty-tip {
  text-align: center;
  padding: 48px;
  color: var(--text-muted);
  font-size: 14px;
}

/* ======== 弹窗样式 ======== */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3500;
  pointer-events: none;
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 28px 32px;
  min-width: 450px;
  max-width: 650px;
  max-height: 82vh;
  overflow-y: auto;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1), 0 8px 24px rgba(0, 0, 0, 0.12), 0 16px 48px rgba(0, 0, 0, 0.16);
  border: 2px solid var(--border);
  pointer-events: auto;
  position: relative;
}

.modal::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 5px;
  background: linear-gradient(90deg, var(--primary-light) 0%, #4a90d9 50%, var(--primary-light) 100%);
  border-radius: 14px 14px 0 0;
}

.modal h3 {
  font-size: 18px;
  color: var(--primary);
  margin-bottom: 24px;
  padding-bottom: 14px;
  border-bottom: 2px solid var(--primary-lighter);
}

.large-modal {
  max-width: 750px;
}

.large-modal::before {
  height: 6px;
  background: linear-gradient(90deg, #1e4a8a 0%, var(--primary-light) 50%, #1e4a8a 100%);
}

.modal .form-group {
  margin-bottom: 18px;
}
.modal .form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--primary);
  margin-bottom: 6px;
}
.modal .form-group input,
.modal .form-group select,
.modal .form-group textarea {
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #ddd;
  font-size: 13px;
  font-family: inherit;
  background: var(--bg-card);
  transition: border-color 0.2s;
}
.modal .form-group input:focus,
.modal .form-group select:focus,
.modal .form-group textarea:focus {
  outline: none;
  border-color: var(--primary-light);
  background: white;
}
.modal .form-group textarea {
  min-height: 140px;
  resize: vertical;
  line-height: 1.8;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--primary-lighter);
}

.viewer-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  padding: 14px 18px;
  background: var(--bg);
  border-radius: 10px;
}
.viewer-meta strong {
  font-size: 16px;
  color: var(--primary);
}
.viewer-body {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  padding: 22px;
  max-height: 450px;
  overflow-y: auto;
}
.viewer-body pre {
  white-space: pre-wrap;
  font-family: 'Consolas', 'Microsoft YaHei', monospace;
  font-size: 14px;
  line-height: 2;
  margin: 0;
  color: #333;
}

/* 📱 移动端弹窗适配 */
@media (max-width: 767px) {
  /* 弹窗安全区适配 */
  .modal-mask {
    padding: env(safe-area-inset-top, 12px) 12px env(safe-area-inset-bottom, 12px) 12px;
    box-sizing: border-box;
  }
  .modal {
    min-width: 0 !important;
    width: 92vw !important;
    max-width: 92vw !important;
    padding: 16px 14px !important;
    border-radius: 12px !important;
    max-height: calc(100% - 16px) !important;
  }
  .modal::before {
    border-radius: 10px 10px 0 0 !important;
  }
  .large-modal {
    min-width: 0 !important;
    width: 96vw !important;
    max-width: 96vw !important;
  }
  .modal h3 {
    font-size: 15px !important;
    margin-bottom: 12px !important;
    padding-bottom: 10px !important;
  }
  .modal .form-group label {
    font-size: 12px !important;
  }
  .modal .form-group input,
  .modal .form-group select,
  .modal .form-group textarea {
    font-size: 13px !important;
    padding: 9px 12px !important;
  }
  .modal .form-group textarea {
    min-height: 110px !important;
  }
  .modal-actions {
    margin-top: 12px !important;
    padding-top: 12px !important;
    gap: 8px !important;
  }
  .modal-actions .btn,
  .modal-actions .btn-primary {
    flex: 1;
    font-size: 13px;
    padding: 10px 6px;
    text-align: center;
    min-height: 40px;
  }
  /* 查看弹窗 */
  .viewer-meta {
    padding: 10px 14px !important;
    gap: 6px !important;
  }
  .viewer-meta strong {
    font-size: 14px !important;
  }
  .viewer-body {
    padding: 14px !important;
    max-height: 40vh !important;
  }
  .viewer-body pre {
    font-size: 12px !important;
    line-height: 1.7 !important;
  }
}
</style>
