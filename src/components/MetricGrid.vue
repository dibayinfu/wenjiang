<!-- 基于龙安 MetricGrid.vue：保留指标样式，说明通过 Tooltip 展示。 -->
<script setup lang="ts">
import { IconInfoCircle } from "@arco-design/web-vue/es/icon";
defineProps<{
  items: {
    label: string;
    value: string | number;
    unit: string;
    note: string;
    icon: string;
    tone?: string;
  }[];
}>();
</script>
<template>
  <div class="metric-row">
    <div v-for="item in items" :key="item.label" class="metric-card">
      <div class="metric-label">
        {{ item.label
        }}<a-tooltip :content="item.note"
          ><IconInfoCircle :size="14"
        /></a-tooltip>
      </div>
      <div class="metric-value" :class="`tone-${item.tone || 'normal'}`">
        {{ item.value }}<span>{{ item.unit }}</span>
      </div>
    </div>
  </div>
</template>
<style scoped>
.metric-row {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}
.metric-card {
  flex-shrink: 0;
  padding: 16px 20px;
  background: var(--color-bg-2);
  border-radius: 6px;
  min-width: 130px;
  border: 1px solid var(--color-border-2);
}
.metric-label {
  color: var(--color-text-3);
  font-size: 13px;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  white-space: nowrap;
}
.metric-label svg {
  margin-left: 4px;
  color: var(--color-text-4);
  cursor: help;
}
.metric-value {
  margin-top: 10px;
  color: rgb(var(--arcoblue-6));
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.metric-value span {
  margin-left: 4px;
  color: var(--color-text-3);
  font-size: 13px;
  font-weight: 400;
}
.tone-green {
  color: rgb(var(--green-6));
}
.tone-orange {
  color: rgb(var(--orange-6));
}
.tone-purple {
  color: rgb(var(--arcoblue-6));
}
</style>
