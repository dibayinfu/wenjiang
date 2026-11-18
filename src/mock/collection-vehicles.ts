// 核验地图的车辆选项仅在此维护，不依赖其他项目。
export const collectionVehicles = [{
  label: '川A25533D',
  truckId: '047e07c64d5944809e2caed6d9efe672',
  imei: '60814162490247860',
}];

export type CollectionVehicle = typeof collectionVehicles[number];
