<script setup lang="ts">
defineOptions({name:'WenjiangManifests'});
import {computed,reactive,ref,onDeactivated} from 'vue';
import {Message,Modal} from '@arco-design/web-vue';
import PageHeader from '../components/PageHeader.vue';
import ProductRequirements from '../components/ProductRequirements.vue';
import ManifestSheet from '../components/ManifestSheet.vue';
import {dailyManifests,type DailyManifest} from '../mock/daily-manifests';
import {currentOrganization,currentTenant,newManifestTemplate,saveTemplate,saasOrganizations,regionLayouts,validateTemplate,type ManifestTemplate} from '../mock/manifest-templates';
import {demo} from '../mock/store';
const visible=ref(false),previewVisible=ref(false),keyword=ref('');const previewTemplate=ref<ManifestTemplate|null>(null);
const draft=reactive(newManifestTemplate());
const list=computed(()=>dailyManifests.templates.filter(t=>t.tenantId===currentTenant.id&&t.name.includes(keyword.value.trim())));
const columns=[{title:'模板名称',dataIndex:'name',width:190},{title:'所属机构',slotName:'organization',width:300},{title:'是否开启',slotName:'enabled',width:90},{title:'操作',slotName:'action',width:180}];
function edit(t?:ManifestTemplate){Object.assign(draft,newManifestTemplate(),JSON.parse(JSON.stringify(t??newManifestTemplate())));draft.units.forEach((unit,index)=>{if(!unit.name.trim()||['温江示例收运单位','温江示例处理单位'].includes(unit.name))unit.name=newManifestTemplate().units[index]!.name;});visible.value=true;}
function replacing(t:ManifestTemplate){return t.enabled&&dailyManifests.templates.some(x=>x.id!==t.id&&x.enabled&&x.business===t.business&&(x.organizationId??currentOrganization.id)===(t.organizationId??currentOrganization.id));}
function save(){const error=validateTemplate(draft);if(error)return Message.warning(error);const commit=()=>{saveTemplate(dailyManifests.templates,draft);visible.value=false;Message.success('联单配置已保存');};if(replacing(draft))Modal.confirm({title:'替换当前启用模板',content:'同一机构的商户每日五联单只允许启用一个模板。保存将停用原模板，历史联单保持原样。',onOk:commit});else commit();}
function toggle(t:ManifestTemplate){const next={...t,enabled:!t.enabled};const error=validateTemplate(next);if(error)return Message.warning(error);const commit=()=>saveTemplate(dailyManifests.templates,next);if(replacing(next))Modal.confirm({title:'切换启用模板',content:'将停用当前启用模板，是否继续？',onOk:commit});else commit();}
function remove(t:ManifestTemplate){if(t.enabled)return Message.warning('请先停用模板');if(dailyManifests.documents.some(d=>d.template?.id===t.id)||t.id==='TPL-migrated'&&dailyManifests.documents.length)return Message.warning('已有历史联单引用，只能停用不能删除');Modal.confirm({title:'删除模板',content:'删除未被引用的模板？',onOk:()=>{dailyManifests.templates.splice(dailyManifests.templates.indexOf(t),1);}});}
function preview(t:ManifestTemplate){const error=validateTemplate(t);if(error)return Message.warning(error);const region=regionLayouts.find(r=>r.id===(t.regionId??'chengdu-v1'))!;previewTemplate.value=JSON.parse(JSON.stringify({...t,title:region.title,notes:region.notes,showVehicles:true,showCarrierPerson:true}));previewVisible.value=true;}
const previewDocument=computed<DailyManifest|null>(()=>previewTemplate.value?{id:'DEMO-PREVIEW-未生成',number:'202610300001',key:'preview',date:demo.date,merchant:demo.merchants[0]?.name??'示例商户',kg:128,vehicles:['川A·DEMO01'],drivers:['示例司机'],vehicleDrivers:[{vehicle:'川A·DEMO01',driver:'示例司机'}],collectionDate:demo.date+' 08:10:00',processingDate:demo.date,carrier:previewTemplate.value.units[0]!,processor:previewTemplate.value.units[1]!,generatedAt:'模板预览',template:previewTemplate.value}:null);
function removeSeal(index:number){const unit=draft.units[index]!;Modal.confirm({title:'确认移除印章',content:`确定移除${index===0?'收运单位':'处置单位'}的印章？保存模板后生效，历史联单不受影响。`,okText:'确认移除',cancelText:'取消',onOk:()=>{unit.seal='';}});}
async function upload(ev:Event,index:number){const file=(ev.target as HTMLInputElement).files?.[0];if(!file)return;if(file.type!=='image/png'||file.size>2*1024*1024)return Message.warning('请选择2MB以内PNG');const b=new Uint8Array(await file.slice(0,8).arrayBuffer());if(b.join(',')!=='137,80,78,71,13,10,26,10')return Message.warning('PNG内容不正确');const r=new FileReader();r.onload=()=>draft.units[index]!.seal=String(r.result);r.readAsDataURL(file);}
onDeactivated(()=>{visible.value=false;previewVisible.value=false;});
</script>
<template><div class="gi_page page-content"><PageHeader title="联单设置 · 新增" description="按租户维护联单模板，每个模板独立配置版式、单位与章。" module="业务设置"><a-button type="primary" @click="edit()">添加模板</a-button></PageHeader><ProductRequirements/><section class="panel"><div class="panel-heading"><h2>联单模板列表</h2><a-input v-model="keyword" placeholder="搜索模板名称" style="width:280px" allow-clear/></div><a-table class="template-list" :data="list" :columns="columns" :scroll="{x:760}" :pagination="{pageSize:8}" row-key="id"><template #organization="{record}">{{record.organizationName??currentOrganization.name}}</template><template #business>商户每日五联单</template><template #version="{record}">V{{record.version}}</template><template #enabled="{record}"><a-switch :model-value="record.enabled" :aria-label="`启用${record.name}`" @change="toggle(record)"/></template><template #updated="{record}">{{record.updatedAt?new Date(record.updatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}):'初始模板'}}</template><template #action="{record}"><a-space :size="4"><a-button type="text" @click="preview(record)">预览</a-button><a-button type="text" @click="edit(record)">编辑</a-button><a-button type="text" status="danger" @click="remove(record)">删除</a-button></a-space></template></a-table></section>
<a-drawer :visible="visible" :title="draft.id?'编辑联单模板':'添加联单模板'" :width="'min(820px,96vw)'" :footer="false" @cancel="visible=false"><div class="template-editor"><a-form layout="vertical"><a-form-item label="所属机构 · 新增"><a-select v-model="draft.organizationId" :options="saasOrganizations.map(o=>({label:o.name,value:o.id}))" aria-label="所属机构"/></a-form-item><a-form-item label="版式名称" required><a-select v-model="draft.regionId" :options="regionLayouts.map(r=>({label:r.name,value:r.id}))" aria-label="版式名称"/></a-form-item><p class="layout-help">系统创建版式</p><section v-for="(unit,index) in draft.units" :key="unit.id" class="unit-fields"><a-form-item :label="index===0?'收运单位全称':'处置单位全称'" required><a-input v-model="unit.name" :max-length="100"/></a-form-item><a-form-item :label="index===0?'收运单位印章（PNG格式，2M以内）':'处置单位印章（PNG格式，2M以内）'" required><input type="file" accept="image/png" @change="upload($event,index)"/></a-form-item><div class="seal-actions"><img v-if="unit.seal" :src="unit.seal" width="80" height="80" alt="印章预览"/><a-button :disabled="!unit.seal" @click="removeSeal(index)">移除章</a-button></div></section><a-form-item label="是否开启"><a-switch v-model="draft.enabled" aria-label="模板是否开启"/></a-form-item><div class="modal-actions"><a-button @click="visible=false">取消</a-button><a-button type="primary" @click="save">保存模板</a-button></div></a-form></div></a-drawer>
<a-drawer :visible="previewVisible" title="模板预览（模拟数据）" :width="'min(1000px,96vw)'" :footer="false" @cancel="previewVisible=false"><a-alert>预览不生成联单或分配编号，不改变已保存模板。</a-alert><ManifestSheet v-if="previewDocument" :document="previewDocument"/></a-drawer></div></template>
<style scoped>
.template-list :deep(.arco-table-th),
.template-list :deep(.arco-table-td) { padding-left: 8px; padding-right: 8px; }
.layout-help { color: var(--color-text-3); font-size: 12px; margin: -8px 0 12px; }
.unit-fields { padding: 0; margin: 0; }
.seal-actions { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.seal-actions img { object-fit: contain; }
.template-editor :deep(.arco-form-item) { margin-bottom: 16px; }
.template-editor :deep(.arco-form-item-label-col) { padding-bottom: 4px; }
.template-editor .modal-actions { margin-top: 16px; }
</style>
