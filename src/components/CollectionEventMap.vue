<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Weighing } from '../mock/sanitation';
import { demo, merchantName } from '../mock/store';
import { pointLocation, WENJIANG_CENTER } from '../mock/point-location';
import { loadAmapJsApi, type AMapInstance } from '../utils/amap';
import { fenceContains, isMapCoordinate, isPointFence } from '../utils/point-fence';

const props = defineProps<{ record: Weighing }>();
const element = ref<HTMLElement>();
const loading = ref(true);
const error = ref('');
const ready = ref(false);
const position = computed(() => isMapCoordinate(props.record.gps) ? props.record.gps : undefined);
const fences = computed(() => demo.points.flatMap(point => {
  const fence = point.fence;
  if (!isPointFence(fence)) return [];
  return [{ point, fence, hit: !!position.value && fenceContains(fence, position.value) }];
}));
const hits = computed(() => fences.value.filter(({ hit }) => hit));
const result = computed(() => {
  if (!position.value) return '缺少 GPS 坐标，无法判断';
  if (!fences.value.length) return '暂无已配置的围栏，无法判断';
  return hits.value.length ? `命中 ${hits.value.length} 个收集点围栏` : '未命中任何收集点围栏';
});
const fenceColor = '#165dff';
const hitColor = '#d46b08';
let map: AMapInstance | undefined;
let observer: ResizeObserver | undefined;
let disposed = false;

function locateBucket() {
  if (position.value) map?.setZoomAndCenter(17, position.value);
}

function fitFences() {
  if (fences.value.length) map?.setFitView(undefined, true, [28, 28, 28, 28]);
}

async function init() {
  loading.value = true;
  error.value = '';
  try {
    const amap = await loadAmapJsApi();
    if (disposed || !element.value) return;
    const instance = map = new amap.Map(element.value, {
      center: position.value ?? WENJIANG_CENTER,
      zoom: position.value ? 17 : 13,
      viewMode: '2D',
      mapStyle: 'amap://styles/whitesmoke',
      resizeEnable: true,
    });
    const labels = new amap.LabelsLayer({ collision: true, allowCollision: false, zIndex: 120 });
    const namePopup = new amap.InfoWindow({ offset: new amap.Pixel(0, -8) });
    labels.add(fences.value.map(({ point, fence, hit }) => {
      const color = hit ? hitColor : fenceColor;
      const paint = { strokeColor: color, fillColor: color, strokeWeight: hit ? 3 : 2, fillOpacity: hit ? .28 : .14, zIndex: hit ? 12 : 10 };
      const shape = fence.type === 'circle'
        ? new amap.Circle({ ...paint, center: fence.center, radius: fence.radius })
        : new amap.Polygon({ ...paint, path: fence.path });
      shape.setMap(instance);
      const location = pointLocation(point);
      const anchor = fence.type === 'circle' ? fence.center : fenceContains(fence, location) ? location : fence.path[0]!;
      shape.on('click', () => {
        const name = document.createElement('strong');
        name.textContent = point.name;
        namePopup.setContent(name);
        namePopup.open(instance, anchor);
      });
      return new amap.LabelMarker({
        position: anchor,
        rank: hit ? 2 : 1,
        text: {
          content: point.name,
          direction: 'bottom',
          offset: [0, 6],
          style: { fontSize: 12, fillColor: color, strokeColor: '#fff', strokeWidth: 3 },
        },
      });
    }));
    instance.add(labels);
    if (position.value) {
      new amap.Marker({ position: position.value, title: '收运桶 GPS 位置', zIndex: 100 }).setMap(map);
    } else {
      fitFences();
    }
    observer = new ResizeObserver(() => map?.resize());
    observer.observe(element.value);
    ready.value = true;
  } catch (cause) {
    map?.destroy();
    map = undefined;
    error.value = cause instanceof Error ? cause.message : '地图加载失败';
  } finally {
    loading.value = false;
  }
}

onMounted(init);
onBeforeUnmount(() => {
  disposed = true;
  observer?.disconnect();
  map?.destroy();
});
</script>

<template>
  <a-descriptions :column="{ xs: 1, sm: 2 }" bordered>
    <a-descriptions-item label="RFID">{{ record.rfid }}</a-descriptions-item>
    <a-descriptions-item label="记录所属商户">{{ merchantName(record.merchantId) }}</a-descriptions-item>
    <a-descriptions-item label="模拟 GPS（GCJ-02）">
      <template v-if="position">经度 {{ position[0].toFixed(6) }}，纬度 {{ position[1].toFixed(6) }}</template>
      <template v-else>缺少坐标</template>
    </a-descriptions-item>
    <a-descriptions-item label="采集时间">{{ record.collectedAt }}</a-descriptions-item>
  </a-descriptions>

  <div class="fence-result" aria-live="polite">
    <a-tag :color="hits.length ? 'orange' : 'gray'">{{ result }}</a-tag>
    <span v-for="{ point } in hits" :key="point.id">
      {{ point.name }}（{{ merchantName(point.merchantId) }}）
    </span>
  </div>

  <div class="event-map-frame">
    <div ref="element" class="event-map" role="region" aria-label="收运桶位置及收集点围栏地图" />
    <div v-if="loading || error" class="map-feedback">
      <a-spin v-if="loading" />
      <span>{{ error || '高德地图加载中' }}</span>
      <a-button v-if="error" size="small" @click="init">重试</a-button>
    </div>
  </div>

  <div class="map-footer">
    <div class="map-legend">
      <span><i :style="{ borderColor: fenceColor }" />收集点围栏（{{ fences.length }}）</span>
      <span><i :style="{ borderColor: hitColor }" />命中围栏</span>
      <span>点击围栏查看名称</span>
    </div>
    <a-space wrap>
      <a-button size="small" :disabled="!ready || !position" @click="locateBucket">定位收运桶</a-button>
      <a-button size="small" :disabled="!ready || !fences.length" @click="fitFences">查看全部围栏</a-button>
    </a-space>
  </div>
</template>

<style scoped>
.fence-result, .map-footer, .map-legend {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 16px;
}
.fence-result { margin: 12px 0; }
.event-map-frame {
  position: relative;
  overflow: hidden;
  border-radius: 4px;
  background: var(--color-fill-2);
}
.event-map { height: clamp(280px, 48vh, 520px); }
.map-feedback {
  position: absolute;
  inset: 0;
  z-index: 8;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--color-bg-2);
}
.map-footer { justify-content: space-between; margin-top: 12px; }
.map-legend { color: var(--color-text-2); }
.map-legend i {
  display: inline-block;
  width: 12px;
  height: 8px;
  margin-right: 5px;
  border: 2px solid;
  border-radius: 2px;
}
</style>
