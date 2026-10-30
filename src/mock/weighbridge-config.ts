export const weighbridgeSources=['本地主机增量同步','云平台对接'] as const;
export const weighbridgeUnits=['千克','吨'] as const;
export interface WeighbridgeConfig { id:string; organizationId:string; source:typeof weighbridgeSources[number]; unit:typeof weighbridgeUnits[number]; enabled:boolean }
export function validateWeighbridgeConfig(row:WeighbridgeConfig,organizationIds:string[]){
 if(!organizationIds.includes(row.organizationId))return '请选择有效所属机构';
 if(!weighbridgeSources.includes(row.source))return '请选择数据来源';
 if(!weighbridgeUnits.includes(row.unit))return '请选择重量单位';
 if(typeof row.enabled!=='boolean')return '请选择是否开启';
}
export function saveWeighbridgeConfig(list:WeighbridgeConfig[],draft:WeighbridgeConfig,organizationIds:string[]){
 const error=validateWeighbridgeConfig(draft,organizationIds);if(error)throw new Error(error);
 const row={...draft,id:draft.id||`WB-CFG-${crypto.randomUUID()}`};
 if(row.enabled)list.forEach(r=>{if(r.organizationId===row.organizationId)r.enabled=false;});
 const index=list.findIndex(r=>r.id===row.id);if(index<0)list.push(row);else list.splice(index,1,row);return row;
}
// 来源单位在接入时转换，历史已标准化kg的记录不受配置修改影响。
export function sourceWeightToKg(value:number,unit:WeighbridgeConfig['unit']){if(!Number.isFinite(value)||value<0)throw new Error('重量必须为非负数');return Math.round(value*(unit==='吨'?1000:1)*100)/100;}
