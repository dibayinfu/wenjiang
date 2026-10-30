import { mockRfid } from "./rfid.ts";
import { validMerchantStreet } from "./merchant-dictionaries.ts";
import { createWeighbridge, validWeighbridge } from "./weighbridge.ts";
import { collectionLines, validCollectionLine } from "./collection-lines.ts";
import { createOperations, isOperations } from "./operations.ts";
import type { DemoState, Merchant, Street, Task } from "./types.ts";

export const streets: Street[] = [
  "柳城街道",
  "涌泉街道",
  "公平街道",
  "天府街道",
];
export const vehicles = Array.from({ length: 23 }, (_, i) => ({
  plate: `川A·WJ${String(i + 1).padStart(3, "0")}`,
  driver: `示例司机 ${i < 4 ? String.fromCharCode(65 + i) : i + 1}`,
}));

export function chinaDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function createSeed(date = chinaDate()): DemoState {
  const names = [
    "锦城小馆",
    "春熙家宴",
    "蓉味食堂",
    "银杏酒店",
    "柳岸火锅",
    "禾香餐厅",
    "花间川菜",
  ];
  const roads = ["柳城大道", "光华大道", "锦绣路", "学府路"];
  const merchants: Merchant[] = streets.flatMap((street, s) =>
    names.map((name, n) => ({
      id: `WJ-SH${String(s * 7 + n + 1).padStart(3, "0")}`,
      name: `${name}（${street.slice(0, 2)}示例店）`,
      street,
      lineId: collectionLines[(s * 7 + n) % collectionLines.length]!.id,
      address: `${street}${roads[s]}${18 + n * 12}号（示例地址）`,
      category: n === 2 ? "单位食堂" : n === 3 ? "酒店餐饮" : "餐饮门店",
      contact: `示例联系人 ${s * 7 + n + 1}`,
      estimatedKg: 60 + ((s * 29 + n * 37) % 240),
      enabled: n !== 6,
      businessStatus: n === 6 ? "歇业" : "营业中",
      area: 60 + n * 25,
      note: "纯模拟商户档案",
      phone: "13800000000",
    })),
  );
  const tasks: Task[] = merchants
    .filter((m) => m.enabled)
    .map((m, i) => ({
      id: `WJ-RW${String(i + 1).padStart(3, "0")}`,
      merchantId: m.id,
      pointId: `PT${merchants.findIndex((x) => x.id === m.id) + 1}`,
      buckets: i % 6 < 3 ? 2 + (i % 4) : null,
      rfids:
        i % 6 < 3
          ? Array.from(
              { length: 2 + (i % 4) },
              (_, j) =>
                mockRfid(merchants.findIndex((x) => x.id === m.id), j % (2 + (merchants.findIndex((x) => x.id === m.id) % 3))),
            )
          : [],
      date,
      vehicle: vehicles[Math.floor(i / 6)]!.plate,
      driver: vehicles[Math.floor(i / 6)]!.driver,
      timeWindow: i % 6 < 3 ? "08:00–10:00" : "10:00–12:00",
      status: i % 6 < 3 ? "已完成" : i % 6 === 3 ? "收运中" : "待收运",
      plannedKg: m.estimatedKg,
      actualKg: i % 6 < 3 ? m.estimatedKg - 5 + (i % 3) * 4 : null,
      completedAt:
        i % 6 < 3 ? `${date} 09:${String(10 + i).padStart(2, "0")}` : null,
    }));
  const state: DemoState = {
    version: 3,
    date,
    merchants,
    tasks,
    ...createOperations(date, merchants, tasks),
  };
  state.weighbridge = createWeighbridge(state);
  return state;
}

export function summarize(state: DemoState) {
  const completed = state.tasks.filter((t) => t.status === "已完成");
  const active = state.merchants.filter((m) => m.enabled);
  const serviced = new Set(completed.map((t) => t.merchantId));
  return {
    totalKg: completed.reduce((sum, t) => sum + (t.actualKg ?? 0), 0),
    merchants: state.merchants.length,
    activeMerchants: active.length,
    servicedMerchants: active.filter((m) => serviced.has(m.id)).length,
    completed: completed.length,
    total: state.tasks.length,
    pending: state.tasks.filter((t) => t.status === "待收运").length,
    running: state.tasks.filter((t) => t.status === "收运中").length,
    completionRate: state.tasks.length
      ? Math.round((completed.length / state.tasks.length) * 100)
      : 0,
  };
}

export function advanceTask(state: DemoState, taskId: string) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task || task.status !== "待收运") return false;
  task.status = "收运中";
  return true;
}

