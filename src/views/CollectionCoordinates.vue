<script setup lang="ts">
import { computed, nextTick, onDeactivated, ref, shallowRef, watch } from 'vue';
import { AutoComplete, Checkbox, Popover } from '@arco-design/web-vue';
import { IconClose, IconLeft, IconRight, IconSettings, IconUpload } from '@arco-design/web-vue/es/icon';
import PageHeader from '../components/PageHeader.vue';
import RoutePlayback from '../components/RoutePlayback.vue';
import { routeFrame, routeProgressPath, type RouteFrame } from '../utils/route-playback';
import { createCollectionMap, type MapCircle, type CollectionMap, type MapProvider } from '../utils/collection-map';
import { mapThemeOptions, readMapThemes, saveMapThemes, type MapTheme } from '../utils/map-themes';
import { gcj02ToBd09 } from '../utils/collection-coordinates';
import { collectionHistoryDates, loadCollectionHistory, type CollectionBatches } from '../utils/collection-history';
import { parseCollectionImport, parseFenceImport, parseRouteImport, type CollectionImportPoint } from '../utils/collection-import';
import { collectionMerchantNames, unmatchedCollectionCounts } from '../utils/collection-matching';
import { collectionSearchSuggestions, searchCollectionPoints, type CollectionSearchMode, type CollectionSearchResult } from '../utils/collection-search';
import recordsSample from '../mock/collection-samples/收运明细样例.json?url&no-inline';
import fencesSample from '../mock/collection-samples/商户收集点样例.json?url&no-inline';
import routeSample from '../mock/collection-samples/路线样例.json?url&no-inline';

defineOptions({ name: 'WenjiangCollectionCoordinates' });

type ImportKind = 'records' | 'fences' | 'route';

const recordsInput = ref<HTMLInputElement>();
const fencesInput = ref<HTMLInputElement>();
const routeInput = ref<HTMLInputElement>();
const mapElement = ref<HTMLElement>();
const mapToolbar = ref<HTMLElement>();
const selectedDate = ref<string | undefined>(collectionHistoryDates[0]);
const dateOptions = collectionHistoryDates.map(date => ({
    value: date,
    label: `20${date.slice(0, 2)}-${date.slice(2, 4)}-${date.slice(4, 6)}`,
  }));
const manualBatches = shallowRef<CollectionBatches>({});
const historyBatches = shallowRef<CollectionBatches>({});
const activeBatches = computed(() => selectedDate.value ? historyBatches.value : manualBatches.value);
const batch = computed(() => activeBatches.value.records);
const fenceBatch = computed(() => activeBatches.value.fences);
const routeBatch = computed(() => activeBatches.value.route);
const playbackFrame = shallowRef<RouteFrame>();
watch(routeBatch, () => { playbackFrame.value = undefined; }, { flush: 'sync' });
const selectedDetail = shallowRef<CollectionSearchResult>();
const selectedFenceRowIndex = ref(0);
const selectedFenceRow = computed(() => selectedDetail.value?.kind === 'fences' ? selectedDetail.value.point.rows[selectedFenceRowIndex.value] : undefined);
watch(selectedDetail, () => { selectedFenceRowIndex.value = 0; }, { flush: 'sync' });
const rfidKeyword = ref('');
const merchantKeyword = ref('');
const rfidSuggestions = computed(() => collectionSearchSuggestions(batch.value?.points ?? [], [], 'rfid', rfidKeyword.value));
const merchantSuggestions = computed(() => collectionSearchSuggestions(batch.value?.points ?? [], fenceBatch.value?.points ?? [], 'merchant', merchantKeyword.value));
const noSuggestions = computed(() => (rfidKeyword.value.trim() && !rfidSuggestions.value.length) || (merchantKeyword.value.trim() && !merchantSuggestions.value.length));
const searchResults = shallowRef<CollectionSearchResult[]>([]);
const searchIndex = ref(0);
const searchPerformed = ref(false);
const reading = ref<ImportKind>();
const importError = ref('');
const dateLoading = ref(false);
const dateError = ref('');
const mapLoading = ref(false);
const mapError = ref('');
const retry = ref(0);
const mapProvider = ref<MapProvider>('baidu');
const themePreferences = ref(readMapThemes());
const themeLoading = ref(false);
const themeError = ref('');
let themeRequest = 0;
const currentTheme = computed({
  get: () => themePreferences.value[mapProvider.value],
  set(value) {
    themePreferences.value[mapProvider.value] = value;
    saveMapThemes(themePreferences.value);
    void applyMapTheme(value);
  },
});
const mapProviderName = computed(() => mapProvider.value === 'baidu' ? '百度地图' : '高德地图');
const coordinateSystem = computed(() => mapProvider.value === 'baidu' ? 'BD-09' : 'GCJ-02');
function displayPosition(position: [number, number]) {
  return (mapProvider.value === 'baidu' ? gcj02ToBd09(position) : position).map(value => value.toFixed(6)).join('，');
}
const radius = ref(50);
const showNames = ref(false);
const highlightUnmatched = ref(false);
const canMatch = computed(() => Boolean(batch.value?.points.length && fenceBatch.value?.points.length));
const matchCounts = computed(() => highlightUnmatched.value && canMatch.value
  ? unmatchedCollectionCounts(batch.value!.points, fenceBatch.value!.points, radius.value)
  : new Map<CollectionImportPoint, number>());
