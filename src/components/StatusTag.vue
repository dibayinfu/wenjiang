<script setup lang="ts">
defineProps<{ value: string }>();
const colors: Record<string, string> = {
  已完成: "green",
  收运中: "arcoblue",
  待收运: "orange",
  已签约: "green",
  暂停收运: "gray",
};
</script>
<template>
  <a-tag :color="colors[value] || 'gray'" size="small"
    ><span class="status-dot" />{{ value }}</a-tag
  >
</template>
