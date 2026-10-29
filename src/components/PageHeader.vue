<!-- 迁自龙安 ModuleHeader.vue，沿用标签、标题、描述与操作区。 -->
<script setup lang="ts">
withDefaults(
  defineProps<{ title: string; description: string; module?: string }>(),
  { module: "餐厨收运" },
);
</script>
<template>
  <div class="module-header">
    <div>
      <a-space
        ><a-tag color="arcoblue">产品原型</a-tag
        ><a-tag color="orangered">示例页面</a-tag
        ><a-tag>{{ module }}</a-tag></a-space
      >
      <h2>{{ title }}</h2>
      <p>{{ description }}</p>
    </div>
    <a-space class="module-header-actions" wrap><slot /></a-space>
  </div>
</template>
<style scoped>
.module-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  background: var(--color-bg-2);
  border-radius: 4px;
}
.module-header h2 {
  margin: 10px 0 6px;
  color: var(--color-text-1);
  font-size: 20px;
  font-weight: 600;
}
.module-header p {
  max-width: 900px;
  margin: 0;
  color: var(--color-text-3);
  line-height: 1.7;
}
@media (max-width: 767px) {
  .module-header {
    flex-direction: column;
  }
}
</style>
