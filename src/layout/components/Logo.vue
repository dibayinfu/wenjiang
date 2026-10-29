<!-- 迁自龙安 Logo.vue：改为独立站点标题及本地资源。 -->
<script setup lang="ts">
import { useAppStore } from "../../stores/app";
defineProps<{ collapsed?: boolean }>();
const app = useAppStore();
const logo = `${import.meta.env.BASE_URL}logo.svg`;
</script>
<template>
  <RouterLink
    to="/overview"
    class="system-logo"
    :class="{ collapsed }"
    aria-label="温江餐厨首页"
    ><img class="logo" :src="logo" alt="" /><span
      class="system-name gi_line_1"
      >{{ app.title }}</span
    ></RouterLink
  >
</template>
<style scoped>
.system-logo {
  height: 56px;
  padding: 0 12px;
  color: var(--color-text-1);
  font-size: 20px;
  line-height: 1;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  flex-wrap: nowrap;
  cursor: pointer;
  user-select: none;
  box-sizing: border-box;
}
.system-logo.collapsed {
  padding: 0;
  justify-content: center;
}
.system-logo.collapsed .system-name {
  display: none;
}
.logo {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
}
.system-name {
  padding-left: 6px;
  white-space: nowrap;
  line-height: 1.5;
}
.system-name:hover {
  color: rgb(var(--primary-6));
}
</style>
