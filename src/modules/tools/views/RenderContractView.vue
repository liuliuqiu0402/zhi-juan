<template>
  <div class="tool-sub-page">
    <div class="ph">
      <h3>🎨 渲染契约库</h3>
      <span class="st-badge">待迁移 · 数据源：src/config/eduRenderContract.js</span>
    </div>
    <div class="brief">
      <p>EduRender Studio 渲染指令协议：[GRAPH]（9 种 TYPE）· [IMAGE]（SD/ICON）· 公式 $..$ / $$..$$。</p>
      <p>迁移要点：补「历史」学科 [GRAPH] 统计图；扩展 [IMAGE] 关键词（识图/读图/示意）；按 学科×学段×类型 三维度组织条目。</p>
    </div>
    <div class="stat-row">
      <div class="stat"><b>9</b><span>图形 TYPE</span></div>
      <div class="stat"><b>7</b><span>GRAPH 学科</span></div>
      <div class="stat"><b>2</b><span>IMAGE 类型（SD/ICON）</span></div>
      <div class="stat warn"><b>1</b><span>缺口：历史学科</span></div>
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
.stat-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-top: 16px; }
.stat { background: #fff; border: 1px solid var(--border-light); border-radius: 10px; padding: 14px; text-align: center; }
.stat b { display: block; font-size: 24px; color: var(--primary); }
.stat span { font-size: 12px; color: var(--text-muted); }
.stat.warn b { color: #a06a10; }
</style>
