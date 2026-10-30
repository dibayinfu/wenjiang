import type {DemoState,Merchant} from './types.ts';
import {records,type RecordRow} from './operations.ts';
import {collectionLines} from './collection-lines.ts';
import {streetDictionary} from './merchant-dictionaries.ts';
export interface ReportFilters {merchantId?:string;lineId?:string;street?:string}
export function matchesReportMerchant(merchant:Merchant,filters:ReportFilters={}) {
  return (!filters.merchantId||merchant.id===filters.merchantId)&&(!filters.lineId||merchant.lineId===filters.lineId)&&(!filters.street||merchant.street===filters.street);
}
export function monthDates(month:string):string[] {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return [];
  const [year,monthNumber]=month.split('-').map(Number);
  const count=new Date(Date.UTC(year!,monthNumber!,0)).getUTCDate();
  return Array.from({length:count},(_,index)=>`${month}-${String(index+1).padStart(2,'0')}`);
}
export function reportArea(merchant:Pick<Merchant,'street'>|undefined) {
  return merchant?.street ? {type:'街道',name:merchant.street} : {type:'未归属',name:'未设置街道'};
}
export function sumRecordKg(rows:RecordRow[]) {return rows.reduce((total,row)=>total+Math.round(row.kg*100),0)/100;}
export function merchantMonthlyReport(state:DemoState,month:string,filters:ReportFilters={}) {
  const dates=monthDates(month);
  const all=records(state);
  const earliest=all.reduce((date,row)=>!date||row.date<date?row.date:date,'');
  const items=all.filter(row=>row.date.startsWith(`${month}-`)&&row.date<=state.date);
  const byMerchant=new Map<string,RecordRow[]>();
  for(const row of items){const group=byMerchant.get(row.merchantId)??[];group.push(row);byMerchant.set(row.merchantId,group);}
  return state.merchants.filter(merchant=>matchesReportMerchant(merchant,filters)).map(merchant=>{
    const rows=byMerchant.get(merchant.id)??[];
    const days:Record<string,number|null>={};
    for(const date of dates)days[date]=date>state.date||!earliest||date<earliest?null:0;
    for(const row of rows)if(days[row.date]!==null)days[row.date]=((Math.round((days[row.date]??0)*100)+Math.round(row.kg*100))/100);
    return {id:merchant.id,merchantId:merchant.id,name:merchant.name,line:collectionLines.find(line=>line.id===merchant.lineId)?.name??'未设置线路',area:reportArea(merchant).name,kg:sumRecordKg(rows),buckets:rows.reduce((total,row)=>total+row.buckets,0),collectionDays:new Set(rows.map(row=>row.date)).size,days,items:rows};
  });
}
export function regionMonthlyReport(state:DemoState,month:string,street='') {
  const dates=monthDates(month);
  if(!dates.length)return [];
  const merchantRows=merchantMonthlyReport(state,month);
  const areas:string[]=[...streetDictionary];
  if(merchantRows.some(row=>row.area==='未设置街道'))areas.push('未设置街道');
  return areas.filter(area=>!street||area===street).map(area=>{
    const merchants=merchantRows.filter(row=>row.area===area);
    const items=merchants.flatMap(row=>row.items);
    const days:Record<string,number|null>={};
    for(const date of dates)days[date]=merchantRows[0]?.days[date]===null||date>state.date?null:merchants.reduce((sum,row)=>sum+Math.round((row.days[date]??0)*100),0)/100;
    return {id:area,area,days,kg:sumRecordKg(items),buckets:items.reduce((sum,row)=>sum+row.buckets,0),items};
  });
}

export function monthlyDailyTotals(dates:string[],rows:{days:Record<string,number|null>}[]) {
  return dates.map(date=>({date,kg:!rows.length||rows.every(row=>row.days[date]===null)?null:rows.reduce((sum,row)=>sum+Math.round((row.days[date]??0)*100),0)/100}));
}
