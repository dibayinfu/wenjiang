<script setup lang="ts">
import {computed,h,onDeactivated,ref,watch} from 'vue';
import PageHeader from '../components/PageHeader.vue';
import ProductRequirements from '../components/ProductRequirements.vue';
import ReportCollectionDrawer from '../components/ReportCollectionDrawer.vue';
import {demo} from '../mock/store';
import {collectionLines} from '../mock/collection-lines';
import {streetDictionary} from '../mock/merchant-dictionaries';
import {merchantMonthlyReport,monthDates,monthlyDailyTotals} from '../mock/summary-reports';
import type {RecordRow} from '../mock/operations';
import {downloadCsv} from '../utils/csv';
defineOptions({name:'WenjiangMerchantMonthly'});
const month=ref(demo.date.slice(0,7)),merchant=ref(''),line=ref(''),street=ref('');
const page=ref(1),advanced=ref(false),chart=ref(false),detailVisible=ref(false),detailTitle=ref('');
const detailRecords=ref<RecordRow[]>([]);
const dates=computed(()=>monthDates(month.value));
const rows=computed(()=>dates.value.length?merchantMonthlyReport(demo,month.value,{merchantId:merchant.value,lineId:line.value,street:street.value}):[]);
const totalCents=computed(()=>rows.value.reduce((sum,row)=>sum+Math.round(row.kg*100),0));
const totalBuckets=computed(()=>rows.value.reduce((sum,row)=>sum+row.buckets,0));
const dailyTotals=computed(()=>monthlyDailyTotals(dates.value,rows.value));
const maxDaily=computed(()=>Math.max(1,...dailyTotals.value.map(day=>day.kg??0)));
function showDetails(row:typeof rows.value[number],date?:string){detailTitle.value=`${row.name} · ${date??month.value} 收运明细`;detailRecords.value=date?row.items.filter(item=>item.date===date):row.items;detailVisible.value=true;}
const columns=computed(()=>[
  {title:'商户名称',dataIndex:'name',width:220,fixed:'left' as const,ellipsis:true,tooltip:true},
  {title:'线路',dataIndex:'line',width:80},
  {title:'街道',dataIndex:'area',width:100},
  ...dates.value.map((date,index)=>({title:`${index+1}日`,width:72,render:({record}:{record:typeof rows.value[number]})=>{
    const kg=record.days[date];
    return kg===null?h('span',{class:'empty-day'},'—'):record.items.some(item=>item.date===date)?h('button',{class:'text-button',onClick:()=>showDetails(record,date)},Number(kg??0).toFixed(2)):h('span',{class:'zero-day'},'0.00');
  }})),
  {title:'月合计（kg）',width:130,fixed:'right' as const,render:({record}:{record:typeof rows.value[number]})=>h('button',{class:'text-button',disabled:!record.items.length,onClick:()=>showDetails(record)},record.kg.toFixed(2))},
  {title:'收运桶数',dataIndex:'buckets',width:84,fixed:'right' as const},
  {title:'收运天数',dataIndex:'collectionDays',width:84,fixed:'right' as const},
]);
watch([month,merchant,line,street],()=>{page.value=1;detailVisible.value=false;});
function reset(){month.value=demo.date.slice(0,7);merchant.value='';line.value='';street.value='';advanced.value=false;}
function exportReport(){downloadCsv(`商户月报-${month.value}.csv`,[
  ['月份','商户名称','线路','街道',...dates.value,'月合计kg','收运桶数','收运天数'],
  ...rows.value.map(row=>[month.value,row.name,row.line,row.area,...dates.value.map(date=>row.days[date]===null?'':Number(row.days[date]??0).toFixed(2)),row.kg.toFixed(2),row.buckets,row.collectionDays]),
]);}
onDeactivated(()=>detailVisible.value=false);
</script>
<template>
  <div class="gi_page page-content merchant-monthly-page">
    <PageHeader title="商户月报"><a-button type="primary" :disabled="!dates.length" @click="exportReport">导出当前报表</a-button></PageHeader>
    <ProductRequirements/>
    <section class="panel"><div class="monthly-filters">
      <a-month-picker v-model="month" value-format="YYYY-MM" format="YYYY-MM" :allow-clear="false" aria-label="统计月份" style="width:160px"/>
      <a-select v-model="merchant" class="monthly-merchant" style="width:240px;max-width:100%" aria-label="月报商户" allow-search :filter-option="(search:string,option:{label?:unknown})=>String(option.label??'').includes(search.trim())" :options="[{label:'全部商户',value:''},...demo.merchants.map(m=>({label:m.name,value:m.id}))]"/>
      <a-select v-model="line" class="filter-select" aria-label="月报线路" :options="[{label:'全部线路',value:''},...collectionLines.map(l=>({label:l.name,value:l.id}))]"/>
      <template v-if="advanced"><a-select v-model="street" class="filter-select" aria-label="月报街道" :options="[{label:'全部街道',value:''},...streetDictionary]"/></template>
      <a-button type="text" :aria-expanded="advanced" @click="advanced=!advanced">{{advanced?'收起':'展开'}}{{street?'（已选）':''}}</a-button><a-button @click="reset">重置</a-button>
    </div></section>
    <div class="monthly-summary"><span>商户数量：<strong>{{rows.length}}</strong></span><span>收运重量：<strong>{{(totalCents/100).toFixed(2)}}</strong> 千克</span><span>收运桶数：<strong>{{totalBuckets}}</strong></span><a-button type="text" size="small" @click="chart=!chart">{{chart?'收起趋势':'查看趋势'}}</a-button></div>
    <section v-if="chart" class="panel"><div class="monthly-chart-title">每日收运重量（kg）</div><div class="monthly-chart" role="group" aria-label="所选商户每日收运重量"><a-tooltip v-for="(day,index) in dailyTotals" :key="day.date" :content="`${day.date}：${day.kg===null?'无可用数据':day.kg.toFixed(2)+' 千克'}`" :trigger="['hover','focus']" position="top"><div class="month-chart-column" tabindex="0" :aria-label="`${day.date}：${day.kg===null?'无可用数据':day.kg.toFixed(2)+' 千克'}`"><div class="month-bar-track"><i v-if="day.kg!==null" :style="{height:`${day.kg/maxDaily*100}%`}"/></div><span>{{index+1}}</span></div></a-tooltip></div></section>
    <section class="panel"><div class="monthly-table-note"><span>{{month}} · 单位：千克</span><span>点击每日重量或月合计查看明细；未到日期显示 —</span></div><a-table :data="rows.slice((page-1)*10,page*10)" :columns="columns" row-key="id" :pagination="false" :scroll="{x:698+dates.length*72}"/><a-pagination v-model:current="page" :total="rows.length" :page-size="10" show-total/></section>
    <ReportCollectionDrawer v-model:visible="detailVisible" :title="detailTitle" :records="detailRecords"/>
  </div>
