import { mockRfid, validRfid, UNRECOGNIZED_RFID } from "./rfid.ts";
import type { DemoState, Merchant, Task } from "./types.ts";
import type { Point, RoutePlan, RecordRow } from "./operations.ts";
export interface Bin {
  id: string;
  name: string;
  code: string;
  rfid: string;
  spec: number;
  kind: string;
  merchantId: string;
  pointId: string;
  status: string;
  note: string;
}
export interface Shift {
  id: string;
  name: string;
  start: string;
  end: string;
}
export interface Schedule {
  id: string;
  date: string;
  vehicle: string;
  routeId: string;
  shiftId: string;
}
export type RuleKind =
  | "垃圾量异常预警"
  | "桶数减少"
  | "称重异常报警"
  | "位置不匹配报警"
  | "RFID标签异常报警";
export interface WarningRule {
  id: string;
  type: RuleKind;
  level: string;
  enabled: boolean;
  periodic: boolean;
  threshold: number;
  lower: number;
  upper: number;
  excludedVehicles: string[];
  note: string;
}
export interface Weighing {
  id: string;
  recordId: string;
  date: string;
  collectedAt: string;
  vehicle: string;
  merchantId: string;
  pointId: string;
  rfid: string;
  kg: number;
  status: string;
  reason: string;
}
export interface SanitationData {
  bins: Bin[];
  shifts: Shift[];
  schedules: Schedule[];
  warningRules: WarningRule[];
  weighExceptions: Weighing[];
}
export const ruleKinds: RuleKind[] = [
  "垃圾量异常预警",
  "桶数减少",
  "称重异常报警",
  "位置不匹配报警",
  "RFID标签异常报警",
];
export function createSanitation(
  date: string,
  merchants: Merchant[],
  tasks: Task[],
  points: Point[],
  routes: RoutePlan[],
): SanitationData {
  const bins = points.flatMap((p, i) =>
    Array.from({ length: 2 + (i % 3) }, (_, j) => ({
      id: `BIN${i + 1}-${j + 1}`,
      name: `${merchants.find((m) => m.id === p.merchantId)!.name}桶${j + 1}`,
      code: `WJ-B${i + 1}-${j + 1}`,
      rfid: mockRfid(i, j),
      spec: j % 2 ? 240 : 120,
      kind: "餐厨垃圾",
      merchantId: p.merchantId,
      pointId: p.id,
      status: "在用",
      note: "虚构演示资产",
    })),
  );
  return {
    bins,
    shifts: [
      { id: "SHIFT1", name: "早班", start: "08:00", end: "12:00" },
      { id: "SHIFT2", name: "午班", start: "14:00", end: "18:00" },
    ],
    schedules: routes.map((r, i) => ({
      id: `SCH${i + 1}`,
      date,
      vehicle: tasks[i * 6]!.vehicle,
      routeId: r.id,
      shiftId: "SHIFT1",
    })),
    warningRules: ruleKinds.map((type, i) => ({
      id: `RULE${i + 1}`,
      type,
      level: i === 2 ? "高" : "中",
      enabled: true,
      periodic: i < 2,
      threshold: i < 2 ? 30 : 30,
      lower: -5,
      upper: 260,
      excludedVehicles: [],
      note: "演示阈值，可在本地修改；不影响线上配置",
    })),
    weighExceptions: [
      {
        id: "EX001",
        recordId: "",
        date,
        collectedAt: `${date} 09:18:00`,
        vehicle: tasks[0]!.vehicle,
        merchantId: merchants[0]!.id,
        pointId: points[0]!.id,
        rfid: bins[0]!.rfid,
        kg: -6,
        status: "待核验",
        reason: "称重异常：原始净重为负，未计入有效收运量",
      },
      {
        id: "EX002",
        recordId: "",
        date,
        collectedAt: `${date} 09:26:00`,
        vehicle: tasks[6]!.vehicle,
        merchantId: "",
        pointId: "",
        rfid: UNRECOGNIZED_RFID,
        kg: 42,
        status: "待核验",
        reason: "未识别到RFID，未计入有效收运量",
      },
    ],
  };
}
export function pointBins(state: DemoState, id: string) {
  return state.bins.filter((b) => b.pointId === id && b.status === "在用");
}
export function validateBin(state: DemoState, b: Bin): string | undefined {
  if (!b.name?.trim() || !b.code?.trim() || !b.rfid?.trim())
    return "桶名称、编号及RFID必填";
  if (!validRfid(b.rfid)) return "RFID须为14位批次＋8位编码，不能使用未识别标记";
  if (![120, 240, 660].includes(Number(b.spec)))
    return "请选择120L、240L或660L";
  if (
    state.bins.some(
      (x) => x.id !== b.id && (x.code === b.code || x.rfid === b.rfid),
    )
  )
    return "垃圾桶编号及RFID必须唯一";
  if (
    !state.points.some(
      (p) => p.id === b.pointId && p.merchantId === b.merchantId,
    )
  )
    return "收集点必须属于所选商户";
  const old = state.bins.find((x) => x.id === b.id);
  if (
    old &&
    (old.rfid !== b.rfid ||
      old.pointId !== b.pointId ||
      old.merchantId !== b.merchantId) &&
    state.tasks.some((t) => t.pointId === old.pointId && t.status !== "已完成")
  )
    return "原点位还有未完成记录，请完成后调整绑定";
}
export function saveBin(state: DemoState, b: Bin) {
  const error = validateBin(state, b);
  if (error) throw new Error(error);
  const old = state.bins.find((x) => x.id === b.id);
  const normalized = { ...b, spec: Number(b.spec) };
  if (old) Object.assign(old, normalized);
  else state.bins.push(normalized);
}
export function validateShift(state: DemoState, s: Shift): string | undefined {
  if (
    !s.name?.trim() ||
    state.shifts.some((x) => x.id !== s.id && x.name === s.name)
  )
    return "班次名称必填且不能重复";
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.end) ||
    s.start >= s.end
  )
    return "班次应为当日时段，结束时间须晚于开始时间";
}
export function validateSchedule(
  state: DemoState,
  s: Schedule,
  others = state.schedules,
): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) return "请选择有效排班日期";
  const v = state.fleet.find((v) => v.plate === s.vehicle);
  const shift = state.shifts.find((x) => x.id === s.shiftId);
  const route = state.routes.find((x) => x.id === s.routeId && x.enabled);
  if (!v || v.status === "维修中" || !shift || !route)
    return "请选择可用车辆、班次和启用线路";
  if (
    route.pointIds.some(
      (id) =>
        !state.points.some(
          (p) =>
            p.id === id &&
            state.merchants.some(
              (m) =>
                m.id === p.merchantId &&
                m.enabled &&
                m.businessStatus === "营业中",
            ),
        ),
    )
  )
    return "线路含停业或暂停收运商户，请先调整线路";
  if (
    others.some(
      (x) =>
        x.id !== s.id &&
        x.date === s.date &&
        x.vehicle === s.vehicle &&
        (() => {
          const old = state.shifts.find((a) => a.id === x.shiftId);
          return old && old.start < shift.end && shift.start < old.end;
        })(),
    )
  )
    return "该车辆在重叠时段已有排班";
}
export function saveSchedules(state: DemoState, rows: Schedule[]) {
  const pending = state.schedules.filter(
    (x) => !rows.some((r) => r.id === x.id),
  );
  for (const row of rows) {
    const error = validateSchedule(state, row, pending);
    if (error) throw new Error(`${row.date}：${error}`);
    pending.push(row);
  }
  state.schedules.splice(0, state.schedules.length, ...pending);
}
export function weighingRows(
  state: DemoState,
  rows: RecordRow[],
  includeExceptions = true,
): Weighing[] {
  const result: Weighing[] = [];
  for (const row of rows) {
    const count = row.buckets;
    const cents = Math.round(row.kg * 100);
    const base = count ? Math.floor(cents / count) : 0;

    for (let i = 0; i < count; i++)
      result.push({
        id: `${row.id}-B${i + 1}`,
        recordId: row.id,
        date: row.date,
        collectedAt: `${row.date} ${String(8 + Math.floor(i / 60)).padStart(2, "0")}:${String((i * 3 + 10) % 60).padStart(2, "0")}:00`,
        vehicle: row.vehicle,
        merchantId: row.merchantId,
        pointId: row.pointId,
        rfid: row.rfids?.[i] ?? mockRfid(Math.max(0, state.points.findIndex(p => p.id === row.pointId)), i % (2 + (Math.max(0, state.points.findIndex(p => p.id === row.pointId)) % 3))),
        kg: (base + (i < cents % count ? 1 : 0)) / 100,
        status: "有效",
        reason: "",
      });
  }
  if (includeExceptions) result.push(...state.weighExceptions);
  return result.map(row => resolveWeighingPoint(state,row));
}
// 收集点维护不改写已识别事件的商户快照；未绑定事件可补齐归属。
export function resolveWeighingPoint(state:DemoState,row:Weighing):Weighing {
  const point=state.points.find(point=>point.id===state.collectionPointBindings?.[row.id]);
  return point ? {...row,pointId:point.id,merchantId:row.merchantId||point.merchantId} : row;
}