const unmatchedPointCount = computed(() => [...matchCounts.value.values()].filter(count => count > 0).length);
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
    hint: `共 ${fenceBatch.value.total - fenceBatch.value.skipped} 个收集点，点击绿色围栏查看详情。${fenceBatch.value.corrected ? `已按真实系统地图校正 ${fenceBatch.value.corrected} 点。` : ''}`,
  },
  routeBatch.value && {
    kind: 'route', color: 'cyan', fileName: routeBatch.value.fileName,
    label: `路线 ${routeBatch.value.total}点`,
    skipped: routeBatch.value.skipped,
    hint: '浅青蓝为未回放轨迹，深青蓝为已回放轨迹；箭头表示行进方向。',
  },
].filter(layer => layer !== undefined));
let circles: MapCircle[] = [];
let activeMap: CollectionMap | undefined;
async function applyMapTheme(value: MapTheme) {
  const map = activeMap;
  if (!map) return;
  const request = ++themeRequest;
  const provider = mapProvider.value;
  themeLoading.value = true;
  themeError.value = '';
  try { await map.setTheme(value); }
  catch (error) {
    if (request !== themeRequest || map !== activeMap) return;
    themePreferences.value[provider] = 'normal';
    saveMapThemes(themePreferences.value);
    themeError.value = error instanceof Error ? error.message : '主题加载失败，请重试。';
  } finally {
    if (request === themeRequest) themeLoading.value = false;
  }
}
const recordFields = [
  ['所属商户', 'merchantName'],
  ['收集点', 'collectionPoint'],
  ['线路', 'routeName'],
  ['车牌', 'plateNumber'],
  ['收运时间', 'createTime'],
  ['重量', 'weight'],
  ['RFID', 'rfid'],
] as const;

function clearSearch() {
  searchResults.value = [];
  searchIndex.value = 0;
  searchPerformed.value = false;
}

function locateSearchResult(index: number) {
  const result = searchResults.value[index];
  if (!result) return;
  searchIndex.value = index;
  selectedDetail.value = result;
  if (result.kind === 'fences') {
    const index = result.point.rows.findIndex(row => row.merchantName.trim().toLowerCase() === merchantKeyword.value.trim().toLowerCase());
    selectedFenceRowIndex.value = Math.max(0, index);
  }
  activeMap?.locate(Math.max(activeMap.getZoom(), 17), result.point.position);
}

