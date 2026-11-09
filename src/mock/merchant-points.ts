import type { DemoState } from './types.ts';
import type { Point } from './operations.ts';
import { isMapCoordinate, isPointFence } from '../utils/point-fence.ts';
export const pointCategories=['小区','餐饮门店','单位食堂','酒店餐饮','商户收集点'];
export function saveMerchantPoint(state: DemoState, draft: Point) {
  const current = state.points.find(p => p.id === draft.id);
  if (!draft.name.trim() || !draft.address.trim()) throw new Error('请填写收集点名称和地址');
  if (!state.merchants.some(m => m.id === draft.merchantId)) throw new Error('请选择所属商户');
  if (![draft.x, draft.y].every(n => Number.isFinite(n) && n >= 0 && n <= 100)) throw new Error('请在地图范围内选择位置');
  if (draft.longitude !== undefined || draft.latitude !== undefined) {
    if (!isMapCoordinate([draft.longitude, draft.latitude])) throw new Error('地图经纬度无效');
  }
  if (!draft.category.trim()) throw new Error('请选择点位分类');
  if (!Number.isFinite(draft.estimatedKg) || draft.estimatedKg < 0) throw new Error('预估垃圾量不能为负数');
  if (draft.organizationId && draft.organizationId !== 'demo-wenjiang-branch') throw new Error('请选择有效所属机构');
  if (draft.fence != null && !isPointFence(draft.fence)) throw new Error('请绘制有效的收集点范围');
  if (state.points.some(p => p.id !== draft.id && p.merchantId === draft.merchantId && p.name === draft.name.trim())) throw new Error('该商户下已存在同名收集点');
  const point = JSON.parse(JSON.stringify({...draft, fence:draft.fence ?? null, name:draft.name.trim(), address:draft.address.trim()})) as Point;
  if (current) {
    // 当前点位及桶资产一起调整归属，已采集的收运记录保留商户快照。
    if (current.merchantId !== point.merchantId) state.bins.filter(bin=>bin.pointId===point.id).forEach(bin=>{bin.merchantId=point.merchantId;});
    Object.assign(current, point);
  }
  else state.points.push(point);
}
