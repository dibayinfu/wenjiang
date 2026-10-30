export function nextManifestNumber(date:string,organizationId:string,documents:{number?:string;organizationId?:string}[]){
 const prefix=date.replaceAll('-','');let max=0;
 for(const d of documents){if(d.organizationId!==organizationId||!d.number?.startsWith(prefix)||!/^\d{12}$/.test(d.number))continue;max=Math.max(max,Number(d.number.slice(8)));}
 if(max>=9999)throw new Error('该机构当日联单编号已达到9999，请联系管理员');
 return prefix+String(max+1).padStart(4,'0');
}
