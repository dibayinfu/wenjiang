import { isMapCoordinate } from './point-fence.ts';
import { bd09ToGcj02, wgs84ToGcj02 } from './collection-coordinates.ts';

interface CollectionImportRow {
  id: number;
  merchantName: string;
  collectionPoint: string;
  routeName: string;
  plateNumber: string;
  createTime: string;
  rfid: string;
  weight: string;
}

export interface CollectionImportPoint {
  position: [number, number];
  rows: CollectionImportRow[];
}

interface CollectionFencePoint {
  position: [number, number];
  names: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function coordinate(value: unknown) {
  if (typeof value === 'string' && value.trim()) return Number(value);
  return value;
}

function readPosition(longitude: unknown, latitude: unknown) {
  const position = [coordinate(longitude), coordinate(latitude)];
  if (isMapCoordinate(position) && (position[0] !== 0 || position[1] !== 0)) return position;
}

function display(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '—';
}

function readData(text: string) {
  let payload: unknown;
  try {
    payload = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('文件内容不是有效的 JSON。');
  }
  if (isObject(payload) && isObject(payload.data)) return payload.data;
}

function readRecords(text: string): unknown[] {
  const records = readData(text)?.list;
  if (!Array.isArray(records)) {
    throw new Error('文件缺少 data.list 数组。');
  }
  return records;
}

export function parseCollectionImport(text: string) {
  const records = readRecords(text);
  if (records.some(record => isObject(record) && 'name' in record && 'fenceId' in record)) {
    throw new Error('这是商户收集点文件，请使用「导入商户收集点」。');
  }
  const points = new Map<string, CollectionImportPoint>();
  let skipped = 0;
  records.forEach((record, index) => {
    const position = isObject(record) ? readPosition(record.lng, record.lat) : undefined;
    if (!position || !isObject(record)) {
      skipped++;
      return;
    }

    const key = position.join(',');
    let point = points.get(key);
    if (!point) {
      point = { position: wgs84ToGcj02(position), rows: [] };
      points.set(key, point);
    }
    point.rows.push({
      id: index,
      merchantName: display(record.merchantName),
      collectionPoint: display(record.collectionPoint),
      routeName: display(record.routeName),
      plateNumber: display(record.plateNumber),
      createTime: display(record.createTime),
      rfid: display(record.rfid),
      weight: display(record.weight),
    });
  });

  return { total: records.length, skipped, points: [...points.values()] };
}

export function parseFenceImport(text: string) {
  const records = readRecords(text);
  if (records.length && !records.some(record => isObject(record) && 'name' in record)) {
    throw new Error('文件缺少商户收集点名称（name）。');
  }

  const points = new Map<string, CollectionFencePoint>();
  let skipped = 0;
  for (const record of records) {
    const position = isObject(record) ? readPosition(record.lng, record.lat) : undefined;
    if (!position || !isObject(record) || typeof record.name !== 'string' || !record.name.trim()) {
      skipped++;
      continue;
    }

    const key = position.join(',');
    let point = points.get(key);
    if (!point) {
      point = { position: bd09ToGcj02(position), names: [] };
      points.set(key, point);
    }
    point.names.push(record.name);
  }

  return { total: records.length, skipped, points: [...points.values()] };
}

export function parseRouteImport(text: string) {
  const positions: unknown = readData(text)?.positions;
  if (!Array.isArray(positions)) {
    throw new Error('文件缺少 data.positions 轨迹数组。');
  }

  const path: [number, number][] = [];
  let skipped = 0;
  for (const row of positions as unknown[]) {
    // 轨迹导出的 valid / validPos 可能全为 false，绘图以坐标值为准。
    const position = isObject(row) ? readPosition(row.longitude, row.latitude) : undefined;
    if (!position) {
      skipped++;
      continue;
    }
    const previous = path.at(-1);
    if (previous?.[0] === position[0] && previous[1] === position[1]) continue;
    path.push(position);
  }
  if (path.length < 2) {
    throw new Error('路线至少需要两个不同的有效坐标点。');
  }

  return { total: positions.length, skipped, path: path.map(wgs84ToGcj02) };
}
