<!-- 抽取龙安 LayoutDefault / LayoutMix 的共用结构；移除登录、权限及后端依赖。 -->
<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import {
  IconMenuFold,
  IconMenuUnfold,
  IconDashboard,
} from "@arco-design/web-vue/es/icon";
import Logo from "./components/Logo.vue";
import Menu from "./components/Menu.vue";
import Tabs from "./components/Tabs.vue";
import HeaderRightBar from "./components/HeaderRightBar.vue";
import { useAppStore } from "../stores/app";
import { useTabsStore } from "../stores/tabs";
import { storageUnavailable } from "../mock/store";
import { useRoute } from "vue-router";
const app = useAppStore();
const tabs = useTabsStore();
const route = useRoute();
const viewport = window.matchMedia("(min-width: 992px)");
const isDesktop = ref(viewport.matches);
const mobileMenu = ref(false);
function updateDevice() {
  isDesktop.value = viewport.matches;
  mobileMenu.value = false;
}
viewport.addEventListener("change", updateDevice);
onBeforeUnmount(() => viewport.removeEventListener("change", updateDevice));
function toggleMenu() {
  if (isDesktop.value) app.menuCollapse = !app.menuCollapse;
  else mobileMenu.value = !mobileMenu.value;
}
</script>
<template>
  <div class="layout-mix">
    <section
      v-if="isDesktop"
      class="layout-mix-left"
      :style="{ width: app.menuCollapse ? '48px' : '230px' }"
    >
      <Logo :collapsed="app.menuCollapse" />
      <div class="layout-mix-menu-scroll">
        <a-scrollbar
          style="height: 100%; overflow: auto"
          :outer-style="{ height: '100%' }"
          ><Menu
        /></a-scrollbar>
      </div>
    </section>
    <section class="layout-mix-right">
      <header class="header">
        <a-button
          size="mini"
          class="gi_hover_btn menu-fold-btn"
          :aria-label="
            isDesktop
              ? app.menuCollapse
                ? '展开导航'
                : '折叠导航'
              : '打开导航'
          "
          @click="toggleMenu"
          ><template #icon
            ><IconMenuUnfold
              v-if="app.menuCollapse"
              :size="18"
              :stroke-width="3" /><IconMenuFold
              v-else
              :size="18"
              :stroke-width="3" /></template
        ></a-button>
        <a-menu
          v-if="isDesktop && app.layout === 'mix'"
          class="layout-mix-top-menu"
          mode="horizontal"
          :selected-keys="['wenjiang']"
          :auto-open-selected="false"
          @menu-item-click="$router.push('/overview')"
          ><a-menu-item key="wenjiang"
            ><template #icon><IconDashboard :size="24" /></template
            >温江餐厨</a-menu-item
          ></a-menu
        >
        <a-breadcrumb v-else-if="isDesktop" class="header-breadcrumb"
          ><a-breadcrumb-item>项目工作台</a-breadcrumb-item
          ><a-breadcrumb-item>温江餐厨</a-breadcrumb-item
          ><a-breadcrumb-item>{{
            route.path === "/merchants" ? "基础档案" : "运营管理"
          }}</a-breadcrumb-item
          ><a-breadcrumb-item>{{
            route.meta.title
          }}</a-breadcrumb-item></a-breadcrumb
        >
        <span v-else class="mobile-title">温江餐厨</span>
        <HeaderRightBar />
      </header>
      <Tabs />
      <a-layout class="main"
        ><a-alert v-if="storageUnavailable" type="warning"
          >浏览器存储不可用，本次操作仅在当前页面有效。</a-alert
        ><RouterView v-slot="{ Component, route }"
          ><KeepAlive :key="tabs.reloadKey" :include="tabs.cacheList"
            ><component :is="Component" :key="route.path" /></KeepAlive
        ></RouterView>
        <footer v-if="app.copyrightDisplay" class="layout-footer">
          温江餐厨管理平台 · 产品原型 · 全部使用模拟数据
        </footer></a-layout
      >
    </section>
    <a-drawer
      v-model:visible="mobileMenu"
      placement="left"
      :width="230"
      :header="false"
      :footer="false"
      class="mobile-menu-drawer"
      ><Logo /><Menu mobile @navigate="mobileMenu = false"
    /></a-drawer>
  </div>
</template>
<style scoped>
.layout-mix {
  display: flex;
  align-items: stretch;
  height: 100%;
  overflow: hidden;
}
.layout-mix-left {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background-color: var(--color-bg-1);
  border-right: 1px solid var(--color-border);
  flex-shrink: 0;
}
.layout-mix-menu-scroll {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.layout-mix-right {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  height: 56px;
  padding: 0 var(--padding);
  overflow: hidden;
  color: var(--color-text-1);
  background: var(--color-bg-1);
  border-bottom: 1px solid var(--color-border);
}
.menu-fold-btn {
  background-color: var(--color-secondary-hover) !important;
  flex-shrink: 0;
}
.layout-mix-top-menu {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
.layout-mix-top-menu :deep(.arco-menu-inner) {
  padding-left: 0;
}
.layout-mix-top-menu :deep(.arco-menu-item) {
  display: inline-flex;
  align-items: center;
}
.layout-mix-top-menu :deep(.arco-menu-icon) {
  display: inline-flex;
  align-items: center;
  margin-right: 8px;
}
.main {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}
.layout-footer {
  padding: 8px 14px;
  text-align: center;
  color: var(--color-text-3);
  font-size: 12px;
  flex-shrink: 0;
}
.mobile-title {
  flex: 1;
  margin-left: 12px;
  font-size: 16px;
  white-space: nowrap;
}
.header-breadcrumb {
  flex: 1;
  min-width: 0;
  margin-left: 16px;
}
</style>
