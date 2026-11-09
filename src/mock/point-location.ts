import type { Point, PointFence } from './operations.ts';
export const WENJIANG_CENTER: [number, number] = [103.848,30.707];
// 固定种子的随机分布，位于温江城区及万春附近；刷新不改变模拟点位。
export function randomPointLocation(id: string): [number, number] {
  let seed=2166136261;
  for(const char of id) seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
  const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const centers: [number,number][]=[[103.835,30.687],[103.864,30.701],[103.842,30.725],[103.869,30.677],[103.823,30.752]];
  const center=centers[Math.floor(next()*centers.length)]!;
  return [Number((center[0]+(next()-.5)*.024).toFixed(6)),Number((center[1]+(next()-.5)*.019).toFixed(6))];
}
export function pointLocation(point: Point): [number, number] {
  if (Number.isFinite(point.longitude) && Number.isFinite(point.latitude)) return [point.longitude!,point.latitude!];
  return randomPointLocation(point.id);
}

export function demoPointFence(point: Point): PointFence {
  return {type:'circle', center:pointLocation(point), radius:35};
}

export function mockCollectionPosition(origin: [number, number], bucketIndex: number): [number, number] {
  const [longitude, latitude] = origin;
  // 每组第二桶模拟围栏外采集，其余桶分布在原始收集点附近。
  const offset = bucketIndex === 1 ? .00085 : (bucketIndex % 5 - 2) * .000025;
  return [Number((longitude + offset).toFixed(6)), Number((latitude + .000025).toFixed(6))];
}
