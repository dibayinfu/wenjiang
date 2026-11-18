import { parseCollectionImport, parseCollectionPointSnapshot, parseFenceImport, parseRouteImport } from './collection-import';
import pointsSnapshotUrl from '../mock/collection-point-snapshot.json?url&no-inline';

export interface CollectionBatches {
  records?: ReturnType<typeof parseCollectionImport> & { fileName: string };
  fences?: ReturnType<typeof parseFenceImport> & { fileName: string; snapshotAt?: string };
  route?: ReturnType<typeof parseRouteImport> & { fileName: string };
}

const files = import.meta.glob<string>('../mock/collection-history/*/*.json', {
  eager: true,
  query: '?url&no-inline',
  import: 'default',
});

function batchFiles(date: string) {
  const prefix = `../mock/collection-history/${date}/`;
  const records = `收运明细${date}.json`;
  const route = files[`${prefix}路线${date}.json`] ? `路线${date}.json` : `轨迹${date}.json`;
  const recordsUrl = files[prefix + records];
  const routeUrl = files[prefix + route];
  if (recordsUrl && routeUrl) {
    return { records, route, recordsUrl, routeUrl };
  }
}

export const collectionHistoryDates = [...new Set(Object.keys(files).map(path => path.split('/').at(-2) ?? ''))]
  .filter(date => /^\d{6}$/.test(date) && batchFiles(date))
  .sort((a, b) => b.localeCompare(a));

let localPoints: ReturnType<typeof parseCollectionPointSnapshot> | undefined;

async function loadLocalPoints(signal: AbortSignal) {
  signal.throwIfAborted();
  if (localPoints) return localPoints;
  const text = await readJson(pointsSnapshotUrl, '本地收集点围栏快照', signal);
  signal.throwIfAborted();
  localPoints = parseCollectionPointSnapshot(text);
  return localPoints;
}

async function readJson(url: string, fileName: string, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`无法读取 ${fileName}（HTTP ${response.status}）。`);
  return response.text();
}

export async function loadCollectionHistory(date: string, signal: AbortSignal): Promise<CollectionBatches> {
  const batch = batchFiles(date);
  if (!batch) throw new Error('该日期的收运明细和轨迹 JSON 文件未集齐。');

  const [records, fences, route] = await Promise.all([
    readJson(batch.recordsUrl, batch.records, signal),
    loadLocalPoints(signal),
    readJson(batch.routeUrl, batch.route, signal),
  ]);
  return {
    records: { ...parseCollectionImport(records), fileName: batch.records },
    fences,
    route: { ...parseRouteImport(route), fileName: batch.route },
  };
}