async function selectSearch(mode: CollectionSearchMode, value: string) {
  // AutoComplete 先触发 select，再更新输入值；等待输入更新后定位，避免结果被清空。
  await nextTick();
  if (mode === 'rfid') merchantKeyword.value = '';
  else rfidKeyword.value = '';
  searchResults.value = searchCollectionPoints(batch.value?.points ?? [], fenceBatch.value?.points ?? [], mode, value, true);
  searchPerformed.value = true;
  locateSearchResult(0);
}

watch([rfidKeyword, merchantKeyword], clearSearch, { flush: 'sync' });

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
    selectedDate.value = undefined;
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

watch([batch, fenceBatch, routeBatch, retry, mapProvider], async ([imported, importedFences, importedRoute], _, onCleanup) => {
  clearSearch();
  rfidKeyword.value = '';
  merchantKeyword.value = '';
  selectedDetail.value = undefined;
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
    // 独立容器隔离快速切换时尚未完成的 SDK 加载。
    const canvas = document.createElement('div');
    canvas.style.cssText = 'position:absolute;inset:0';
    element.replaceChildren(canvas);
    const map = await createCollectionMap(mapProvider.value, canvas, center, currentTheme.value);
    if (cancelled) { map.destroy(); canvas.remove(); return; }
    activeMap = map;
    void applyMapTheme(currentTheme.value);
    let observer: ResizeObserver | undefined;
    const stopEffects: (() => void)[] = [];
    disposeMap = () => {
      for (const stop of stopEffects) stop();
      observer?.disconnect();
      circles = [];
      activeMap = undefined;
      themeRequest++;
      themeLoading.value = false;
      themeError.value = '';
      map.destroy();
    };
    const routeLine = importedRoute ? map.route(importedRoute.path) : undefined;
    if (importedRoute?.samples.length) {
      const vehicle = document.createElement('div');
      vehicle.className = 'playback-position';
      vehicle.setAttribute('aria-label', '轨迹当前位置');
      const arrow = document.createElement('i');
      arrow.className = 'playback-direction';
      vehicle.append(arrow);
      const marker = map.marker(importedRoute.samples[0]!.position, vehicle, [-17, -17], undefined, 200);
      let progressTimer: number | undefined;
      let lastProgressAt = -Infinity;
      let pendingFrame: RouteFrame;
      const drawProgress = () => {
        progressTimer = undefined;
        lastProgressAt = performance.now();
        routeLine?.setProgress(routeProgressPath(importedRoute.samples, pendingFrame));
      };
      stopEffects.push(() => window.clearTimeout(progressTimer));
      stopEffects.push(watch(playbackFrame, value => {
        const frame = value ?? routeFrame(importedRoute.samples, importedRoute.samples[0]!.timestamp);
        marker.setPosition(frame.position);
        // 位置保持逐帧更新；折线最多每 100ms 更新一次，并补绘最后一帧。
        pendingFrame = frame;
        if (progressTimer === undefined) progressTimer = window.setTimeout(drawProgress, Math.max(0, 100 - (performance.now() - lastProgressAt)));
        arrow.style.transform = `rotate(${frame.heading}deg)`;
      }, { immediate: true }));
    }
    const fenceStyle = {
      strokeColor: '#00852e', strokeWeight: 2,
      fillColor: '#23a650', fillOpacity: 0.2, zIndex: 10,
    };
    for (const point of fencePoints) {
      const circle = map.circle(point.position, radius.value, fenceStyle, () => {
        selectedDetail.value = { kind: 'fences', point };
      });
      circles.push(circle);
    }
    const recordPins = new Map<CollectionImportPoint, HTMLElement>();
    for (const point of recordPoints) {
      const content = document.createElement('div');
      content.className = 'collection-record-marker';
      const pin = document.createElement('i');
      pin.className = 'collection-record-pin';
      content.append(pin);
      recordPins.set(point, content);
      map.marker(point.position, content, [-14, -33], () => {
        selectedDetail.value = { kind: 'records', point };
      });
    }

    let selectedCircle: MapCircle | undefined;
    let selectedPin: HTMLElement | undefined;
    stopEffects.push(watch(selectedDetail, detail => {
      selectedCircle?.setOptions(fenceStyle);
      selectedCircle = undefined;
      selectedPin?.classList.remove('selected');
      selectedPin = undefined;
      if (detail?.kind === 'fences') {
        selectedCircle = circles[fencePoints.indexOf(detail.point)];
        selectedCircle?.setOptions({
          strokeColor: '#006b27', strokeWeight: 3,
          fillColor: '#23a650', fillOpacity: 0.26, zIndex: 20,
        });
      } else if (detail?.kind === 'records') {
        selectedPin = recordPins.get(detail.point);
        selectedPin?.classList.add('selected');
      }
    }, { flush: 'sync' }));

    stopEffects.push(watch(matchCounts, counts => {
      for (const [point, content] of recordPins) {
        const count = counts.get(point) ?? 0;
        content.classList.toggle('unmatched', count > 0);
        content.title = `${collectionMerchantNames(point.rows).join('、') || '未填写所属商户'} · ${point.rows.length} 条记录${count ? ` · ${count} 条未匹配` : ''}`;
      }
    }, { immediate: true }));

    stopEffects.push(watch([showNames, matchCounts], ([visible], _, onCleanup) => {
      if (!visible) return;
      const items = [
        ...fencePoints.map(point => ({ position: point.position,
          text: collectionMerchantNames(point.rows).join('、') || '未填写所属商户', color: '#00852e',
          offset: [0, 8] as [number, number], click: () => { selectedDetail.value = { kind: 'fences', point }; } })),
        ...recordPoints.map(point => ({ position: point.position,
          text: collectionMerchantNames(point.rows).join('、') || '未填写所属商户',
          color: matchCounts.value.get(point) ? '#d03050' : '#165dff', offset: [0, -38] as [number, number],
          click: () => { selectedDetail.value = { kind: 'records', point }; } })),
      ];
      onCleanup(map.labels(items));
    }, { immediate: true }));

    let fitted = recordPoints.length === 1 && !fencePoints.length && !importedRoute;
    observer = new ResizeObserver(() => {
      element.parentElement?.style.setProperty('--map-toolbar-height', `${mapToolbar.value?.offsetHeight ?? 0}px`);
      if (!element.clientWidth || !element.clientHeight) return;
      map.resize();
      if (!fitted) {
        fitted = true;
        map.fit();
      }
    });
    observer.observe(element);
    if (mapToolbar.value) observer.observe(mapToolbar.value);
  } catch (cause) {
    if (cancelled) return;
    disposeMap?.();
    disposeMap = undefined;
    mapError.value = cause instanceof Error ? cause.message : `${mapProviderName.value}加载失败。`;
  } finally {
    if (!cancelled) mapLoading.value = false;
  }
}, { flush: 'post' });

