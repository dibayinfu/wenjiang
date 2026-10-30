<script setup lang="ts">
import { computed } from "vue";
const props = defineProps<{
  items: { label: string; value: number }[];
  unit?: string;
  precision?: number;
  title: string;
}>();
const max = computed(() => Math.max(1, ...props.items.map((i) => i.value)));
</script>
<template>
  <section class="panel">
    <div class="panel-heading">
      <h2>{{ title }}</h2>
      <span class="muted small-text">{{ unit }}</span>
    </div>
    <div v-if="items.length" class="mini-bars" role="group" :aria-label="title">
      <a-tooltip v-for="(i,n) in items" :key="i.label" :content="`${i.label}：${i.value.toFixed(precision ?? 2)} ${unit??''}`" :trigger="['hover','focus']"><div class="mini-bar-row" tabindex="0" :aria-label="`${i.label}：${i.value.toFixed(precision ?? 2)} ${unit??''}`">
        <span class="mini-bar-label" :title="i.label">{{ i.label }}</span>
        <div class="mini-bar-track">
          <div
            :style="{ width: `${(i.value / max) * 100}%` }"
            :class="{ 'bar-secondary': n > 2 }"
          />
        </div>
        <strong>{{ precision === undefined ? Number(i.value.toFixed(2)) : i.value.toFixed(precision) }}</strong>
      </div></a-tooltip>
    </div>
    <a-empty v-else description="当前筛选无数据" />
  </section>
</template>

<style scoped>
.mini-bar-row{border-radius:4px;transition:background-color .16s ease,transform .16s ease}.mini-bar-track > div{transform-origin:center;transition:transform .16s ease,background-color .16s ease,box-shadow .16s ease}.mini-bar-row:hover,.mini-bar-row:focus-visible{background:var(--color-primary-light-1);transform:translateX(3px)}.mini-bar-row:hover .mini-bar-track > div,.mini-bar-row:focus-visible .mini-bar-track > div{transform:scaleY(1.3);background:rgb(var(--primary-5));box-shadow:0 2px 7px rgb(var(--primary-6),.18)}.mini-bar-row:hover strong,.mini-bar-row:focus-visible strong{color:rgb(var(--primary-6))}.mini-bar-row:focus-visible{outline:2px solid rgb(var(--primary-3));outline-offset:2px}@media(prefers-reduced-motion:reduce){.mini-bar-row,.mini-bar-track > div{transition:none;transform:none!important}}
</style>
