<script setup lang="ts">
defineProps<{ title: string; description: string; eyebrow?: string }>();
</script>
<template>
  <div class="page-heading">
    <div>
      <div class="eyebrow">{{ eyebrow || "温江餐厨 · 业务管理" }}</div>
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
    </div>
    <div class="heading-actions"><slot /></div>
  </div>
</template>
