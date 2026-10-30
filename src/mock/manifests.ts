import type { DemoState } from './types.ts';
import { records } from './operations.ts';
export interface ManifestUnit { id:string; name:string; receiver:string; seal:string }
export interface Manifest { id:string; kind:string; key:string; merchant:string; period:string; kg:number; createdAt:string; status:string; html:string; reason:string }
export interface ManifestState { sequence:number; units:ManifestUnit[]; documents:Manifest[] }
export const sealSample = 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><circle cx="75" cy="75" r="65" fill="none" stroke="#c22" stroke-width="4"/><text x="75" y="65" text-anchor="middle" fill="#c22" font-size="18">模拟单位</text><text x="75" y="95" text-anchor="middle" fill="#c22" font-size="18">演示章</text></svg>');
export function createManifestState():ManifestState { return {sequence:0,units:[{id:'carrier',name:'温江示例收运单位',receiver:'示例收运人',seal:sealSample},{id:'processor',name:'温江示例处理单位',receiver:'示例接收人',seal:sealSample}],documents:[]}; }
export function sourceEvents(state:DemoState) { return records(state).map(r=>({...r,label:`${r.date} · ${state.merchants.find(m=>m.id===r.merchantId)?.name} · ${r.vehicle} · ${r.kg}kg`})).sort((a,b)=>b.date.localeCompare(a.date)); }
export function quarterRows(state:DemoState,year:number,quarter:number) {
 const start=`${year}-${String((quarter-1)*3+1).padStart(2,'0')}-01`;
 const end=new Date(Date.UTC(year,quarter*3,0)).toISOString().slice(0,10);
 const rs=records(state).filter(r=>r.date>=start&&r.date<=end);
 return {start,end,rows:state.merchants.map(m=>({name:m.name,months:[0,1,2].map(i=>rs.filter(r=>r.merchantId===m.id && Number(r.date.slice(5,7))===(quarter-1)*3+1+i).reduce((s,r)=>s+r.kg,0))})).filter(r=>r.months.some(n=>n>0))};
}
export function issueManifest(state:ManifestState,input:Omit<Manifest,'id'|'status'|'reason'>) {
 const old=state.documents.find(d=>d.key===input.key&&d.status!=='已作废');
 if(old) return old;
 const id=`DEMO-WJ-${input.kind==='季度汇总'?'JB':'LD'}-${input.createdAt.slice(0,10).replaceAll('-','')}-${String(++state.sequence).padStart(6,'0')}`;
 const doc={...input,id,status:'已生成',reason:'',html:input.html.replaceAll('待生成编号',id)};
 state.documents.unshift(doc); return doc;
}
export function escapeHtml(s:unknown) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)); }
export function documentShell(body:string) {return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>餐厨联单（模拟）</title><style>body{font:15px SimSun,serif;color:#111;margin:30px}h1{text-align:center;font-size:24px}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{border:1px solid #222;padding:12px;text-align:left;position:relative}img{width:95px;height:95px;object-fit:contain}small{color:#666}thead{display:table-header-group}@page{size:A4;margin:15mm}@media print{body{margin:0}tr{break-inside:avoid}}</style>${body}</html>`;}
