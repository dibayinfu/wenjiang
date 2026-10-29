<script setup lang="ts">
defineOptions({ name: "WenjiangTasks" });
import { computed, onDeactivated, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { Message } from "@arco-design/web-vue";
import PageHeader from "../components/PageHeader.vue";
import MetricGrid from "../components/MetricGrid.vue";
import StatusTag from "../components/StatusTag.vue";
import AppIcon from "../components/AppIcon.vue";
import { demo, merchantName, summary } from "../mock/store";
import { advanceTask, dispatchTask, streets, vehicles } from "../mock/model";
import type { Task } from "../mock/types";
import { downloadCsv } from "../utils/csv";

const route = useRoute();
const keyword = ref("");
const status = ref("全部状态");
const street = ref("全部街道");
const page = ref(1);
const drawer = ref(false);
const selectedId = ref("");
const selected = computed(() =>
  demo.tasks.find((t) => t.id === selectedId.value),
);
const selectedMerchant = computed(() =>
  demo.merchants.find((m) => m.id === selected.value?.merchantId),
);
const dispatchVisible = ref(false);
const merchantId = ref("");
const vehicle = ref(vehicles[0]!.plate);
let lastTaskFullPath = "";
onDeactivated(() => {
  drawer.value = false;
  dispatchVisible.value = false;
});

watch(
  () => route.fullPath,
  (fullPath) => {
    if (route.path !== "/tasks" || fullPath === lastTaskFullPath) return;
    lastTaskFullPath = fullPath;
    const query = route.query;
    keyword.value = typeof query.keyword === "string" ? query.keyword : "";
    status.value =
      typeof query.status === "string" &&
      ["已完成", "待收运", "收运中"].includes(query.status)
        ? query.status
        : "全部状态";
    street.value =
      typeof query.street === "string" &&
      streets.some((s) => s === query.street)
        ? query.street
        : "全部街道";
  },
  { immediate: true },
);
const rows = computed(() =>
  demo.tasks
    .map((task) => ({
      ...task,
      name: merchantName(task.merchantId),
      street:
        demo.merchants.find((m) => m.id === task.merchantId)?.street ?? "",
    }))
    .filter(
      (t) =>
        (!keyword.value.trim() ||
          `${t.id} ${t.name} ${t.vehicle} ${t.driver}`
            .toLowerCase()
            .includes(keyword.value.trim().toLowerCase())) &&
        (status.value === "全部状态" || t.status === status.value) &&
        (street.value === "全部街道" || t.street === street.value),
    ),
);
watch([keyword, status, street], () => {
  page.value = 1;
});
watch(
  () => rows.value.length,
  (length) => {
    page.value = Math.min(page.value, Math.max(1, Math.ceil(length / 8)));
  },
);
const candidates = computed(() =>
  demo.merchants.filter(
    (m) =>
      m.enabled &&
      !demo.tasks.some((t) => t.merchantId === m.id && t.status !== "已完成"),
  ),
);
const metrics = computed(() => [
  {
    label: "今日任务",
    value: summary.value.total,
    unit: "条",
    note: "全部当日收运计划",
    icon: "truck",
  },
  {
    label: "已完成",
    value: summary.value.completed,
    unit: "条",
    note: "已完成称重收运",
    icon: "check",
    tone: "green",
  },
  {
    label: "收运中",
    value: summary.value.running,
    unit: "条",
    note: "车辆正在执行任务",
    icon: "pin",
    tone: "purple",
  },
  {
    label: "待收运",
    value: summary.value.pending,
    unit: "条",
    note: "等待车辆开始作业",
    icon: "clock",
    tone: "orange",
  },
]);
const columns = [
  { title: "任务编号", dataIndex: "id", width: 122 },
  { title: "收运商户", slotName: "merchant", width: 220 },
  { title: "收运车辆 / 司机", slotName: "vehicle", width: 160 },
  { title: "计划时段", dataIndex: "timeWindow", width: 130 },
  { title: "实际收运量", slotName: "weight", width: 120 },
  { title: "作业状态", slotName: "status", width: 110 },
  { title: "操作", slotName: "action", width: 155, fixed: "right" as const },
];
function showDetail(task: Task) {
  selectedId.value = task.id;
  drawer.value = true;
}
function advance(task: Task) {
  const wasPending = task.status === "待收运";
  if (advanceTask(demo, task.id))
    Message.success(
      wasPending
        ? "已开始收运（模拟）"
        : "已完成收运，运营统计已同步更新（模拟）",
    );
}
function resetFilters() {
  keyword.value = "";
  status.value = "全部状态";
  street.value = "全部街道";
}
function openDispatch() {
  merchantId.value = "";
  vehicle.value = vehicles[0]!.plate;
  dispatchVisible.value = true;
}
function submitDispatch() {
  try {
    const task = dispatchTask(demo, merchantId.value, vehicle.value);
    dispatchVisible.value = false;
    resetFilters();
    page.value = 1;
    Message.success(`任务 ${task.id} 已派发（模拟）`);
  } catch (error) {
    Message.warning((error as Error).message);
  }
}
function exportRows() {
  downloadCsv(`温江收运任务-${demo.date}.csv`, [
    [
      "任务编号",
      "收运日期",
      "商户",
      "街道",
      "车辆",
      "司机",
      "计划时段",
      "计划量(kg)",
      "实际量(kg)",
      "状态",
    ],
    ...rows.value.map((t) => [
      t.id,
      t.date,
      t.name,
      t.street,
      t.vehicle,
      t.driver,
      t.timeWindow,
      t.plannedKg,
      t.actualKg ?? "",
      t.status,
    ]),
  ]);
  Message.success(`已导出筛选后的 ${rows.value.length} 条模拟任务`);
}
</script>

<template>
  <div class="gi_page page-content">
    <PageHeader
      title="收运作业"
      description="统一管理当日收运计划，跟踪商户、车辆与任务进度。"
      module="运营管理"
    >
      <a-button @click="exportRows"
        ><template #icon><AppIcon name="download" :size="16" /></template
        >导出任务</a-button
      ><a-button type="primary" @click="openDispatch"
        ><template #icon><AppIcon name="plus" :size="17" /></template
        >派发任务</a-button
      >
    </PageHeader>
    <MetricGrid :items="metrics" />
    <section class="panel table-panel">
      <div class="panel-heading">
        <div class="inline-heading">
          <h2>收运任务列表</h2>
          <a-tag color="arcoblue">{{ demo.date }}</a-tag>
        </div>
        <span class="muted small-text">共 {{ rows.length }} 条结果</span>
      </div>
      <div class="filter-bar">
        <a-input
          v-model="keyword"
          aria-label="搜索收运任务"
          placeholder="搜索任务、商户或车牌"
          allow-clear
          class="search-input"
        /><a-select
          v-model="street"
          aria-label="街道筛选"
          :options="['全部街道', ...streets]"
          class="filter-select"
        /><a-select
          v-model="status"
          aria-label="任务状态筛选"
          :options="['全部状态', '待收运', '收运中', '已完成']"
          class="filter-select"
        /><a-button @click="resetFilters"
          ><template #icon><AppIcon name="refresh" :size="15" /></template
          >重置</a-button
        >
      </div>
      <a-table
        :columns="columns"
        :data="rows.slice((page - 1) * 8, page * 8)"
        :pagination="false"
        stripe
        :scroll="{ x: 1117 }"
        row-key="id"
      >
        <template #merchant="{ record }"
          ><div class="cell-primary">{{ record.name }}</div>
          <div class="cell-secondary">{{ record.street }}</div></template
        >
        <template #vehicle="{ record }"
          ><div class="cell-primary tabular">{{ record.vehicle }}</div>
          <div class="cell-secondary">{{ record.driver }}</div></template
        >
        <template #weight="{ record }"
          ><strong v-if="record.actualKg !== null" class="weight-number"
            >{{ record.actualKg }}<span> kg</span></strong
          ><span v-else class="muted">待称重</span></template
        >
        <template #status="{ record }"
          ><StatusTag :value="record.status"
        /></template>
        <template #action="{ record }"
          ><div class="table-actions">
            <button class="text-button" @click="showDetail(record)">详情</button
            ><button
              v-if="record.status !== '已完成'"
              class="text-button"
              @click="advance(record)"
            >
              {{ record.status === "待收运" ? "开始收运" : "完成收运" }}
            </button>
          </div></template
        >
        <template #empty
          ><a-empty description="没有匹配的任务，请调整筛选条件"
        /></template>
      </a-table>
      <div class="table-pagination">
        <span>全部为模拟任务 · 每页 8 条</span
        ><a-pagination
          v-model:current="page"
          :total="rows.length"
          :page-size="8"
          show-total
          :simple="false"
        />
      </div>
    </section>
    <div class="usage-note">
      <AppIcon name="info" :size="16" /><span
        >体验提示：点击“开始收运 →
        完成收运”，总览指标和商户收运记录会同步更新。</span
      >
    </div>
    <a-drawer
      v-model:visible="drawer"
      title="收运任务详情"
      :width="'min(520px, 96vw)'"
      :footer="false"
    >
      <template v-if="selected"
        ><div class="detail-hero">
          <span class="eyebrow">{{ selected.id }}</span>
          <h2>{{ merchantName(selected.merchantId) }}</h2>
          <StatusTag :value="selected.status" />
        </div>
        <a-descriptions :column="1" bordered
          ><a-descriptions-item label="收运日期">{{
            selected.date
          }}</a-descriptions-item
          ><a-descriptions-item label="所属街道">{{
            selectedMerchant?.street
          }}</a-descriptions-item
          ><a-descriptions-item label="收运地址">{{
            selectedMerchant?.address
          }}</a-descriptions-item
          ><a-descriptions-item label="收运车辆">{{
            selected.vehicle
          }}</a-descriptions-item
          ><a-descriptions-item label="作业司机">{{
            selected.driver
          }}</a-descriptions-item
          ><a-descriptions-item label="计划时段">{{
            selected.timeWindow
          }}</a-descriptions-item
          ><a-descriptions-item label="预计收运量"
            >{{ selected.plannedKg }} kg</a-descriptions-item
          ><a-descriptions-item label="实际收运量">{{
            selected.actualKg === null ? "待称重" : `${selected.actualKg} kg`
          }}</a-descriptions-item
          ><a-descriptions-item label="完成时间">{{
            selected.completedAt || "尚未完成"
          }}</a-descriptions-item></a-descriptions
        >
        <div class="detail-section">
          <h3>作业流程</h3>
          <div class="flow-steps">
            <div :class="{ done: true }"><span>1</span>任务派发</div>
            <div :class="{ done: selected.status !== '待收运' }">
              <span>2</span>开始收运
            </div>
            <div :class="{ done: selected.status === '已完成' }">
              <span>3</span>称重完成
            </div>
          </div>
        </div>
        <a-alert
          >模拟操作：完成收运时按预计重量生成称重记录，不连接车辆或称重设备。</a-alert
        >
        <a-button
          v-if="selected.status !== '已完成'"
          type="primary"
          long
          class="detail-action"
          @click="advance(selected)"
          >{{
            selected.status === "待收运"
              ? "开始收运（模拟）"
              : "完成收运（模拟）"
          }}</a-button
        > </template
      ><a-empty v-else description="任务已被重置，请重新选择" />
    </a-drawer>
    <a-modal
      v-model:visible="dispatchVisible"
      title="派发收运任务"
      :width="'min(500px, 94vw)'"
      :footer="false"
    >
      <p class="modal-description">为商户创建一条今日下午的模拟收运任务。</p>
      <a-form layout="vertical" @submit="submitDispatch"
        ><a-form-item label="收运商户" required
          ><a-select
            v-model="merchantId"
            placeholder="请选择商户"
            aria-label="派单商户"
            :options="candidates.map((m) => ({ label: m.name, value: m.id }))"
            allow-search /></a-form-item
        ><a-form-item label="收运车辆" required
          ><a-select
            v-model="vehicle"
            aria-label="派单车辆"
            :options="
              vehicles.map((v) => ({
                label: `${v.plate} · ${v.driver}`,
                value: v.plate,
              }))
            " /></a-form-item
        ><a-alert v-if="!candidates.length" type="warning"
          >暂无可派单商户。请先完成已有任务或新增签约商户。</a-alert
        ><a-alert v-else
          >仅可为已签约且没有未完成任务的商户派单。计划时段为
          14:00–16:00。</a-alert
        >
        <div class="modal-actions">
          <a-button @click="dispatchVisible = false">取消</a-button
          ><a-button type="primary" :disabled="!merchantId" html-type="submit"
            >确认派发</a-button
          >
        </div></a-form
      >
    </a-modal>
  </div>
</template>
