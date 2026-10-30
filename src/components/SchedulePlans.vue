<script setup lang="ts">
import { computed, onDeactivated, reactive, ref, watch } from "vue";
import { Message } from "@arco-design/web-vue";
import ResourceTable, { type Field } from "./ResourceTable.vue";
import { demo } from "../mock/store";
import { shiftDate } from "../mock/operations";
import {
  saveSchedules,
  validateSchedule,
  validateShift,
  type Schedule,
} from "../mock/sanitation";
const month = ref(demo.date.slice(0, 7));
const vehicle = ref("全部车辆");
const mode = ref("calendar");
const batch = ref(false);
const preview = ref<Schedule[]>([]);
const checkedKey = ref("");
const form = reactive({
  range: [demo.date, demo.date],
  vehicle: demo.fleet[0]!.plate,
  routeId: demo.routes[0]!.id,
  shiftId: demo.shifts[0]!.id,
});
const fields = computed<Field[]>(() => [
  {
    key: "date",
    label: "排班日期",
    type: "date",
    required: true,
    default: demo.date,
  },
  {
    key: "vehicle",
    label: "收运车辆",
    type: "select",
    options: demo.fleet
      .filter((v) => v.status !== "维修中")
      .map((v) => v.plate),
    required: true,
  },
  {
    key: "shiftId",
    label: "班次",
    type: "select",
    options: demo.shifts.map((s) => ({
      label: `${s.name} ${s.start}–${s.end}`,
      value: s.id,
    })),
    required: true,
  },
  {
    key: "routeId",
    label: "收运线路",
    type: "select",
    options: demo.routes
      .filter((r) => r.enabled)
      .map((r) => ({ label: r.name, value: r.id })),
    required: true,
  },
]);
const rows = computed(() =>
  demo.schedules.filter(
    (s) =>
      s.date.startsWith(month.value) &&
      (vehicle.value === "全部车辆" || s.vehicle === vehicle.value),
  ),
);
const days = computed(() => {
  if (!/^\d{4}-\d{2}$/.test(month.value)) return [];
  const first = `${month.value}-01`;
  const day = new Date(`${first}T12:00:00+08:00`).getUTCDay() || 7;
  const max = new Date(
    Number(month.value.slice(0, 4)),
    Number(month.value.slice(5, 7)),
    0,
  ).getDate();
  return [
    ...Array.from({ length: day - 1 }, () => ""),
    ...Array.from(
      { length: max },
      (_, i) => `${month.value}-${String(i + 1).padStart(2, "0")}`,
    ),
  ];
});
const selectedDate = ref("");
const selectedRows = computed(() =>
  rows.value.filter((s) => s.date === selectedDate.value),
);
const shiftFields: Field[] = [
  { key: "name", label: "班次名称", required: true },
  {
    key: "start",
    label: "开始时间（HH:mm）",
    required: true,
    default: "08:00",
  },
  { key: "end", label: "结束时间（HH:mm）", required: true, default: "12:00" },
];
function shiftValidate(r: any) {
  const msg = validateShift(demo, r);
  if (msg) return msg;
  const old = demo.shifts.find((s) => s.id === r.id);
  if (
    old &&
    (old.start !== r.start || old.end !== r.end) &&
    demo.schedules.some((s) => s.shiftId === r.id)
  )
    return "已被排班引用的时段请保留，可新增班次用于后续排班";
}
function saveShift(r: any) {
  const old = demo.shifts.find((s) => s.id === r.id);
  if (old) Object.assign(old, r);
  else demo.shifts.push(r);
}
function saveRow(r: any) {
  saveSchedules(demo, [r]);
}
function key() {
  return JSON.stringify(form);
}
function buildPreview() {
  preview.value = [];
  checkedKey.value = "";
  if (!form.range || form.range.length !== 2 || form.range[0]! > form.range[1]!)
    return Message.warning("请选择有效起止日期");
  const count =
    Math.round(
      (Date.parse(form.range[1]!) - Date.parse(form.range[0]!)) / 86400000,
    ) + 1;
  if (count < 1 || count > 31) return Message.warning("批量排班范围限1–31天");
  const next = Array.from({ length: count }, (_, i) => ({
    id: `SCH-${Date.now()}-${i}`,
    date: shiftDate(form.range[0]!, i),
    vehicle: form.vehicle,
    shiftId: form.shiftId,
    routeId: form.routeId,
  }));
  for (const r of next) {
    const error = validateSchedule(demo, r, [
      ...demo.schedules,
      ...next.filter((x) => x.id !== r.id),
    ]);
    if (error) return Message.warning(`${r.date}：${error}`);
  }
  preview.value = next;
  checkedKey.value = key();
}
function confirm() {
  if (!preview.value.length || checkedKey.value !== key())
    return Message.warning("请先生成有效预览");
  try {
    saveSchedules(demo, preview.value);
    batch.value = false;
    month.value = form.range[0]!.slice(0, 7);
    Message.success(
      `已保存${preview.value.length}条模拟排班计划，没有生成执行记录`,
    );
  } catch (e) {
    Message.warning((e as Error).message);
  }
}
watch(
  form,
  () => {
    preview.value = [];
    checkedKey.value = "";
  },
  { deep: true },
);
onDeactivated(() => {
  batch.value = false;
  selectedDate.value = "";
});
function validateRow(r: any) {
  return validateSchedule(demo, r);
}
</script>
<template>
  <section class="panel">
    <div class="panel-heading">
      <div>
        <h2>排班视图</h2>
        <p>
          继承日期、车辆、班次、线路关系，默认月历，复杂批量修改简化为预览后保存。
        </p>
      </div>
      <a-space wrap
        ><a-radio-group v-model="mode" type="button"
          ><a-radio value="calendar">排班日历</a-radio
          ><a-radio value="list">排班列表</a-radio
          ><a-radio value="shifts">班次设置</a-radio></a-radio-group
        ><a-button
          type="primary"
          @click="
            batch = true;
            preview = [];
          "
          >新增排班计划</a-button
        ></a-space
      >
    </div>
    <div class="filter-bar">
      <a-month-picker
        v-model="month"
        :allow-clear="false"
        aria-label="排班月份"
        style="width: 160px"
      /><a-select
        v-model="vehicle"
        :options="['全部车辆', ...demo.fleet.map((v) => v.plate)]"
        class="filter-select"
        aria-label="排班车辆"
      /><span class="muted">当前月 {{ rows.length }} 条排班 · 不提供派单</span>
    </div>
    <div v-if="mode === 'calendar'" class="schedule-calendar">
      <div
        v-for="day in ['一', '二', '三', '四', '五', '六', '日']"
        :key="day"
        class="calendar-week"
      >
        周{{ day }}
      </div>
      <div
        v-for="(day, i) in days"
        :key="day || 'blank' + i"
        class="calendar-day"
        :class="{ today: day === demo.date, blank: !day }"
      >
        <template v-if="day"
          ><button class="calendar-date" @click="selectedDate = day">
            {{ Number(day.slice(-2)) }}</button
          ><button
            v-for="s in rows.filter((s) => s.date === day)"
            :key="s.id"
            class="calendar-entry"
            @click="selectedDate = day"
          >
            {{ s.vehicle.slice(-3) }} ·
            {{ demo.shifts.find((x) => x.id === s.shiftId)?.name }}</button
          ><span
            v-if="!rows.some((s) => s.date === day)"
            class="muted small-text"
            >无排班</span
          ></template
        >
      </div>
    </div>
    <ResourceTable
      v-else-if="mode === 'list'"
      title="排班计划"
      :rows="rows"
      :fields="fields"
      :validate="validateRow"
      @save="saveRow"
    /><ResourceTable
      v-else
      title="班次设置"
      :rows="demo.shifts"
      :fields="shiftFields"
      :validate="shiftValidate"
      add
      @save="saveShift"
    />
  </section>
  <a-drawer
    :visible="!!selectedDate"
    :title="`${selectedDate} 排班计划`"
    :width="'min(650px,96vw)'"
    :footer="false"
    @cancel="selectedDate = ''"
    ><ResourceTable
      v-if="selectedRows.length"
      title="当日排班"
      :rows="selectedRows"
      :fields="fields"
      :validate="validateRow"
      @save="saveRow" /><a-empty v-else description="当日无排班" /></a-drawer
  ><a-modal
    v-model:visible="batch"
    title="新增排班计划 · 先预览后保存"
    :footer="false"
    :width="'min(700px,94vw)'"
    ><a-form layout="vertical"
      ><a-form-item label="生效时间范围（最多31天）" required
        ><a-range-picker v-model="form.range" style="width: 100%"
      /></a-form-item>
      <div class="form-grid">
        <a-form-item label="车辆" required
          ><a-select
            v-model="form.vehicle"
            :options="
              demo.fleet
                .filter((v) => v.status !== '维修中')
                .map((v) => v.plate)
            " /></a-form-item
        ><a-form-item label="班次" required
          ><a-select
            v-model="form.shiftId"
            :options="
              demo.shifts.map((s) => ({
                label: `${s.name} ${s.start}–${s.end}`,
                value: s.id,
              }))
            "
        /></a-form-item>
      </div>
      <a-form-item label="线路" required
        ><a-select
          v-model="form.routeId"
          :options="
            demo.routes
              .filter((r) => r.enabled)
              .map((r) => ({ label: r.name, value: r.id }))
          " /></a-form-item></a-form
    ><a-alert
      >保存只增加本地排班计划；同一车辆的时段重叠会被拦截。执行记录仍由独立模拟作业维护。</a-alert
    >
    <div v-if="preview.length" class="detail-section">
      <h3>待保存 {{ preview.length }} 条</h3>
      <a-space wrap
        ><a-tag v-for="s in preview" :key="s.id">{{ s.date }}</a-tag></a-space
      >
    </div>
    <div class="modal-actions">
      <a-button @click="batch = false">取消</a-button
      ><a-button @click="buildPreview">生成预览</a-button
      ><a-button type="primary" :disabled="!preview.length" @click="confirm"
        >确认保存排班</a-button
      >
    </div></a-modal
  >
</template>
