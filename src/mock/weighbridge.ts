import type { DemoState } from './types.ts';
import { records } from './operations.ts';
export interface WeighbridgeRecord {
  id: string;
  sourceId: string;
  weighingNo?: string;
  tareAt?: string;
  grossAt?: string;
  date: string;
  weighedAt: string;
  syncedAt: string;
  vehicle: string;
  tareKg: number;
  grossKg: number;
  netKg: number;
  device: string;
}
const round = (n: number) => Math.round(n * 100) / 100;
export const normalizePlate = (s: string) => s.toUpperCase().replace(/[\s·.-]/g, '');
export function validWeighbridge(r: WeighbridgeRecord) {
  return !!r && [r.id,r.sourceId,r.device,r.vehicle,r.date,r.weighedAt,r.syncedAt].every(v => typeof v === 'string' && !!v.trim()) &&
    /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.weighedAt.startsWith(r.date + ' ') &&
    (r.weighingNo === undefined || (typeof r.weighingNo === 'string' && !!r.weighingNo.trim())) &&
    [r.tareAt, r.grossAt].every(t => t === undefined || (typeof t === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(t) && Number.isFinite(Date.parse(t.replace(' ', 'T') + '+08:00')))) &&
    [r.tareKg,r.grossKg,r.netKg].every(n => Number.isFinite(n) && n >= 0) &&
    Math.abs(round(r.tareKg + r.netKg) - r.grossKg) < 0.01;
}
// 只在初始化时生成独立地磅快照；后续模拟收运变化不会反写地磅。
export function createWeighbridge(state: DemoState): WeighbridgeRecord[] {
  const groups = new Map<string, {date:string;vehicle:string;kg:number}>();
  for (const r of records(state)) {
    const key = `${r.date}|${r.vehicle}`;
    const g = groups.get(key);
    if (g) g.kg += r.kg; else groups.set(key, {date:r.date,vehicle:r.vehicle,kg:r.kg});
  }
  return [...groups.values()].flatMap((g,i) => {
    if (i % 11 === 3) return []; // 未同步样例
    const net = i % 13 === 2 ? 0 : round(g.kg * [1,1.025,0.96,1.08][i % 4]!);
    const parts = i % 5 === 0 ? [round(net * 0.4), round(net - round(net * 0.4))] : [net];
    return parts.map((netKg,j) => ({
      id:`WB-${g.date}-${i}-${j}`, sourceId:`LOCAL-${g.date}-${i}-${j}`,
      weighingNo:`DEMO-${g.date.replaceAll('-','')}-${String(i*2+j+1).padStart(5,'0')}`,
      tareAt:`${g.date} ${j ? '15:10:00' : '11:10:00'}`,
      grossAt:`${g.date} ${j ? '15:30:00' : '11:30:00'}`,
      date:g.date, vehicle:g.vehicle, tareKg:8200+i%4*100,
      netKg, grossKg:round(8200+i%4*100+netKg),
      weighedAt:`${g.date} ${j ? '15:30:00' : '11:30:00'}`,
      syncedAt:`${g.date} ${j ? '15:30:10' : '11:30:10'}`,
      device:'处理厂地磅主机（模拟）',
    }));
  });
}
export function compareWeighbridge(data: WeighbridgeRecord[], date: string, vehicle: string, collectionKg: number) {
  const seen = new Set<string>();
  const items = data.filter(r => {
    const key = `${r.device}|${r.sourceId}`;
    if (r.date !== date || normalizePlate(r.vehicle) !== normalizePlate(vehicle) || seen.has(key)) return false;
    seen.add(key); return true;
  });
  const invalid = items.some(r => !validWeighbridge(r));
  const netKg = items.length && !invalid ? round(items.reduce((s,r) => s+r.netKg,0)) : null;
  return {items, netKg, differenceKg:netKg === null ? null : round(collectionKg-netKg),
    accuracy:netKg !== null && netKg > 0 ? round(Math.max(0, Math.min(1, 1 - Math.abs(collectionKg - netKg) / netKg)) * 100) : null,
    status:invalid ? '地磅数据异常' : !items.length ? '未同步地磅' : netKg === 0 ? '净重为0' : '已匹配'};
}
