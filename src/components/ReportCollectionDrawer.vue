<script setup lang="ts">
import {computed,ref,watch} from 'vue';
import type {RecordRow} from '../mock/operations';
import {weighingRows,type Weighing} from '../mock/sanitation';
import {demo,merchantName} from '../mock/store';
const props=defineProps<{visible:boolean;title:string;records:RecordRow[]}>();
const emit=defineEmits<{'update:visible':[value:boolean]}>();
const page=ref(1);
const rows=computed(()=>weighingRows(demo,props.records,false));
watch(()=>props.records,()=>page.value=1);
const columns=[
  {title:'收集时间',dataIndex:'collectedAt',width:180},
  {title:'车牌号',dataIndex:'vehicle',width:140},
  {title:'商户',width:220,render:({record}:{record:Weighing})=>merchantName(record.merchantId)},
  {title:'重量（kg）',width:120,render:({record}:{record:Weighing})=>record.kg.toFixed(2)},
  {title:'RFID',slotName:'rfid',width:260},
  {title:'所属收集点',width:260,render:({record}:{record:Weighing})=>demo.points.find(point=>point.id===record.pointId)?.name??'未绑定'},
];
</script>
<template>
  <a-drawer :visible="visible" :title="title" :width="'min(1160px,96vw)'" :footer="false" @cancel="emit('update:visible',false)">
    <a-table :data="rows.slice((page-1)*10,page*10)" :columns="columns" :scroll="{x:1180}" :pagination="false" row-key="id"><template #rfid="{record}"><span class="rfid-value">{{record.rfid}}</span></template></a-table>
    <a-pagination v-model:current="page" :total="rows.length" :page-size="10" show-total/>
  </a-drawer>
</template>
