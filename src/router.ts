import { createRouter, createWebHashHistory } from "vue-router";
import LayoutMix from "./layout/LayoutMix.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      component: LayoutMix,
      redirect: "/overview",
      children: [
        {
          path: "overview",
          name: "WenjiangOverview",
          component: () => import("./views/Overview.vue"),
          meta: { title: "运营总览", affix: true },
        },
        {
          path: "tasks",
          name: "WenjiangTasks",
          component: () => import("./views/Tasks.vue"),
          meta: { title: "收运作业" },
        },
        {
          path: "merchants",
          name: "WenjiangMerchants",
          component: () => import("./views/Merchants.vue"),
          meta: { title: "餐厨商户" },
        },
      ],
    },
    { path: "/:pathMatch(.*)*", redirect: "/overview" },
  ],
});
router.afterEach((to) => {
  document.title = `${to.meta.title} · 温江餐厨`;
});
