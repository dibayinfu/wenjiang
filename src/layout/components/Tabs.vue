<!-- 迁自龙安 Tabs：保留 card-gutter 多页签、关闭、刷新、关闭其他。 -->
<script setup lang="ts">
import { watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  IconRefresh,
  IconMoreVertical,
  IconClose,
} from "@arco-design/web-vue/es/icon";
import { useAppStore } from "../../stores/app";
import { useTabsStore } from "../../stores/tabs";
const app = useAppStore();
const tabs = useTabsStore();
const route = useRoute();
const router = useRouter();
watch(
  () => route.fullPath,
  () => tabs.addTabItem(route),
  { immediate: true },
);
function change(key: string | number) {
  router.push(
    tabs.tabList.find((tab) => tab.path === key)?.fullPath || String(key),
  );
}
function close(key: string | number) {
  tabs.closeCurrent(String(key), router);
}
</script>
<template>
  <div v-if="app.tab" class="tabs">
    <a-tabs
      editable
      hide-content
      size="medium"
      :type="app.tabMode"
      :active-key="route.path"
      @tab-click="change"
      @delete="close"
    >
      <a-tab-pane
        v-for="tab in tabs.tabList"
        :key="tab.path"
        :title="tab.title"
        :closable="tab.path !== '/overview'"
      />
      <template #extra
        ><a-button
          type="text"
          aria-label="刷新当前页面"
          @click="tabs.reloadKey++"
          ><template #icon><IconRefresh /></template></a-button
        ><a-dropdown trigger="click"
          ><a-button type="text" aria-label="页签操作"
            ><template #icon><IconMoreVertical /></template></a-button
          ><template #content
            ><a-doption
              :disabled="route.path === '/overview'"
              @click="tabs.closeCurrent(route.path, router)"
              ><template #icon><IconClose /></template>关闭当前</a-doption
            ><a-doption @click="tabs.closeOther(route.path)"
              ><template #icon><IconClose /></template>关闭其他</a-doption
            ></template
          ></a-dropdown
        ></template
      >
    </a-tabs>
  </div>
</template>
<style scoped>
.tabs {
  padding: 5px 0;
  background-color: var(--color-bg-1);
  position: relative;
  flex-shrink: 0;
}
:deep(
  .arco-tabs-nav-tab:not(.arco-tabs-nav-tab-scroll) .arco-tabs-tab:first-child
) {
  border-left: 0;
}
</style>
