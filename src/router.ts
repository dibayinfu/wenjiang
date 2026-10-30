import { createRouter, createWebHashHistory } from "vue-router";
import { reportPath } from "./mock/report-pages";
import LayoutMix from "./layout/LayoutMix.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      component: LayoutMix,
      redirect: "/reports/vehicles",
      children: [
        {
          path: "merchants",
          name: "WenjiangMerchants",
          component: () => import("./views/Merchants.vue"),
          meta: { title: "商户管理", group: "商户资产" },
        },
        {
          path: "assets/points",
          name: "WenjiangMerchantPoints",
          component: () => import("./views/MerchantPoints.vue"),
          meta: { title: "商户收集点", group: "商户资产" },
        },
        { path: "reports/manifests", redirect: "/settings/units" },
        { path: "settings/weighbridge", name: "WenjiangWeighbridgeSettings", component: () => import("./views/WeighbridgeSettings.vue"), meta: {title:"地磅设置",group:"业务设置"} },
        { path: "settings/units", name: "WenjiangManifests", component: () => import("./views/Manifests.vue"), meta: {title:"联单设置",group:"业务设置"} },
        {
          path: "reports",
          redirect: to => {
            const { view, ...query } = to.query;
            return { path: reportPath(view), query };
          },
        },
        {
          path: "reports/vehicles", name: "WenjiangVehicleSummary",
          component: () => import("./views/VehicleSummary.vue"),
          meta: { title: "车辆线路日报", group: "作业监管", affix:true },
        },
        {
          path: "reports/details", name: "WenjiangVehicleDetails",
          component: () => import("./views/VehicleDetails.vue"),
          meta: { title: "收运明细", group: "作业监管" },
        },
        {
          path: "reports/merchants", name: "WenjiangMerchantReport",
          component: () => import("./views/MerchantReport.vue"),
          meta: { title: "商户日报", group: "作业监管" },
        },
        {
          path:"reports/merchant-monthly",name:"WenjiangMerchantMonthly",
          component:()=>import("./views/MerchantMonthly.vue"),
          meta:{title:"商户月报",group:"作业监管"},
        },
        {
          path:"reports/regions",name:"WenjiangRegionMonthly",
          component:()=>import("./views/RegionMonthly.vue"),
          meta:{title:"区域月报",group:"作业监管"},
        },

      ],
    },
    { path: "/:pathMatch(.*)*", redirect: "/reports/vehicles" },
  ],
});
router.afterEach((to) => {
  document.title = `${to.meta.title} · 温江项目升级原型`;
});
