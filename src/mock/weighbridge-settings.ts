import { reactive, watch } from 'vue';
import { currentOrganization,currentTenant,saasOrganizations } from './manifest-templates';
import {storageUnavailable} from './store';
import {validateWeighbridgeConfig,type WeighbridgeConfig} from './weighbridge-config';
const key=`wenjiang:weighbridge-configs:v2:${currentTenant.id}`;
function restore():WeighbridgeConfig[]{try{const raw=localStorage.getItem(key);if(raw){const rows=JSON.parse(raw);if(Array.isArray(rows)){const restored=rows.filter(r=>!validateWeighbridgeConfig(r,saasOrganizations.map(o=>o.id)));const enabled=new Set<string>();for(const r of restored){if(r.enabled&&enabled.has(r.organizationId))r.enabled=false;else if(r.enabled)enabled.add(r.organizationId);}return restored;}}
 const old=JSON.parse(localStorage.getItem(`wenjiang:weighbridge-settings:${currentTenant.id}:${currentOrganization.id}`)||'null');
 return old?[{id:'WB-CFG-migrated',organizationId:currentOrganization.id,source:old.source==='云平台对接'?'云平台对接':'本地主机增量同步',unit:'千克',enabled:old.enabled===true}]:[];
}catch{return [];}}
export const weighbridgeConfigs=reactive(restore());
export const weighbridgeSettings=reactive({get enabled(){return weighbridgeConfigs.some(r=>r.organizationId===currentOrganization.id&&r.enabled);}});
watch(weighbridgeConfigs,rows=>{try{localStorage.setItem(key,JSON.stringify(rows));}catch{storageUnavailable.value=true;}},{deep:true});
