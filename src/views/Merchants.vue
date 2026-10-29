<script setup lang="ts">
defineOptions({ name: "WenjiangMerchants" });
import { computed, onDeactivated, reactive, ref, watch } from "vue";
import { Message } from "@arco-design/web-vue";
import { useRouter } from "vue-router";
import AppIcon from "../components/AppIcon.vue";
import PageHeader from "../components/PageHeader.vue";
import MetricGrid from "../components/MetricGrid.vue";
import StatusTag from "../components/StatusTag.vue";
import { demo, summary } from "../mock/store";
import { streets } from "../mock/model";
import type { Merchant, Street } from "../mock/types";
import { downloadCsv } from "../utils/csv";

const router = useRouter();
const keyword = ref("");
const street = ref("全部街道");
const status = ref("全部状态");
const page = ref(1);
const drawer = ref(false);
const selectedId = ref("");
const selected = computed(() =>
  demo.merchants.find((m) => m.id === selectedId.value),
);
const merchantTasks = computed(() =>
  demo.tasks.filter((t) => t.merchantId === selectedId.value),
);
const addVisible = ref(false);
onDeactivated(() => {
  drawer.value = false;
  addVisible.value = false;
});
const newMerchant = () => ({
  name: "",
  street: streets[0] as Street,
  category: "餐饮门店" as Merchant["category"],
  address: "",
  estimatedKg: 100,
});
const form = reactive(newMerchant());
const rows = computed(() =>
  demo.merchants.filter(
    (m) =>
      (!keyword.value.trim() ||
        `${m.id} ${m.name} ${m.address}`
          .toLowerCase()
          .includes(keyword.value.trim().toLowerCase())) &&
      (street.value === "全部街道" || m.street === street.value) &&
      (status.value === "全部状态" ||
        (status.value === "已签约" ? m.enabled : !m.enabled)),
  ),
);
watch([keyword, street, status], () => {
  page.value = 1;
});
watch(
  () => rows.value.length,
  (length) => {
    page.value = Math.min(page.value, Math.max(1, Math.ceil(length / 8)));
  },
);
const metrics = computed(() => [
  {
    label: "商户档案",
    value: summary.value.merchants,
    unit: "家",
    note: "已录入餐厨产废单位",
    icon: "shop",
  },
  {
    label: "已签约商户",
    value: summary.value.activeMerchants,
    unit: "家",
    note: "已开通日常收运服务",
    icon: "check",
    tone: "green",
  },
  {
    label: "今日已服务",
    value: summary.value.servicedMerchants,
    unit: "家",
    note: "已完成至少一次收运",
    icon: "truck",
    tone: "purple",
  },
  {
    label: "覆盖街道",
    value: new Set(demo.merchants.map((m) => m.street)).size,
    unit: "个",
    note: "当前示例项目服务区域",
    icon: "pin",
    tone: "orange",
  },
]);
const columns = [
  { title: "商户名称 / 编号", slotName: "name", width: 240 },
  { title: "所属街道", dataIndex: "street", width: 115 },
  { title: "商户类型", dataIndex: "category", width: 120 },
  { title: "收运频次", dataIndex: "frequency", width: 115 },
  { title: "预计单次产废", slotName: "weight", width: 125 },
  { title: "服务状态", slotName: "status", width: 110 },
  { title: "操作", slotName: "action", width: 90, fixed: "right" as const },
];
function reset() {
  keyword.value = "";
  street.value = "全部街道";
  status.value = "全部状态";
}
function openAdd() {
  Object.assign(form, newMerchant());
  addVisible.value = true;
}
function submit() {
  if (!form.name.trim() || !form.address.trim())
    return Message.warning("请填写商户名称和收运地址");
  if (
    !Number.isFinite(form.estimatedKg) ||
    form.estimatedKg <= 0 ||
    form.estimatedKg > 10000
  )
    return Message.warning("预计产废量应为 1–10000 kg");
  if (
    demo.merchants.some(
      (m) => m.name === form.name.trim() && m.street === form.street,
    )
  )
    return Message.warning("该街道已存在同名商户");
  const nextId =
    Math.max(
      0,
      ...demo.merchants.map((m) => Number(m.id.replace("WJ-SH", ""))),
    ) + 1;
  demo.merchants.unshift({
    id: `WJ-SH${String(nextId).padStart(3, "0")}`,
    name: form.name.trim(),
    street: form.street,
    address: form.address.trim(),
    category: form.category,
    contact: "示例联系人",
    frequency: "每日一次",
    estimatedKg: Math.round(form.estimatedKg),
    enabled: true,
  });
  reset();
  page.value = 1;
  addVisible.value = false;
  Message.success("商户已新增，可前往收运作业派单（模拟）");
}
function exportRows() {
  downloadCsv(`温江商户档案-${demo.date}.csv`, [
    [
      "商户编号",
      "商户名称",
      "街道",
      "类型",
      "地址",
      "收运频次",
      "预计单次产废(kg)",
      "服务状态",
    ],
    ...rows.value.map((m) => [
      m.id,
      m.name,
      m.street,
      m.category,
      m.address,
      m.frequency,
      m.estimatedKg,
      m.enabled ? "已签约" : "暂停收运",
    ]),
  ]);
  Message.success(`已导出 ${rows.value.length} 家模拟商户`);
}
</script>

