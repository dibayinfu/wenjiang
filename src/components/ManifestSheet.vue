<script setup lang="ts">
import {ref,watch} from 'vue';
import type {DailyManifest} from '../mock/daily-manifests';
import {renderManifestPage} from '../utils/manifest-template';
const props=defineProps<{document:DailyManifest}>();
const image=ref('');let request=0;
watch(()=>props.document,async()=>{const current=++request;const canvas=await renderManifestPage(props.document);if(current===request)image.value=canvas.toDataURL('image/png');},{immediate:true});
</script>
<template><img v-if="image" :src="image" class="manifest-sheet" alt="成都市餐厨垃圾管理联单"/><a-spin v-else/></template>
<style scoped>.manifest-sheet{display:block;width:100%;height:auto;background:white}</style>
