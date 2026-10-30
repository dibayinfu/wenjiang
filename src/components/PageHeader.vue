<!-- 统一页面标题与操作区。 -->
<script setup lang="ts">
defineProps<{ title: string; description?: string; module?: string }>();
</script>
<template>
  <div class="module-header">
    <h2>{{ title }}</h2>
    <a-space class="module-header-actions" wrap><slot /></a-space>
  </div>
</template>
<style scoped>
.module-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  background: var(--color-bg-2);
  border-radius: 4px;
}
.module-header h2 {
  margin: 0;
  color: var(--color-text-1);
  font-size: 20px;
  font-weight: 600;
}
@media (max-width: 767px) {
  .module-header {
    flex-direction: column;
  }
}
</style>
