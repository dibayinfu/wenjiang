<script setup lang="ts">
import { computed, nextTick, onActivated, onDeactivated, ref, shallowRef, watch } from 'vue';
import { AutoComplete, Checkbox, Popover } from '@arco-design/web-vue';
import { IconClose, IconLeft, IconRight, IconRefresh, IconSettings, IconUpload } from '@arco-design/web-vue/es/icon';
import PageHeader from '../components/PageHeader.vue';
import CollectionLoginModal from '../components/CollectionLoginModal.vue';
import { collectionVehicles } from '../mock/collection-vehicles';
import { collectionApi, collectionAuth } from '../utils/collection-auth';
import { COLLECTION_MIN_DATE, collectionToday, createCollectionOnlineLoader, type CollectionOnlineUpdate } from '../utils/collection-online';
import RoutePlayback from '../components/RoutePlayback.vue';
import { routeFrame, routeProgressPath, type RouteFrame } from '../utils/route-playback';
import { createCollectionMap, type MapFence, type CollectionMap, type MapProvider } from '../utils/collection-map';
import { mapThemeOptions, readMapThemes, saveMapThemes, type MapTheme } from '../utils/map-themes';
import { collectionFenceGeometry } from '../utils/collection-fence-geometry';
import { gcj02ToBd09 } from '../utils/collection-coordinates';
import { collectionHistoryDates, loadCollectionHistory, type CollectionBatches } from '../utils/collection-history';
import { parseCollectionImport, parseFenceImport, parseRouteImport, type CollectionImportPoint } from '../utils/collection-import';
import { collectionMerchantNames, unmatchedCollectionRows } from '../utils/collection-matching';
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
const dataSource = ref<'online' | 'history' | 'manual'>('online');
const onlineDate = ref(collectionToday(new Date(Date.now() - 86400000)));
const selectedVehicle = ref(collectionVehicles[0]!.truckId);
const vehicleOptions = collectionVehicles.map(vehicle => ({ value: vehicle.truckId, label: vehicle.label }));
const refreshVersion = ref(0);
const onlineBatches = shallowRef<CollectionBatches>({});
const onlineWarnings = ref<string[]>([]);
const onlineUpdated = ref('');
const onlineProgress = ref('');
const onlineLayers = shallowRef<CollectionOnlineUpdate['layers']>();
const mapReady = shallowRef<CollectionMap>();
const mapRendering = ref(false);
let disposeLayers: (() => void) | undefined;
const loadOnline = createCollectionOnlineLoader(collectionApi);
let onlineController: AbortController | undefined;
function disabledOnlineDate(date: Date) {
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return day < COLLECTION_MIN_DATE || day > collectionToday();
}
const dateOptions = collectionHistoryDates.map(date => ({
    value: date,
    label: `20${date.slice(0, 2)}-${date.slice(2, 4)}-${date.slice(4, 6)}`,
  }));
const manualBatches = shallowRef<CollectionBatches>({});
const historyBatches = shallowRef<CollectionBatches>({});
const activeBatches = computed(() => dataSource.value === 'online' ? onlineBatches.value : dataSource.value === 'history' ? historyBatches.value : manualBatches.value);
const batch = computed(() => activeBatches.value.records);
const fenceBatch = computed(() => activeBatches.value.fences);
const routeBatch = computed(() => activeBatches.value.route);
const playbackFrame = shallowRef<RouteFrame>();
watch(routeBatch, () => { playbackFrame.value = undefined; }, { flush: 'sync' });
const selectedDetail = shallowRef<CollectionSearchResult>();
const selectedFenceRowIndex = ref(0);
const selectedRecordRowIndex = ref(0);
const selectedFenceRow = computed(() => selectedDetail.value?.kind === 'fences' ? selectedDetail.value.point.rows[selectedFenceRowIndex.value] : undefined);
const selectedRecordRows = computed(() => selectedDetail.value?.kind === 'records' ? selectedDetail.value.point.rows.slice(selectedRecordRowIndex.value, selectedRecordRowIndex.value + 1) : []);
watch(selectedDetail, () => { selectedFenceRowIndex.value = 0; selectedRecordRowIndex.value = 0; }, { flush: 'sync' });
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
const radius = ref(0);
const showNames = ref(false);
const highlightUnmatched = ref(true);
const canMatch = computed(() => Boolean(batch.value?.points.length && fenceBatch.value?.points.length)
  && (dataSource.value !== 'online' || (onlineLayers.value?.fences.status === 'complete' && onlineLayers.value.records.status === 'complete')));
