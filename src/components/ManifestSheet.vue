<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import type { DailyManifest } from '../mock/daily-manifests';
import { manifestPrintHtml } from '../utils/manifest-print-layout';
import { manifestPaper } from '../utils/manifest-template';
const props = defineProps<{ document: DailyManifest }>();
const container = ref<HTMLElement>();
const width = ref(688);
const nativeWidth = manifestPaper.widthMm / 25.4 * 96;
const nativeHeight = manifestPaper.heightMm / 25.4 * 96;
const source = computed(() => manifestPrintHtml(props.document));
const observer = new ResizeObserver(entries => { width.value = entries[0]!.contentRect.width; });
onMounted(() => { if (container.value) observer.observe(container.value); });
onBeforeUnmount(() => observer.disconnect());
</script>
<template>
 <div ref="container" class="manifest-sheet" :style="{ aspectRatio: `${manifestPaper.widthMm} / ${manifestPaper.heightMm}` }">
  <iframe :srcdoc="source" title="餐厨垃圾收运五联单预览" scrolling="no"
   :style="{ width: `${nativeWidth}px`, height: `${nativeHeight}px`, transform: `scale(${width / nativeWidth})` }" />
 </div>
</template>
<style scoped>
.manifest-sheet { position:relative; display:block; width:688px; max-width:100%; background:white; }
iframe { position:absolute; top:0; left:0; border:0; transform-origin:top left; }
</style>