onDeactivated(() => { selectedDetail.value = undefined; });
</script>

<template>
  <div class="gi_page page-content audit-map-page">
    <PageHeader title="核验地图" class="map-page-header">
      <div class="map-search-controls">
        <AutoComplete v-model="merchantKeyword" class="map-search-input" :data="merchantSuggestions" :filter-option="false" placeholder="输入商户名称搜索"
          aria-label="商户名称搜索" allow-clear :disabled="dateLoading || mapLoading" @select="(value: string) => selectSearch('merchant', value)" />
        <AutoComplete v-model="rfidKeyword" class="map-search-input" :data="rfidSuggestions" :filter-option="false" placeholder="输入 RFID 搜索"
          aria-label="RFID 搜索" allow-clear :disabled="dateLoading || mapLoading" @select="(value: string) => selectSearch('rfid', value)" />
        <div v-if="searchPerformed" class="search-results" role="status">
          <template v-if="searchResults.length">
            <a-button size="mini" aria-label="上一个搜索结果" :disabled="searchIndex === 0" @click="locateSearchResult(searchIndex - 1)"><IconLeft /></a-button>
            <span>{{ searchIndex + 1 }}/{{ searchResults.length }}</span>
            <a-button size="mini" aria-label="下一个搜索结果" :disabled="searchIndex === searchResults.length - 1" @click="locateSearchResult(searchIndex + 1)"><IconRight /></a-button>
          </template>
          <span v-else>无匹配结果</span>
        </div>
        <span v-else-if="noSuggestions" class="search-results" role="status">无匹配结果</span>
      </div>
      <div class="map-data-controls">
        <div class="map-date-controls">
          <template v-if="collectionHistoryDates.length">
            <span class="date-label">数据日期</span>
            <a-select v-model="selectedDate" :options="dateOptions" :disabled="!!reading"
              placeholder="导入模式" aria-label="收运数据日期" style="width: 150px" />
          </template>
          <input ref="recordsInput" type="file" accept=".json,application/json" hidden @change="importFile($event, 'records')" />
          <input ref="fencesInput" type="file" accept=".json,application/json" hidden @change="importFile($event, 'fences')" />
          <input ref="routeInput" type="file" accept=".json,application/json" hidden @change="importFile($event, 'route')" />
          <Popover trigger="click" position="br">
            <a-button aria-label="导入设置"><template #icon><IconSettings /></template></a-button>
            <template #content>
              <div class="import-settings">
                <strong>数据导入</strong>
                <div class="import-setting-row">
                  <div><span>收运明细</span><small>WGS-84 · data.list · lng / lat</small></div>
                  <a-space :size="4">
                    <a-button size="small" :loading="reading === 'records'" :disabled="!!reading && reading !== 'records'" @click="recordsInput?.click()">
                      <template #icon><IconUpload /></template>导入收运明细
                    </a-button>
                    <a :href="recordsSample" download="收运明细样例.json" aria-label="下载收运明细样例">格式样例</a>
                  </a-space>
                </div>
                <div class="import-setting-row">
                  <div><span>商户收集点</span><small>BD-09 · data.list · name / lng / lat</small></div>
                  <a-space :size="4">
                    <a-button size="small" :loading="reading === 'fences'" :disabled="!!reading && reading !== 'fences'" @click="fencesInput?.click()">
                      <template #icon><IconUpload /></template>导入商户收集点
                    </a-button>
                    <a :href="fencesSample" download="商户收集点样例.json" aria-label="下载商户收集点样例">格式样例</a>
                  </a-space>
                </div>
                <div class="import-setting-row">
                  <div><span>车辆路线</span><small>WGS-84 · data.positions · longitude / latitude</small></div>
                  <a-space :size="4">
                    <a-button size="small" :loading="reading === 'route'" :disabled="!!reading && reading !== 'route'" @click="routeInput?.click()">
                      <template #icon><IconUpload /></template>导入路线
                    </a-button>
                    <a :href="routeSample" download="路线样例.json" aria-label="下载路线样例">格式样例</a>
                  </a-space>
                </div>
              </div>
            </template>
          </Popover>
        </div>
        <div v-if="layerSummaries.length" class="layer-summaries" aria-label="当前日期数据统计" aria-live="polite">
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
      </div>
    </PageHeader>
    <a-alert v-if="importError || dateError" type="error">{{ importError || dateError }}</a-alert>

    <section class="panel map-panel" aria-label="收运坐标地图">
      <a-empty v-if="dateLoading" description="正在读取该日期的收运数据…" />
      <a-empty v-else-if="dateError" description="该日期数据暂时无法显示。" />
      <a-empty v-else-if="!layerSummaries.length" description="请选择收运明细、商户收集点或路线 JSON 文件，在地图上查看。" />
      <a-empty v-else-if="!hasOverlays" description="导入的文件中没有可显示的坐标。" />
      <template v-else>
        <div class="map-frame" :class="{ 'has-playback': !!routeBatch }">
          <div ref="mapElement" class="coordinate-map" role="region" :aria-label="`收运明细${mapProviderName}`" />
          <div ref="mapToolbar" class="import-toolbar">
            <div class="map-settings-control">
              <Popover trigger="click" position="br">
                <a-button size="small" aria-label="地图显示设置"><template #icon><IconSettings /></template></a-button>
                <template #content>
                  <div class="map-display-settings">
                    <div class="map-setting-field">
                      <span>地图切换</span>
                      <a-radio-group v-model="mapProvider" type="button" size="small" aria-label="地图切换">
                        <a-radio value="baidu">百度地图</a-radio>
                        <a-radio value="amap">高德地图</a-radio>
                      </a-radio-group>
                    </div>
                    <div class="map-setting-field">
                      <span>地图主题</span>
                      <a-select v-model="currentTheme" :options="mapThemeOptions[mapProvider]" :disabled="mapLoading || !!mapError" :loading="themeLoading"
                        size="small" aria-label="地图主题" />
                    </div>
                    <span v-if="themeError" class="theme-error" role="status">{{ themeError }}</span>
                    <div v-if="fenceBatch?.points.length" class="map-setting-field">
                      <span id="fence-radius-label">围栏半径</span>
                      <a-radio-group v-model="radius" type="button" size="mini" aria-labelledby="fence-radius-label">
                        <a-radio v-for="meters in [10, 20, 30, 50, 100]" :key="meters" :value="meters">{{ meters }} 米</a-radio>
                      </a-radio-group>
                    </div>
                    <Checkbox v-model="showNames">显示名称</Checkbox>
                    <Checkbox v-model="highlightUnmatched" :disabled="!canMatch">高亮未匹配收运点坐标</Checkbox>
                    <small>{{ canMatch ? '收运坐标位于同名商户的围栏内，才算匹配。' : '导入收运明细和收集点后可核对匹配情况。' }}</small>
                    <small v-if="highlightUnmatched && canMatch">未匹配 {{ unmatchedPointCount }} 个收运坐标点，以红色显示。</small>
                  </div>
                </template>
              </Popover>
            </div>
          </div>
          <RoutePlayback v-if="routeBatch" :samples="routeBatch.samples" :issue="routeBatch.playbackIssue" @frame="playbackFrame = $event" />
          <aside v-if="selectedDetail" class="map-detail" :aria-label="selectedDetail.kind === 'fences' ? '收集点详情' : '收运记录详情'">
            <div class="detail-heading">
              <h3>点位详情</h3>
              <a-tag size="small" class="detail-type-tag" :class="selectedDetail.kind">{{ selectedDetail.kind === 'fences' ? '收集点' : '收运坐标点' }}</a-tag>
              <span v-if="selectedDetail.point.rows.length > 1" class="detail-count">{{ selectedDetail.kind === 'fences' ? '重合' : '' }}{{ selectedDetail.point.rows.length }} {{ selectedDetail.kind === 'fences' ? '个' : '条' }}</span>
              <a-button type="text" size="mini" aria-label="关闭地图详情" @click="selectedDetail = undefined"><IconClose /></a-button>
            </div>
            <div class="detail-body">
              <template v-if="selectedDetail.kind === 'fences'">
                <a-select v-if="selectedDetail.point.rows.length > 1" v-model="selectedFenceRowIndex" class="overlap-selector" size="small"
                  aria-label="选择同坐标收集点" :options="selectedDetail.point.rows.map((row, index) => ({ label: row.name, value: index }))">
                  <template #option="{ data }"><span class="overlap-option">{{ data.label }}</span></template>
                </a-select>
                <a-descriptions v-if="selectedFenceRow" class="point-fields" :column="1" size="small" layout="vertical">
                  <a-descriptions-item label="收集点名称">{{ selectedFenceRow.name }}</a-descriptions-item>
                  <a-descriptions-item label="所属商户">{{ selectedFenceRow.merchantName }}</a-descriptions-item>
                  <a-descriptions-item label="地址">{{ selectedFenceRow.address }}</a-descriptions-item>
                  <a-descriptions-item label="坐标">
                    <a-tooltip :content="`${mapProviderName} ${coordinateSystem}（经度，纬度）；原始导出 BD-09 为 ${selectedDetail.point.sourcePosition.join('，')}${selectedDetail.point.mapSourcePosition ? `；已按真实系统地图 BD-09 ${selectedDetail.point.mapSourcePosition.join('，')} 校正` : ''}`">
                      <span>{{ displayPosition(selectedDetail.point.position) }}</span>
                    </a-tooltip>
                  </a-descriptions-item>
                  <a-descriptions-item label="更新时间">{{ selectedFenceRow.updateTime }}</a-descriptions-item>
                </a-descriptions>
              </template>
              <template v-else>
                <a-descriptions v-for="row in selectedDetail.point.rows" :key="row.id" class="point-fields" :column="1" size="small" layout="vertical">
                  <a-descriptions-item v-for="[label, field] in recordFields" :key="field" :label="label">{{ row[field] }}</a-descriptions-item>
                  <a-descriptions-item :label="`坐标（${coordinateSystem}）`">{{ displayPosition(selectedDetail.point.position) }}</a-descriptions-item>
                </a-descriptions>
              </template>
            </div>
          </aside>
          <div v-if="mapLoading || mapError" class="map-feedback" role="status">
            <a-spin v-if="mapLoading" />
            <span>{{ mapError || `${mapProviderName}加载中` }}</span>
            <a-button v-if="mapError" size="small" @click="retry++">重试</a-button>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.map-page-header :deep(.module-header-actions) { flex: 1; min-width: 0; justify-content: space-between; }
