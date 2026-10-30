<!-- 基于龙安 Menu：保留原生 Arco 分组、折叠、选中与手风琴行为。 -->
<script setup lang="ts">
import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  IconBarChart,
  IconStorage,
  IconSettings,
} from "@arco-design/web-vue/es/icon";
import { reportPages } from "../../mock/report-pages";
import { useAppStore } from "../../stores/app";
defineProps<{ mobile?: boolean }>();
const emit = defineEmits<{ navigate: [] }>();
const route = useRoute();
const router = useRouter();
const app = useAppStore();
const openKeys = ref<string[]>(["reports", "merchantAssets", "business"]);
watch(
  () => route.path,
  (path) => {
    const group = path === "/merchants" || path.startsWith("/assets/") ? "merchantAssets" : path.startsWith("/settings/") ? "business" : "reports";
    openKeys.value = app.menuAccordion
      ? [group]
      : [...new Set([...openKeys.value, group, ...(path.startsWith("/reports/") ? ["reports"] : [])])];
  },
  { immediate: true },
);
function navigate(path: string) {
  router.push(path);
  emit("navigate");
}
</script>
<template>
  <a-menu
    class="business-menu"
    :collapsed="mobile ? false : app.menuCollapse"
    :selected-keys="[route.path]"
    v-model:open-keys="openKeys"
    :accordion="app.menuAccordion"
    auto-open-selected
    @menu-item-click="navigate"
  >
    <a-sub-menu key="reports" title="作业监管"><template #icon><IconBarChart /></template><a-menu-item v-for="page in reportPages" :key="page.path"><span :style="page.upgrade ? {color:'rgb(var(--danger-6))'} : undefined">{{page.title}}</span></a-menu-item></a-sub-menu>
    <a-sub-menu key="merchantAssets" title="商户资产"><template #icon><IconStorage /></template><a-menu-item key="/merchants">商户管理</a-menu-item><a-menu-item key="/assets/points">商户收集点</a-menu-item></a-sub-menu>
    <a-sub-menu key="business" title="业务设置"><template #icon><IconSettings /></template><a-menu-item key="/settings/units"><span style="color:rgb(var(--danger-6))">联单设置 · 新增</span></a-menu-item><a-menu-item key="/settings/weighbridge"><span style="color:rgb(var(--danger-6))">地磅设置 · 新增</span></a-menu-item></a-sub-menu>
  </a-menu>
</template>
<style scoped>
.business-menu {
  width: 100%;
}
:deep(.arco-menu-collapsed .arco-menu-icon) {
  margin-right: 0;
  padding: 10px 0;
}
:deep(.arco-menu-collapsed .arco-menu-has-icon) {
  justify-content: center;
  padding: 0;
}
</style>
