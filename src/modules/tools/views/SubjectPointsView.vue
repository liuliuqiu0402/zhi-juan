<template>
  <div class="tool-sub-page">
    <div class="ph">
      <h3>📚 学科要点库</h3>
      <span class="st-badge">待迁移 · 数据源：promptLibrary SUBJECT_EXAM_EXTRAS / expertKnowledge</span>
    </div>
    <div class="brief">
      <p>15 个学科的命题内容底线（如语文"识字写字：看拼音写词语嵌入语境句"、数学"应用题真实情境+列式+答语"）。</p>
      <p>迁移要点：按 学科×学段×类型 组织；与蓝图 note / 情境库去重；只保留模型语义类内容底线，格式类条目归排版规格库。</p>
    </div>
    <div class="subject-chips">
      <span v-for="s in SUBJECTS" :key="s" class="s-chip">{{ s }}</span>
    </div>
  </div>
</template>

<script setup>
import { SUBJECT_KEYS } from '@/config/toolLibrary.js';
const SUBJECTS = SUBJECT_KEYS;
</script>

<style scoped>
.tool-sub-page { padding: 22px; }
.ph { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.ph h3 { margin: 0; font-size: 18px; color: var(--primary); }
.st-badge { font-size: 12px; color: #a06a10; background: #fdf3e2; border: 1px solid #f3d9a8; border-radius: 999px; padding: 2px 12px; }
.brief { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 10px; padding: 14px 16px; font-size: 13px; color: #445; }
.brief p { margin: 4px 0; }
.subject-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.s-chip { background: #fff; border: 1px solid var(--border); border-radius: 999px; padding: 4px 14px; font-size: 13px; }
</style>