const unmatchedRows = computed(() => highlightUnmatched.value && canMatch.value
  ? unmatchedCollectionRows(batch.value!.points, fenceBatch.value!.points, radius.value)
  : new Map<CollectionImportPoint, CollectionImportPoint['rows']>());
const matchCounts = computed(() => new Map([...unmatchedRows.value].map(([point, rows]) => [point, rows.length])));
const recordRowOptions = computed(() => {
  const detail = selectedDetail.value;
  if (detail?.kind !== 'records') return [];
  const unmatched = unmatchedRows.value.get(detail.point);
  return detail.point.rows.map((row, index) => ({
    label: `${index + 1}. ${row.merchantName} · ${row.createTime}${highlightUnmatched.value && canMatch.value ? (unmatched?.includes(row) ? ' · 未匹配' : ' · 已匹配') : ''}`,
    value: index,
  }));
});
const unmatchedPointCount = computed(() => [...matchCounts.value].filter(([point, count]) => count === point.rows.length).length);
const partialPointCount = computed(() => [...matchCounts.value].filter(([point, count]) => count > 0 && count < point.rows.length).length);
const hasOverlays = computed(() => Boolean(batch.value?.points.length || fenceBatch.value?.points.length || routeBatch.value));
const referenceFenceCount = computed(() => (fenceBatch.value?.points ?? []).filter(point => !point.fence).reduce((sum, point) => sum + point.rows.length, 0));
const layerSummaries = computed(() => [
  batch.value && {
    kind: 'records' as const, color: 'arcoblue', fileName: batch.value.fileName,
    label: `收运明细 ${batch.value.total} 条 / ${batch.value.points.length} 个坐标`,
    skipped: batch.value.skipped,
    hint: '点击地图标记查看该位置的收运记录。',
  },
  fenceBatch.value && {
    kind: 'fences' as const, color: 'green', fileName: fenceBatch.value.fileName,
    label: `收集点 ${fenceBatch.value.total - fenceBatch.value.skipped} 个 / ${fenceBatch.value.points.length} 处`,
    skipped: fenceBatch.value.skipped,
    hint: `共 ${fenceBatch.value.total - fenceBatch.value.skipped} 个收集点，点击绿色围栏查看详情。${fenceBatch.value.corrected ? `已按真实系统地图校正 ${fenceBatch.value.corrected} 点。` : ''}`,
  },
  routeBatch.value && {
    kind: 'route' as const, color: 'cyan', fileName: routeBatch.value.fileName,
    label: `轨迹点 ${routeBatch.value.total} 个`,
    skipped: routeBatch.value.skipped,
    hint: '浅青蓝为未回放轨迹，深青蓝为已回放轨迹；箭头表示行进方向。',
  },
].filter(layer => layer !== undefined));
let fenceOverlays: MapFence[] = [];
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
  } else {
    const index = result.point.rows.findIndex(row => rfidKeyword.value.trim()
      ? row.rfid.trim().toLowerCase() === rfidKeyword.value.trim().toLowerCase()
      : row.merchantName.trim().toLowerCase() === merchantKeyword.value.trim().toLowerCase());
    selectedRecordRowIndex.value = Math.max(0, index);
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
watch([dataSource, selectedDate, onlineDate, selectedVehicle], () => {
  rfidKeyword.value = '';
  merchantKeyword.value = '';
  clearSearch();
  selectedDetail.value = undefined;
});

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
    dataSource.value = 'manual';
  } catch (cause) {
    importError.value = cause instanceof Error ? cause.message : '文件读取失败。';
  } finally {
    reading.value = undefined;
  }
}

