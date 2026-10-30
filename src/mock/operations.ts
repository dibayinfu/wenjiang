import { createSanitation, ruleKinds } from "./sanitation.ts";
import type { SanitationData } from "./sanitation.ts";
import type { DemoState, Merchant, Task } from "./types.ts";
export interface Vehicle {
  id: string;
  plate: string;
  driver: string;
  type: string;
  status: string;
  attendance: boolean;
  battery: number;
  mileage: number;
  insurance: string;
  maintenance: string;
  purchased: string;
  x: number;
  y: number;
}
export type PointFence = {type:'circle';center:[number,number];radius:number} | {type:'polygon';path:[number,number][]};
export interface Point {
  organizationId?: string;
  note?: string;
  fence?: PointFence;
  longitude?: number;
  latitude?: number;
  id: string;
  merchantId: string;
  name: string;
  address: string;
  category: string;
  estimatedKg: number;
  x: number;
  y: number;
}
export interface RoutePlan {
  id: string;
  name: string;
  pointIds: string[];
  mode: string;
  enabled: boolean;
  note: string;
  sourceVehicle: string;
  sourceDate: string;
}
export interface Alert {
  merchantId: string;
  pointId: string;
  ruleId: string;
  occurrences: number;
  handledAt: string | null;
  criteria: string;
  id: string;
  vehicle: string;
  taskId: string;
  type: string;
  level: string;
  time: string;
  status: string;
  owner: string;
  note: string;
  logs: string[];
}
export interface Device {
  id: string;
  name: string;
  vehicle: string;
  pointId: string;
  type: string;
  status: string;
  checked: string;
}
export interface Staff {
  id: string;
  name: string;
  role: string;
  attendance: boolean;
}
export interface RecordRow {
  driver?: string;
  rfids?: string[];
  id: string;
  date: string;
  merchantId: string;
  pointId: string;
  vehicle: string;
  kg: number;
  buckets: number;
  km: number;
}
export interface Operations {
  fleet: Vehicle[];
  points: Point[];
  routes: RoutePlan[];
  alerts: Alert[];
  devices: Device[];
  staff: Staff[];
  history: RecordRow[];
  project: {
    name: string;
    targetKg: number;
  };
}
export function createOperations(
  date: string,
  merchants: Merchant[],
  tasks: Task[],
): Operations & SanitationData {
  const fleet: Vehicle[] = Array.from({ length: 23 }, (_, i) => ({
    id: `CAR${i + 1}`,
    plate: `川A·WJ${String(i + 1).padStart(3, "0")}`,
    driver: `示例司机 ${i < 4 ? String.fromCharCode(65 + i) : i + 1}`,
    type: i < 10 ? "10m³餐厨车" : i < 20 ? "5m³餐厨车" : "自装卸车",
    status: i === 22 ? "维修中" : i === 21 ? "离线" : "在线",
    attendance: i < 18,
    battery: 92 - i * 3,
    mileage: 28 + i * 2,
    insurance: shiftDate(date, i === 0 ? 7 : 120 + i),
    maintenance: shiftDate(date, i === 1 ? 3 : 30 + i),
    purchased: "2025-01-15",
    x: 12 + (i % 6) * 14,
    y: 20 + Math.floor(i / 6) * 19,
  }));
  const points = merchants.map((m, i) => ({
    id: `PT${i + 1}`,
    merchantId: m.id,
    name: `${m.name}收集点`,
    address: m.address,
    category: "商户收集点",
    estimatedKg: m.estimatedKg,
    x: 10 + (i % 7) * 12,
    y: 17 + Math.floor(i / 7) * 20,
  }));
  const history: RecordRow[] = [];
  for (let d = 365; d > 0; d--)
    for (let i = 0; i < 24; i++) {
      const kg = merchants[i]!.estimatedKg + (((d + i) % 11) - 5) * 3;
      history.push({
        id: `H${d}-${i}`,
        date: shiftDate(date, -d),
        merchantId: merchants[i]!.id,
        pointId: points[i]!.id,
        vehicle: fleet[Math.floor(i / 6)]!.plate,
        driver: fleet[Math.floor(i / 6)]!.driver,
        kg,
        buckets: 2 + ((d + i) % 4),
        km: 2 + (i % 5),
      });
    }
  const routes: RoutePlan[] = fleet.slice(0, 4).map((v, i) => ({
    id: `LINE${i + 1}`,
    name: `${["柳城", "涌泉", "公平", "天府"][i]}早班线`,
    pointIds: tasks.filter((t) => t.vehicle === v.plate).map((t) => t.pointId),
    sourceVehicle: v.plate,
    sourceDate: date,
    mode: "根据车辆轨迹",
    enabled: true,
    note: "模拟线路，可按收集点顺序调整",
  }));
  return {
    ...createSanitation(date, merchants, tasks, points, routes),
    fleet,
    points,
    history,
    routes,
    alerts: [
      {
        id: "AL001",
        type: "垃圾量异常预警",
        status: "待处理",
        note: "模拟商户完整周收运量较上周下降35%",
        ruleId: "RULE1",
      },
      {
        id: "AL002",
        type: "桶数减少",
        status: "处理中",
        note: "模拟商户完整周收运桶数下降40%，需核对经营情况",
        ruleId: "RULE2",
      },
      {
        id: "AL003",
        type: "称重异常报警",
        status: "待处理",
        note: "模拟负净重已隔离为待核验记录，未计入有效收运量",
        ruleId: "RULE3",
      },
      {
        id: "AL004",
        type: "RFID标签异常报警",
        status: "已关闭",
        note: "已复核演示标签，不修改历史称重归属",
        ruleId: "RULE5",
      },
      {
        id: "AL005",
        type: "位置不匹配报警",
        status: "待处理",
        note: "模拟称重位置距绑定点50m",
        ruleId: "RULE4",
      },
      {
        id: "AL006",
        type: "超速",
        status: "待处理",
        note: "模拟车速65km/h，限速50km/h",
        ruleId: "",
      },
    ].map((a, i) => ({
      ...a,
      vehicle:
        i === 3 ? fleet[1]!.plate : tasks[[0, 6, 0, 9, 12, 3][i]!]!.vehicle,
      taskId: i === 3 ? "" : tasks[[0, 6, 0, 9, 12, 3][i]!]!.id,
      merchantId: i === 3 ? "" : tasks[[0, 6, 0, 9, 12, 3][i]!]!.merchantId,
      pointId: i === 3 ? "" : tasks[[0, 6, 0, 9, 12, 3][i]!]!.pointId,
      level: i === 2 ? "高" : "中",
      time: `${date} 09:${String(10 + i * 3).padStart(2, "0")}`,
      owner: a.status === "待处理" ? "" : "示例运营员",
      logs: [`系统生成模拟事件：${a.type}`],
      occurrences: i + 1,
      handledAt: a.status === "已关闭" ? `${date} 10:00` : null,
      criteria: a.ruleId
        ? ([
            "完整自然周重量下降≥30%",
            "完整自然周桶数下降≥30%",
            "净重>260kg或≤-5kg",
            "RFID无法识别或未绑定",
            "距离>30m",
          ][i] ?? "")
        : "车速>50km/h",
    })),
    devices: fleet.flatMap((v, i) =>
      ["视频终端", "称重设备", "RFID读卡器"].map((type, j) => ({
        id: `DEV${i + 1}-${j + 1}`,
        name: `${v.plate}${type}`,
        vehicle: v.plate,
        pointId: "",
        type,
        status: i === 21 ? "离线" : "在线",
        checked: date,
      })),
    ),
    staff: fleet.map((v, i) => ({
      id: `STAFF${i + 1}`,
      name: v.driver,
      role: "驾驶员",
      attendance: v.attendance,
    })),
    project: {
      name: "温江餐厨垃圾收运项目",
      targetKg: 8000,
    },
  };
}
export function shiftDate(date: string, days: number) {
  return new Date(
    new Date(`${date}T12:00:00+08:00`).getTime() + days * 86400000,
  )
    .toISOString()
    .slice(0, 10);
}
export function records(state: DemoState): RecordRow[] {
  return [
    ...state.history,
    ...state.tasks
      .filter((t) => t.status === "已完成")
      .map((t) => ({
        id: t.id,
        date: t.date,
        merchantId: t.merchantId,
        pointId: t.pointId,
        vehicle: t.vehicle,
        driver: t.driver,
        rfids: t.rfids,
        kg: t.actualKg ?? 0,
        buckets: t.buckets ?? 0,
        km: 3,
      })),
  ];
}
export function vehicleStats(
  state: DemoState,
  plate: string,
  date = state.date,
) {
  const rs = records(state).filter(
    (r) => r.vehicle === plate && r.date === date,
  );
  return {
    kg: rs.reduce((n, r) => n + r.kg, 0),
    buckets: rs.reduce((n, r) => n + r.buckets, 0),
    points: new Set(rs.map((r) => r.pointId)).size,
  };
}
export function handleAlert(
  state: DemoState,
  id: string,
  status: string,
  owner: string,
  note: string,
) {
  const a = state.alerts.find((a) => a.id === id);
  if (!a) throw new Error("告警不存在");
  if (a.status === "已关闭") throw new Error("该告警已关闭");
  if (!owner.trim() || !note.trim()) throw new Error("请填写处理人和处理说明");
  if (!["处理中", "已关闭"].includes(status)) throw new Error("无效处理状态");
  a.status = status;
  a.owner = owner.trim();
  if (status === "已关闭")
    a.handledAt = `${state.date} ${new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit" }).format(new Date())}`;
  a.logs.push(`${status} · ${a.owner}：${note.trim()}`);
}

