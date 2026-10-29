<!-- 基于龙安 HeaderRightBar：原型移除登录和真实通知接口。 -->
<script setup lang="ts">
import { ref } from "vue";
import { Message, Modal } from "@arco-design/web-vue";
import {
  IconSettings,
  IconMoonFill,
  IconSunFill,
  IconFullscreen,
  IconDown,
  IconInfoCircle,
} from "@arco-design/web-vue/es/icon";
import { useAppStore } from "../../stores/app";
import { demo, resetDemo } from "../../mock/store";
const app = useAppStore();
const settings = ref(false);
const about = ref(false);
function reset() {
  Modal.confirm({
    title: "重置演示数据",
    content: "清除当前浏览器的模拟操作，恢复初始商户和今日任务。",
    okText: "确认重置",
    cancelText: "取消",
    onOk: () => {
      resetDemo();
      Message.success("已恢复初始演示数据");
    },
  });
}
async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    Message.info("当前浏览器不支持切换全屏");
  }
}
</script>
<template>
  <a-space size="medium" class="header-right-bar">
    <a-tag color="arcoblue" class="environment-tag">模拟数据</a-tag>
    <a-tooltip content="项目配置"
      ><a-button
        size="mini"
        class="gi_hover_btn"
        aria-label="项目配置"
        @click="settings = true"
        ><template #icon><IconSettings :size="18" /></template></a-button
    ></a-tooltip>
    <a-tooltip
      :content="app.theme === 'light' ? '切换深色主题' : '切换浅色主题'"
      ><a-button
        size="mini"
        class="gi_hover_btn"
        aria-label="切换主题"
        @click="app.toggleTheme"
        ><template #icon
          ><IconMoonFill v-if="app.theme === 'light'" :size="18" /><IconSunFill
            v-else
            :size="18" /></template></a-button
    ></a-tooltip>
    <a-tooltip content="全屏"
      ><a-button
        size="mini"
        class="gi_hover_btn fullscreen-button"
        aria-label="全屏"
        @click="fullscreen"
        ><template #icon><IconFullscreen :size="18" /></template></a-button
    ></a-tooltip>
    <a-dropdown trigger="click"
      ><a-button type="text" class="user" aria-label="项目管理员菜单"
        ><a-avatar :size="32">温</a-avatar
        ><span class="username">项目管理员</span><IconDown /></a-button
      ><template #content
        ><a-doption @click="about = true"
          ><template #icon><IconInfoCircle /></template>关于项目原型</a-doption
        ><a-doption @click="reset">重置演示数据</a-doption></template
      ></a-dropdown
    >
  </a-space>
  <a-drawer
    v-model:visible="settings"
    title="项目配置"
    :width="'min(340px, 94vw)'"
    :footer="false"
  >
    <a-form layout="vertical"
      ><a-form-item label="布局模式"
        ><a-radio-group v-model="app.layout" type="button"
          ><a-radio value="default">默认布局</a-radio
          ><a-radio value="mix">混合布局</a-radio></a-radio-group
        ></a-form-item
      ><a-form-item label="主题模式"
        ><a-radio-group
          v-model="app.theme"
          type="button"
          @change="app.initTheme"
          ><a-radio value="light">简白</a-radio
          ><a-radio value="dark">暗黑</a-radio></a-radio-group
        ></a-form-item
      ><a-form-item label="菜单折叠"
        ><a-switch v-model="app.menuCollapse" /></a-form-item
      ><a-form-item label="菜单手风琴模式"
        ><a-switch v-model="app.menuAccordion" /></a-form-item
      ><a-form-item label="显示多页签"
        ><a-switch v-model="app.tab" /></a-form-item
      ><a-form-item label="显示页脚"
        ><a-switch v-model="app.copyrightDisplay" /></a-form-item
    ></a-form>
  </a-drawer>
  <a-modal
    v-model:visible="about"
    title="关于温江餐厨原型"
    :footer="false"
    :width="'min(520px, 94vw)'"
  >
    <a-descriptions :column="1" bordered
      ><a-descriptions-item label="前端框架"
        >Vue 3 + Arco Design / ContiNew Admin</a-descriptions-item
      ><a-descriptions-item label="布局与主题"
        >沿用龙安 LayoutMix 混合布局、vue-gi-demo 主题与 Arco
        样式</a-descriptions-item
      ><a-descriptions-item label="演示日期">{{
        demo.date
      }}</a-descriptions-item
      ><a-descriptions-item label="数据来源"
        >独立模拟数据，无后端服务</a-descriptions-item
      ></a-descriptions
    >
    <p class="about-description">
      商户、人员、车辆、地址均为虚构示例。操作保存在当前浏览器，按北京时间跨日重置。
    </p>
    <a-button long @click="reset">重置演示数据</a-button>
  </a-modal>
</template>
<style scoped>
.header-right-bar {
  flex-shrink: 0;
}
.user {
  height: auto;
  padding: 0;
  color: var(--color-text-1);
}
.username {
  margin: 0 10px;
  white-space: nowrap;
}
.about-description {
  margin: 16px 0;
  color: var(--color-text-3);
  line-height: 1.7;
}
@media (max-width: 767px) {
  .username,
  .environment-tag,
  .fullscreen-button {
    display: none;
  }
}
</style>
