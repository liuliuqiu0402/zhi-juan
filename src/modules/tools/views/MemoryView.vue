<template>
  <div class="tool-sub-page">
    <div class="ph">
      <h3>🧠 记忆库</h3>
      <div>
        <button class="btn" @click="load">🔄 刷新</button>
        <button class="btn danger" @click="clearAll">🗑️ 清理全部</button>
      </div>
    </div>
    <div class="brief">
      <p>跨会话去重：按 教材|单元|类型 分桶存储已出题摘要；生成时读取为"已出题摘要"，实现"至少 70% 不与已出题雷同"。</p>
    </div>
    <div class="stat-row">
      <div class="stat"><b>{{ bucketCount }}</b><span>分桶数</span></div>
      <div class="stat"><b>{{ recordCount }}</b><span>记录条数</span></div>
      <div class="stat"><b>{{ storageKB }}KB</b><span>占用估算</span></div>
    </div>
    <div class="tbl-wrap" v-if="buckets.length">
      <table>
        <thead><tr><th>分桶键（教材|单元|类型）</th><th>条目数</th><th>最近记录</th></tr></thead>
        <tbody>
          <tr v-for="(b, i) in buckets" :key="i">
            <td><code>{{ b.key }}</code></td>
            <td>{{ b.count }}</td>
            <td>{{ b.last }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="empty">暂无记忆记录（生成教辅后自动产生）。</p>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const MEMORY_KEY = 'wisdom_unit_paper_memory_v1';
const buckets = ref([]);
const bucketCount = ref(0);
const recordCount = ref(0);
const storageKB = ref(0);

const load = () => {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    const data = raw ? JSON.parse(raw) : {};
    const keys = Object.keys(data);
    bucketCount.value = keys.length;
    let total = 0;
    buckets.value = keys.map((k) => {
      const arr = data[k] || [];
      total += arr.length;
      return { key: k, count: arr.length, last: arr.length ? new Date(arr[arr.length - 1].ts).toLocaleDateString('zh-CN') : '-' };
    }).sort((a, b) => b.count - a.count).slice(0, 20);
    recordCount.value = total;
    storageKB.value = Math.round((raw ? raw.length : 0) / 1024);
  } catch (e) {
    buckets.value = [];
    bucketCount.value = 0; recordCount.value = 0; storageKB.value = 0;
  }
};

const clearAll = () => {
  if (window.confirm('确认清空全部记忆记录？将影响后续生成的"避雷同"能力。')) {
    localStorage.removeItem(MEMORY_KEY);
    load();
  }
};

load();
</script>

<style scoped>
.tool-sub-page { padding: 22px; }
.ph { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.ph h3 { margin: 0; font-size: 18px; color: var(--primary); }
.btn { border: 1px solid var(--border); background: #fff; border-radius: 6px; padding: 6px 14px; font-size: 13px; cursor: pointer; margin-left: 8px; }
.btn.danger { color: var(--danger); border-color: var(--danger-light); }
.brief { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 10px; padding: 14px 16px; font-size: 13px; color: #445; }
.brief p { margin: 4px 0; }
.stat-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-top: 16px; }
.stat { background: #fff; border: 1px solid var(--border-light); border-radius: 10px; padding: 14px; text-align: center; }
.stat b { display: block; font-size: 24px; color: var(--primary); }
.stat span { font-size: 12px; color: var(--text-muted); }
.tbl-wrap { overflow-x: auto; margin-top: 14px; }
table { border-collapse: collapse; width: 100%; background: #fff; border-radius: 10px; overflow: hidden; font-size: 12.5px; }
th, td { border-bottom: 1px solid var(--border-light); padding: 8px 10px; text-align: left; }
th { background: var(--primary-lighter); color: var(--primary); font-weight: 600; white-space: nowrap; }
tr:last-child td { border-bottom: none; }
.empty { color: var(--text-muted); font-size: 13px; margin-top: 16px; }
</style>
