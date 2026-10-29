import { computed, reactive, ref, watch } from "vue";
import { chinaDate, createSeed, isDemoState, summarize } from "./model";
import type { DemoState } from "./types";

const STORAGE_KEY = "wenjiang:prototype:v1";
export const storageUnavailable = ref(false);

function restore(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isDemoState(parsed)) return parsed;
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
  return demo.merchants.find((m) => m.id === id)?.name ?? "未知商户";
}
