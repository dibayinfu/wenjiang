<!-- 基于龙安 Menu：保留原生 Arco 分组、折叠、选中与手风琴行为。 -->
<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import {
  IconDashboard,
  IconFile,
  IconSchedule,
} from "@arco-design/web-vue/es/icon";
import { useAppStore } from "../../stores/app";
defineProps<{ mobile?: boolean }>();
const emit = defineEmits<{ navigate: [] }>();
const route = useRoute();
const router = useRouter();
const app = useAppStore();
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
    :default-open-keys="['operations', 'archives']"
    :accordion="app.menuAccordion"
    auto-open-selected
    @menu-item-click="navigate"
  >
    <a-sub-menu key="operations" title="运营管理"
      ><template #icon><IconDashboard /></template
      ><a-menu-item key="/overview">运营总览</a-menu-item
      ><a-menu-item key="/tasks"
        ><template #icon><IconSchedule /></template>收运作业</a-menu-item
      ></a-sub-menu
    >
    <a-sub-menu key="archives" title="基础档案"
      ><template #icon><IconFile /></template
      ><a-menu-item key="/merchants">餐厨商户</a-menu-item></a-sub-menu
    >
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
