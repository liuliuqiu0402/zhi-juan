<template>
  <div class="tool-sub-page">
    <div class="ph">
      <h3>📏 排版规格库</h3>
      <span class="st-badge">新增 · 数据源：从 themeConfig CSS 抽取参数</span>
    </div>
    <div class="brief">
      <p>学段渲染参数（程序可读数据）：作文格宽、解答题空白区系数、blank 上限、方格纸规格等。供骨架编译器与导出端读取，模型不感知。</p>
      <p>解答题空白区 = f(分值, 学段)：行数 = 分值 × 学段系数 · 行高 = 学段字号 × 行距系数。</p>
    </div>
    <div class="tbl-wrap">
      <table>
        <thead><tr><th>规格项</th><th>小学低段</th><th>小学中段</th><th>小学高段</th><th>初中</th><th>高中</th><th>读取方</th></tr></thead>
        <tbody>
          <tr><td>作文格格宽</td><td>12mm</td><td>12mm</td><td>10mm</td><td>10mm</td><td>7.5×8mm</td><td>骨架编译器 / docxBuilder</td></tr>
          <tr><td>作文格列数（A4 内边距）</td><td colspan="4">按边距排满</td><td>按边距排满</td><td>docxBuilder</td></tr>
          <tr><td>解答题空白区行数系数</td><td>1.4 行/分</td><td>1.2 行/分</td><td>1.0 行/分</td><td>0.9 行/分</td><td>0.8 行/分</td><td>骨架编译器</td></tr>
          <tr><td>解答题空白区行高</td><td>9mm</td><td>8.5mm</td><td>8mm</td><td>7.5mm</td><td>7mm</td><td>骨架编译器</td></tr>
          <tr><td>填空横线上限</td><td colspan="5">16em（8 字宽）</td><td>normalizeBlankMarkers</td></tr>
          <tr><td>方格纸 square-grid</td><td>12列×8行</td><td>12列×8行</td><td>12列×8行</td><td>—</td><td>—</td><td>骨架编译器</td></tr>
          <tr><td>书写载体（田字格/四线三格/拼音四线格）</td><td>田字格</td><td>田字格/方格</td><td>方格/横线</td><td>横线</td><td>横线</td><td>writing-grid-fix</td></tr>
        </tbody>
      </table>
    </div>
    <p style="font-size: 12px; color: var(--text-muted); margin-top: 10px;">※ 上表数值为拟定占位，需按实际排版规范校准。</p>
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
.tbl-wrap { overflow-x: auto; margin-top: 14px; }
table { border-collapse: collapse; width: 100%; background: #fff; border-radius: 10px; overflow: hidden; font-size: 12.5px; }
th, td { border-bottom: 1px solid var(--border-light); padding: 8px 10px; text-align: left; }
th { background: var(--primary-lighter); color: var(--primary); font-weight: 600; white-space: nowrap; }
tr:last-child td { border-bottom: none; }
</style>
