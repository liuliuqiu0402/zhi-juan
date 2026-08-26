<template>
  <div class="tool-sub-page">
    <div class="ph">
      <h3>📏 排版规格库</h3>
      <span class="st-badge">真实数据源 · {{ srcFile }}（程序可读，模型不感知）</span>
    </div>
    <div class="brief">
      <p>学段渲染参数（程序可读数据）：作文格宽、填空横线上限、书写载体、解答题空白区系数、方格纸规格等。供骨架编译器、清洗器(normalizeBlankMarkers)、导出端(docxBuilder) 读取。</p>
      <p>与规则库分工：排版规格库承载格式<b>数值/参数</b>，规则库承载格式<b>逻辑/开关</b>（writing-grid-fix 判定执行入口读取本库参数）。</p>
      <p>解答题空白区 = f(分值, 学段)：行数 = 分值 × 学段系数 · 行高 = 学段字号 × 行距系数。</p>
    </div>
    <div class="tbl-wrap">
      <table>
        <thead><tr><th>规格项</th><th>小学低段</th><th>小学中段</th><th>小学高段</th><th>初中</th><th>高中</th><th>读取方</th></tr></thead>
        <tbody>
          <tr><td>作文格格宽</td>
            <td>{{ zwg('primary') }}</td><td>{{ zwg('primary') }}</td><td>{{ zwg('primary') }}</td>
            <td>{{ zwg('middle') }}</td><td>{{ zwg('high') }}</td><td>骨架编译器 / docxBuilder</td></tr>
          <tr><td>作文格数字标注步长</td>
            <td>{{ mark('primary') }}</td><td>{{ mark('primary') }}</td><td>{{ mark('primary') }}</td>
            <td>{{ mark('middle') }}</td><td>{{ mark('high') }}</td><td>docxBuilder</td></tr>
          <tr><td>作文格列数（A4 内边距）</td><td colspan="4">按边距排满</td><td>按边距排满</td><td>docxBuilder</td></tr>
          <tr><td>填空横线上限</td><td colspan="2">{{ blankUpper }}em（{{ blankChars }} 字宽）</td><td colspan="2">{{ blankUpper }}em（{{ blankChars }} 字宽）</td><td>{{ blankUpper }}em（{{ blankChars }} 字宽）</td><td>normalizeBlankMarkers</td></tr>
          <tr><td>解答题空白区行数系数</td>
            <td>{{ ANSWER_REGION.primary_low.linePerScore }} 行/分</td>
            <td>{{ ANSWER_REGION.primary_mid.linePerScore }} 行/分</td>
            <td>{{ ANSWER_REGION.primary_high.linePerScore }} 行/分</td>
            <td>{{ ANSWER_REGION.middle.linePerScore }} 行/分</td>
            <td>{{ ANSWER_REGION.high.linePerScore }} 行/分</td><td>骨架编译器</td></tr>
          <tr><td>解答题空白区行高</td>
            <td>{{ ANSWER_REGION.primary_low.lineHeightMm }}mm</td>
            <td>{{ ANSWER_REGION.primary_mid.lineHeightMm }}mm</td>
            <td>{{ ANSWER_REGION.primary_high.lineHeightMm }}mm</td>
            <td>{{ ANSWER_REGION.middle.lineHeightMm }}mm</td>
            <td>{{ ANSWER_REGION.high.lineHeightMm }}mm</td><td>骨架编译器</td></tr>
          <tr><td>方格纸 square-grid</td>
            <td>{{ sg('primary') }}</td><td>{{ sg('primary') }}</td><td>{{ sg('primary') }}</td>
            <td>—</td><td>—</td><td>骨架编译器</td></tr>
          <tr><td>书写载体（田字格/方格/横线）</td>
            <td>{{ carrier('primary_low') }}</td><td>{{ carrier('primary_mid') }}</td>
            <td>{{ carrier('primary_high') }}</td><td>{{ carrier('middle') }}</td><td>{{ carrier('high') }}</td><td>writing-grid-fix</td></tr>
        </tbody>
      </table>
    </div>
    <p style="font-size: 12px; color: var(--text-muted); margin-top: 10px;">※ 数据源：src/config/layoutSpec.js（填空/作文格尺寸已由清洗器与 docxBuilder 读取；themeConfig 作文格 CSS 参数对齐见后续）。</p>
  </div>
</template>

<script setup>
import { ZUOWEN_CELL, ZUOWEN_MARK_STEP, BLANK, WRITING_CARRIER, ANSWER_REGION, SQUARE_GRID } from '../../../config/layoutSpec.js';

const srcFile = 'src/config/layoutSpec.js';
const blankUpper = BLANK.maxCap;
const blankChars = Math.floor(BLANK.maxCap / BLANK.wordGap);

const zwg = (g) => {
  const c = ZUOWEN_CELL[g];
  return c.widthMm === c.heightMm ? `${c.widthMm}×${c.heightMm}mm` : `${c.widthMm}×${c.heightMm}mm`;
};
const mark = (g) => `${ZUOWEN_MARK_STEP[g]} 格/标`;
const sg = (g) => SQUARE_GRID[g] ? `${SQUARE_GRID[g].cols}列×${SQUARE_GRID[g].rows}行` : '—';
const carrier = (s) => ({ 'tian-zi-ge': '田字格', square: '方格', line: '横线' }[WRITING_CARRIER[s]] || WRITING_CARRIER[s]);
</script>

<style scoped>
.tool-sub-page { padding: 22px; }
.ph { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.ph h3 { margin: 0; font-size: 18px; color: var(--primary); }
.st-badge { font-size: 12px; color: var(--primary); background: var(--primary-lighter, #eef4ff); border: 1px solid var(--primary-soft, #c9d8ff); border-radius: 999px; padding: 2px 12px; }
.brief { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 10px; padding: 14px 16px; font-size: 13px; color: #445; }
.brief p { margin: 4px 0; }
.tbl-wrap { overflow-x: auto; margin-top: 14px; }
table { border-collapse: collapse; width: 100%; background: #fff; border-radius: 10px; overflow: hidden; font-size: 12.5px; }
th, td { border-bottom: 1px solid var(--border-light); padding: 8px 10px; text-align: left; }
th { background: var(--primary-lighter, #eef4ff); color: var(--primary); font-weight: 600; white-space: nowrap; }
tr:last-child td { border-bottom: none; }
</style>