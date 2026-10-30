import type { DemoState } from './types.ts';
import { collectionLines } from './collection-lines.ts';
import { merchantProfile } from './merchant-profile.ts';
import { randomPointLocation } from './point-location.ts';
export const lineColors=['#165DFF','#008B74','#D46210','#9333C8','#D52C56','#007EAF','#6860CA','#4E8228','#B34B00','#B12BA9','#008585','#A73645','#5362A0','#875A30','#376D9A','#647526'];
export function merchantMapStyle(state: DemoState, merchantId: string) {
  const merchant=state.merchants.find(m=>m.id===merchantId);
  const lineIndex=collectionLines.findIndex(line=>line.id===merchant?.lineId);
  const profile=merchant ? merchantProfile(state,merchant) : undefined;
  return {line:collectionLines[lineIndex]?.name ?? '未设置线路',color:lineColors[lineIndex] ?? '#86909c',buckets:profile ? profile.bucket120+profile.bucket240+profile.bucket660 : 0};
}
export function ensureMerchantMapPoints(state: DemoState) {
  // 复用本项目商户、原有收集点及桶资产，不生成新的收运流水。
  for(let i=state.points.length;i<200;i++) {
    const merchant=state.merchants[i%state.merchants.length];
    if(!merchant)break;
    const id=`PT-MAP-${String(i+1).padStart(3,'0')}`;
    if(state.points.some(point=>point.id===id))continue;
    const [longitude,latitude]=randomPointLocation(id);
    state.points.push({id,merchantId:merchant.id,name:`${merchant.name}收集点${i+1}`,address:merchant.address,category:'商户收集点',estimatedKg:merchant.estimatedKg,x:10+(i*17%80),y:10+(i*23%80),longitude,latitude});
  }
}
