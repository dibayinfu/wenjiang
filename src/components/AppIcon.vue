<script setup lang="ts">
import type { Component } from "vue";
import {
  IconDashboard,
  IconSchedule,
  IconHome,
  IconArrowRight,
  IconPlus,
  IconDownload,
  IconRefresh,
  IconStorage,
  IconCheck,
  IconClockCircle,
  IconLocation,
  IconInfoCircle,
  IconMenuFold,
  IconSafe,
} from "@arco-design/web-vue/es/icon";
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 });
const icons: Record<string, Component> = {
  dashboard: IconDashboard,
  truck: IconSchedule,
  shop: IconHome,
  arrow: IconArrowRight,
  plus: IconPlus,
  download: IconDownload,
  refresh: IconRefresh,
  weight: IconStorage,
  check: IconCheck,
  clock: IconClockCircle,
  pin: IconLocation,
  info: IconInfoCircle,
  menu: IconMenuFold,
  leaf: IconSafe,
};
</script>
<template>
  <component
    :is="icons[name] || IconDashboard"
    :size="size"
    aria-hidden="true"
  />
</template>
