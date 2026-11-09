import type { PointFence } from '../mock/operations.ts';

export function isMapCoordinate(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 &&
    Number.isFinite(value[0]) && Math.abs(value[0]) <= 180 &&
    Number.isFinite(value[1]) && Math.abs(value[1]) <= 90;
}

export function isPointFence(value: PointFence | null | undefined): value is PointFence {
  if (value?.type === 'circle') {
    return isMapCoordinate(value.center) && Number.isFinite(value.radius) && value.radius > 0;
  }
  return value?.type === 'polygon' && Array.isArray(value.path) &&
    value.path.length >= 3 && value.path.every(isMapCoordinate);
}

export function fenceContains(fence: PointFence, [longitude, latitude]: [number, number]): boolean {
  if (fence.type === 'circle') {
    const [centerLongitude, centerLatitude] = fence.center;
    const radians = Math.PI / 180;
    const a = Math.sin((latitude - centerLatitude) * radians / 2) ** 2 +
      Math.cos(latitude * radians) * Math.cos(centerLatitude * radians) *
      Math.sin((longitude - centerLongitude) * radians / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.sqrt(Math.min(a, 1))) <= fence.radius;
  }

  // 射线穿过奇数条边则位于内部。边界计入命中，重复顶点不参与判断。
  let inside = false;
  const tolerance = 1e-9;
  for (let i = 0; i < fence.path.length; i++) {
    const [x1, y1] = fence.path[i]!;
    const [x2, y2] = fence.path[(i + 1) % fence.path.length]!;
    const dx = x2 - x1, dy = y2 - y1;
    if (dx === 0 && dy === 0) continue;
    const cross = (longitude - x1) * dy - (latitude - y1) * dx;
    if (Math.abs(cross) <= tolerance * Math.hypot(dx, dy) &&
        longitude >= Math.min(x1, x2) - tolerance && longitude <= Math.max(x1, x2) + tolerance &&
        latitude >= Math.min(y1, y2) - tolerance && latitude <= Math.max(y1, y2) + tolerance) {
      return true;
    }
    if ((y1 > latitude) !== (y2 > latitude) && longitude < x1 + (latitude - y1) * dx / dy) {
      inside = !inside;
    }
  }
  return inside;
}
