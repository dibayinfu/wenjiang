import type { PointFence } from '../mock/operations.ts';
import type { CollectionFencePoint } from './collection-import.ts';
import { bd09ToGcj02, gcj02ToBd09, wgs84ToGcj02 } from './collection-coordinates.ts';
import { isMapCoordinate } from './point-fence.ts';

type Position = [number, number];

export function readCollectionFenceGeometry(boundary: unknown, radius: unknown, fallback?: Position, pointSystem: 'bd09' | 'wgs84' = 'bd09') {
  const entries = typeof boundary === 'string' ? boundary.split(';') : Array.isArray(boundary) ? boundary : [];
  // 与原系统百度绘制规则一致：WGS-84 边界转为 BD-09，保留六位后计算外接矩形中心。
  const path: Position[] = [];
  for (const entry of entries) {
    const values = typeof entry === 'string' ? entry.split(',') : Array.isArray(entry) ? entry : [];
    if (values.length !== 2 || values.some(value => !['string', 'number'].includes(typeof value) || String(value).trim() === '')) continue;
    const position = values.map(Number);
    if (!isMapCoordinate(position) || (position[0] === 0 && position[1] === 0)) continue;
    path.push(gcj02ToBd09(wgs84ToGcj02(position)).map(value => Number(value.toFixed(6))) as Position);
  }
  let center: Position | undefined;
  if (path.length > 2) {
    const xs = path.map(point => point[0]); const ys = path.map(point => point[1]);
    center = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  }
  const meters = typeof radius === 'number' || (typeof radius === 'string' && radius.trim()) ? Number(radius) : NaN;
  if (radius !== undefined && radius !== null && String(radius).trim() !== '' && (!Number.isFinite(meters) || meters < 0)) return;
  if (Number.isFinite(meters) && meters > 0) {
    center ??= fallback ? pointSystem === 'wgs84' ? gcj02ToBd09(wgs84ToGcj02(fallback)) : fallback : path[0];
    if (center) return { centerBd09: center, fromBoundary: path.length > 2, fence: { type: 'circle', center: bd09ToGcj02(center), radius: meters } satisfies PointFence };
  } else if (center && path.length > 2) {
    return { centerBd09: center, fromBoundary: true, fence: { type: 'polygon', path: path.map(bd09ToGcj02) } satisfies PointFence };
  }
}

// 显示与匹配共用同一几何；只有主动选择米数才切换为自定义核验圆。
export function collectionFenceGeometry(point: CollectionFencePoint, radius: number | null = null): PointFence {
  if (radius !== null && radius > 0) return { type: 'circle', center: point.position, radius };
  return point.fence ?? { type: 'circle', center: point.position, radius: 50 };
}
