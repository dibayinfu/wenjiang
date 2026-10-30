export const reportPages = [
  { path: '/reports/vehicles', title: '车辆线路日报', name: 'WenjiangVehicleSummary' },
  { path: '/reports/details', title: '收运明细', name: 'WenjiangVehicleDetails' },
  { path: '/reports/merchants', title: '商户日报', name: 'WenjiangMerchantReport' },
  { path: '/reports/merchant-monthly', title: '商户月报', name: 'WenjiangMerchantMonthly', upgrade:true },
  { path: '/reports/regions', title: '区域月报', name: 'WenjiangRegionMonthly', upgrade:true },
];
export function reportPath(view: unknown) {
  return reportPages.find(p => p.title === (view === '车辆收运明细' ? '收运明细' : view === '车辆收运汇总' ? '车辆线路日报' : view === '商户联单' || view === '商户报表' ? '商户日报' : view))?.path ?? reportPages[0]!.path;
}
