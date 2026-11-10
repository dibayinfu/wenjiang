<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { Popover } from '@arco-design/web-vue';
import { IconUpload } from '@arco-design/web-vue/es/icon';
import PageHeader from '../components/PageHeader.vue';
import { loadAmapJsApi, type AMapCircle } from '../utils/amap';
import { collectionHistoryDates, loadCollectionHistory, type CollectionBatches } from '../utils/collection-history';
import { parseCollectionImport, parseFenceImport, parseRouteImport, type CollectionImportPoint } from '../utils/collection-import';

defineOptions({ name: 'WenjiangCollectionCoordinates' });

type ImportKind = 'records' | 'fences' | 'route';

const recordsInput = ref<HTMLInputElement>();
const fencesInput = ref<HTMLInputElement>();
const routeInput = ref<HTMLInputElement>();
const mapElement = ref<HTMLElement>();
const selectedDate = ref(collectionHistoryDates[0] ?? '');
const dateOptions = [
  ...collectionHistoryDates.map(date => ({
    value: date,
    label: `20${date.slice(0, 2)}-${date.slice(2, 4)}-${date.slice(4, 6)}`,
  })),
  { value: '', label: '手动导入' },
];
const manualBatches = shallowRef<CollectionBatches>({});
const historyBatches = shallowRef<CollectionBatches>({});
const activeBatches = computed(() => selectedDate.value ? historyBatches.value : manualBatches.value);
const batch = computed(() => activeBatches.value.records);
const fenceBatch = computed(() => activeBatches.value.fences);
const routeBatch = computed(() => activeBatches.value.route);
const reading = ref<ImportKind>();
const importError = ref('');
const dateLoading = ref(false);
const dateError = ref('');
const mapLoading = ref(false);
const mapError = ref('');
const retry = ref(0);
const radius = ref(50);
const hasOverlays = computed(() => Boolean(batch.value?.points.length || fenceBatch.value?.points.length || routeBatch.value));
const layerSummaries = computed(() => [
  batch.value && {
    kind: 'records', color: 'arcoblue', fileName: batch.value.fileName,
    label: `收运 ${batch.value.total}条 / ${batch.value.points.length}点`,
    skipped: batch.value.skipped,
    hint: '点击地图标记查看该位置的收运记录。',
  },
  fenceBatch.value && {
    kind: 'fences', color: 'green', fileName: fenceBatch.value.fileName,
    label: `围栏 ${fenceBatch.value.points.length}处 / ${fenceBatch.value.total - fenceBatch.value.skipped}点`,
    skipped: fenceBatch.value.skipped,
    hint: `共 ${fenceBatch.value.total - fenceBatch.value.skipped} 个收集点，点击绿色围栏查看名称。`,
  },
  routeBatch.value && {
    kind: 'route', color: 'purple', fileName: routeBatch.value.fileName,
    label: `路线 ${routeBatch.value.total}点`,
    skipped: routeBatch.value.skipped,
    hint: '紫色折线为车辆路线，箭头表示行进方向。',
  },
].filter(layer => layer !== undefined));
let circles: AMapCircle[] = [];
const recordFields = [
  ['商户', 'merchantName'],
  ['收集点', 'collectionPoint'],
  ['线路', 'routeName'],
  ['车牌', 'plateNumber'],
  ['收运时间', 'createTime'],
  ['重量', 'weight'],
  ['RFID', 'rfid'],
] as const;

function createRecordPopup(point: CollectionImportPoint) {
  const content = document.createElement('div');
  content.className = 'record-popup';
  const title = document.createElement('strong');
  title.textContent = `收运明细 · ${point.rows.length} 条记录`;
  const coordinates = document.createElement('small');
  coordinates.textContent = `GCJ-02 · 经度 ${point.position[0].toFixed(6)} · 纬度 ${point.position[1].toFixed(6)}`;

  const list = document.createElement('div');
  list.className = 'record-popup-list';
  list.tabIndex = 0;
  list.setAttribute('role', 'region');
  list.setAttribute('aria-label', '该点位的收运记录');
  list.addEventListener('wheel', event => event.stopPropagation(), { passive: true });
  for (const row of point.rows) {
    const details = document.createElement('dl');
    for (const [label, field] of recordFields) {
      const term = document.createElement('dt');
      const value = document.createElement('dd');
      term.textContent = label;
      value.textContent = row[field];
      details.append(term, value);
    }
    list.append(details);
  }
  content.append(title, coordinates, list);
  return content;
}

