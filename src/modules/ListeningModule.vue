<template>
  <div class="listening-page">
    <!-- 页面头：说明这个功能**不依赖任何生成记录**——粘贴素材即可出听力音频 -->
    <div class="lp-header">
      <div class="lp-title-wrap">
        <h2>🎧 听力配音</h2>
        <p class="lp-desc">
          粘贴英语或中文听力素材，直接生成考试听力音频。<b>英文</b>走规则解析；<b>中文</b>先译为英语听力稿
          （译文在下方朗读稿里逐句核对）。语速、音色、静默作答留白按学段矩阵自动取值，也可手动覆盖。
        </p>
      </div>
    </div>

    <!-- 工作台：page 形态＝常驻面板（不用弹窗）。
         🔴 与生成页结果卡片上的「🎧 听力稿」是**同一个组件**——区别只有来源：
            那边读某条记录答案页里的听力原文，这边读你粘贴的素材；解析/参数/渲染/合成完全同源。 -->
    <ListeningWorkbench variant="page" />

    <div class="lp-foot">
      <span class="lp-foot-label">说明</span>
      本页与「生成教辅」的结果列表无关：结果列表是 20 条上限滚动的临时区，记录滚走后仍可在此配音。
      听力原文取自生成记录时，请到结果卡片上用「🎧 听力稿」进入。
    </div>
  </div>
</template>

<script setup>
// 🎧 听力工作台（与生成页共用同一实现，只有 variant 不同：page = 常驻面板）
import ListeningWorkbench from '../components/listening/ListeningWorkbench.vue';
</script>

<style scoped>
.listening-page {
  height: 100%;
  overflow: auto;
  padding: 20px 22px 28px;
  box-sizing: border-box;
  background: var(--bg, #f5f7fb);
}

.lp-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.lp-title-wrap {
  min-width: 0;
}

.listening-page h2 {
  margin: 0;
  font-size: 20px;
  color: var(--primary, #1e3a6f);
}

.lp-desc {
  margin: 6px 0 0;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--text-muted, #6b7a90);
  max-width: 900px;
}

.lp-foot {
  margin-top: 14px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-muted, #6b7a90);
  background: #fff;
  border: 1px dashed var(--border-light, #dfe6ef);
  border-radius: 8px;
  padding: 10px 12px;
}

.lp-foot-label {
  font-weight: 600;
  color: var(--primary, #1e3a6f);
  margin-right: 6px;
}
</style>