<template>
  <div class="gi_page page-content">
    <PageHeader
      title="餐厨商户"
      description="建立产废单位档案，连接每一家商户与日常收运服务。"
      module="基础档案"
      ><a-button @click="exportRows"
        ><template #icon><AppIcon name="download" :size="16" /></template
        >导出档案</a-button
      ><a-button type="primary" @click="openAdd"
        ><template #icon><AppIcon name="plus" :size="17" /></template
        >新增商户</a-button
      ></PageHeader
    >
    <MetricGrid :items="metrics" />
    <section class="panel table-panel">
      <div class="panel-heading">
        <div class="inline-heading">
          <h2>商户档案列表</h2>
          <a-tag>模拟档案</a-tag>
        </div>
        <span class="muted small-text">共 {{ rows.length }} 家商户</span>
      </div>
      <div class="filter-bar">
        <a-input
          v-model="keyword"
          aria-label="搜索商户"
          placeholder="搜索商户名称、编号或地址"
          allow-clear
          class="search-input"
        /><a-select
          v-model="street"
          aria-label="商户街道筛选"
          :options="['全部街道', ...streets]"
          class="filter-select"
        /><a-select
          v-model="status"
          aria-label="商户状态筛选"
          :options="['全部状态', '已签约', '暂停收运']"
          class="filter-select"
        /><a-button @click="reset"
          ><template #icon><AppIcon name="refresh" :size="15" /></template
          >重置</a-button
        >
      </div>
      <a-table
        :data="rows.slice((page - 1) * 8, page * 8)"
        :columns="columns"
        :pagination="false"
        stripe
        :scroll="{ x: 1005 }"
        row-key="id"
        ><template #name="{ record }"
          ><div class="merchant-cell">
            <span class="shop-avatar"><AppIcon name="shop" :size="18" /></span>
            <div>
              <div class="cell-primary">{{ record.name }}</div>
              <div class="cell-secondary tabular">{{ record.id }}</div>
            </div>
          </div></template
        ><template #weight="{ record }"
          ><span class="weight-number"
            >{{ record.estimatedKg }}<span> kg</span></span
          ></template
        ><template #status="{ record }"
          ><StatusTag
            :value="record.enabled ? '已签约' : '暂停收运'" /></template
        ><template #action="{ record }"
          ><button
            class="text-button"
            @click="
              selectedId = record.id;
              drawer = true;
            "
          >
            查看详情
          </button></template
        ><template #empty
          ><a-empty description="没有匹配的商户，请调整筛选条件" /></template
      ></a-table>
      <div class="table-pagination">
        <span>商户信息均为虚构示例 · 每页 8 条</span
        ><a-pagination
          v-model:current="page"
          :total="rows.length"
          :page-size="8"
          show-total
        />
      </div>
    </section>
    <div class="usage-note">
      <AppIcon name="info" :size="16" /><span
        >体验提示：新增商户后，可在“收运作业”中为该商户派发模拟任务。</span
      >
    </div>
    <a-drawer
      v-model:visible="drawer"
      title="商户档案详情"
      :width="'min(520px, 96vw)'"
      :footer="false"
      ><template v-if="selected"
        ><div class="detail-hero">
          <span class="eyebrow">{{ selected.id }}</span>
          <h2>{{ selected.name }}</h2>
          <StatusTag :value="selected.enabled ? '已签约' : '暂停收运'" />
        </div>
        <a-descriptions :column="1" bordered
          ><a-descriptions-item label="所属街道">{{
            selected.street
          }}</a-descriptions-item
          ><a-descriptions-item label="商户类型">{{
            selected.category
          }}</a-descriptions-item
          ><a-descriptions-item label="收运地址">{{
            selected.address
          }}</a-descriptions-item
          ><a-descriptions-item label="联系人">{{
            selected.contact
          }}</a-descriptions-item
          ><a-descriptions-item label="收运频次">{{
            selected.frequency
          }}</a-descriptions-item
          ><a-descriptions-item label="预计单次产废"
            >{{ selected.estimatedKg }} kg</a-descriptions-item
          ></a-descriptions
        >
        <div class="detail-section">
          <h3>
            今日收运记录
            <span class="muted small-text">{{ merchantTasks.length }} 条</span>
          </h3>
          <div
            v-for="task in merchantTasks"
            :key="task.id"
            class="merchant-task"
          >
            <div>
              <strong>{{ task.id }}</strong>
              <p>
                {{ task.timeWindow }} ·
                {{ task.actualKg === null ? "待称重" : `${task.actualKg} kg` }}
              </p>
            </div>
            <StatusTag :value="task.status" />
          </div>
          <a-empty
            v-if="!merchantTasks.length"
            description="今日暂无收运任务"
          />
        </div>
        <a-button
          type="primary"
          long
          @click="
            drawer = false;
            router.push({ path: '/tasks', query: { keyword: selected.name } });
          "
          >查看该商户收运任务</a-button
        ></template
      ><a-empty v-else description="商户已被重置，请重新选择"
    /></a-drawer>
    <a-modal
      v-model:visible="addVisible"
      title="新增餐厨商户"
      :width="'min(500px, 94vw)'"
      :footer="false"
      ><p class="modal-description">
        录入一个演示商户，体验从建档到收运的完整流程。
      </p>
      <a-form layout="vertical" @submit="submit"
        ><a-form-item label="商户名称" required
          ><a-input
            v-model="form.name"
            aria-label="新增商户名称"
            placeholder="例如：温江示例餐厅"
            :max-length="60"
        /></a-form-item>
        <div class="form-grid">
          <a-form-item label="所属街道" required
            ><a-select
              v-model="form.street"
              aria-label="新增商户街道"
              :options="streets" /></a-form-item
          ><a-form-item label="商户类型" required
            ><a-select
              v-model="form.category"
              aria-label="新增商户类型"
              :options="['餐饮门店', '单位食堂', '酒店餐饮']"
          /></a-form-item>
        </div>
        <a-form-item label="收运地址" required
          ><a-input
            v-model="form.address"
            aria-label="新增商户地址"
            placeholder="请输入示例收运地址"
            :max-length="150" /></a-form-item
        ><a-form-item label="预计单次产废量（kg）" required
          ><a-input-number
            v-model="form.estimatedKg"
            aria-label="预计单次产废量"
            :min="1"
            :max="10000"
            :precision="0"
            style="width: 100%" /></a-form-item
        ><a-alert
          >新增商户默认已签约，每日收运一次。请填写虚构的演示信息。</a-alert
        >
        <div class="modal-actions">
          <a-button @click="addVisible = false">取消</a-button
          ><a-button type="primary" html-type="submit">保存商户</a-button>
        </div></a-form
      ></a-modal
    >
  </div>
</template>