async function importFile(event: Event, kind: ImportKind) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || reading.value) return;

  reading.value = kind;
  importError.value = '';
  try {
    const content = await file.text();
    if (kind === 'fences') {
      manualBatches.value = { ...manualBatches.value, fences: { ...parseFenceImport(content), fileName: file.name } };
    } else if (kind === 'route') {
      manualBatches.value = { ...manualBatches.value, route: { ...parseRouteImport(content), fileName: file.name } };
    } else {
      manualBatches.value = { ...manualBatches.value, records: { ...parseCollectionImport(content), fileName: file.name } };
    }
    selectedDate.value = '';
  } catch (cause) {
    importError.value = cause instanceof Error ? cause.message : '文件读取失败。';
  } finally {
    reading.value = undefined;
  }
}

watch(selectedDate, async (date, _, onCleanup) => {
  historyBatches.value = {};
  dateError.value = '';
  dateLoading.value = Boolean(date);
  if (!date) return;

  importError.value = '';
  const controller = new AbortController();
  onCleanup(() => controller.abort());
  const isCurrent = () => !controller.signal.aborted && selectedDate.value === date;
  try {
    const imported = await loadCollectionHistory(date, controller.signal);
    if (isCurrent()) historyBatches.value = imported;
  } catch (cause) {
    if (isCurrent()) dateError.value = cause instanceof Error ? cause.message : '读取日期数据失败。';
  } finally {
    if (isCurrent()) dateLoading.value = false;
  }
}, { immediate: true });

watch(radius, value => {
  for (const circle of circles) circle.setRadius(value);
});

watch([batch, fenceBatch, routeBatch, retry], async ([imported, importedFences, importedRoute], _, onCleanup) => {
  const element = mapElement.value;
  const recordPoints = imported?.points ?? [];
  const fencePoints = importedFences?.points ?? [];
  const center = recordPoints[0]?.position ?? fencePoints[0]?.position ?? importedRoute?.path[0];
  mapError.value = '';
  mapLoading.value = Boolean(center && element);
  if (!center || !element) return;

  let cancelled = false;
  let disposeMap: (() => void) | undefined;
  onCleanup(() => {
    cancelled = true;
    disposeMap?.();
  });

  try {
    const amap = await loadAmapJsApi();
    if (cancelled) return;

    const map = new amap.Map(element, {
      center,
      zoom: 17,
      viewMode: '2D',
      mapStyle: 'amap://styles/whitesmoke',
    });
    let observer: ResizeObserver | undefined;
    disposeMap = () => {
      observer?.disconnect();
      circles = [];
      map.destroy();
    };
    if (importedRoute) {
      map.add(new amap.Polyline({
        path: importedRoute.path,
        strokeColor: '#722ed1',
        strokeOpacity: 0.9,
        strokeWeight: 5,
        lineJoin: 'round',
        lineCap: 'round',
        showDir: true,
        bubble: true,
        zIndex: 8,
      }));
    }
    const popup = new amap.InfoWindow({});
    for (const point of fencePoints) {
      const circle = new amap.Circle({
        center: point.position,
        radius: radius.value,
        strokeColor: '#00852e',
        strokeWeight: 2,
        fillColor: '#23a650',
        fillOpacity: 0.2,
        zIndex: 10,
      });
      circle.on('click', () => {
        const content = document.createElement('div');
        content.className = 'fence-names';
        for (const name of point.names) {
          const label = document.createElement('div');
          label.textContent = name;
          content.appendChild(label);
        }
        popup.setContent(content);
        popup.open(map, point.position);
      });
      circle.setMap(map);
      circles.push(circle);
    }
    for (const point of recordPoints) {
      const marker = new amap.Marker({
        position: point.position,
        title: `${point.rows[0]!.merchantName} · ${point.rows.length} 条记录`,
      });
      marker.on('click', () => {
        popup.setContent(createRecordPopup(point));
        popup.open(map, point.position);
      });
      marker.setMap(map);
    }

    let fitted = recordPoints.length === 1 && !fencePoints.length && !importedRoute;
    observer = new ResizeObserver(() => {
      if (!element.clientWidth || !element.clientHeight) return;
      map.resize();
      if (!fitted) {
        fitted = true;
        map.setFitView(undefined, true, [40, 40, 40, 40]);
      }
    });
    observer.observe(element);
  } catch (cause) {
    if (cancelled) return;
    disposeMap?.();
    disposeMap = undefined;
    mapError.value = cause instanceof Error ? cause.message : '高德地图加载失败。';
  } finally {
    if (!cancelled) mapLoading.value = false;
  }
}, { flush: 'post' });
</script>