.map-page-header :deep(.module-header-actions > .arco-space-item:first-child) { flex: 1; min-width: 0; }
.map-search-controls, .map-date-controls { display: flex; align-items: center; gap: 8px; }
.map-search-controls { flex-wrap: wrap; width: 100%; }
.map-data-controls { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; max-width: 100%; }
.map-date-controls { flex-wrap: wrap; justify-content: flex-end; }
.date-label { font-size: 12px; color: var(--color-text-2); white-space: nowrap; }
.map-search-controls :deep(.map-search-input) { flex: 0 1 260px; width: 260px; max-width: 100%; }
.search-results { display: flex; align-items: center; gap: 4px; color: var(--color-text-2); font-size: 12px; white-space: nowrap; }
.audit-map-page > .map-panel { flex: 1 0 392px; min-height: 392px; display: flex; flex-direction: column; }
.import-settings { width: min(380px, calc(100vw - 64px)); }
.import-setting-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; margin-top: 12px; }
.import-setting-row > div:first-child { flex: 1 1 100%; }
.import-setting-row small { display: block; color: var(--color-text-3); overflow-wrap: anywhere; }
.import-setting-row a { color: rgb(var(--primary-6)); white-space: nowrap; }
.import-toolbar, .layer-summaries, .map-settings-control {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 8px;
}
.import-toolbar { position: absolute; z-index: 13; top: 12px; left: 12px; right: 12px; }
.layer-summaries { justify-content: flex-end; }
.map-settings-control { padding: 4px; background: var(--color-bg-2); border-radius: 4px; box-shadow: 0 2px 8px #0001; }
.map-settings-control { margin-inline-start: auto; color: var(--color-text-2); }
.map-display-settings { display: flex; flex-direction: column; gap: 10px; width: min(260px, calc(100vw - 64px)); }
.map-display-settings small { color: var(--color-text-3); }
.layer-summary { display: inline-flex; padding: 0; border: 0; background: none; }
.layer-details { max-width: 240px; overflow-wrap: anywhere; }
@media (max-width: 600px) {
  .map-page-header { align-items: stretch; }
  .map-page-header :deep(.module-header-actions > .arco-space-item:first-child) { flex-basis: 100%; }
  .map-page-header :deep(.module-header-actions > .arco-space-item:last-child) { margin-inline-start: auto; }
  .map-search-controls :deep(.map-search-input) { flex: 1 1 100%; width: 100%; }
  .layer-summaries { column-gap: 4px; }
  .layer-summary :deep(.arco-tag) { padding-inline: 4px; }
}
.map-frame {
  flex: 1;
  min-height: 360px;
  position: relative;
  overflow: hidden;
  border-radius: 4px;
  background: var(--color-fill-2);
}
.coordinate-map { position: absolute; inset: 0; }
.map-setting-field { display: flex; flex-direction: column; gap: 6px; }
.map-setting-field > span { font-size: 12px; color: var(--color-text-2); }
.theme-error { font-size: 12px; color: rgb(var(--danger-6)); }
.coordinate-map :deep(.playback-position) {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 2px solid #165dff;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 8px #165dff44;
  pointer-events: none;
}
.coordinate-map :deep(.playback-direction) {
  width: 15px;
  height: 19px;
  background: #165dff;
  clip-path: polygon(50% 0, 95% 100%, 50% 76%, 5% 100%);
}
.coordinate-map :deep(.collection-record-marker) { position: relative; width: 28px; height: 36px; cursor: pointer; }
.coordinate-map :deep(.collection-record-pin) {
  position: absolute;
  top: 1px;
  left: 1px;
  width: 26px;
  height: 26px;
  box-sizing: border-box;
  border: 2px solid #fff;
  border-radius: 50% 50% 50% 0;
  background: #4d94ff;
  transform: rotate(-45deg);
}
.coordinate-map :deep(.collection-record-marker.selected) { transform: scale(1.08); transform-origin: 14px 33px; }
.coordinate-map :deep(.collection-record-marker.selected .collection-record-pin) { box-shadow: 0 0 0 3px #165dff33; }
.coordinate-map :deep(.collection-record-marker.unmatched .collection-record-pin) { background: #f53f3f; }
.coordinate-map :deep(.collection-record-marker.unmatched.selected .collection-record-pin) { box-shadow: 0 0 0 3px #f53f3f33; }
.map-detail {
  position: absolute;
  z-index: 12;
  top: calc(var(--map-toolbar-height, 32px) + 24px);
  right: 12px;
  width: 300px;
  max-width: calc(100% - 24px);
  max-height: calc(100% - var(--map-toolbar-height, 32px) - 36px);
  display: flex;
  flex-direction: column;
  background: var(--color-bg-2);
  border-radius: 6px;
  box-shadow: 0 3px 14px #0002;
  overflow: hidden;
}
.has-playback .map-detail { max-height: calc(100% - var(--map-toolbar-height, 32px) - 120px); }
@media (max-width: 700px) {
  .has-playback .map-detail { max-height: calc(100% - var(--map-toolbar-height, 32px) - 148px); }
}
.overlap-selector { width: 100%; margin-bottom: 10px; }
.overlap-option { display: block; white-space: normal; overflow-wrap: anywhere; }
.detail-heading { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 8px 12px; border-bottom: 1px solid var(--color-border-2); }
.detail-heading h3 { flex: 1; min-width: 0; margin: 0; font-size: 14px; line-height: 20px; }
.map-detail .detail-type-tag { color: #fff; }
.map-detail .detail-type-tag.fences { background: #00852e; }
.map-detail .detail-type-tag.records { background: #165dff; }
.detail-body { min-height: 0; padding: 8px 12px 0; overflow: auto; overflow-wrap: anywhere; }
.detail-count { color: var(--color-text-3); font-size: 12px; white-space: nowrap; }
.point-fields + .point-fields { margin-top: 4px; padding-top: 10px; border-top: 1px solid var(--color-border-2); }
.point-fields :deep(table) { width: 100%; table-layout: fixed; }
.point-fields :deep(.arco-descriptions-item-label),
.point-fields :deep(.arco-descriptions-item-value) { font-size: 12px; line-height: 18px; }
.point-fields :deep(.arco-descriptions-item-label) { padding: 0 0 2px; white-space: normal; }
.point-fields :deep(.arco-descriptions-item-value) { padding: 0 0 6px; white-space: normal; overflow-wrap: anywhere; }
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