watch([dataSource, selectedDate, refreshVersion], async ([source, date], _, onCleanup) => {
  if (source !== 'history') return;
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

watch([dataSource, onlineDate, selectedVehicle, refreshVersion], async ([source, date, vehicleId, version], previous, onCleanup) => {
  if (source !== 'online') {
    if (source === 'manual') { dateLoading.value = false; dateError.value = ''; }
    return;
  }
  const controller = new AbortController();
  onlineController = controller;
  onCleanup(() => controller.abort());
  onlineBatches.value = {};
  onlineWarnings.value = []; onlineUpdated.value = ''; onlineProgress.value = ''; onlineLayers.value = undefined;
  dateError.value = ''; importError.value = ''; dateLoading.value = true;
  clearSearch(); selectedDetail.value = undefined;
  try {
    const vehicle = collectionVehicles.find(item => item.truckId === vehicleId);
    if (!vehicle) throw new Error('请选择有效车辆。');
    const result = await loadOnline(vehicle, date, controller.signal, version !== previous?.[3], text => {
      if (!controller.signal.aborted) onlineProgress.value = text;
    }, () => collectionAuth.token, value => {
      if (controller.signal.aborted) return;
      onlineBatches.value = value.batches;
      onlineWarnings.value = value.warnings;
      onlineLayers.value = value.layers;
      dateError.value = value.errors.join(' ');
    });
    if (!controller.signal.aborted) {
      onlineBatches.value = result.batches;
      onlineWarnings.value = result.warnings;
      onlineLayers.value = result.layers;
      dateError.value = result.errors.join(' ');
      onlineUpdated.value = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
    }
  } catch (cause) {
    if (!controller.signal.aborted) dateError.value = cause instanceof Error ? cause.message : '接口数据加载失败。';
  } finally {
    if (!controller.signal.aborted) dateLoading.value = false;
  }
}, { immediate: true });

// 底图仅在容器、地图提供方或手动重试变化时创建，数据分批到达时复用同一实例。
watch([mapElement, retry, mapProvider], async ([element, , provider], _, onCleanup) => {
  let cancelled = false;
  let map: CollectionMap | undefined;
  onCleanup(() => {
    cancelled = true;
    disposeLayers?.();
    if (activeMap === map) activeMap = undefined;
    mapReady.value = undefined;
    themeRequest++;
    themeLoading.value = false;
    themeError.value = '';
    map?.destroy();
  });
  if (!element) { mapLoading.value = false; return; }
  mapLoading.value = true;
  mapError.value = '';
  try {
    const center = batch.value?.points[0]?.position ?? fenceBatch.value?.points[0]?.position ?? routeBatch.value?.path[0] ?? [103.83, 30.70];
    const canvas = document.createElement('div');
    canvas.style.cssText = 'position:absolute;inset:0';
    element.replaceChildren(canvas);
    map = await createCollectionMap(provider, canvas, center, currentTheme.value);
    if (cancelled) { map.destroy(); canvas.remove(); return; }
    activeMap = map;
    mapReady.value = map;
    void applyMapTheme(currentTheme.value);
  } catch (cause) {
    if (!cancelled) mapError.value = cause instanceof Error ? cause.message : `${mapProviderName.value}加载失败。`;
  } finally {
    if (!cancelled) mapLoading.value = false;
  }
}, { flush: 'post' });

watch([batch, fenceBatch, routeBatch, mapReady, radius], async ([imported, importedFences, importedRoute, map], _, onCleanup) => {
  const restoreSearch = searchPerformed.value;
  const previousIndex = searchIndex.value;
  clearSearch();
  selectedDetail.value = undefined;
  const element = mapElement.value;
  if (!element || !map) return;
  const recordPoints = imported?.points ?? [];
  const fencePoints = importedFences?.points ?? [];
  const recordPins = new Map<CollectionImportPoint, HTMLElement>();
  const recordItems = new Map<CollectionImportPoint, HTMLButtonElement[]>();
  const stopEffects: (() => void)[] = [];
  let observer: ResizeObserver | undefined;
  let cancelled = false;
  const cleanup = () => {
    if (cancelled) return;
    cancelled = true;
    for (const stop of stopEffects) stop();
    observer?.disconnect();
    fenceOverlays = [];
    map.clear();
    if (disposeLayers === cleanup) disposeLayers = undefined;
  };
  disposeLayers = cleanup;
  onCleanup(cleanup);
  mapRendering.value = true;
  try {
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
    let painted = 0;
    for (const point of fencePoints) {
      if (++painted % 100 === 0) { await new Promise(resolve => setTimeout(resolve, 0)); if (cancelled) return; }
      const geometry = collectionFenceGeometry(point, radius.value);
      const click = () => { selectedDetail.value = { kind: 'fences', point }; };
      const overlay = geometry.type === 'circle'
        ? map.circle(geometry.center, geometry.radius, fenceStyle, click)
        : map.polygon(geometry.path, fenceStyle, click);
      fenceOverlays.push(overlay);
    }
    for (const point of recordPoints) {
      if (++painted % 100 === 0) { await new Promise(resolve => setTimeout(resolve, 0)); if (cancelled) return; }
      const content = document.createElement('div');
      content.className = 'collection-record-marker';
      const pin = document.createElement('i');
      pin.className = 'collection-record-pin';
      content.append(pin);
      if (point.rows.length > 1) {
        const count = document.createElement('span');
        count.className = 'collection-record-count';
        count.textContent = String(point.rows.length);
        content.append(count);
        const expanded = document.createElement('div');
        expanded.className = 'collection-record-expanded';
        const lines = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        lines.classList.add('collection-record-links');
        expanded.append(lines);
        const items = point.rows.map((row, index) => {
          // 只偏移气泡展示位置；所有记录仍锚定同一个真实坐标。
          const angle = -Math.PI / 2 + (index + 0.5) * Math.PI * 2 / point.rows.length;
          const distance = Math.max(36, point.rows.length * 7);
          const dx = Math.cos(angle) * distance;
          const dy = Math.sin(angle) * distance - 24;
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', '14'); line.setAttribute('y1', '33');
          line.setAttribute('x2', String(14 + dx)); line.setAttribute('y2', String(33 + dy));
          lines.append(line);
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'collection-record-item';
          item.style.left = `${dx}px`; item.style.top = `${dy}px`;
          item.append(pin.cloneNode());
          const number = document.createElement('span');
          number.textContent = String(index + 1);
          item.append(number);
          item.addEventListener('click', event => {
            event.stopPropagation();
            selectedDetail.value = { kind: 'records', point };
            selectedRecordRowIndex.value = index;
          });
          expanded.append(item);
          return item;
        });
        recordItems.set(point, items);
        content.append(expanded);
      }
      recordPins.set(point, content);
      map.marker(point.position, content, [-14, -33], () => {
        selectedDetail.value = { kind: 'records', point };
      });
    }

    let selectedCircle: MapFence | undefined;
    let selectedPin: HTMLElement | undefined;
    stopEffects.push(watch([selectedDetail, selectedRecordRowIndex], ([detail, rowIndex]) => {
      selectedCircle?.setOptions(fenceStyle);
      selectedCircle = undefined;
      selectedPin?.classList.remove('selected');
      selectedPin?.classList.remove('expanded');
      selectedPin?.querySelectorAll('.row-selected').forEach(item => item.classList.remove('row-selected'));
      selectedPin = undefined;
      if (detail?.kind === 'fences') {
        selectedCircle = fenceOverlays[fencePoints.indexOf(detail.point)];
        selectedCircle?.setOptions({
          strokeColor: '#006b27', strokeWeight: 4,
          fillColor: '#23a650', fillOpacity: 0.30, zIndex: 20,
        });
      } else if (detail?.kind === 'records') {
        selectedPin = recordPins.get(detail.point);
        selectedPin?.classList.add('selected');
        if (detail.point.rows.length > 1) {
          selectedPin?.classList.add('expanded');
          recordItems.get(detail.point)?.[rowIndex]?.classList.add('row-selected');
        }
      }
    }, { flush: 'sync' }));

    stopEffects.push(watch(matchCounts, counts => {
      for (const [point, content] of recordPins) {
        const count = counts.get(point) ?? 0;
        content.classList.toggle('unmatched', count === point.rows.length);
        content.classList.toggle('partial-match', count > 0 && count < point.rows.length);
        content.title = `${collectionMerchantNames(point.rows).join('、') || '未填写所属商户'} · ${point.rows.length} 条记录${count ? ` · ${count} 条未匹配` : ''}`;
        recordItems.get(point)?.forEach((item, index) => {
          const row = point.rows[index]!;
          const unmatched = unmatchedRows.value.get(point)?.includes(row) ?? false;
          item.classList.toggle('unmatched', unmatched);
          item.title = `${row.merchantName} · ${row.createTime}${highlightUnmatched.value && canMatch.value ? (unmatched ? ' · 未匹配' : ' · 已匹配') : ''}`;
          item.setAttribute('aria-label', item.title);
        });
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
          color: !matchCounts.value.get(point) ? '#165dff' : matchCounts.value.get(point) === point.rows.length ? '#d03050' : '#d46b08', offset: [0, -38] as [number, number],
          click: () => { selectedDetail.value = { kind: 'records', point }; } })),
      ];
      onCleanup(map.labels(items));
    }, { immediate: true }));

    if (restoreSearch) {
      const mode = rfidKeyword.value.trim() ? 'rfid' : 'merchant';
      const keyword = mode === 'rfid' ? rfidKeyword.value : merchantKeyword.value;
      searchResults.value = searchCollectionPoints(recordPoints, fencePoints, mode, keyword, true);
      searchPerformed.value = true;
      locateSearchResult(Math.max(0, Math.min(previousIndex, searchResults.value.length - 1)));
    }
    let fitted = restoreSearch || (recordPoints.length === 1 && !fencePoints.length && !importedRoute);
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
    cleanup();
    mapRendering.value = false;
    mapError.value = cause instanceof Error ? cause.message : `${mapProviderName.value}加载失败。`;
  } finally {
    if (!cancelled) mapRendering.value = false;
  }
}, { flush: 'post' });

