<template>
  <div
    v-if="visible"
    class="modal-mask"
  >
    <div class="modal meta-modal">
      <h3>🏷️ 编辑元数据</h3>
      <p class="meta-name">
        {{ itemName || '（未命名）' }}
      </p>

      <div class="meta-form">
        <div class="meta-row">
          <label>学段</label>
          <select v-model="form.stage">
            <option value="">
              未标注
            </option>
            <option
              v-for="s in STAGE_CHOICES"
              :key="s"
              :value="s"
            >
              {{ s }}
            </option>
          </select>
        </div>
        <div class="meta-row">
          <label>学科</label>
          <select v-model="form.subject">
            <option value="">
              未标注
            </option>
            <option
              v-for="s in subjectOptions"
              :key="s"
              :value="s"
            >
              {{ s }}
            </option>
          </select>
        </div>
        <div
          v-if="form.stage === '高中'"
          class="meta-row"
        >
          <label>册次</label>
          <input
            v-model="form.volume"
            list="meta-high-volume-options"
            placeholder="如：必修1 / 选择性必修第一册"
          >
        </div>
      </div>

      <!-- 联动说明：把"保存后会发生什么"写在按钮之前，避免"改完才发现年级被清了"这类意外 -->
      <p class="meta-note">
        {{ linkageNote }}
      </p>

      <div class="modal-actions">
        <button
          class="btn"
          @click="cancel"
        >
          取消
        </button>
        <button
          class="btn-primary"
          @click="confirm"
        >
          保存
        </button>
      </div>

      <datalist id="meta-high-volume-options">
        <option
          v-for="v in volumePresets"
          :key="v.id"
          :value="v.id"
        >
          {{ v.label }}
        </option>
      </datalist>
    </div>
  </div>
</template>

<script setup>
/**
 * 教材库／模板库通用的「编辑元数据」弹窗（学段 / 学科 / 册次）
 * ============================================================
 * 🔴 为什么有这个：列表已按「学段 → 学科」两级分组，但学段与学科**只在导入时能选**
 *    （初中不自动识别学段，只有小学年级与高中册次认得出来），老数据缺这两项就永远落"未标注"、
 *    归不了位，且原先没有入口可补（册次有「📚」，学段/学科没有）。
 * 🔴 两库共用同一个组件：课本库与模板库的元数据字段、联动规则完全一致，
 *    各写一份必然漂移（本仓库对"双份逐字副本各自演化"有过多轮教训）。
 * 🔴 真正的字段联动规则在 utils/libraryMetaEdit.applyLibraryMetaEdit（纯函数、有单测），
 *    本组件只负责收集输入 + 把"保存后会发生什么"如实说明。
 * ============================================================
 */
import { ref, computed, watch } from 'vue';
import { STAGE_CHOICES } from '../../utils/libraryMetaEdit.js';
import { highVolumeOptions } from '../../config/highVolumes.js';
import { subjects } from '../../config/expertKnowledge.js';

const props = defineProps({
  visible: { type: Boolean, default: false },
  itemName: { type: String, default: '' },
  stage: { type: String, default: '' },
  subject: { type: String, default: '' },
  volume: { type: String, default: '' },
});
const emit = defineEmits(['update:visible', 'confirm']);

const form = ref({ stage: '', subject: '', volume: '' });

// 每次打开都从条目现值重置（避免上一次编辑的残留被误当成这次的输入）
watch(() => props.visible, (v) => {
  if (!v) return;
  form.value = {
    stage: props.stage || '',
    subject: props.subject || '',
    volume: props.volume || '',
  };
}, { immediate: true });

const subjectOptions = subjects;
/** 册次候选按学科给（学科未定 → 合并全部）；音体美等模块制学科无预设 → 可自由填写 */
const volumePresets = computed(() => highVolumeOptions(form.value.subject));

/** 保存后会发生什么（与 applyLibraryMetaEdit 的三条规则一一对应，不允许说得比实现多） */
const linkageNote = computed(() => {
  if (form.value.stage === '高中') {
    return form.value.volume
      ? '保存后：写入册次，并清空遗留的年级（高中按册次、不按年级）。'
      : '保存后：归入「高中」分组；册次留空也没关系，可稍后在卡片上再补。';
  }
  return props.volume
    ? '保存后：归入对应学段分组，并清空册次（册次只对高中有意义）。'
    : '保存后：归入对应学段分组，可按学科再分组查看。';
});

const cancel = () => emit('update:visible', false);
const confirm = () => {
  emit('confirm', { ...form.value });
  emit('update:visible', false);
};
</script>

<style scoped>
/* 弹窗外壳与各模块内的弹窗同一套观感（各模块的 .modal 是 scoped 的，组件内需自带一份） */
.modal-mask { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: transparent; display: flex; align-items: center; justify-content: center; z-index: 3500; pointer-events: none; }
.modal {
  background: white; border-radius: 16px; padding: 24px;
  min-width: 420px; max-width: 95%; max-height: 85vh;
  display: flex; flex-direction: column;
  pointer-events: auto; position: relative;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.12), 0 16px 48px rgba(0,0,0,0.16);
  border: 2px solid var(--border);
}
.modal::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 5px;
  background: linear-gradient(90deg, var(--primary-light) 0%, #4a90d9 50%, var(--primary-light) 100%);
  border-radius: 14px 14px 0 0;
}
.modal h3 { margin: 4px 0 8px; font-size: 16px; color: var(--primary); }
.meta-name { margin: 0 0 14px; font-size: 13px; color: var(--text-secondary, #666); word-break: break-all; }
.meta-form { display: flex; flex-direction: column; gap: 10px; }
.meta-row { display: flex; align-items: center; gap: 8px; }
.meta-row label { width: 42px; font-size: 13px; color: #666; white-space: nowrap; }
.meta-row select,
.meta-row input {
  flex: 1; padding: 6px 8px; border-radius: 6px; border: 1px solid #ddd;
  font-size: 13px; background: white;
}
.meta-note {
  margin: 14px 0 0; padding: 8px 10px; border-radius: 6px;
  background: #f6f8fb; border: 1px solid var(--border-light);
  font-size: 12px; color: #5a6472; line-height: 1.6;
}
.modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 18px; }
</style>
