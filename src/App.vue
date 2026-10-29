<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { Message, Modal } from "@arco-design/web-vue";
import AppIcon from "./components/AppIcon.vue";
import { navigation } from "./router";
import { demo, resetDemo, storageUnavailable } from "./mock/store";

const route = useRoute();
const collapsed = ref(false);
const mobileMenu = ref(false);
const about = ref(false);
const current = computed(
  () => navigation.find((n) => n.path === route.path) || navigation[0]!,
);
function handleReset() {
  Modal.confirm({
    title: "重置演示数据",
    content: "这会清除当前浏览器中的模拟操作，恢复初始商户和今日任务。",
    okText: "确认重置",
    cancelText: "取消",
    onOk: () => {
      resetDemo();
      Message.success("已恢复初始演示数据");
    },
  });
}
</script>

<template>
  <a-config-provider>
    <div
      class="app-shell"
      :class="{ collapsed, 'mobile-menu-open': mobileMenu }"
    >
      <button
        v-if="mobileMenu"
        class="sidebar-mask"
        aria-label="关闭导航"
        @click="mobileMenu = false"
      />
      <aside class="sidebar">
        <RouterLink
          to="/overview"
          class="brand"
          aria-label="温江餐厨首页"
          @click="mobileMenu = false"
        >
          <div class="brand-mark">W<span>·</span></div>
          <div class="brand-copy">
            <strong>温江餐厨</strong><span>收运运营管理平台</span>
          </div>
        </RouterLink>
        <div class="project-label">项目工作台 <span>WENJIANG</span></div>
        <nav aria-label="主导航">
          <RouterLink
            v-for="item in navigation"
            :key="item.path"
            :to="item.path"
            :title="item.title"
            class="nav-item"
            @click="mobileMenu = false"
          >
            <AppIcon :name="item.icon" /><span>{{ item.title }}</span
            ><span class="nav-arrow">›</span>
          </RouterLink>
        </nav>
        <div class="sidebar-foot">
          <div class="demo-card">
            <span class="live-dot" />
            <div>
              <strong>产品原型 · v0.1</strong>
              <p>全部使用模拟数据</p>
            </div>
          </div>
          <button class="text-button sidebar-about" @click="about = true">
            <AppIcon name="info" :size="16" /><span>关于项目原型</span>
          </button>
        </div>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <div class="topbar-left">
            <button
              class="icon-button desktop-toggle"
              :aria-label="collapsed ? '展开导航' : '折叠导航'"
              @click="collapsed = !collapsed"
            >
              <AppIcon name="menu" />
            </button>
            <button
              class="icon-button mobile-toggle"
              aria-label="打开导航"
              @click="mobileMenu = true"
            >
              <AppIcon name="menu" />
            </button>
            <span class="breadcrumb"
              >餐厨收运<span>/</span><strong>{{ current.title }}</strong></span
            >
          </div>
          <div class="topbar-right">
            <span class="demo-badge"><span class="live-dot" />演示环境</span
            ><span class="topbar-divider" />
            <div class="avatar">温</div>
            <span class="user-name">项目管理员</span>
          </div>
        </header>
        <div class="workspace-tabs">
          <span class="active-tab"
            ><AppIcon :name="current.icon" :size="14" />{{
              current.title
            }}</span
          ><span class="workspace-date">{{ demo.date }} · 当日演示数据</span>
        </div>
        <main id="main-content">
          <a-alert
            v-if="storageUnavailable"
            type="warning"
            class="storage-alert"
            >浏览器存储不可用，本次操作仅在当前页面有效。</a-alert
          >
          <RouterView />
          <footer class="page-footer">
            <span>温江餐厨收运管理平台</span
            ><span>产品原型 · 所有商户、车辆、地址及业务数据均为虚构示例</span>
          </footer>
        </main>
      </div>
      <a-modal
        v-model:visible="about"
        title="关于温江餐厨原型"
        :footer="false"
        :width="'min(520px, 94vw)'"
      >
        <div class="about-content">
          <div class="about-logo">
            温江餐厨 <a-tag color="arcoblue">v0.1</a-tag>
          </div>
          <p>
            参考龙安项目的蓝白后台风格、指标卡片、表格和详情抽屉，搭建独立的纯前端原型。
          </p>
          <p>
            当前提供运营总览、收运作业和餐厨商户三个示例页。全部数据由本地模拟数据生成，不连接后端，也不代表真实运营情况。
          </p>
          <p>
            演示操作仅保存在当前浏览器。数据按北京时间每日初始化，也可手动重置。
          </p>
          <a-button long @click="handleReset"
            ><template #icon><AppIcon name="refresh" :size="16" /></template
            >重置演示数据</a-button
          >
        </div>
      </a-modal>
    </div>
  </a-config-provider>
</template>