// 浏览器缓存不可信：恢复前检查结构、唯一编号和外键，错误数据统一回退种子。
export function isOperations(s: DemoState): boolean {
  try {
    const unique = (rows: { id: string }[]) =>
      rows.every((r) => r && typeof r.id === "string" && r.id.length > 0) &&
      new Set(rows.map((r) => r.id)).size === rows.length;
    const str = (v: unknown) => typeof v === "string";
    const num = (v: unknown, min = 0, max = 1000000) =>
      typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
    const date = (v: unknown) =>
      str(v) && /^\d{4}-\d{2}-\d{2}$/.test(v as string);
    const hasVehicle = (v: string) => s.fleet.some((f) => f.plate === v);
    const hasMerchant = (id: string) => s.merchants.some((m) => m.id === id);
    const hasPoint = (id: string) => s.points.some((p) => p.id === id);
    if (
      ![
        s.fleet,
        s.points,
        s.routes,
        s.alerts,
        s.devices,
        s.staff,
        s.history,
      ].every((r) => Array.isArray(r) && unique(r))
    )
      return false;
    if (new Set(s.fleet.map((v) => v.plate)).size !== 23) return false;
    if (
      !s.fleet.every(
        (v) =>
          str(v.plate) &&
          str(v.driver) &&
          str(v.type) &&
          ["在线", "离线", "维修中"].includes(v.status) &&
          typeof v.attendance === "boolean" &&
          num(v.battery, 0, 100) &&
          num(v.mileage) &&
          num(v.x, 0, 100) &&
          num(v.y, 0, 100) &&
          date(v.insurance) &&
          date(v.maintenance) &&
          date(v.purchased),
      )
    )
      return false;
    if (
      !s.points.every(
        (p) =>
          hasMerchant(p.merchantId) &&
          str(p.name) &&
          str(p.address) &&
          str(p.category) &&
          num(p.estimatedKg, 0) &&
          num(p.x, 0, 100) &&
          num(p.y, 0, 100),
      )
    )
      return false;
    if (
      !s.routes.every(
        (r) =>
          str(r.name) &&
          Array.isArray(r.pointIds) &&
          r.pointIds.every(hasPoint) &&
          typeof r.enabled === "boolean" &&
          str(r.mode) &&
          str(r.note),
      )
    )
      return false;
    if (
      !s.alerts.every(
        (a) =>
          hasVehicle(a.vehicle) &&
          (!a.taskId || s.tasks.some((t) => t.id === a.taskId)) &&
          str(a.type) &&
          ["高", "中", "低"].includes(a.level) &&
          str(a.time) &&
          ["待处理", "处理中", "已关闭"].includes(a.status) &&
          str(a.owner) &&
          str(a.note) &&
          Array.isArray(a.logs) &&
          a.logs.every(str),
      )
    )
      return false;
    if (
      !s.devices.every(
        (d) =>
          str(d.name) &&
          ["视频终端", "称重设备", "RFID读卡器", "垃圾桶标签"].includes(
            d.type,
          ) &&
          ["在线", "离线", "维护中"].includes(d.status) &&
          date(d.checked) &&
          (d.type === "垃圾桶标签"
            ? hasPoint(d.pointId) && !d.vehicle
            : hasVehicle(d.vehicle) && !d.pointId),
      )
    )
      return false;
    if (
      !s.staff.every(
        (p) => str(p.name) && str(p.role) && typeof p.attendance === "boolean",
      )
    )
      return false;
    if (
      !s.history.every(
        (r) =>
          date(r.date) &&
          r.date < s.date &&
          hasMerchant(r.merchantId) &&
          hasPoint(r.pointId) &&
          hasVehicle(r.vehicle) &&
          num(r.kg) &&
          num(r.buckets) &&
          num(r.km),
      )
    )
      return false;
    if (
      !Array.isArray(s.bins) ||
      !unique(s.bins) ||
      new Set(s.bins.map((b) => b.rfid)).size !== s.bins.length ||
      new Set(s.bins.map((b) => b.code)).size !== s.bins.length ||
      !s.bins.every(
        (b) =>
          str(b.name) &&
          str(b.code) &&
          str(b.rfid) &&
          [120, 240, 660].includes(b.spec) &&
          hasMerchant(b.merchantId) &&
          s.points.some(
            (p) => p.id === b.pointId && p.merchantId === b.merchantId,
          ) &&
          ["在用", "停用", "维修"].includes(b.status),
      )
    )
      return false;
    if (
      !Array.isArray(s.shifts) ||
      !unique(s.shifts) ||
      !s.shifts.every(
        (x) => str(x.name) && str(x.start) && str(x.end) && x.start < x.end,
      )
    )
      return false;
    if (
      !Array.isArray(s.schedules) ||
      !unique(s.schedules) ||
      !s.schedules.every(
        (x) =>
          date(x.date) &&
          hasVehicle(x.vehicle) &&
          s.shifts.some((z) => z.id === x.shiftId) &&
          s.routes.some((z) => z.id === x.routeId),
      )
    )
      return false;
    if (
      !Array.isArray(s.warningRules) ||
      !unique(s.warningRules) ||
      !s.warningRules.every(
        (r) =>
          ruleKinds.includes(r.type) &&
          str(r.level) &&
          typeof r.enabled === "boolean" &&
          typeof r.periodic === "boolean" &&
          num(r.threshold) &&
          Number.isFinite(r.lower) &&
          Number.isFinite(r.upper) &&
          Array.isArray(r.excludedVehicles) &&
          r.excludedVehicles.every(hasVehicle) &&
          str(r.note),
      )
    )
      return false;
    if (
      !Array.isArray(s.weighExceptions) ||
      !unique(s.weighExceptions) ||
      !s.weighExceptions.every(
        (r) =>
          date(r.date) &&
          hasVehicle(r.vehicle) &&
          Number.isFinite(r.kg) &&
          str(r.reason) &&
          (!r.pointId || hasPoint(r.pointId)) &&
          (!r.merchantId || hasMerchant(r.merchantId)),
      )
    )
      return false;
    return str(s.project.name) && num(s.project.targetKg, 1);
  } catch {
    return false;
  }
}
