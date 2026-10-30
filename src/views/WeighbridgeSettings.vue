<script setup lang="ts">
defineOptions({name:'WenjiangWeighbridgeSettings'});
import {reactive,ref,onDeactivated} from 'vue';
import {Message,Modal} from '@arco-design/web-vue';
import PageHeader from '../components/PageHeader.vue';
import ProductRequirements from '../components/ProductRequirements.vue';
import {weighbridgeConfigs} from '../mock/weighbridge-settings';
import {weighbridgeSources,weighbridgeUnits,validateWeighbridgeConfig,saveWeighbridgeConfig,type WeighbridgeConfig} from '../mock/weighbridge-config';
import {currentOrganization,saasOrganizations} from '../mock/manifest-templates';
const visible=ref(false);
const draft=reactive<WeighbridgeConfig>({id:'',organizationId:currentOrganization.id,source:'本地主机增量同步',unit:'千克',enabled:false});
const columns=[{title:'所属机构',slotName:'organization',width:400},{title:'数据来源',dataIndex:'source',width:180},{title:'重量单位',dataIndex:'unit',width:110},{title:'是否开启',slotName:'enabled',width:110},{title:'操作',slotName:'action',width:100}];
function edit(row?:WeighbridgeConfig){Object.assign(draft,row?{...row}:{id:'',organizationId:currentOrganization.id,source:'本地主机增量同步',unit:'千克',enabled:false});visible.value=true;}
function save(){const error=validateWeighbridgeConfig(draft,saasOrganizations.map(o=>o.id));if(error)return Message.warning(error);const commit=()=>{saveWeighbridgeConfig(weighbridgeConfigs,draft,saasOrganizations.map(o=>o.id));visible.value=false;Message.success('地磅配置已保存');};if(draft.enabled&&weighbridgeConfigs.some(r=>r.id!==draft.id&&r.organizationId===draft.organizationId&&r.enabled))Modal.confirm({title:'切换地磅配置',content:'同一机构只开启一条配置，保存后将停用原配置。',onOk:commit});else commit();}
onDeactivated(()=>{visible.value=false;});
</script>
<template><div class="gi_page page-content"><PageHeader title="地磅设置 · 新增" description="按机构维护地磅来源、重量单位及启用状态。" module="业务设置"><a-button type="primary" @click="edit()">添加</a-button></PageHeader><ProductRequirements/><section class="panel"><a-table :data="weighbridgeConfigs" :columns="columns" :scroll="{x:900}" :pagination="{pageSize:8}" row-key="id"><template #organization="{record}">{{saasOrganizations.find(o=>o.id===record.organizationId)?.name}}</template><template #enabled="{record}"><a-tag :color="record.enabled?'green':'gray'">{{record.enabled?'开启':'关闭'}}</a-tag></template><template #action="{record}"><a-button type="text" @click="edit(record)">编辑</a-button></template></a-table></section>
<a-drawer :visible="visible" :title="draft.id?'编辑地磅设置':'添加地磅设置'" :width="'min(720px,96vw)'" :footer="false" @cancel="visible=false"><a-form layout="vertical"><a-form-item label="所属机构" required><a-select v-model="draft.organizationId" :options="saasOrganizations.map(o=>({label:o.name,value:o.id}))" aria-label="地磅所属机构"/></a-form-item><a-form-item label="数据来源" required><a-select v-model="draft.source" :options="[...weighbridgeSources]" aria-label="地磅数据来源"/></a-form-item><a-form-item label="重量单位" required><a-select v-model="draft.unit" :options="[...weighbridgeUnits]" aria-label="地磅重量单位"/></a-form-item><a-form-item label="是否开启"><a-switch v-model="draft.enabled" aria-label="启用地磅配置"/></a-form-item><div class="modal-actions"><a-button @click="visible=false">取消</a-button><a-button type="primary" @click="save">保存</a-button></div></a-form></a-drawer></div></template>
