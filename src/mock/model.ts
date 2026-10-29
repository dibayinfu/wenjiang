import type { DemoState, Merchant, Street, Task } from "./types.ts";

export const streets: Street[] = [
  "柳城街道",
  "涌泉街道",
  "公平街道",
  "天府街道",
];
export const vehicles = [
  { plate: "川A·WJ001", driver: "示例司机 A" },
  { plate: "川A·WJ002", driver: "示例司机 B" },
  { plate: "川A·WJ003", driver: "示例司机 C" },
  { plate: "川A·WJ004", driver: "示例司机 D" },
];

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
      address: `${street}${roads[s]}${18 + n * 12}号（示例地址）`,
      category: n === 2 ? "单位食堂" : n === 3 ? "酒店餐饮" : "餐饮门店",
      contact: `示例联系人 ${s * 7 + n + 1}`,
      frequency: n === 4 ? "每日两次" : "每日一次",
      estimatedKg: 60 + ((s * 29 + n * 37) % 240),
      enabled: n !== 6,
    })),
  );
  const tasks: Task[] = merchants
    .filter((m) => m.enabled)
    .map((m, i) => ({
      id: `WJ-RW${String(i + 1).padStart(3, "0")}`,
      merchantId: m.id,
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
  return { version: 1, date, merchants, tasks };
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

export function dispatchTask(
  state: DemoState,
  merchantId: string,
  plate: string,
): Task {
  const merchant = state.merchants.find(
    (m) => m.id === merchantId && m.enabled,
  );
  const vehicle = vehicles.find((v) => v.plate === plate);
  if (!merchant || !vehicle) throw new Error("请选择有效的商户和车辆");
  if (
    state.tasks.some(
      (t) => t.merchantId === merchantId && t.status !== "已完成",
    )
  ) {
    throw new Error("该商户已有未完成任务，请先处理现有任务");
  }
  const nextId =
    Math.max(0, ...state.tasks.map((t) => Number(t.id.replace("WJ-RW", "")))) +
    1;
  const task: Task = {
    id: `WJ-RW${String(nextId).padStart(3, "0")}`,
    merchantId,
    date: state.date,
    vehicle: vehicle.plate,
    driver: vehicle.driver,
    timeWindow: "14:00–16:00",
    status: "待收运",
    plannedKg: merchant.estimatedKg,
    actualKg: null,
    completedAt: null,
  };
  state.tasks.unshift(task);
  return task;
}

export function advanceTask(
  state: DemoState,
  taskId: string,
  now = new Date(),
) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task || task.status === "已完成") return false;
  if (task.status === "待收运") task.status = "收运中";
  else {
    task.status = "已完成";
    task.actualKg = task.plannedKg;
    task.completedAt = `${state.date} ${new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      minute: "2-digit",
    }).format(now)}`;
  }
  return true;
}

// 只恢复当前版本、当天且结构完整的数据，避免旧缓存破坏页面。
export function isDemoState(
  value: unknown,
  date = chinaDate(),
): value is DemoState {
  if (!value || typeof value !== "object") return false;
  const s = value as DemoState;
  if (
    s.version !== 1 ||
    s.date !== date ||
    !Array.isArray(s.merchants) ||
    !Array.isArray(s.tasks)
  )
    return false;
  const ids = new Set<string>();
  for (const m of s.merchants) {
    if (
      !m ||
      typeof m.id !== "string" ||
      !/^WJ-SH\d+$/.test(m.id) ||
      ids.has(m.id) ||
      typeof m.name !== "string" ||
      !m.name.trim() ||
      !streets.includes(m.street) ||
      typeof m.address !== "string" ||
      typeof m.contact !== "string" ||
      typeof m.frequency !== "string" ||
      !["餐饮门店", "单位食堂", "酒店餐饮"].includes(m.category) ||
      !Number.isFinite(m.estimatedKg) ||
      m.estimatedKg <= 0 ||
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
      t.date !== date ||
      !vehicles.some((v) => v.plate === t.vehicle && v.driver === t.driver) ||
      typeof t.timeWindow !== "string" ||
      !["待收运", "收运中", "已完成"].includes(t.status) ||
      !Number.isFinite(t.plannedKg) ||
      t.plannedKg <= 0 ||
      (t.status === "已完成"
        ? !Number.isFinite(t.actualKg) ||
          t.actualKg! < 0 ||
          typeof t.completedAt !== "string"
        : t.actualKg !== null || t.completedAt !== null)
    )
      return false;
    taskIds.add(t.id);
  }
  return true;
}
