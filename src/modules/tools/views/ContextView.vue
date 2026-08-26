<template>
  <div class="tool-sub-page">
    <div class="ph">
      <h3>🏞️ 情境库</h3>
      <span class="st-badge">待迁移 · 数据源：src/config/subjectContextLibrary.js</span>
    </div>
    <div class="brief">
      <p>统一情境/场景：学科 × 学段预设情境（如数学·小学"校园义卖活动"），供统一情境框架构建。</p>
      <p>迁移要点：补非 exam 类型的接线（当前仅 exam 因指令字面量触发）；情境框架改由三维度检索显式驱动，废除指令正则。</p>
    </div>
    <div class="ctx-row">
      <div class="ctx-card"><b>数学 · 小学</b><span>校园义卖 / 春游安排 / 家庭开支 / 运动数据</span></div>
      <div class="ctx-card"><b>语文 · 小学</b><span>校园生活 / 自然观察 / 节日民俗 / 童话世界</span></div>
      <div class="ctx-card"><b>英语 · 初中</b><span>学校生活 / 旅游出行 / 健康饮食 / 科技环保</span></div>
    </div>
  </div>
</template>

<script setup></script>

<style scoped>
.tool-sub-page { padding: 22px; }
.ph { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.ph h3 { margin: 0; font-size: 18px; color: var(--primary); }
.st-badge { font-size: 12px; color: #a06a10; background: #fdf3e2; border: 1px solid #f3d9a8; border-radius: 999px; padding: 2px 12px; }
.brief { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 10px; padding: 14px 16px; font-size: 13px; color: #445; }
.brief p { margin: 4px 0; }
.ctx-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-top: 16px; }
.ctx-card { background: #fff; border: 1px solid var(--border-light); border-left: 4px solid var(--accent); border-radius: 10px; padding: 12px 14px; }
.ctx-card b { display: block; color: var(--primary); font-size: 13.5px; margin-bottom: 6px; }
.ctx-card span { font-size: 12.5px; color: #556; }
</style>
