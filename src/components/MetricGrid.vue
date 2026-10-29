<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
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
  <div class="metric-grid">
    <article v-for="item in items" :key="item.label" class="metric-card">
      <div class="metric-top">
        <span>{{ item.label }}</span
        ><span class="metric-icon" :class="item.tone"
          ><AppIcon :name="item.icon" :size="21"
        /></span>
      </div>
      <div class="metric-value">
        {{ item.value }}<span>{{ item.unit }}</span>
      </div>
      <p class="metric-note">{{ item.note }}</p>
    </article>
  </div>
</template>
