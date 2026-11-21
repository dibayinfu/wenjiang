import type { ApiRow } from './collection-api.ts';
import { collectionPointOrganization } from '../mock/collection-scope.ts';

const key = (value: unknown) => value === null || value === undefined ? '' : String(value).trim();

export function isEnabledCollectionPoint(status: unknown) {
  return status === 1 || status === '1';
}

// collectionPoints 是正式档案；mapPoints 仅用于补充该档案绑定的围栏几何。
export function selectRegisteredCollectionPoints(mapRows: ApiRow[], registry: ApiRow[], options: { allowMissingMapFenceId?: boolean } = {}) {
  const catalog = new Map<string, ApiRow>();
  for (const row of registry) {
    if (key(row.org) !== collectionPointOrganization) continue;
    const id = key(row.id);
    if (!id || !key(row.merchantId)) continue;
    if (catalog.has(id)) throw new Error('正式收集点档案存在重复 ID，无法核验地图点。');
    catalog.set(id, row);
  }
  const rows: ApiRow[] = [];
  let excluded = 0;
  for (const mapRow of mapRows) {
    const official = catalog.get(key(mapRow.id));
    if (!official || key(mapRow.org) !== collectionPointOrganization || key(mapRow.merchantId) !== key(official.merchantId)) {
      excluded++;
      continue;
    }
    // 两个来源均须启用，禁用点无需校验围栏，也不影响快照中的其他点。
    if (!isEnabledCollectionPoint(official.status) || !isEnabledCollectionPoint(mapRow.status)) continue;
    const mapFenceId = key(mapRow.fenceId);
    const officialFenceId = key(official.fenceId);
    const useRegistryBinding = options.allowMissingMapFenceId && !mapFenceId && Boolean(officialFenceId);
    if (!useRegistryBinding && mapFenceId !== officialFenceId) {
      excluded++;
      continue;
    }
    // 名称、机构、地址等以正式档案为准，避免地图接口的旧别名混入。
    rows.push({ ...mapRow, ...official,
      lng: mapRow.lng, lat: mapRow.lat,
      fenceRadius: useRegistryBinding ? undefined : mapRow.fenceRadius,
      fenceLnglats: useRegistryBinding ? undefined : mapRow.fenceLnglats,
    });
  }
  return { rows, excluded };
}
