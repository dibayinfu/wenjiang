<script setup lang="ts">
import { computed } from "vue";
import ResourceTable, { type Field } from "./ResourceTable.vue";
import { demo } from "../mock/store";
import { records } from "../mock/operations";
import mapAsset from "../assets/service-map.svg";
const fields = computed<Field[]>(() => [
  { key: "name", label: "线路名称", required: true },
  {
    key: "mode",
    label: "画线方式",
    type: "select",
    options: ["手动绘制", "根据车辆轨迹", "模拟自动规划"],
    default: "手动绘制",
    required: true,
  },
  {
    key: "pointIds",
    label: "关联收集点（顺序）",
    type: "multiple",
    options: demo.points
      .filter((p) =>
        demo.merchants.some(
          (m) =>
            m.id === p.merchantId && m.enabled && m.businessStatus === "营业中",
        ),
      )
      .map((p) => ({ label: p.name, value: p.id })),
    required: true,
    when: { key: "mode", value: "手动绘制" },
  },
  {
    key: "sourceVehicle",
    label: "轨迹来源车辆",
    type: "select",
    options: demo.fleet.map((v) => v.plate),
    when: { key: "mode", value: "根据车辆轨迹" },
    required: true,
    hidden: true,
  },
  {
    key: "sourceDate",
    label: "轨迹日期",
    type: "date",
    default: demo.date,
    when: { key: "mode", value: "根据车辆轨迹" },
    required: true,
    hidden: true,
  },
  { key: "enabled", label: "线路启用", type: "boolean", default: true },
  { key: "note", label: "备注", type: "textarea", hidden: true },
]);
function plannedPoints(r: any): string[] {
  const old = demo.routes.find((x) => x.id === r.id);
  if (
    old &&
    r.mode === "根据车辆轨迹" &&
    old.mode === r.mode &&
    old.sourceVehicle === r.sourceVehicle &&
    old.sourceDate === r.sourceDate
  )
    return old.pointIds;

  if (r.mode === "根据车辆轨迹")
    return [
      ...new Set(
        records(demo)
          .filter(
            (x) => x.vehicle === r.sourceVehicle && x.date === r.sourceDate,
          )
          .map((x) => x.pointId),
      ),
    ].filter((id) =>
      demo.points.some(
        (p) =>
          p.id === id &&
          demo.merchants.some(
            (m) =>
              m.id === p.merchantId &&
              m.enabled &&
              m.businessStatus === "营业中",
          ),
      ),
    );
  if (r.mode === "模拟自动规划")
    return demo.points
      .filter((p) =>
        demo.merchants.some(
          (m) =>
            m.id === p.merchantId && m.enabled && m.businessStatus === "营业中",
        ),
      )
      .sort((a, b) => a.address.localeCompare(b.address, "zh-CN"))
      .map((p) => p.id);
  return r.pointIds;
}
function validate(r: any) {
  const old = demo.routes.find((x) => x.id === r.id);
  if (
    old &&
    demo.schedules.some((s) => s.routeId === r.id && s.date >= demo.date) &&
    (JSON.stringify(plannedPoints(r)) !== JSON.stringify(old.pointIds) ||
      r.mode !== old.mode)
  )
    return "线路已有今日或未来排班；修改点位或规划方式请新增线路并调整后续计划";

  const ids = plannedPoints(r);
  if (!ids?.length) return "请选择收集点，或选择有收运记录的轨迹日期与车辆";
  if (demo.routes.some((x) => x.id !== r.id && x.name.trim() === r.name.trim()))
    return "线路名称不能重复";
  if (
    !r.enabled &&
    demo.schedules.some((s) => s.routeId === r.id && s.date >= demo.date)
  )
    return "线路存在今日或未来排班，请先调整排班";
}
function save(r: any) {
  r.pointIds = plannedPoints(r);
  r.sourceVehicle ??= "";
  r.sourceDate ??= "";
  const old = demo.routes.find((x) => x.id === r.id);
  if (old) Object.assign(old, r);
  else demo.routes.push(r);
}
function line(r: any) {
  return r.pointIds
    .map((id: string) => demo.points.find((p) => p.id === id))
    .filter(Boolean)
    .map((p: any) => `${p.x},${p.y}`)
    .join(" ");
}
</script>
<template>
  <a-alert
    >继承“线路列表 /
    线路设置”。手动绘制简化为按顺序选择收集点；根据车辆轨迹读取模拟完成点；自动规划按地址排序。线路不固定车辆，车辆与班次在排班中关联。</a-alert
  ><ResourceTable
    title="线路列表与设置"
    :rows="demo.routes"
    :fields="fields"
    :validate="validate"
    add
    @save="save"
    ><template #detail="{ record }"
      ><div class="detail-section">
        <h3>线路示意 · {{ record.pointIds.length }} 个收集点</h3>
        <div
          class="monitor-map route-preview"
          :style="{ backgroundImage: `url(${mapAsset})` }"
        >
          <svg
            class="track-overlay"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-label="线路点位顺序"
          >
            <polyline
              :points="line(record)"
              fill="none"
              stroke="#165dff"
              stroke-width="0.8"
            />
          </svg>
        </div>
        <ol class="route-point-list">
          <li v-for="(id, i) in record.pointIds" :key="id">
            {{ Number(i) + 1 }}.
            {{ demo.points.find((p) => p.id === id)?.name }}
          </li>
        </ol>
      </div></template
    ></ResourceTable
  >
</template>
