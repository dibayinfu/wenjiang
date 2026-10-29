<script setup lang="ts">
import { useAppStore } from "./stores/app";
useAppStore().initTheme();
</script>

<template>
  <a-config-provider update-at-scroll><RouterView /></a-config-provider>
</template>
