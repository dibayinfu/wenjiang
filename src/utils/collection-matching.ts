import type { CollectionFencePoint, CollectionImportPoint } from './collection-import.ts';
import { fenceContains } from './point-fence.ts';

function merchantName(value: string) {
  const name = value.trim();
  return name === '—' ? '' : name;
}

export function collectionMerchantNames(rows: { merchantName: string }[]) {
  return [...new Set(rows.map(row => merchantName(row.merchantName)).filter(Boolean))];
}

// 输入坐标均已在导入时统一为 GCJ-02。按商户索引，避免逐点扫描全部围栏。
export function unmatchedCollectionCounts(points: CollectionImportPoint[], fences: CollectionFencePoint[], radius: number) {
  const result = new Map<CollectionImportPoint, number>();
  if (!fences.length) return result;

  const byMerchant = new Map<string, CollectionFencePoint[]>();
  for (const fence of fences) {
    for (const name of collectionMerchantNames(fence.rows)) {
      const candidates = byMerchant.get(name) ?? [];
      candidates.push(fence);
      byMerchant.set(name, candidates);
    }
  }
  for (const point of points) {
    const matched = new Set(collectionMerchantNames(point.rows).filter(name =>
      byMerchant.get(name)?.some(fence => fenceContains({ type: 'circle', center: fence.position, radius }, point.position)),
    ));
    result.set(point, point.rows.filter(row => !matched.has(merchantName(row.merchantName))).length);
  }
  return result;
}
