<script setup lang="ts">
import { computed, h, onDeactivated, ref, watch } from 'vue';
import PageHeader from '../components/PageHeader.vue';
import ProductRequirements from '../components/ProductRequirements.vue';
import { demo, merchantName } from '../mock/store';
import { currentOrganization } from '../mock/manifest-templates';
import { ensureMerchantMapPoints } from '../mock/merchant-map';
import {streetDictionary,merchantMatchesFilters} from '../mock/merchant-dictionaries';
import type { Point } from '../mock/operations';
import MerchantPointMap from '../components/MerchantPointMap.vue';
import CollectionPointEditor from '../components/CollectionPointEditor.vue';
defineOptions({name:'WenjiangMerchantPoints'});
ensureMerchantMapPoints(demo);
const streetFilter=ref('');
const mode=ref('map');
const page=ref(1);
const selectedId=ref('');
const visible=ref(false);
const editingPoint=ref<Point>();
const rows=computed(()=>demo.points.filter(point=>{
  const merchant=demo.merchants.find(merchant=>merchant.id===point.merchantId);
  return !!merchant && merchantMatchesFilters(merchant,{line:'全部线路',status:'全部状态',street:streetFilter.value});
}));
watch(streetFilter,()=>{page.value=1;selectedId.value='';});
function selectStreet(value:string){streetFilter.value=value;}

function openEditor(point?:Point){editingPoint.value=point;visible.value=true;}
onDeactivated(()=>{visible.value=false;});
const columns=[
  {title:'收集点名称',dataIndex:'name',width:240},
  {title:'所属商户',width:240,render:({record}:{record:Point})=>merchantName(record.merchantId)},
  {title:'地址',dataIndex:'address',width:320},
  {title:'所属机构',width:380,render:()=>h('span',{style:{whiteSpace:'nowrap'}},currentOrganization.name)},
  {title:'操作',width:120,fixed:'right' as const,render:({record}:{record:Point})=>h('button',{class:'text-button',onClick:()=>openEditor(record)},'编辑')},
];
</script>
<template>
  <div class="gi_page page-content">
    <PageHeader title="商户收集点" description="" module="商户资产"><a-button type="primary" @click="openEditor()">添加</a-button></PageHeader>
    <ProductRequirements />
    <a-tabs v-model:active-key="mode" class="point-mode-tabs"><a-tab-pane key="list" title="列表模式"/><a-tab-pane key="map"><template #title><span class="point-upgrade">地图模式</span></template></a-tab-pane></a-tabs>
    <section class="panel table-panel">
      <div class="area-filters">
        <div class="area-filter-row" role="group" aria-label="街道筛选"><span class="area-label">街道</span><button type="button" class="area-chip" :class="{active:!streetFilter}" :aria-pressed="!streetFilter" @click="selectStreet('')">全部</button><button v-for="street in streetDictionary" :key="street" type="button" class="area-chip" :class="{active:streetFilter===street}" :aria-pressed="streetFilter===street" @click="selectStreet(street)">{{street}}</button><span v-if="mode==='list'" class="muted area-count">共 {{rows.length}} 个收集点</span></div>
      </div>
      <template v-if="mode==='list'">
        <a-table :data="rows.slice((page-1)*10,page*10)" :columns="columns" :pagination="false" :scroll="{x:1300}" row-key="id"/>
        <a-pagination v-model:current="page" :total="rows.length" :page-size="10" />
      </template>
      <MerchantPointMap v-else :points="rows" :selected-id="selectedId" @select="selectedId=$event" @edit="openEditor"/>
    </section>
    <CollectionPointEditor v-model:visible="visible" :point="editingPoint" @saved="selectedId=$event.id"/>
  </div>
</template>
<style scoped>
.point-mode-tabs{margin-top:-6px;margin-bottom:-6px}.point-mode-tabs :deep(.arco-tabs-tab){padding-top:5px;padding-bottom:5px}.point-mode-tabs :deep(.arco-tabs-content){padding-top:0}.point-upgrade{color:rgb(var(--danger-6))}.area-filters{margin-bottom:16px}.area-filter-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}.area-filter-row:last-child{margin-bottom:0}.area-label{min-width:32px;color:var(--color-text-2);font-size:13px;white-space:nowrap}.area-chip{padding:2px 13px;border:1px solid var(--color-border-2);border-radius:14px;background:var(--color-bg-2);color:var(--color-text-2);font-size:13px;line-height:22px;cursor:pointer;transition:all .15s}.area-chip:hover{border-color:rgb(var(--primary-6));color:rgb(var(--primary-6))}.area-chip.active{background:rgb(var(--primary-6));border-color:rgb(var(--primary-6));color:white}.area-chip:focus-visible{outline:2px solid rgb(var(--primary-3));outline-offset:2px}.area-count{font-size:12px}
</style>
