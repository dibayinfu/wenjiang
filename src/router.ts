import { createRouter, createWebHashHistory } from "vue-router";

export const navigation = [
  {
    path: "/overview",
    title: "运营总览",
    icon: "dashboard",
    caption: "项目运营一目了然",
  },
  {
    path: "/tasks",
    title: "收运作业",
    icon: "truck",
    caption: "计划派发与作业跟踪",
  },
  {
    path: "/merchants",
    title: "餐厨商户",
    icon: "shop",
    caption: "产废单位与收运档案",
  },
];

export const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: "/", redirect: "/overview" },
    {
      path: "/overview",
      component: () => import("./views/Overview.vue"),
      meta: { title: "运营总览" },
    },
    {
      path: "/tasks",
      component: () => import("./views/Tasks.vue"),
      meta: { title: "收运作业" },
    },
    {
      path: "/merchants",
      component: () => import("./views/Merchants.vue"),
      meta: { title: "餐厨商户" },
    },
    { path: "/:pathMatch(.*)*", redirect: "/overview" },
  ],
});
router.afterEach((to) => {
  document.title = `${to.meta.title} · 温江餐厨`;
});
