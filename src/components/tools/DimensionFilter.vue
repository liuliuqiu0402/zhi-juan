<template>
  <div
    class="dim-filter"
    :class="{ compact }"
  >
    <div class="fitem">
      <label>学段</label>
      <select
        :value="modelValue.stage"
        @change="emit('update:modelValue', { ...modelValue, stage: $event.target.value })"
      >
        <option value="">
          全部学段
        </option>
        <option
          v-for="(label, key) in STAGE_LABELS"
          :key="key"
          :value="key"
        >
          {{ label }}
        </option>
      </select>
    </div>
    <div class="fitem">
      <label>学科</label>
      <select
        :value="modelValue.subject"
        @change="emit('update:modelValue', { ...modelValue, subject: $event.target.value })"
      >
        <option value="">
          全部学科
        </option>
        <option
          v-for="s in SUBJECT_KEYS"
          :key="s"
          :value="s"
        >
          {{ s }}
        </option>
      </select>
    </div>
    <div class="fitem">
      <label>资料类型</label>
      <select
        :value="modelValue.genType"
        @change="emit('update:modelValue', { ...modelValue, genType: $event.target.value })"
      >
        <option value="">
          全部类型
        </option>
        <option
          v-for="t in GEN_TYPE_LABELS"
          :key="t.key"
          :value="t.key"
        >
          {{ t.label }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { STAGE_KEYS, SUBJECT_KEYS, GEN_TYPE_KEYS } from '@/config/toolLibrary.js';

defineProps({
  modelValue: { type: Object, default: () => ({ stage: '', subject: '', genType: '' }) },
  compact: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);

const STAGE_LABELS = {
  primary_low: '小学低段（1-2年级）',
  primary_mid: '小学中段（3-4年级）',
  primary_high: '小学高段（5-6年级）',
  middle: '初中（7-9年级）',
  high: '高中',
};

const GEN_TYPE_LABELS = GEN_TYPE_KEYS.map((k) => ({
  key: k,
  label: ({ exam: '正式试卷', practice: '课时练', special: '专项突破', preview: '课前预习', reading: '阅读训练', summary: '知识总结', dictation: '默写积累', errorbook: '错题本', review: '复习资料' })[k] || k,
}));
</script>

<style scoped>
.dim-filter { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.fitem { display: flex; align-items: center; gap: 6px; }
.fitem label { font-size: 11.5px; color: var(--text-muted); white-space: nowrap; }
.fitem select { border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; font-size: 13px; background: #fff; min-width: 128px; }
.compact .fitem select { min-width: 88px; padding: 5px 8px; font-size: 12.5px; }
</style>
