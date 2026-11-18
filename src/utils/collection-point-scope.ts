import type { ApiRow } from './collection-api.ts';
import { collectionPointOrganization } from '../mock/collection-scope.ts';

const key = (value: unknown) => value === null || value === undefined ? '' : String(value).trim();

// collectionPoints 是正式档案；mapPoints 仅用于补充该档案绑定的围栏几何。
export function selectRegisteredCollectionPoints(mapRows: ApiRow[], registry: ApiRow[]) {
  const catalog = new Map<string, ApiRow>();
  for (const row of registry) {
    if (key(row.org) !== collectionPointOrganization || Number(row.status) !== 1) continue;
    const id = key(row.id);
    if (!id || !key(row.merchantId)) continue;
    if (catalog.has(id)) throw new Error('正式收集点档案存在重复 ID，无法核验地图点。');
    catalog.set(id, row);
  }
  const rows: ApiRow[] = [];
  let excluded = 0;
  for (const mapRow of mapRows) {
    const official = catalog.get(key(mapRow.id));
    if (!official || key(mapRow.org) !== collectionPointOrganization || Number(mapRow.status) !== 1
      || key(mapRow.merchantId) !== key(official.merchantId)
      || key(mapRow.fenceId) !== key(official.fenceId)) {
      excluded++;
      continue;
    }
    // 名称、机构、地址等以正式档案为准，避免地图接口的旧别名混入。
    rows.push({ ...mapRow, ...official,
      lng: mapRow.lng, lat: mapRow.lat, fenceRadius: mapRow.fenceRadius, fenceLnglats: mapRow.fenceLnglats,
    });
  }
  return { rows, excluded };
}
