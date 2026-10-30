<script setup lang="ts">
import {computed,ref,watch} from 'vue';
import {Message,type FormInstance} from '@arco-design/web-vue';
import PointGeometryMap from './PointGeometryMap.vue';
import {demo} from '../mock/store';
import {currentOrganization,saasOrganizations} from '../mock/manifest-templates';
import {pointCategories,saveMerchantPoint} from '../mock/merchant-points';
import {pointLocation,WENJIANG_CENTER} from '../mock/point-location';
import type {Point} from '../mock/operations';
import {collectionLines} from '../mock/collection-lines';
const props=defineProps<{visible:boolean;point?:Point;merchantId?:string}>();
const emit=defineEmits<{'update:visible':[value:boolean];saved:[point:Point]}>();
const form=ref<FormInstance>();
const saving=ref(false);
const draft=ref<Point>({id:'',name:'',merchantId:'',organizationId:currentOrganization.id,category:'小区',estimatedKg:0,address:'',note:'',x:50,y:50});
const position=computed<[number,number]>(()=>[draft.value.longitude??WENJIANG_CENTER[0],draft.value.latitude??WENJIANG_CENTER[1]]);
const merchantLine=computed(()=>{const merchant=demo.merchants.find(m=>m.id===draft.value.merchantId);return collectionLines.find(line=>line.id===merchant?.lineId)?.name??'未设置线路';});
const rules={name:[{required:true,message:'请输入收集点名称'}],merchantId:[{required:true,message:'请选择所属商户'}],organizationId:[{required:true,message:'请选择所属机构'}],category:[{required:true,message:'请选择点位分类'}],address:[{required:true,message:'请填写详细地址'}]};
watch(()=>props.visible,async visible=>{
  if(!visible)return;
  const point=props.point;
  const [longitude,latitude]=point?pointLocation(point):WENJIANG_CENTER;
  draft.value=point?{...JSON.parse(JSON.stringify(point)),organizationId:point.organizationId??currentOrganization.id,note:point.note??'',longitude,latitude}:{id:`PT-DEMO-${crypto.randomUUID()}`,name:'',merchantId:props.merchantId??'',organizationId:currentOrganization.id,category:'小区',estimatedKg:0,address:'',note:'',x:50,y:50,longitude,latitude};
  if(document.fullscreenElement)await document.exitFullscreen();
},{immediate:true});
function pick(value:[number,number]){draft.value.longitude=value[0];draft.value.latitude=value[1];}
async function submit(){
  if(saving.value)return;
  const errors=await form.value?.validate();if(errors)return;
  saving.value=true;
  try {saveMerchantPoint(demo,draft.value);const saved=demo.points.find(point=>point.id===draft.value.id)!;emit('saved',saved);emit('update:visible',false);Message.success(props.point?'收集点信息已更新':'收集点已添加');}
  catch(cause){Message.warning((cause as Error).message);}finally{saving.value=false;}
}
</script>
<template>
  <a-modal :visible="visible" :title="point?'编辑收集点信息':'新增收集点信息'" :width="'min(1440px,96vw)'" :footer="false" :mask-closable="false" modal-class="collection-point-editor" @cancel="emit('update:visible',false)">
    <div v-if="visible" class="point-editor-layout">
      <a-form ref="form" :model="draft" :rules="rules" layout="vertical" class="point-editor-form">
        <a-form-item field="name" label="收集点名称" required><a-input v-model="draft.name" placeholder="请输入收集点名称" :max-length="80"/></a-form-item>
        <a-form-item field="merchantId" label="所属商户" required><a-select v-model="draft.merchantId" allow-search placeholder="请选择所属商户" :options="demo.merchants.map(merchant=>({label:merchant.name,value:merchant.id}))"/><template #extra><span v-if="draft.merchantId" class="merchant-line-info">所属线路：{{merchantLine}}</span></template></a-form-item>
        <a-form-item field="organizationId" label="所属机构" required><a-select v-model="draft.organizationId" :options="saasOrganizations.map(org=>({label:org.name,value:org.id}))" placeholder="请选择所属机构"/></a-form-item>
        <a-form-item field="category" label="点位分类" required><a-select v-model="draft.category" :options="pointCategories" placeholder="请选择点位分类"/></a-form-item>
        <a-form-item field="estimatedKg" label="预估垃圾量（千克）"><a-input-number v-model="draft.estimatedKg" :min="0" :precision="2" placeholder="请输入预估垃圾量"/></a-form-item>
        <a-form-item field="address" label="详细地址" required><a-textarea v-model="draft.address" placeholder="请输入详细地址" :max-length="200" :auto-size="{minRows:2,maxRows:3}"/></a-form-item>
        <a-form-item field="note" label="备注"><a-textarea v-model="draft.note" placeholder="请输入备注信息" :max-length="300" :auto-size="{minRows:2,maxRows:3}"/></a-form-item>
      </a-form>
      <PointGeometryMap :position="position" :fence="draft.fence" @pick="pick" @fence="draft.fence=$event" @address="draft.address=$event"/>
    </div>
    <div class="point-editor-footer"><a-button @click="emit('update:visible',false)">取消</a-button><a-button type="primary" :loading="saving" @click="submit">提交</a-button></div>
  </a-modal>
</template>
<style>
.collection-point-editor .arco-modal-body{padding:16px 20px 0;max-height:calc(95vh - 70px);overflow:auto}.collection-point-editor .arco-modal-title{font-size:18px}.collection-point-editor .arco-modal-header{border-bottom:0}
</style>
<style scoped>
.merchant-line-info{color:rgb(var(--danger-6))}.point-editor-layout{display:grid;grid-template-columns:340px minmax(0,1fr);gap:20px;align-items:stretch}.point-editor-form :deep(.arco-form-item){margin-bottom:14px}.point-editor-form :deep(.arco-form-item-label-col){margin-bottom:6px}.point-editor-form :deep(.arco-input-number){width:100%}.point-editor-footer{display:flex;justify-content:flex-end;gap:12px;border-top:1px solid var(--color-border-2);padding:16px 0;margin-top:16px}.point-editor-footer :deep(.arco-btn){min-width:96px}@media(max-width:900px){.point-editor-layout{grid-template-columns:1fr}.point-editor-form{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}}@media(max-width:560px){.point-editor-form{display:block}}
</style>
