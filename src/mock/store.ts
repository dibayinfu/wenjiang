import {migrateMerchantStreet} from "./merchant-dictionaries";
import { migrateRfid } from "./rfid";
import { createWeighbridge } from "./weighbridge";
import { computed, reactive, ref, watch } from "vue";
import { chinaDate, createSeed, isDemoState, summarize } from "./model";
import type { DemoState } from "./types";

const STORAGE_KEY = "wenjiang:prototype:v3";
export const storageUnavailable = ref(false);

function restore(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      // 兼容旧版模拟缓存：移除旧行政字段，为缺少街道的档案补齐模拟归属。
      if(parsed && typeof parsed==='object' && 'merchants' in parsed && Array.isArray(parsed.merchants)) {
        parsed.merchants=parsed.merchants.map(merchant=>{
          if(!merchant||typeof merchant!=='object')return merchant;
          return migrateMerchantStreet(merchant);
        });
      }
      if (isDemoState(parsed)) {
        // 旧缓存仅剔除已移除模块字段，保留现有收运、排班和档案操作。
        const cleaned = { ...parsed } as DemoState & Record<string, unknown>;
        delete cleaned.users;
        delete cleaned.roles;
        delete cleaned.feedbacks;
        cleaned.bins = cleaned.bins.map(bin => ({...bin, rfid: migrateRfid(bin.rfid)}));
        cleaned.tasks = cleaned.tasks.map(task => ({...task, rfids: task.rfids.map(migrateRfid)}));
        cleaned.weighExceptions = cleaned.weighExceptions.map(row => ({...row, rfid: migrateRfid(row.rfid)}));
        cleaned.merchants = parsed.merchants.map((merchant) => {
          const { frequency: _frequency, ...current } =
            merchant as typeof merchant & { frequency?: unknown };
          return { ...current, lineId: current.lineId ?? "" };
        });
        cleaned.project = {
          name: parsed.project.name,
          targetKg: parsed.project.targetKg,
        };
        cleaned.weighbridge ??= createWeighbridge(cleaned);
        // 为旧版纯模拟缓存补充新版样例元信息；不重算或覆盖原有重量快照。
        const samples = new Map(createWeighbridge(cleaned).map(r => [`${r.device}|${r.sourceId}`, r]));
        cleaned.weighbridge = cleaned.weighbridge.map(r => {
          const sample = samples.get(`${r.device}|${r.sourceId}`);
          return { ...r, weighingNo: r.weighingNo ?? sample?.weighingNo,
            tareAt: r.tareAt ?? sample?.tareAt, grossAt: r.grossAt ?? sample?.grossAt };
        });
        return cleaned;
      }
    }
  } catch {
    storageUnavailable.value = true;
  }
  return createSeed();
}

export const demo = reactive<DemoState>(restore());
export const summary = computed(() => summarize(demo));
watch(
  demo,
  (state) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      storageUnavailable.value = true;
    }
  },
  { deep: true },
);

export function resetDemo() {
  Object.assign(demo, createSeed());
}
// 长时间打开页面后，回到页面时切换到当天的演示数据。
window.addEventListener("focus", () => {
  if (demo.date !== chinaDate()) resetDemo();
});

export function merchantName(id: string) {
  if (!id) return "未绑定商户";
  return demo.merchants.find((m) => m.id === id)?.name ?? "未知商户";
}
