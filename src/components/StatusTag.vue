<script setup lang="ts">
defineProps<{ value: string }>();
const colors: Record<string, string> = {
  有效: "green",
  待核验: "orange",
  在线: "green",
  已收运: "green",
  已关闭: "green",
  处理中: "arcoblue",
  待处理: "red",
  离线: "gray",
  维修中: "orange",
  未收运: "orange",
  未排班: "gray",
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
