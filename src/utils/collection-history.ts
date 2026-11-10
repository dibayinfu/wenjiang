import { parseCollectionImport, parseFenceImport, parseRouteImport } from './collection-import';

export interface CollectionBatches {
  records?: ReturnType<typeof parseCollectionImport> & { fileName: string };
  fences?: ReturnType<typeof parseFenceImport> & { fileName: string };
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
  const fences = `商户收集点${date}.json`;
  const route = files[`${prefix}路线${date}.json`] ? `路线${date}.json` : `轨迹${date}.json`;
  const recordsUrl = files[prefix + records];
  const fencesUrl = files[prefix + fences];
  const routeUrl = files[prefix + route];
  if (recordsUrl && fencesUrl && routeUrl) {
    return { records, fences, route, recordsUrl, fencesUrl, routeUrl };
  }
}

export const collectionHistoryDates = [...new Set(Object.keys(files).map(path => path.split('/').at(-2) ?? ''))]
  .filter(date => /^\d{6}$/.test(date) && batchFiles(date))
  .sort((a, b) => b.localeCompare(a));

async function readJson(url: string, fileName: string, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`无法读取 ${fileName}（HTTP ${response.status}）。`);
  return response.text();
}

export async function loadCollectionHistory(date: string, signal: AbortSignal): Promise<CollectionBatches> {
  const batch = batchFiles(date);
  if (!batch) throw new Error('该日期的三个 JSON 文件未集齐。');

  const [records, fences, route] = await Promise.all([
    readJson(batch.recordsUrl, batch.records, signal),
    readJson(batch.fencesUrl, batch.fences, signal),
    readJson(batch.routeUrl, batch.route, signal),
  ]);
  return {
    records: { ...parseCollectionImport(records), fileName: batch.records },
    fences: { ...parseFenceImport(fences), fileName: batch.fences },
    route: { ...parseRouteImport(route), fileName: batch.route },
  };
}