// 只恢复当前版本、当天且结构完整的数据，避免旧缓存破坏页面。
export function isDemoState(
  value: unknown,
  date = chinaDate(),
): value is DemoState {
  if (!value || typeof value !== "object") return false;
  try {
    const s = value as DemoState;
    if (
      s.version !== 3 ||
      s.date !== date ||
      !Array.isArray(s.merchants) ||
      !Array.isArray(s.tasks) ||
      !Array.isArray(s.fleet) ||
      s.fleet.length !== 23 ||
      !Array.isArray(s.points) ||
      !Array.isArray(s.routes) ||
      !Array.isArray(s.alerts) ||
      !Array.isArray(s.devices) ||
      !Array.isArray(s.staff) ||
      !Array.isArray(s.history) ||
      !s.project
    )
      return false;
    if (s.weighbridge !== undefined && (!Array.isArray(s.weighbridge) || !s.weighbridge.every(validWeighbridge) || new Set(s.weighbridge.map(r => `${r.device}|${r.sourceId}`)).size !== s.weighbridge.length)) return false;
    const ids = new Set<string>();
    for (const m of s.merchants) {
      if (
        !m ||
        typeof m.id !== "string" ||
        !/^WJ-SH\d+$/.test(m.id) ||
        ids.has(m.id) ||
        typeof m.name !== "string" ||
        !m.name.trim() ||
        !validMerchantStreet(m.street) ||
        !validCollectionLine(m.lineId) ||
        (m.allocatedBins !== undefined && (![120, 240, 660].every(size => Number.isInteger(m.allocatedBins?.[size as 120 | 240 | 660]) && m.allocatedBins![size as 120 | 240 | 660] >= 0 && m.allocatedBins![size as 120 | 240 | 660] <= 1000))) ||
        typeof m.address !== "string" ||
        typeof m.contact !== "string" ||
        !["餐饮门店", "单位食堂", "酒店餐饮"].includes(m.category) ||
        !Number.isFinite(m.estimatedKg) ||
        m.estimatedKg <= 0 ||
        !["营业中", "停业", "歇业"].includes(m.businessStatus) ||
        !Number.isFinite(m.area) ||
        m.area < 0 ||
        typeof m.note !== "string" ||
        typeof m.enabled !== "boolean"
      )
        return false;
      ids.add(m.id);
    }
    const taskIds = new Set<string>();
    for (const t of s.tasks) {
      if (
        !t ||
        typeof t.id !== "string" ||
        !/^WJ-RW\d+$/.test(t.id) ||
        taskIds.has(t.id) ||
        !ids.has(t.merchantId) ||
        !Array.isArray(t.rfids) ||
        !t.rfids.every((r) => typeof r === "string") ||
        t.date !== date ||
        !s.points.some(
          (p) => p && p.id === t.pointId,
        ) ||
        typeof t.driver !== "string" ||
        !s.fleet.some((v) => v.plate === t.vehicle) ||
        typeof t.timeWindow !== "string" ||
        !["待收运", "收运中", "已完成"].includes(t.status) ||
        !Number.isFinite(t.plannedKg) ||
        t.plannedKg <= 0 ||
        (t.status === "已完成"
          ? !Number.isFinite(t.actualKg) ||
            t.actualKg! < 0 ||
            t.rfids.length !== t.buckets ||
            !Number.isInteger(t.buckets) ||
            t.buckets! < 1 ||
            t.buckets! > 100 ||
            typeof t.completedAt !== "string"
          : t.actualKg !== null || t.completedAt !== null || t.buckets !== null)
      )
        return false;
      taskIds.add(t.id);
    }
    return isOperations(s);
  } catch {
    return false;
  }
}

export function finishTask(
  state: DemoState,
  id: string,
  kg: number,
  now = new Date(),
  buckets = 1,
) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task || task.status !== "收运中")
    throw new Error("只有收运中的记录可以完成");
  if (!Number.isFinite(kg) || kg < 0 || kg > 10000)
    throw new Error("净重应为 0–10000 kg");
  if (!Number.isInteger(buckets) || buckets < 1 || buckets > 100)
    throw new Error("桶数应为1–100的整数");
  const bound = state.bins.filter(
    (b) => b.pointId === task.pointId && b.status === "在用",
  );
  if (!bound.length) throw new Error("收集点没有在用RFID桶，请先核对绑定");
  task.rfids = Array.from(
    { length: buckets },
    (_, i) => bound[i % bound.length]!.rfid,
  );
  task.actualKg = Math.round(kg * 10) / 10;
  task.buckets = buckets;
  task.status = "已完成";
  task.completedAt = `${state.date} ${new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit" }).format(now)}`;
}