export function ruleDescription(r: WarningRule) {
  return r.type === "垃圾量异常预警" || r.type === "桶数减少"
    ? `较上周减少 ≥ ${r.threshold}%`
    : r.type === "称重异常报警"
      ? `净重 > ${r.upper}kg 或 ≤ ${r.lower}kg`
      : r.type === "位置不匹配报警"
        ? `距离 > ${r.threshold}m`
        : "标签未绑定或无法识别";
}
export function evaluateRule(
  rule: WarningRule,
  sample: {
    vehicle: string;
    baseline?: number;
    current?: number;
    weight?: number;
    distance?: number;
    knownTag?: boolean;
  },
) {
  if (!rule.enabled) return { hit: false, reason: "规则已停用" };
  if (rule.excludedVehicles.includes(sample.vehicle))
    return { hit: false, reason: "车辆在过滤名单中" };
  if (rule.type === "垃圾量异常预警" || rule.type === "桶数减少") {
    if (!Number.isFinite(sample.baseline) || sample.baseline! <= 0)
      return { hit: false, reason: "上周基数为零或缺失，不计算下降比例" };
    if (!Number.isFinite(sample.current) || sample.current! < 0)
      return { hit: false, reason: "当前值无效" };
    const decrease =
      ((sample.baseline! - sample.current!) / sample.baseline!) * 100;
    return {
      hit: decrease >= rule.threshold,
      reason: `同口径较上周减少 ${decrease.toFixed(1)}%`,
    };
  }
  if (rule.type === "称重异常报警")
    return {
      hit:
        Number.isFinite(sample.weight) &&
        (sample.weight! > rule.upper || sample.weight! <= rule.lower),
      reason: `原始净重 ${sample.weight}kg`,
    };
  if (rule.type === "位置不匹配报警")
    return {
      hit:
        Number.isFinite(sample.distance) && sample.distance! > rule.threshold,
      reason: `采集位置距绑定点 ${sample.distance}m`,
    };
  return {
    hit: sample.knownTag === false,
    reason: sample.knownTag ? "RFID已绑定" : "RFID未绑定或无法识别",
  };
}