</template>
<style scoped>
.monthly-filters{display:flex;align-items:center;flex-wrap:wrap;gap:12px}.monthly-merchant{width:240px}.monthly-summary{display:flex;align-items:center;flex-wrap:wrap;gap:8px 28px;padding:8px 16px;background:var(--color-bg-2);border-radius:4px}.monthly-summary strong{font-size:16px;margin:0 3px}.monthly-table-note{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px;font-size:12px;color:var(--color-text-3)}.monthly-chart-title{font-size:13px;margin-bottom:8px}.monthly-chart{height:140px;display:flex;gap:6px;overflow:auto}.month-chart-column{flex:1;min-width:16px;display:flex;flex-direction:column;gap:6px;align-items:center;font-size:11px;color:var(--color-text-3)}.month-bar-track{height:110px;display:flex;align-items:flex-end;justify-content:center;width:100%}.month-bar-track i{display:block;min-height:1px;background:rgb(var(--primary-6));width:55%;max-width:18px;border-radius:3px 3px 0 0}.merchant-monthly-page :deep(.module-header h2){color:rgb(var(--danger-6))}.merchant-monthly-page :deep(.arco-table-cell){white-space:nowrap;padding-left:8px;padding-right:8px}.merchant-monthly-page :deep(.empty-day),.merchant-monthly-page :deep(.zero-day){color:var(--color-text-3)}

.month-chart-column{border-radius:4px;transition:background-color .16s ease,color .16s ease}.month-bar-track i{transform-origin:bottom center;transition:transform .16s ease,background-color .16s ease,box-shadow .16s ease}.month-chart-column:hover,.month-chart-column:focus-visible{background:var(--color-primary-light-1);color:rgb(var(--primary-6))}.month-chart-column:hover .month-bar-track i,.month-chart-column:focus-visible .month-bar-track i{transform:translateY(-2px) scaleX(1.1);background:rgb(var(--primary-5));box-shadow:0 3px 8px rgb(var(--primary-6),.2)}.month-chart-column:focus-visible{outline:2px solid rgb(var(--primary-3));outline-offset:-2px}@media(prefers-reduced-motion:reduce){.month-chart-column,.month-bar-track i{transition:none}.month-chart-column:hover .month-bar-track i,.month-chart-column:focus-visible .month-bar-track i{transform:none}}
</style>
