// 沿用龙安的独立页签状态，保留筛选链接，关闭页签时清理相应缓存。
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { RouteLocationNormalizedLoaded, Router } from "vue-router";

interface PageTab {
  path: string;
  fullPath: string;
  title: string;
  name: string;
}
export const useTabsStore = defineStore("tabs", () => {
  const tabList = ref<PageTab[]>([
    {
      path: "/reports/vehicles",
      fullPath: "/reports/vehicles",
      title: "车辆线路日报",
      name: "WenjiangVehicleSummary",
    },
  ]);
  const reloadKey = ref(0);
  const cacheList = computed(() => tabList.value.map((tab) => tab.name));
  function addTabItem(route: RouteLocationNormalizedLoaded) {
    const tab = {
      path: route.path,
      fullPath: route.fullPath,
      title: String(route.meta.title),
      name: String(route.name),
    };
    const index = tabList.value.findIndex((item) => item.path === tab.path);
    if (index === -1) tabList.value.push(tab);
    else tabList.value[index] = tab;
  }
  function closeCurrent(path: string, router: Router) {
    if (path === "/reports/vehicles") return;
    const index = tabList.value.findIndex((tab) => tab.path === path);
    if (index === -1) return;
    tabList.value.splice(index, 1);
    if (router.currentRoute.value.path === path)
      router.push(tabList.value[Math.max(0, index - 1)]!.fullPath);
  }
  function closeOther(path: string) {
    tabList.value = tabList.value.filter(
      (tab) => tab.path === "/reports/vehicles" || tab.path === path,
    );
  }
  return {
    tabList,
    cacheList,
    reloadKey,
    addTabItem,
    closeCurrent,
    closeOther,
  };
});
