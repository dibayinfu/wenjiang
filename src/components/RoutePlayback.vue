<script setup lang="ts">
import { computed, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue';
import { IconPause, IconPlayArrow, IconRefresh } from '@arco-design/web-vue/es/icon';
import { routeColors, formatRouteTime, routeFrame, type RouteFrame, type RouteSample } from '../utils/route-playback';

const props = defineProps<{ samples: RouteSample[]; issue?: string }>();
const emit = defineEmits<{ frame: [frame: RouteFrame | undefined] }>();
const playing = ref(false);
const speed = ref(20);
const elapsed = ref(0);
const duration = computed(() => props.samples.length ? props.samples.at(-1)!.timestamp - props.samples[0]!.timestamp : 0);
const frame = computed(() => props.samples.length ? routeFrame(props.samples, props.samples[0]!.timestamp + elapsed.value) : undefined);
const thumbPosition = computed(() => {
  const progress = duration.value ? elapsed.value / duration.value : 0;
  return `clamp(30px, calc(${progress * 100}% + ${8 - progress * 16}px), calc(100% - 30px))`;
});
const timeLabel = (timestamp: number) => formatRouteTime(timestamp, props.samples[0] && formatRouteTime(props.samples[0].timestamp, true).slice(0, 10) !== formatRouteTime(props.samples.at(-1)!.timestamp, true).slice(0, 10));
let animation = 0;
let previousTime: number | undefined;

function pause() {
  playing.value = false;
  cancelAnimationFrame(animation);
  previousTime = undefined;
}

function tick(now: number) {
  if (!playing.value) return;
  if (previousTime !== undefined) elapsed.value = Math.min(duration.value, elapsed.value + (now - previousTime) * speed.value);
  previousTime = now;
  if (elapsed.value >= duration.value) pause();
  else animation = requestAnimationFrame(tick);
}

function toggle() {
  if (playing.value) return pause();
  if (!duration.value) return;
  if (elapsed.value >= duration.value) elapsed.value = 0;
  playing.value = true;
  previousTime = performance.now();
  animation = requestAnimationFrame(tick);
}

function reset() {
  pause();
  elapsed.value = 0;
}

function seek(event: Event) {
  pause();
  elapsed.value = Number((event.target as HTMLInputElement).value) * 1000;
}

function visibilityChanged() {
  if (document.hidden) pause();
}

watch(() => props.samples, reset, { immediate: true });
watch(frame, value => emit('frame', value), { immediate: true });
onMounted(() => document.addEventListener('visibilitychange', visibilityChanged));
onDeactivated(pause);
onBeforeUnmount(() => {
  pause();
  document.removeEventListener('visibilitychange', visibilityChanged);
});
</script>

<template>
  <div class="route-playback" role="region" aria-label="轨迹播放控制">
    <span v-if="issue" class="playback-issue">{{ issue }}</span>
    <template v-else-if="frame">
      <a-button size="mini" :aria-label="playing ? '暂停轨迹' : '播放轨迹'" @click="toggle">
        <template #icon><IconPause v-if="playing" /><IconPlayArrow v-else /></template>
      </a-button>
      <a-button size="mini" aria-label="重置轨迹播放" @click="reset"><template #icon><IconRefresh /></template></a-button>
      <a-select v-model="speed" size="mini" aria-label="轨迹播放倍速"
        :options="[1, 5, 10, 20, 30, 60, 120].map(value => ({ label: `${value}×`, value }))" style="width: 76px; flex: 0 0 76px" />
      <time class="playback-time">{{ formatRouteTime(frame.timestamp, true).slice(0, 10) }}</time>
      <div class="playback-timeline">
        <div class="timeline-track">
          <time class="timeline-current" :style="{ left: thumbPosition }" :datetime="new Date(frame.timestamp).toISOString()"
            :title="formatRouteTime(frame.timestamp, true)">{{ formatRouteTime(frame.timestamp) }}</time>
          <input type="range" min="0" :max="duration / 1000" :value="elapsed / 1000" step="1" aria-label="轨迹时间轴"
            :aria-valuetext="formatRouteTime(frame.timestamp, true)" @input="seek" />
        </div>
        <div class="timeline-times">
          <time>{{ timeLabel(samples[0]!.timestamp) }}</time>
          <span class="playback-legend" aria-label="轨迹颜色说明">
            <span><i :style="{ background: routeColors.completed }" />已回放</span>
            <span><i :style="{ background: routeColors.remaining }" />未回放</span>
          </span>
          <time>{{ timeLabel(samples.at(-1)!.timestamp) }}</time>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.route-playback {
  position: absolute;
  z-index: 15;
  left: 50%;
  width: min(1040px, calc(100% - 64px));
  box-sizing: border-box;
  transform: translateX(-50%);
  bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  color: var(--color-text-1);
  background: var(--color-fill-2);
  border-radius: 6px;
  box-shadow: 0 2px 10px #0002;
}
.playback-time { font-size: 12px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.playback-timeline { flex: 1; min-width: 120px; }
.timeline-track { position: relative; padding-top: 14px; }
.timeline-current { position: absolute; top: 0; transform: translateX(-50%); font-size: 11px; line-height: 14px; white-space: nowrap; color: rgb(var(--primary-6)); font-variant-numeric: tabular-nums; pointer-events: none; }
.playback-timeline input { display: block; width: 100%; height: 12px; margin: 0; accent-color: rgb(var(--primary-6)); cursor: pointer; }
.timeline-times { display: flex; justify-content: space-between; font-size: 11px; color: var(--color-text-2); font-variant-numeric: tabular-nums; }
.playback-legend, .playback-legend > span { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.playback-legend { gap: 10px; }
.playback-legend i { width: 14px; height: 3px; border-radius: 2px; }
.playback-issue { font-size: 12px; }
@media (max-width: 700px) {
  .route-playback { width: calc(100% - 16px); flex-wrap: wrap; gap: 4px; padding: 4px 6px; }
  .playback-time { margin-inline-start: auto; font-size: 11px; }
  .playback-timeline { flex-basis: 100%; }
}
</style>
