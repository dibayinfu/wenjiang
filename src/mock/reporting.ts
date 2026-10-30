import { collectionLines } from "./collection-lines.ts";
import type { DemoState } from "./types.ts";
import { records, shiftDate, type RecordRow } from "./operations.ts";
export const merchantDatePresets = ['今日', '昨日', '近7天', '本月'] as const;
export type MerchantDatePreset = typeof merchantDatePresets[number];
export function merchantDateRange(today: string, preset: MerchantDatePreset): [string, string] {
  if (preset === '今日') return [today, today];
  if (preset === '昨日') {const yesterday=shiftDate(today,-1);return [yesterday,yesterday];}
  if (preset === '近7天') return [shiftDate(today,-6),today];
  return [`${today.slice(0,7)}-01`,today];
}
export function periodRange(date: string, period: string): [string, string] {
  const d = new Date(`${date}T12:00:00+08:00`);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  if (period === "周") {
    const day = d.getUTCDay() || 7;
    const start = shiftDate(date, 1 - day);
    return [start, shiftDate(start, 6)];
  }
  if (period === "月")
    return [
      `${year}-${String(month + 1).padStart(2, "0")}-01`,
      new Date(Date.UTC(year, month + 1, 0, 12)).toISOString().slice(0, 10),
    ];
  if (period === "季度") {
    const m = Math.floor(month / 3) * 3;
    return [
      `${year}-${String(m + 1).padStart(2, "0")}-01`,
      new Date(Date.UTC(year, m + 3, 0, 12)).toISOString().slice(0, 10),
    ];
  }
  if (period === "年") return [`${year}-01-01`, `${year}-12-31`];
  return [date, date];
}
export function aggregateRows(
  state: DemoState,
  rows: RecordRow[],
  dimension: string,
) {
  const groups = new Map<string, RecordRow[]>();
  for (const r of rows) {
    const key =
      dimension === "车辆"
        ? r.vehicle
        : dimension === "商户"
          ? r.merchantId
          : r.pointId;
    const group = groups.get(key);
    if (group) group.push(r);
    else groups.set(key, [r]);
  }
  return [...groups]
    .map(([id, items]) => ({
      id,
      name:
        dimension === "车辆"
          ? id
          : dimension === "商户"
            ? (state.merchants.find((m) => m.id === id)?.name ?? "未知商户")
            : (state.points.find((p) => p.id === id)?.name ?? "未绑定点位"),
      kg: items.reduce((s, r) => s + r.kg, 0),
      buckets: items.reduce((s, r) => s + r.buckets, 0),
      km: items.reduce((s, r) => s + r.km, 0),
      points: new Set(items.map((r) => r.pointId).filter(Boolean)).size,
      merchants: new Set(items.map((r) => r.merchantId)).size,
      count: items.length,
      items,
    }))
    .sort((a, b) => b.kg - a.kg);
}
export function reportRecords(state: DemoState, date: string, period: string) {
  const [start, end] = periodRange(date, period);
  return records(state).filter((r) => r.date >= start && r.date <= end);
}

