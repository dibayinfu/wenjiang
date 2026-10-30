<script setup lang="ts">
defineOptions({ name: "WenjiangMerchants" });
import { computed } from "vue";
import PageHeader from "../components/PageHeader.vue";
import ProductRequirements from "../components/ProductRequirements.vue";
import ResourceTable, { type Field } from "../components/ResourceTable.vue";
import { demo } from "../mock/store";
import { collectionLines, validCollectionLine } from "../mock/collection-lines";
import { streetDictionary, validMerchantStreet } from "../mock/merchant-dictionaries";
import { merchantPhoto, merchantProfile } from "../mock/merchant-profile";
const rows = computed(() => demo.merchants.map(m => merchantProfile(demo, m)));
const fields: Field[] = [
  { key: "name", label: "商户名称", required: true, width: 260 },
  { key: "lineId", label: "线路", type: "select", upgrade: true, width: 160,
    options: [{ label: "未分配", value: "" }, ...collectionLines.map(l => ({label:l.name,value:l.id}))], default: "" },
  {key:"street",label:"街道",type:"select",options:[{label:"未选择",value:""},...streetDictionary],hidden:true,upgrade:true,default:""},
  { key: "category", label: "商户类型", type: "select", options: ["餐饮门店", "单位食堂", "酒店餐饮"], required: true },
  { key: "businessStatus", label: "经营状态", type: "select", options: ["营业中", "停业", "歇业"], required: true },
  { key: "organization", label: "所属机构", readonly: true, width: 380 },
  { key: "contact", label: "客户姓名" },
  { key: "phone", label: "客户联系电话（模拟）", required: true, width: 190 },
  { key: "area", label: "商户面积（m²）", type: "number", min: 0 },
  { key: "estimatedKg", label: "预估垃圾量（kg）", type: "number", min: 1, max: 10000 },
  { key: "address", label: "地址", required: true, width: 280 },
  { key: "note", label: "备注", type: "textarea", hidden: true },
  { key: "bucket120", label: "120L配桶数量", type: "number", min: 0, max: 1000, hidden: true, formHidden: true },
  { key: "bucket240", label: "240L配桶数量", type: "number", min: 0, max: 1000, hidden: true, formHidden: true },
  { key: "bucket660", label: "660L配桶数量", type: "number", min: 0, max: 1000, hidden: true, formHidden: true },
  { key: "license", label: "商户照片说明", type: "textarea", hidden: true, formHidden: true },
];
function validateMerchant(row: any) {
  if (!validMerchantStreet(row.street)) return "请从字典选择街道";
  if (!validCollectionLine(row.lineId)) return "请选择有效线路";
  if (!demo.merchants.some(m => m.id === row.id)) return "商户不存在";
  if (!/^1\d{10}$/.test(row.phone)) return "模拟联系电话应为11位数字";
  if (demo.merchants.some(m => m.id !== row.id && m.name.trim() === row.name.trim() && m.street === row.street)) return "同街道商户名称不能重复";
  if (row.businessStatus !== "营业中" && demo.tasks.some(t => t.merchantId === row.id && t.status !== "已完成")) return "该商户还有未完成收运记录";
  if ([row.bucket120,row.bucket240,row.bucket660].some(n => !Number.isInteger(n) || n < 0 || n > 1000)) return "配桶数量应为0—1000的整数";
}
function saveMerchant(row: any) {
  const merchant = demo.merchants.find(m => m.id === row.id);
  if (!merchant) return;
  for (const key of ['name','lineId','street','category','businessStatus','contact','phone','area','estimatedKg','address','note','license'] as const) {
    (merchant as any)[key] = typeof row[key] === 'string' ? row[key].trim() : row[key];
  }
  // 现有配桶数量模拟字段独立保存，不自动创建或调整RFID实物资产。
  merchant.allocatedBins = {120:row.bucket120,240:row.bucket240,660:row.bucket660};
}
</script>
<template>
  <div class="gi_page page-content merchant-upgrade">
    <PageHeader title="商户管理" description="融涞系统升级 · 保留现有商户信息和演示场景，新增线路标红。" module="商户升级" />
    <ProductRequirements />
    <ResourceTable title="商户档案" :rows="rows" :fields="fields" editor-drawer
      :secondary-filter="{key:'lineId',label:'全部线路',options:[{label:'未分配',value:''},...collectionLines.map(l=>({label:l.name,value:l.id}))]}"
      :validate="validateMerchant" @save="saveMerchant">
      <template #detail>
        <section class="detail-section"><h3>其他资料 · 商户照片</h3>
          <a-image :src="merchantPhoto" :width="180" alt="商户照片模拟占位，点击预览" />
          <p class="muted">模拟占位图，不含真实商户照片。</p>
        </section>
      </template>
      <template #form-extra="{ draft }">
        <section class="detail-section"><h3>垃圾配桶信息</h3>
          <a-space wrap>
            <a-form-item v-for="size in [120,240,660]" :key="size" :label="`${size}L配桶数量`">
              <a-input-number v-model="draft[`bucket${size}`]" :min="0" :max="1000" :precision="0" :aria-label="`${size}L配桶数量`" />
            </a-form-item>
          </a-space>
          <h3>其他资料 · 商户照片（最多5张）</h3>
          <a-image :src="merchantPhoto" :width="180" alt="商户照片模拟占位，点击预览" />
          <a-form-item label="照片说明"><a-textarea v-model="draft.license" aria-label="照片说明" :max-length="500" /></a-form-item>
          <p class="muted">照片使用可预览的模拟占位图；本原型不上传真实附件。</p>
        </section>
      </template>
    </ResourceTable>
  </div>
</template>
<style scoped>
.upgrade-legend { margin-bottom: 16px; }
</style>
