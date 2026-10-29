export type Street = "柳城街道" | "涌泉街道" | "公平街道" | "天府街道";
export type TaskStatus = "待收运" | "收运中" | "已完成";
export interface Merchant {
  id: string;
  name: string;
  street: Street;
  address: string;
  category: "餐饮门店" | "单位食堂" | "酒店餐饮";
  contact: string;
  frequency: string;
  estimatedKg: number;
  enabled: boolean;
}
export interface Task {
  id: string;
  merchantId: string;
  date: string;
  vehicle: string;
  driver: string;
  timeWindow: string;
  status: TaskStatus;
  plannedKg: number;
  actualKg: number | null;
  completedAt: string | null;
}
export interface DemoState {
  version: 1;
  date: string;
  merchants: Merchant[];
  tasks: Task[];
}
