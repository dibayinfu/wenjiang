import type { CollectionFencePoint, CollectionImportPoint } from './collection-import.ts';

export type CollectionSearchMode = 'rfid' | 'merchant';
export type CollectionSearchResult =
  | { kind: 'records'; point: CollectionImportPoint }
  | { kind: 'fences'; point: CollectionFencePoint };

export function searchCollectionPoints(points: CollectionImportPoint[], fences: CollectionFencePoint[], mode: CollectionSearchMode, query: string, exact = false): CollectionSearchResult[] {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return [];
  const contains = (value: string) => value !== '—' && (exact ? value.trim().toLowerCase() === keyword : value.toLowerCase().includes(keyword));
  const field = mode === 'rfid' ? 'rfid' : 'merchantName';
  const results: CollectionSearchResult[] = points
    .filter(point => point.rows.some(row => contains(row[field])))
    .map(point => ({ kind: 'records', point }));
  if (mode === 'merchant') {
    // 商户筛选优先定位收集点，复用地图点击收集点时的选中状态。
    results.unshift(...fences
      .filter(point => point.rows.some(row => contains(row.merchantName)))
      .map(point => ({ kind: 'fences' as const, point })));
  }
  return results;
}

export function collectionSearchSuggestions(points: CollectionImportPoint[], fences: CollectionFencePoint[], mode: CollectionSearchMode, query: string) {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return [];
  const field = mode === 'rfid' ? 'rfid' : 'merchantName';
  const values = points.flatMap(point => point.rows.map(row => row[field]));
  if (mode === 'merchant') values.push(...fences.flatMap(point => point.rows.map(row => row.merchantName)));
  return [...new Set(values.map(value => value.trim()))].filter(value => value && value !== '—' && value.toLowerCase().includes(keyword));
}
