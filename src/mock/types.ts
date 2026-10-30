import type { SanitationData } from "./sanitation.ts";
import type { Operations } from "./operations.ts";
export type Street = typeof import("./merchant-dictionaries.ts").streetDictionary[number];
export type TaskStatus = "待收运" | "收运中" | "已完成";
export interface Merchant {
  id: string;
  name: string;
  lineId?: string;
  street: Street | "";
  address: string;
  category: "餐饮门店" | "单位食堂" | "酒店餐饮";
  contact: string;
  estimatedKg: number;
  enabled: boolean;
  businessStatus: "营业中" | "停业" | "歇业";
  area: number;
  allocatedBins?: Record<120 | 240 | 660, number>;
  note: string;
  phone?: string;
  license?: string;
  signedAt?: string;
}
export interface Task {
  id: string;
  merchantId: string;
  pointId: string;
  buckets: number | null;
  rfids: string[];
  date: string;
  vehicle: string;
  driver: string;
  timeWindow: string;
  status: TaskStatus;
  plannedKg: number;
  actualKg: number | null;
  completedAt: string | null;
}
export interface DemoState extends Operations, SanitationData {
  collectionPointBindings?: Record<string, string>;
  weighbridge?: import("./weighbridge.ts").WeighbridgeRecord[];
  version: 3;
  date: string;
  merchants: Merchant[];
  tasks: Task[];
}