<template>
  <div class="gi_page page-content">
    <PageHeader title="收运核查地图">
      <a-select v-if="collectionHistoryDates.length" v-model="selectedDate" :options="dateOptions"
        :disabled="!!reading" aria-label="收运数据日期" style="width: 150px" />
      <input ref="recordsInput" type="file" accept=".json,application/json" hidden @change="importFile($event, 'records')" />
      <input ref="fencesInput" type="file" accept=".json,application/json" hidden @change="importFile($event, 'fences')" />
      <input ref="routeInput" type="file" accept=".json,application/json" hidden @change="importFile($event, 'route')" />
      <a-button type="primary" :loading="reading === 'records'" :disabled="!!reading && reading !== 'records'" @click="recordsInput?.click()">
        <template #icon><IconUpload /></template>
        导入收运明细
      </a-button>
      <a-button :loading="reading === 'fences'" :disabled="!!reading && reading !== 'fences'" @click="fencesInput?.click()">
        <template #icon><IconUpload /></template>
        导入商户收集点
      </a-button>
      <a-button :loading="reading === 'route'" :disabled="!!reading && reading !== 'route'" @click="routeInput?.click()">
        <template #icon><IconUpload /></template>
        导入路线
      </a-button>
    </PageHeader>
    <a-alert v-if="importError || dateError" type="error">{{ importError || dateError }}</a-alert>

    <section class="panel" aria-label="收运坐标地图">
      <div v-if="layerSummaries.length" class="import-toolbar">
        <div class="layer-summaries" aria-live="polite">
          <Popover v-for="layer in layerSummaries" :key="layer.kind" :trigger="['hover', 'click']" position="bl">
            <button type="button" class="layer-summary" :aria-label="`${layer.label}，查看导入信息`">
              <a-tag size="small" :color="layer.skipped ? 'orange' : layer.color">
                {{ layer.label }}<template v-if="layer.skipped"> · 跳过 {{ layer.skipped }}</template>
              </a-tag>
            </button>
            <template #content>
              <div class="layer-details">
                <strong>{{ layer.fileName }}</strong>
                <div>{{ layer.hint }}</div>
                <div v-if="layer.skipped">已跳过 {{ layer.skipped }} 条无效数据。</div>
              </div>
            </template>
          </Popover>
        </div>
        <div v-if="fenceBatch?.points.length" class="radius-control">
          <span id="fence-radius-label">围栏半径</span>
          <a-radio-group v-model="radius" type="button" size="small" aria-labelledby="fence-radius-label">
            <a-radio v-for="meters in [30, 50, 100]" :key="meters" :value="meters">{{ meters }} 米</a-radio>
          </a-radio-group>
        </div>
      </div>
      <a-empty v-if="dateLoading" description="正在读取该日期的收运数据…" />
      <a-empty v-else-if="dateError" description="该日期数据暂时无法显示。" />
      <a-empty v-else-if="!layerSummaries.length" description="请选择收运明细、商户收集点或路线 JSON 文件，在高德地图上查看。" />
      <a-empty v-else-if="!hasOverlays" description="导入的文件中没有可显示的坐标。" />
      <template v-else>
        <div class="map-frame">
          <div ref="mapElement" class="coordinate-map" role="region" aria-label="收运明细高德地图" />
          <div v-if="mapLoading || mapError" class="map-feedback" role="status">
            <a-spin v-if="mapLoading" />
            <span>{{ mapError || '高德地图加载中' }}</span>
            <a-button v-if="mapError" size="small" @click="retry++">重试</a-button>
          </div>
        </div>
      </template>
    </section>

  </div>
</template>

<style scoped>
.import-toolbar, .layer-summaries, .radius-control {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 8px;
}
.import-toolbar { margin-bottom: 8px; }
.radius-control { margin-inline-start: auto; color: var(--color-text-2); }
.layer-summary { display: inline-flex; padding: 0; border: 0; background: none; }
.layer-details { max-width: 240px; overflow-wrap: anywhere; }
@media (max-width: 600px) {
  .layer-summaries { column-gap: 4px; }
  .layer-summary :deep(.arco-tag) { padding-inline: 4px; }
}
.map-frame {
  position: relative;
  overflow: hidden;
  border-radius: 4px;
  background: var(--color-fill-2);
}
.coordinate-map { height: clamp(350px, 62vh, 720px); }
.coordinate-map :deep(.fence-names) {
  max-width: 240px;
  max-height: 180px;
  overflow: auto;
  overflow-wrap: anywhere;
}
.coordinate-map :deep(.record-popup) { width: min(280px, calc(100vw - 96px)); }
.coordinate-map :deep(.record-popup small) {
  display: block;
  margin: 4px 0 6px;
  opacity: 0.75;
}
.coordinate-map :deep(.record-popup-list) {
  max-height: min(240px, 34vh);
  overflow: auto;
  overscroll-behavior: contain;
}
.coordinate-map :deep(.record-popup-list dl) {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 3px 10px;
  margin: 0;
  padding: 8px 0;
  border-top: 1px solid var(--color-border-2);
}
.coordinate-map :deep(.record-popup-list dd) { margin: 0; overflow-wrap: anywhere; }
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
</style>
