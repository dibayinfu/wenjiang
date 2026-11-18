import { CollectionApi, isApiObject, type ApiRow } from './collection-api.ts';
import { parseCollectionImport, parseFenceImport, parseRouteImport } from './collection-import.ts';
import { routeTimestamp } from './route-playback.ts';
import { selectRegisteredCollectionPoints } from './collection-point-scope.ts';
import type { CollectionBatches } from './collection-history.ts';
import type { CollectionVehicle } from '../mock/collection-vehicles.ts';

export const COLLECTION_MIN_DATE = '2026-11-10';
export function collectionToday(now = new Date()) {
  return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
}
export function nextCollectionDate(date: string) {
  return collectionToday(new Date(Date.parse(`${date}T00:00:00+08:00`) + 86400000));
}
export function validateCollectionDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00+08:00`))
    || collectionToday(new Date(`${date}T00:00:00+08:00`)) !== date
    || date < COLLECTION_MIN_DATE || date > collectionToday()) throw new Error('请选择 2026-11-10 至今天的日期。');
}

export type OnlineLayer = 'fences' | 'records' | 'route';
export interface OnlineLayerState {
  status: 'loading' | 'complete' | 'error';
  loaded: number;
  total?: number;
  error?: string;
}
export interface CollectionOnlineUpdate {
  batches: CollectionBatches;
  warnings: string[];
  errors: string[];
  layers: Record<OnlineLayer, OnlineLayerState>;
}

export function createCollectionOnlineLoader(api: CollectionApi) {
  let pointsCache: { token: string; batch: NonNullable<CollectionBatches['fences']>; warnings: string[] } | undefined;
  return async (vehicle: CollectionVehicle, date: string, signal: AbortSignal, update: boolean,
    progress: (text: string) => void, token: () => string,
    onUpdate?: (value: CollectionOnlineUpdate) => void): Promise<CollectionOnlineUpdate> => {
    validateCollectionDate(date);
    for (let attempt = 0; attempt < 2; attempt++) {
      await api.authenticate(signal);
      const sessionToken = token();
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal.addEventListener('abort', abort, { once: true });
      const batches: CollectionBatches = {};
      const layerWarnings: Record<OnlineLayer, string[]> = { fences: [], records: [], route: [] };
      const layers: Record<OnlineLayer, OnlineLayerState> = {
        fences: { status: 'loading', loaded: 0 }, records: { status: 'loading', loaded: 0 }, route: { status: 'loading', loaded: 0 },
      };
      const labels = { fences: '收集点', records: '收运明细', route: '轨迹' };
      let sessionChanged = false;
      const snapshot = (): CollectionOnlineUpdate => ({
        batches: { ...batches }, warnings: Object.values(layerWarnings).flat(),
        errors: Object.entries(layers).filter(([, state]) => state.error).map(([kind, state]) => `${labels[kind as OnlineLayer]}：${state.error}`),
        layers: { fences: { ...layers.fences }, records: { ...layers.records }, route: { ...layers.route } },
      });
      const emit = () => {
        signal.throwIfAborted();
        if (token() && token() !== sessionToken) {
          if (!sessionChanged) {
            sessionChanged = true;
            onUpdate?.({ ...snapshot(), batches: {}, warnings: [], errors: [] });
            controller.abort();
          }
          throw new Error('登录状态已更新');
        }
        onUpdate?.(snapshot());
        progress((Object.keys(layers) as OnlineLayer[]).map(kind => {
          const state = layers[kind];
          const count = state.total === undefined ? `${state.loaded}` : `${state.loaded}/${state.total}`;
          return `${labels[kind]} ${state.status === 'error' ? '失败' : `${count} ${state.status === 'complete' ? '✓' : '加载中'}`}`;
        }).join(' · '));
      };
      const wrap = (rows: ApiRow[]) => JSON.stringify({ data: { list: rows } });
      const recordPage = (rows: ApiRow[], total?: number) => {
        const scoped = rows.filter(row => {
          const id = row.truckId ?? row.truckid;
          if (id != null && String(id) !== vehicle.truckId) return false;
          if (row.plateNumber != null && String(row.plateNumber) !== vehicle.label) return false;
          if (id == null && row.plateNumber == null) throw new Error('收运明细缺少车辆标识，无法核验所属车辆。');
          const time = routeTimestamp(row.createTime);
          if (time === undefined) throw new Error('收运明细缺少有效时间，无法核验所属日期。');
          return collectionToday(new Date(time)) === date;
        });
        batches.records = { ...parseCollectionImport(wrap(scoped)), fileName: `接口 · ${date} ${vehicle.label}收运明细` };
        layerWarnings.records = scoped.length === rows.length ? [] : [`已排除 ${rows.length - scoped.length} 条非所选车辆或日期的明细。`];
        Object.assign(layers.records, { loaded: rows.length, total });
        emit();
      };
      const fencePage = (rows: ApiRow[], total?: number) => {
        batches.fences = { ...parseFenceImport(wrap(rows), { legacyCorrections: false, pointCoordinateSystem: 'wgs84' }), fileName: '接口 · 最新收集点' };
        layerWarnings.fences = batches.fences.skipped ? [`${batches.fences.skipped} 个收集点缺少有效坐标或名称，未在地图显示。`] : [];
        Object.assign(layers.fences, { loaded: rows.length, total });
        emit();
      };
      const runLayer = async (kind: OnlineLayer, work: () => Promise<void>) => {
        try {
          await work();
          layers[kind].status = 'complete';
          emit();
        } catch (error) {
          if (signal.aborted || sessionChanged || controller.signal.aborted) return;
          if (token() && token() !== sessionToken) { try { emit(); } catch { /* 下轮使用新会话重新获取 */ } return; }
          delete batches[kind];
          layerWarnings[kind] = [];
          layers[kind].status = 'error';
          layers[kind].error = error instanceof Error ? error.message : '加载失败，请重试。';
          emit();
        }
      };
      try {
        emit();
        await Promise.all([
          runLayer('fences', async () => {
            if (!update && pointsCache?.token === sessionToken) {
              batches.fences = pointsCache.batch;
              layers.fences.loaded = pointsCache.batch.total;
              layerWarnings.fences = [...pointsCache.warnings];
            } else {
              // 两个全集并行获取，不逐点请求；档案核验完成前不发布地图点。
              const [registry, mapRows] = await Promise.all([
                api.all('/api/collectionPoints', { merchantIds: '', name: '', org: '', street: '' }, controller.signal),
                api.all('/api/collectionPoint/mapPoints', { status: '1' }, controller.signal),
              ]);
              const selected = selectRegisteredCollectionPoints(mapRows, registry);
              // 新版 mapPoints 只返回点位，绑定围栏需按收集点 ID 批量补全。
              const missing = selected.rows.filter(row => row.fenceId && !row.fenceLnglats);
              for (let offset = 0; offset < missing.length; offset += 200) {
                const group = missing.slice(offset, offset + 200);
                const response = await api.request('/api/collectionPoint/fences', { ids: group.map(row => String(row.id)).join(',') }, controller.signal);
                if (!Array.isArray(response.data) || !response.data.every(isApiObject)) throw new Error('围栏接口未返回有效的数据列表。');
                for (const row of group) {
                  const matches = response.data.filter(fence => String(fence.id) === String(row.id));
                  const fence = matches[0];
                  if (matches.length !== 1 || String(fence?.fenceId) !== String(row.fenceId)) throw new Error(`收集点 ${row.id} 的围栏缺失或绑定不一致，请重新更新。`);
                  const parsed = parseFenceImport(wrap([{ ...row, fenceRadius: fence.fenceRadius, fenceLnglats: fence.fenceLnglats }]), { legacyCorrections: false, pointCoordinateSystem: 'wgs84' });
                  if (!parsed.points[0]?.fence) throw new Error(`收集点 ${row.id} 的原始围栏无效，请检查正式系统。`);
                  Object.assign(row, { fenceRadius: fence.fenceRadius, fenceLnglats: fence.fenceLnglats });
                }
              }
              fencePage(selected.rows, selected.rows.length);
              if (token() === sessionToken && batches.fences) pointsCache = { token: sessionToken, batch: batches.fences, warnings: [...layerWarnings.fences] };
            }
          }),
          runLayer('records', async () => {
            await api.all('/api/plateRecord/details', {
              startDate: date, endDate: date, truckIdIn: vehicle.truckId,
              rfIdIn: '', collectionPointIdIn: '', merchantIdIn: '', groupIdIn: '',
            }, controller.signal, undefined, 'list', recordPage);
          }),
          runLayer('route', async () => {
            const rows = await api.all('/api/gps/travelPath', {
              truckid: vehicle.truckId, imei: vehicle.imei,
              startTime: `${date} 00:00:00`, endTime: `${nextCollectionDate(date)} 00:00:00`,
            }, controller.signal, (loaded, total) => { Object.assign(layers.route, { loaded, total }); emit(); }, 'positions');
            const positions = rows.filter(row => {
              if (!isApiObject(row) || (row.carnum != null && String(row.carnum) !== vehicle.label)) return false;
              const time = routeTimestamp(row.fixTime) ?? routeTimestamp(row.deviceTime);
              return time !== undefined && collectionToday(new Date(time)) === date;
            });
            try {
              batches.route = { ...parseRouteImport(JSON.stringify({ data: { positions } })), fileName: `接口 · ${date} ${vehicle.label}轨迹` };
            } catch (error) {
              if (!(error instanceof Error) || error.message !== '路线至少需要两个不同的有效坐标点。') throw error;
              layerWarnings.route.push('所选车辆当天不足两个有效轨迹点，暂无可显示路线。');
            }
            if (positions.length !== rows.length) layerWarnings.route.push(`已排除 ${rows.length - positions.length} 个非当天、非所选车辆或缺少时间的轨迹点。`);
          }),
        ]);
        signal.throwIfAborted();
        if (!sessionChanged) return snapshot();
        pointsCache = undefined;
      } finally {
        controller.abort();
        signal.removeEventListener('abort', abort);
      }
    }
    throw new Error('登录状态频繁变化，请重新更新数据。');
  };
}
