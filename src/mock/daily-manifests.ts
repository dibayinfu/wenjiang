import {nextManifestNumber} from './manifest-number';
import {weighingRows} from './sanitation';
import {normalizePlate} from './weighbridge';
import { computed, reactive, watch } from 'vue';
import { demo, storageUnavailable } from './store';
import { records, shiftDate } from './operations';
import { type ManifestUnit } from './manifests';
import {currentOrganization,regionLayouts,currentTenant,newManifestTemplate,type ManifestTemplate} from './manifest-templates';
export interface DailyManifest { id:string; number?:string; organizationId?:string; key:string; date:string; merchant:string; kg:number; vehicles:string[]; carrier:ManifestUnit; processor:ManifestUnit; generatedAt:string; receiver?:string; oilKg?:number; drivers?:string[]; vehicleDrivers?:{vehicle:string;driver:string}[]; collectionDate?:string; processingDate?:string; template?:ManifestTemplate }
interface State { templates:ManifestTemplate[]; documents:DailyManifest[] }
const storageKey=`wenjiang:daily-manifests:v2:${currentTenant.id}`;
function restore():State {try{const x=JSON.parse(localStorage.getItem(storageKey)||'null');if(x&&Array.isArray(x.templates)&&Array.isArray(x.documents)){const templates=x.templates.filter((t:ManifestTemplate)=>t.tenantId===currentTenant.id).map((t:ManifestTemplate)=>({...t,name:regionLayouts.find(r=>r.id===t.regionId)?.name??regionLayouts[0]!.name,organizationId:t.organizationId??currentOrganization.id,organizationName:currentOrganization.name}));let found=false;for(const t of templates){if(t.enabled&&found)t.enabled=false;else if(t.enabled)found=true;}return {templates,documents:x.documents};}
const old=JSON.parse(localStorage.getItem('wenjiang:daily-manifests:v1')||'null');const template=newManifestTemplate();template.id='TPL-migrated';if(old?.units?.length===2)template.units=old.units;template.enabled=old?.enabled===true;return {templates:[template],documents:Array.isArray(old?.documents)?old.documents:[]};}catch{return {templates:[],documents:[]};}}
export const dailyManifests=reactive(restore());
// 补充旧模拟文书的展示编号，不修改内部ID、重量或单位印章快照。
for(const d of dailyManifests.documents){d.organizationId??=currentOrganization.id;if(!d.number)d.number=nextManifestNumber(d.date,d.organizationId,dailyManifests.documents);}

export const activeManifestTemplate=computed(()=>dailyManifests.templates.find(t=>t.tenantId===currentTenant.id&&(t.organizationId??currentOrganization.id)===currentOrganization.id&&t.enabled));
export const manifestEnabled=computed(()=>!!activeManifestTemplate.value);
// 原型模拟历史凌晨批次已执行；只处理已结束日期，重复加载不覆盖已有快照。
export function runDemoBatch(){const template=activeManifestTemplate.value;if(!template)return;const groups=new Map<string,ReturnType<typeof records>>();for(const r of records(demo)){if(r.date>=demo.date || r.date<shiftDate(demo.date,-7))continue;const key=`${r.date}|${r.merchantId}`;const group=groups.get(key)??[];group.push(r);groups.set(key,group);}const existing=new Set(dailyManifests.documents.filter(d=>(d.organizationId??currentOrganization.id)===currentOrganization.id).map(d=>d.key));for(const [key,rows] of groups){if(existing.has(key))continue;const first=rows[0]!;const next=new Date(`${first.date}T12:00:00+08:00`);next.setUTCDate(next.getUTCDate()+1);dailyManifests.documents.push({id:`DEMO-LD-${crypto.randomUUID()}`,key,organizationId:currentOrganization.id,number:nextManifestNumber(first.date,currentOrganization.id,dailyManifests.documents),collectionDate:weighingRows(demo,rows,false).map(r=>r.collectedAt).sort()[0],processingDate:(demo.weighbridge??[]).filter(w=>w.date===first.date&&rows.some(r=>normalizePlate(r.vehicle)===normalizePlate(w.vehicle))).map(w=>w.grossAt??w.weighedAt).sort()[0]?.slice(0,10),drivers:[...new Set(rows.map(r=>r.driver??'司机待接入'))],vehicleDrivers:[...new Map(rows.map(r=>[`${r.vehicle}|${r.driver??''}`,{vehicle:r.vehicle,driver:r.driver??'司机待接入'}])).values()],template:JSON.parse(JSON.stringify(template)),date:first.date,merchant:demo.merchants.find(m=>m.id===first.merchantId)?.name??'未知商户',kg:rows.reduce((s,r)=>s+r.kg,0),vehicles:[...new Set(rows.map(r=>r.vehicle))],carrier:JSON.parse(JSON.stringify(template.units[0])),processor:JSON.parse(JSON.stringify(template.units[1])),generatedAt:next.toISOString().slice(0,10)+' 01:00（模拟）'});}}
runDemoBatch();
watch(() => demo.date, runDemoBatch);
watch(activeManifestTemplate, template => {if(template)runDemoBatch();});
watch(dailyManifests,()=>{try{localStorage.setItem(storageKey,JSON.stringify(dailyManifests));}catch{storageUnavailable.value=true;}},{deep:true});
try{localStorage.setItem(storageKey,JSON.stringify(dailyManifests));}catch{storageUnavailable.value=true;}
export function findDailyManifest(date:string,merchantId:string){return dailyManifests.documents.find(d=>(d.organizationId??currentOrganization.id)===currentOrganization.id&&d.key===`${date}|${merchantId}`);}