// 按完整自然日滚动计算；不受页面筛选范围影响，也不包含行日期当天。
export function dailyAverageLookup(rows:RecordRow[]) {
 const totals=new Map<string,number>();const earliest=rows.reduce((d,r)=>!d||r.date<d?r.date:d,'');
 for(const r of rows){const key=`${r.merchantId}|${r.date}`;totals.set(key,(totals.get(key)??0)+r.kg);}
 return (merchantId:string,date:string):number|null=>{if(!earliest||shiftDate(date,-30)<earliest)return null;let total=0;for(let i=1;i<=30;i++)total+=totals.get(`${merchantId}|${shiftDate(date,-i)}`)??0;return Math.round(total/30*100)/100;};
}
// 原型以实际收运停靠点模拟轨迹；不使用车辆固定绑定或计划线路推断归属。
export function matchTrajectoryRoutes(state: DemoState, rows: RecordRow[]) {
  const scores = new Map<string, number>();
  for (const pointId of new Set(rows.map(row => row.pointId))) {
    const point = state.points.find(point => point.id === pointId);
    const merchant = point && state.merchants.find(merchant => merchant.id === point.merchantId);
    const line = collectionLines.find(line => line.id === merchant?.lineId);
    if (line) scores.set(line.id, (scores.get(line.id) ?? 0) + 1);
  }
  // 命中停靠点最多者为最佳线路；同分按线路编号升序，保证唯一、稳定。
  const best = collectionLines.reduce<(typeof collectionLines)[number] | undefined>((best, line) =>
    (scores.get(line.id) ?? 0) > (best ? scores.get(best.id)! : 0) ? line : best, undefined);
  return {
    routeIds: best ? [best.id] : [],
    routeName: best?.name ?? '未匹配',
    routeUnmatched: !best,
  };
}
// 沿用现有四类报表的粒度：日期+车辆、逐桶、日期+点位+车辆、日期+商户。
export function sanitationReport(
  state: DemoState,
  rows: RecordRow[],
  view: string,
  pointScope?: Set<string>,
) {
  const average=view === "商户报表" ? dailyAverageLookup(records(state)) : null;
  const groups = new Map<string, RecordRow[]>();
  for (const row of rows) {
    const id =
      view === "商户报表"
        ? `${row.date}|${row.merchantId}`
        : view === "收集点报表"
          ? `${row.date}|${row.pointId}|${row.vehicle}`
          : `${row.date}|${row.vehicle}`;
    const list = groups.get(id);
    if (list) list.push(row);
    else groups.set(id, [row]);
  }
  return [...groups]
    .map(([id, items]) => {
      const first = items[0]!;
      const pointIds = new Set(items.map((r) => r.pointId));
      const schedules = state.schedules.filter(
        (s) => s.date === first.date && s.vehicle === first.vehicle,
      );
      const planned =
        view === "车辆收运汇总" && first.date === state.date
          ? new Set(
              schedules.flatMap((s) =>
                (
                  state.routes.find((r) => r.id === s.routeId)?.pointIds ?? []
                ).filter((id) => !pointScope || pointScope.has(id)),
              ),
            )
          : null;
      const completed = planned
        ? [...pointIds].filter((id) => planned.has(id)).length
        : null;
      return {
        id,
        ...matchTrajectoryRoutes(state, items),
        date: first.date,
        vehicle:
          view === "商户报表"
            ? [...new Set(items.map((r) => r.vehicle))].join("、")
            : first.vehicle,
        lineId:state.merchants.find(m=>m.id===first.merchantId)?.lineId??'',
        street:state.merchants.find(m=>m.id===first.merchantId)?.street??'',
        merchantStatus:state.merchants.find(m=>m.id===first.merchantId&&m.enabled&&m.businessStatus==='营业中')?'运营中':'已停止',
        dailyAverageKg:average?.(first.merchantId,first.date)??null,
        merchantId: first.merchantId,
        pointId: first.pointId,
        name:
          view === "商户报表"
            ? (state.merchants.find((m) => m.id === first.merchantId)?.name ??
              "未绑定商户")
            : view === "收集点报表"
              ? (state.points.find((p) => p.id === first.pointId)?.name ??
                "未绑定收集点")
              : first.vehicle,
        kg: Math.round(items.reduce((s, r) => s + r.kg, 0) * 100) / 100,
        buckets: items.reduce((s, r) => s + r.buckets, 0),
        points: pointIds.size,
        planned: planned?.size ?? null,
        completed,
        unplanned: planned
          ? [...pointIds].filter((id) => !planned.has(id)).length
          : null,
        missing: planned ? planned.size - (completed ?? 0) : null,
        rate: planned?.size
          ? Math.round(((completed ?? 0) / planned.size) * 100)
          : null,
        estimated:
          view === "商户报表"
            ? (state.merchants.find((m) => m.id === first.merchantId)
                ?.estimatedKg ?? 0)
            : (state.points.find((p) => p.id === first.pointId)?.estimatedKg ??
              0),
        phone:
          state.merchants.find((m) => m.id === first.merchantId)?.phone ?? "—",
        count: items.length,
        items,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.kg - a.kg);
}
