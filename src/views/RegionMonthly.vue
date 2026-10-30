<script setup lang="ts">
import {computed,h,onDeactivated,ref,watch} from 'vue';
import PageHeader from '../components/PageHeader.vue';
import ProductRequirements from '../components/ProductRequirements.vue';
import ReportCollectionDrawer from '../components/ReportCollectionDrawer.vue';
import MiniBars from '../components/MiniBars.vue';
import {demo} from '../mock/store';
import {streetDictionary} from '../mock/merchant-dictionaries';
import {regionMonthlyReport,monthDates} from '../mock/summary-reports';
import type {RecordRow} from '../mock/operations';
import {downloadCsv} from '../utils/csv';
defineOptions({name:'WenjiangRegionMonthly'});
const month=ref(demo.date.slice(0,7)),street=ref('');
const chart=ref(false),detailVisible=ref(false),detailTitle=ref('');
const detailRecords=ref<RecordRow[]>([]);
const dates=computed(()=>monthDates(month.value));
const rows=computed(()=>regionMonthlyReport(demo,month.value,street.value));
const streetOptions=computed(()=>[{label:'全部街道',value:''},...streetDictionary.map(name=>({label:name,value:name}))]);
const totalKg=computed(()=>rows.value.reduce((sum,row)=>sum+Math.round(row.kg*100),0)/100);
const totalBuckets=computed(()=>rows.value.reduce((sum,row)=>sum+row.buckets,0));
const chartItems=computed(()=>rows.value.map(row=>({label:row.area,value:row.kg})).sort((a,b)=>b.value-a.value));
function showDetails(row:typeof rows.value[number],date?:string){detailTitle.value=`${date??month.value} · ${row.area}收运明细`;detailRecords.value=date?row.items.filter(item=>item.date===date):row.items;detailVisible.value=true;}
const columns=computed(()=>[
  {title:'街道',dataIndex:'area',width:120,fixed:'left' as const},
  ...dates.value.map((date,index)=>({title:`${index+1}日`,width:72,render:({record}:{record:typeof rows.value[number]})=>{
    const kg=record.days[date];
    return kg===null?h('span',{class:'empty-day'},'—'):record.items.some(item=>item.date===date)?h('button',{class:'text-button',onClick:()=>showDetails(record,date)},Number(kg??0).toFixed(2)):h('span',{class:'zero-day'},'0.00');
  }})),
  {title:'月合计（kg）',width:130,fixed:'right' as const,render:({record}:{record:typeof rows.value[number]})=>h('button',{class:'text-button',disabled:!record.items.length,onClick:()=>showDetails(record)},record.kg.toFixed(2))},
  {title:'收运桶数',dataIndex:'buckets',width:90,fixed:'right' as const},
]);
watch([month,street],()=>detailVisible.value=false);
function reset(){month.value=demo.date.slice(0,7);street.value='';}
function exportReport(){downloadCsv(`区域月报-${month.value}.csv`,[
 ['月份','街道',...dates.value,'月合计kg','收运桶数'],
 ...rows.value.map(row=>[month.value,row.area,...dates.value.map(date=>row.days[date]===null?'':Number(row.days[date]??0).toFixed(2)),row.kg.toFixed(2),row.buckets]),
]);}
onDeactivated(()=>detailVisible.value=false);
</script>
<template>
 <div class="gi_page page-content region-monthly-page">
  <PageHeader title="区域月报"><a-button type="primary" :disabled="!dates.length" @click="exportReport">导出当前报表</a-button></PageHeader>
  <ProductRequirements/>
  <section class="panel"><div class="region-filters"><a-month-picker v-model="month" value-format="YYYY-MM" format="YYYY-MM" :allow-clear="false" aria-label="区域月报统计月份" style="width:160px"/><a-select v-model="street" class="filter-select" aria-label="区域月报街道" :options="streetOptions"/><a-button @click="reset">重置</a-button></div></section>
  <div class="region-summary"><span>街道数量：<strong>{{rows.length}}</strong></span><span>收运重量：<strong>{{totalKg.toFixed(2)}}</strong> 千克</span><span>收运桶数：<strong>{{totalBuckets}}</strong></span><a-button type="text" size="small" @click="chart=!chart">{{chart?'收起图表':'区域对比'}}</a-button></div>
  <MiniBars v-if="chart" :items="chartItems" :precision="2" title="各街道月度收运重量对比" unit="千克"/>
  <section class="panel"><div class="region-table-note"><span>{{month}} · 单位：千克</span><span>点击每日重量或月合计查看明细；未到日期显示 —</span></div><a-table :data="rows" :columns="columns" :pagination="false" :scroll="{x:340+dates.length*72}" row-key="id"/></section>
  <ReportCollectionDrawer v-model:visible="detailVisible" :title="detailTitle" :records="detailRecords"/>
 </div>
</template>
<style scoped>
.region-filters{display:flex;flex-wrap:wrap;align-items:center;gap:12px}.region-summary{display:flex;flex-wrap:wrap;align-items:center;gap:8px 28px;padding:8px 16px;background:var(--color-bg-2);border-radius:4px}.region-summary strong{font-size:16px;margin:0 3px}.region-monthly-page :deep(.module-header h2){color:rgb(var(--danger-6))}.region-monthly-page :deep(.arco-table-cell){white-space:nowrap;padding-left:8px;padding-right:8px}.region-monthly-page :deep(.empty-day),.region-monthly-page :deep(.zero-day){color:var(--color-text-3)}.region-table-note{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px;font-size:12px;color:var(--color-text-3)}
</style>