onDeactivated(() => { selectedDetail.value = undefined; onlineController?.abort(); });
onActivated(() => {
  if (dataSource.value === 'online' && onlineController?.signal.aborted) refreshVersion.value++;
});
</script>

<template>
  <div class="gi_page page-content audit-map-page">
    <PageHeader title="核验地图" class="map-page-header">
      <div class="map-query-controls">
        <div class="map-query-fields">
          <a-select v-model="selectedVehicle" class="vehicle-filter" :options="vehicleOptions" :disabled="dataSource !== 'online'" aria-label="车牌号" />
          <a-date-picker v-if="dataSource === 'online'" v-model="onlineDate" class="date-filter" value-format="YYYY-MM-DD" :allow-clear="false" :disabled-date="disabledOnlineDate" aria-label="接口数据日期" />
          <a-select v-else-if="dataSource === 'history'" v-model="selectedDate" class="date-filter" :options="dateOptions" :disabled="!!reading" placeholder="请选择日期" aria-label="本地数据日期" />
          <a-date-picker v-else class="date-filter" disabled placeholder="文件日期" aria-label="手动导入日期" />
          <AutoComplete v-model="merchantKeyword" class="map-search-input merchant-filter" :data="merchantSuggestions" :filter-option="false" placeholder="输入商户名称搜索"
            aria-label="商户名称搜索" allow-clear :disabled="mapLoading || mapRendering || (!batch && !fenceBatch)" @select="(value: string) => selectSearch('merchant', value)" />
          <AutoComplete v-model="rfidKeyword" class="map-search-input rfid-filter" :data="rfidSuggestions" :filter-option="false" placeholder="输入 RFID 搜索"
            aria-label="RFID 搜索" allow-clear :disabled="mapLoading || mapRendering || !batch" @select="(value: string) => selectSearch('rfid', value)" />
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
        <div class="map-query-actions">
          <a-button :loading="dateLoading" :disabled="dataSource === 'manual'" aria-label="更新数据" title="更新" @click="refreshVersion++"><template #icon><IconRefresh /></template></a-button>
          <Popover trigger="click" position="br">
            <a-button aria-label="数据设置" title="设置"><template #icon><IconSettings /></template></a-button>
            <template #content>
              <div class="data-settings">
                <section class="data-settings-section">
                  <strong>数据模式</strong>
                  <a-radio-group v-model="dataSource" type="button" size="small" aria-label="地图数据来源">
                    <a-radio value="online">接口数据</a-radio>
                    <a-radio value="history">本地数据</a-radio>
                    <a-radio value="manual">手动导入</a-radio>
                  </a-radio-group>
                </section>
                <section class="data-settings-section">
                  <strong>当前数据</strong>
                  <div v-if="layerSummaries.length" class="layer-summaries" aria-label="当前日期数据统计" aria-live="polite">
                    <a-tooltip v-for="layer in layerSummaries" :key="layer.kind" :content="`${layer.fileName}；${layer.hint}`" position="left">
                      <a-tag :color="layer.skipped ? 'orange' : layer.color">
                        {{ layer.label }}<template v-if="dataSource === 'online' && onlineLayers?.[layer.kind].status === 'loading'"> · 加载中</template><template v-if="layer.skipped"> · 跳过 {{ layer.skipped }}</template>
                      </a-tag>
                    </a-tooltip>
                  </div>
                  <span v-else class="settings-note">暂无已加载数据</span>
                  <div v-if="dataSource === 'online'" class="online-progress settings-note" aria-live="polite">{{ collectionAuth.visible ? '请登录后加载接口数据…' : onlineProgress || (dateLoading ? '正在获取数据，已到达的图层会先显示…' : '尚未加载数据，请点击更新。') }}</div>
                  <small v-if="dataSource === 'online' && onlineUpdated" class="settings-note">{{ dateError ? '部分更新于' : '更新于' }} {{ onlineUpdated }} · 收集点为最新数据</small>
                  <small v-if="dataSource === 'history' && fenceBatch?.snapshotAt" class="settings-note">收集点使用 {{ new Date(fenceBatch.snapshotAt).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }) }} 的本地围栏快照；日期只切换收运明细和轨迹。</small>
                </section>
                <section v-if="dataSource === 'manual'" class="data-settings-section import-settings">
                  <strong>手动导入</strong>
                  <span class="settings-note">可分别导入收运明细、收集点和轨迹 JSON 文件。</span>
                  <div class="import-setting-row">
                    <a-button size="small" :loading="reading === 'records'" :disabled="!!reading && reading !== 'records'" @click="recordsInput?.click()"><template #icon><IconUpload /></template>导入收运明细</a-button>
                    <a :href="recordsSample" download="收运明细样例.json" aria-label="下载收运明细样例">格式样例</a>
                  </div>
                  <div class="import-setting-row">
                    <a-button size="small" :loading="reading === 'fences'" :disabled="!!reading && reading !== 'fences'" @click="fencesInput?.click()"><template #icon><IconUpload /></template>导入商户收集点</a-button>
                    <a :href="fencesSample" download="商户收集点样例.json" aria-label="下载商户收集点样例">格式样例</a>
                  </div>
                  <div class="import-setting-row">
                    <a-button size="small" :loading="reading === 'route'" :disabled="!!reading && reading !== 'route'" @click="routeInput?.click()"><template #icon><IconUpload /></template>导入轨迹</a-button>
                    <a :href="routeSample" download="路线样例.json" aria-label="下载路线样例">格式样例</a>
                  </div>
                </section>
              </div>
            </template>
          </Popover>
        </div>
      </div>
    </PageHeader>
    <input ref="recordsInput" type="file" accept=".json,application/json" hidden @change="importFile($event, 'records')" />
    <input ref="fencesInput" type="file" accept=".json,application/json" hidden @change="importFile($event, 'fences')" />
    <input ref="routeInput" type="file" accept=".json,application/json" hidden @change="importFile($event, 'route')" />
    <a-alert v-if="importError || dateError" type="error">{{ importError || dateError }}</a-alert>
    <a-alert v-if="dataSource === 'online' && onlineWarnings.length" type="warning">{{ onlineWarnings.join(' ') }}</a-alert>
    <a-alert v-if="dataSource === 'online' && !dateLoading && !hasOverlays && !dateError" type="info">所选日期暂无可显示的有效坐标。</a-alert>
    <CollectionLoginModal />

    <section class="panel map-panel" aria-label="收运坐标地图">
      <a-empty v-if="dateLoading && dataSource !== 'online'" description="正在读取该日期的收运数据…" />
      <a-empty v-else-if="dateError && dataSource !== 'online'" description="该日期数据暂时无法显示。" />
      <a-empty v-else-if="dataSource !== 'online' && !layerSummaries.length" description="请选择收运明细、商户收集点或路线 JSON 文件，在地图上查看。" />
      <a-empty v-else-if="dataSource !== 'online' && !hasOverlays" description="导入的文件中没有可显示的坐标。" />
      <template v-else>
        <div class="map-frame" :class="{ 'has-playback': !!routeBatch }">
          <div ref="mapElement" class="coordinate-map" role="region" :aria-label="`收运明细${mapProviderName}`" />
          <div ref="mapToolbar" class="import-toolbar">
            <div class="map-settings-control">
              <Checkbox v-model="showNames">显示名称</Checkbox>
              <a-tooltip :content="canMatch ? `收运坐标位于同名商户的当前核验范围内才算匹配。${highlightUnmatched ? `全部未匹配 ${unmatchedPointCount} 个坐标点（红色），部分未匹配 ${partialPointCount} 个坐标点（橙色）。` : ''}` : '收运明细和收集点加载完成后可核对匹配情况。'">
                <Checkbox v-model="highlightUnmatched" :disabled="!canMatch">高亮未匹配</Checkbox>
              </a-tooltip>
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
                      <span id="fence-radius-label">核验范围（默认使用原始围栏）</span>
                      <a-radio-group v-model="radius" type="button" size="mini" aria-labelledby="fence-radius-label">
                        <a-radio :value="0">原始围栏</a-radio>
                        <a-radio v-for="meters in [10, 20, 30, 50, 100]" :key="meters" :value="meters">{{ meters }} 米</a-radio>
                      </a-radio-group>
                      <small v-if="referenceFenceCount">{{ referenceFenceCount }} 个收集点未提供原始围栏，默认使用 50 米参考圆；接口数据优先使用真实围栏。</small>
                    </div>
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
                  <a-descriptions-item label="收集点编号">{{ selectedFenceRow.id || '—' }}</a-descriptions-item>
                  <a-descriptions-item label="收集点名称">{{ selectedFenceRow.name }}</a-descriptions-item>
                  <a-descriptions-item label="所属商户">{{ selectedFenceRow.merchantName }}</a-descriptions-item>
                  <a-descriptions-item label="所属机构">{{ selectedFenceRow.organization || '—' }}</a-descriptions-item>
                  <a-descriptions-item label="地址">{{ selectedFenceRow.address }}</a-descriptions-item>
                  <a-descriptions-item label="围栏中心坐标">
                    <a-tooltip :content="`原始接口/文件坐标：${selectedDetail.point.sourcePosition?.join('，') ?? '未提供'}；当前坐标用于围栏绘制、定位和匹配。`">
                      <span>{{ mapProvider === 'baidu' && selectedDetail.point.mapSourcePosition ? selectedDetail.point.mapSourcePosition.map(value => value.toFixed(6)).join('，') : displayPosition(selectedDetail.point.position) }}</span>
                    </a-tooltip>
                  </a-descriptions-item>
                  <a-descriptions-item label="当前核验范围">{{ radius > 0 ? `自定义圆形 · ${radius} 米` : selectedDetail.point.fence?.type === 'circle' ? `原始圆形 · ${selectedDetail.point.fence.radius} 米` : selectedDetail.point.fence?.type === 'polygon' ? '原始多边形' : '参考圆形 · 50 米（未提供原始围栏）' }}</a-descriptions-item>
                  <a-descriptions-item v-if="selectedDetail.point.geometrySource === 'verified'" label="坐标来源">已核验围栏快照；历史文件原坐标保留供核对。</a-descriptions-item>
                  <a-descriptions-item label="更新时间">{{ selectedFenceRow.updateTime }}</a-descriptions-item>
                </a-descriptions>
              </template>
              <template v-else>
                <div v-if="selectedDetail.point.rows.length > 1" class="overlap-record-summary">
                  同坐标共 {{ selectedDetail.point.rows.length }} 条收运记录，气泡已展开，连线指向真实位置。点击编号气泡或下方列表切换记录。
                  <template v-if="highlightUnmatched && canMatch">{{ selectedDetail.point.rows.length - (matchCounts.get(selectedDetail.point) ?? 0) }} 条已匹配，{{ matchCounts.get(selectedDetail.point) ?? 0 }} 条未匹配。</template>
                </div>
                <a-select v-if="selectedDetail.point.rows.length > 1" v-model="selectedRecordRowIndex" class="overlap-selector" size="small"
                  aria-label="切换同坐标收运记录" :options="recordRowOptions">
                  <template #option="{ data }"><span class="overlap-option">{{ data.label }}</span></template>
                </a-select>
                <a-descriptions v-for="row in selectedRecordRows" :key="row.id" class="point-fields" :column="1" size="small" layout="vertical">
                  <a-descriptions-item v-if="highlightUnmatched && canMatch" label="围栏匹配">
                    <a-tag size="small" :color="unmatchedRows.get(selectedDetail.point)?.includes(row) ? 'red' : 'green'">{{ unmatchedRows.get(selectedDetail.point)?.includes(row) ? '未匹配同名商户围栏' : '已匹配同名商户围栏' }}</a-tag>
                  </a-descriptions-item>
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
.map-page-header :deep(.module-header-actions) { flex: 1; min-width: 0; }
.map-page-header :deep(.module-header-actions > .arco-space-item) { flex: 1; min-width: 0; margin-bottom: 0 !important; }
.map-query-controls { display: flex; align-items: center; gap: 8px; width: 100%; }
.map-query-fields { display: flex; align-items: center; flex-wrap: wrap; flex: 1; min-width: 0; gap: 8px; }
.map-query-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 8px; margin-inline-start: auto; }
.map-query-controls :deep(.vehicle-filter) { flex: 0 0 140px; width: 140px; }
.map-query-controls :deep(.date-filter) { flex: 0 0 148px; width: 148px; }
.map-query-controls :deep(.map-search-input) { flex: 0 0 180px; width: 180px; max-width: 100%; }
.search-results { display: flex; align-items: center; gap: 4px; color: var(--color-text-2); font-size: 12px; white-space: nowrap; }
.audit-map-page > .map-panel { flex: 1 0 392px; min-height: 392px; display: flex; flex-direction: column; }
.data-settings { width: min(370px, calc(100vw - 64px)); max-height: 70vh; overflow-y: auto; }
.data-settings-section { display: flex; flex-direction: column; gap: 10px; }
.data-settings-section + .data-settings-section { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--color-border-2); }
.settings-note { color: var(--color-text-3); font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.import-setting-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; }
.import-setting-row a { color: rgb(var(--primary-6)); white-space: nowrap; }
.import-toolbar, .map-settings-control { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 8px; }
.import-toolbar { position: absolute; z-index: 13; top: 12px; left: 12px; right: 12px; }
.layer-summaries { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
.map-settings-control { padding: 4px; background: var(--color-bg-2); border-radius: 4px; box-shadow: 0 2px 8px #0001; margin-inline-start: auto; color: var(--color-text-2); }
.map-display-settings { display: flex; flex-direction: column; gap: 10px; width: min(260px, calc(100vw - 64px)); }
.map-display-settings small { color: var(--color-text-3); }
@media (max-width: 600px) {
  .map-page-header { align-items: stretch; }
  .map-query-controls :deep(.vehicle-filter), .map-query-controls :deep(.date-filter) { flex: 1 1 calc(50% - 4px); width: auto; }

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
.coordinate-map :deep(.collection-record-marker.selected) { transform: scale(1.18); transform-origin: 14px 33px; }
.coordinate-map :deep(.collection-record-marker.selected .collection-record-pin) { box-shadow: 0 0 0 4px #165dff66; }
.coordinate-map :deep(.collection-record-marker.unmatched .collection-record-pin) { background: #f53f3f; }
.coordinate-map :deep(.collection-record-marker.unmatched.selected .collection-record-pin) { box-shadow: 0 0 0 4px #f53f3f66; }
.coordinate-map :deep(.collection-record-marker.partial-match .collection-record-pin) { background: #ff7d00; }
.coordinate-map :deep(.collection-record-marker.partial-match.selected .collection-record-pin) { box-shadow: 0 0 0 4px #ff7d0066; }
.coordinate-map :deep(.collection-record-count) { position: absolute; right: -7px; top: -6px; min-width: 16px; height: 16px; padding: 0 2px; box-sizing: border-box; border-radius: 8px; background: #fff; color: #1d2129; text-align: center; font-size: 11px; line-height: 16px; box-shadow: 0 1px 4px #0004; }
.coordinate-map :deep(.collection-record-expanded) { display: none; }
.coordinate-map :deep(.collection-record-marker.expanded) { transform: none; }
.coordinate-map :deep(.collection-record-marker.expanded > .collection-record-pin),
.coordinate-map :deep(.collection-record-marker.expanded > .collection-record-count) { display: none; }
.coordinate-map :deep(.collection-record-marker.expanded .collection-record-expanded) { display: block; }
.coordinate-map :deep(.collection-record-links) { position: absolute; top: 0; left: 0; width: 1px; height: 1px; overflow: visible; pointer-events: none; stroke: #4e5969; stroke-width: 1.5; stroke-dasharray: 3 2; }
.coordinate-map :deep(.collection-record-item) { position: absolute; width: 28px; height: 36px; padding: 0; border: 0; background: transparent; cursor: pointer; }
.coordinate-map :deep(.collection-record-item > span) { position: absolute; top: 2px; left: 2px; width: 24px; color: #fff; font-size: 12px; line-height: 24px; text-align: center; font-weight: 600; }
.coordinate-map :deep(.collection-record-marker.expanded .collection-record-item .collection-record-pin) { background: #4d94ff; box-shadow: none; }
.coordinate-map :deep(.collection-record-marker.expanded .collection-record-item.unmatched .collection-record-pin) { background: #f53f3f; }
.coordinate-map :deep(.collection-record-item.row-selected) { transform: scale(1.18); transform-origin: 14px 33px; }
.coordinate-map :deep(.collection-record-marker.expanded .collection-record-item.row-selected .collection-record-pin) { box-shadow: 0 0 0 4px #165dff66; }
.coordinate-map :deep(.collection-record-marker.expanded .collection-record-item.unmatched.row-selected .collection-record-pin) { box-shadow: 0 0 0 4px #f53f3f66; }
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
.overlap-record-summary { margin-bottom: 8px; color: var(--color-text-2); font-size: 12px; line-height: 20px; }
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
