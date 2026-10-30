export const streetDictionary=['柳城街道','公平街道','天府街道','涌泉街道','金马街道','永宁街道'] as const;
export function validMerchantStreet(street:unknown){return streetDictionary.includes(street as typeof streetDictionary[number]);}
export function merchantMatchesFilters(m:{lineId?:string;street:string;enabled:boolean;businessStatus:string},filters:{line:string;street:string;status:string}){
 const operating=m.enabled&&m.businessStatus==='营业中';
 return (filters.line==='全部线路'||(m.lineId??'')===filters.line)&&(!filters.street||m.street===filters.street)&&(filters.status==='全部状态'||(filters.status==='运营中'?operating:!operating));
}

// 保留旧模拟档案的其余字段，仅清理已移除字段并补齐街道。
export function migrateMerchantStreet<T extends {street?:unknown;address?:unknown;township?:unknown}>(merchant:T) {
 const {township:_legacy,...current}=merchant;
 return {...current,street:validMerchantStreet(current.street)?current.street:streetDictionary.find(street=>String(current.address??'').includes(street))??streetDictionary[0]};
}
