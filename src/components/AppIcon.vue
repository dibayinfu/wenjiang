<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 });
const paths: Record<string, string[]> = {
  dashboard: ["M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"],
  truck: [
    "M2 6h12v11H2zM14 10h4l4 4v3h-8",
    "M7 19a2 2 0 1 0-4 0 2 2 0 0 0 4 0ZM21 19a2 2 0 1 0-4 0 2 2 0 0 0 4 0Z",
  ],
  shop: [
    "M4 10v11h16V10M3 10l2-7h14l2 7M3 10c0 4 6 4 6 0 0 4 6 4 6 0 0 4 6 4 6 0M9 21v-7h6v7",
  ],
  arrow: ["M5 12h14M14 7l5 5-5 5"],
  plus: ["M12 5v14M5 12h14"],
  download: ["M12 3v12M7 10l5 5 5-5M4 16v5h16v-5"],
  refresh: ["M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 14 6M18 18A8 8 0 0 1 4 12"],
  weight: ["M5 8h14l3 13H2L5 8ZM8 8V6a4 4 0 0 1 8 0v2M12 12v4"],
  check: ["M5 12l4 4L19 6"],
  clock: ["M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0ZM12 6v6l4 2"],
  pin: [
    "M19 10c0 6-7 11-7 11S5 16 5 10a7 7 0 1 1 14 0ZM15 10a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z",
  ],
  info: ["M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0ZM12 11v6M12 7v.2"],
  menu: ["M4 6h16M4 12h16M4 18h16"],
  leaf: ["M20 3C8 2 2 8 5 16c8 6 16-1 15-13ZM5 20 15 9"],
};
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.65"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(d, i) in paths[name] || paths.dashboard" :key="i" :d="d" />
  </svg>
</template>
