// 2026-11-12 只读核验温江真实系统 /api/collectionPoint/mapPoints。
// 列表导出的 lng/lat 与地图接口存在差异；仅校正围栏 ID 和旧坐标均一致的记录。
// 保留原始导出 JSON；不覆盖同一围栏后续更新的坐标，不据收运 GPS 推算收集点。
export const collectionPointMapCorrections: {
  fenceId: string;
  exportPosition: [number, number];
  mapPosition: [number, number]; // BD-09，真实系统直接传给 BMapGL.Point。
}[] = [
  {
    fenceId: 'geofence-1317211335062327296',
    exportPosition: [103.827297, 30.696341],
    mapPosition: [103.82887539378258, 30.697469709734833]
  },
  {
    fenceId: 'geofence-1317211320914939904',
    exportPosition: [103.836688, 30.69857],
    mapPosition: [103.83664202388766, 30.69864189883187]
  },
  {
    fenceId: 'geofence-1317211289881284608',
    exportPosition: [103.83466, 30.702019],
    mapPosition: [103.83449354991372, 30.702050679278663]
  },
  {
    fenceId: 'geofence-1317211256377184256',
    exportPosition: [103.831211, 30.698936],
    mapPosition: [103.83175201872469, 30.69797640992151]
  },
  {
    fenceId: 'geofence-1317211211670097920',
    exportPosition: [103.817927, 30.693627],
    mapPosition: [103.82058253992658, 30.703188227242137]
  },
  {
    fenceId: 'geofence-1317211184377761792',
    exportPosition: [103.832672, 30.698691],
    mapPosition: [103.83275681514182, 30.698474872563718]
  },
  {
    fenceId: 'geofence-1317211155072159744',
    exportPosition: [103.834853, 30.699911],
    mapPosition: [103.82923638442715, 30.697113498279368]
  },
  {
    fenceId: 'geofence-1317137063895764992',
    exportPosition: [103.828075, 30.695066],
    mapPosition: [103.82805581262, 30.695572353924987]
  },
  {
    fenceId: 'geofence-1317137063908347904',
    exportPosition: [103.83239, 30.708062],
    mapPosition: [103.83247358056828, 30.7080445968744]
  },
  {
    fenceId: 'geofence-1316745240329195520',
    exportPosition: [103.831556, 30.694759],
    mapPosition: [103.81781280217406, 30.695696372735583]
  },
  {
    fenceId: 'geofence-1316745240517939200',
    exportPosition: [103.821656, 30.696674],
    mapPosition: [103.82194965348629, 30.696816506253782]
  },
  {
    fenceId: 'geofence-1316745240526327808',
    exportPosition: [103.822415, 30.702647],
    mapPosition: [103.82217651845512, 30.706042078383554]
  }
];
