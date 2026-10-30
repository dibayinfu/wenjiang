<script setup lang="ts">
defineOptions({ name: "WenjiangReports" });
import {
  computed,
  h,
  nextTick,
  onBeforeUnmount,
  onDeactivated,
  ref,
  watch,
} from "vue";
import { useRoute } from "vue-router";
import { IconFile } from "@arco-design/web-vue/es/icon";
import {collectionLines} from "../mock/collection-lines";
import {streetDictionary,merchantMatchesFilters} from "../mock/merchant-dictionaries";
import { currentOrganization } from "../mock/manifest-templates";
import PageHeader from "../components/PageHeader.vue";
import CollectionPointEditor from "../components/CollectionPointEditor.vue";
import ProductRequirements from "../components/ProductRequirements.vue";
import StatusTag from "../components/StatusTag.vue";
import { demo, merchantName } from "../mock/store";
import { records, shiftDate, type Point } from "../mock/operations";
import {
  periodRange,
  merchantDatePresets, merchantDateRange, type MerchantDatePreset,
  sanitationReport,
} from "../mock/reporting";
import { weighingRows, type Weighing, resolveWeighingPoint } from "../mock/sanitation";
import { downloadCsv } from "../utils/csv";
import { compareWeighbridge } from "../mock/weighbridge";
import { manifestEnabled, findDailyManifest, type DailyManifest } from "../mock/daily-manifests";
import {manifestExample} from "../mock/manifest-example";
import ManifestSheet from "../components/ManifestSheet.vue";
import { downloadManifestPdf } from "../utils/manifest-pdf";
import { weighbridgeSettings } from "../mock/weighbridge-settings";
import { Message } from "@arco-design/web-vue";
const dailySelected = ref<DailyManifest|null>(null);
const exampleSelected=computed(()=>dailySelected.value?manifestExample(dailySelected.value):null);
const downloading = ref(false);
watch(() => weighbridgeSettings.enabled, enabled => {if(!enabled)selectedWeighbridgeId.value="";});
watch(() => manifestEnabled.value, enabled => {if(!enabled)dailySelected.value=null;});
async function downloadDaily(){if(!exampleSelected.value)return;downloading.value=true;try{await downloadManifestPdf(exampleSelected.value);}catch{Message.error('PDF生成失败，请重试');}finally{downloading.value=false;}}
const selectedWeighbridgeId = ref("");
const route = useRoute();
const props = defineProps<{ reportView: string }>();
const view = ref(props.reportView);
const ownPath = route.path;
const reportTitle=computed(()=>view.value==='商户报表'?'商户日报':view.value==='车辆收运汇总'?'车辆线路日报':view.value==='车辆收运明细'?'收运明细':view.value);
const reportOrganization=computed(()=>currentOrganization.name);
const newTitle = (label: string) => () => h("span", { class: "report-upgrade", style: { whiteSpace: "nowrap" } }, label);
const date = ref(demo.date);
const advancedFilters=ref(false);
const advancedFilterCount=computed(()=>view.value==='车辆收运明细'?Number(!!keyword.value.trim()):Number(merchantStatus.value!=='全部状态')+Number(!!streetFilter.value));
const vehicleRouteFilter=ref("全部线路");
const detailLineFilter=ref("全部线路");
const lineFilter=ref("全部线路"),streetFilter=ref(""),merchantStatus=ref("全部状态");
const period = ref("自定义");
const hasDateShortcuts=computed(()=>['商户报表','车辆收运明细','车辆收运汇总'].includes(view.value));
const customRange = ref<string[]>(hasDateShortcuts.value ? merchantDateRange(demo.date,'昨日') : [shiftDate(demo.date,-6),demo.date]);
const activeDatePreset=computed(()=>merchantDatePresets.find(preset=>{
  const [start,end]=merchantDateRange(demo.date,preset);
  return customRange.value[0]===start && customRange.value[1]===end;
}));
function selectDatePreset(preset:MerchantDatePreset){period.value='自定义';customRange.value=merchantDateRange(demo.date,preset);}
const vehicle = ref("全部车辆");
const merchant = ref("全部商户");
const point = ref("全部收集点");
const keyword = ref("");
const validity = ref("全部记录");
const page = ref(1);
const detailPage = ref(1);
const selectedId = ref("");
const selectedEventId = ref("");
const printing = ref(false);
const range = computed<[string, string]>(() =>
  period.value === "自定义"
    ? [customRange.value?.[0] ?? "", customRange.value?.[1] ?? ""]
    : periodRange(date.value || demo.date, period.value),
);
const rangeError = computed(() =>
  !range.value[0] || !range.value[1] || range.value[0] > range.value[1]
    ? "请选择有效起止日期"
    : Date.parse(range.value[1]) - Date.parse(range.value[0]) > 365 * 86400000
      ? "单次查询范围不超过366天"
      : "",
);
const filtered = computed(() =>
  rangeError.value
    ? []
    : records(demo).filter((r) => {
        const inRange = r.date >= range.value[0] && r.date <= range.value[1];
        const matches =
          (view.value === "商户报表" || vehicle.value === "全部车辆" || r.vehicle === vehicle.value) &&
          (view.value === "车辆收运汇总" || view.value === "车辆收运明细" || merchant.value === "全部商户" || r.merchantId === merchant.value) &&
          (view.value === "商户报表" || view.value === "车辆收运汇总" || point.value === "全部收集点" || r.pointId === point.value);
        const text = `${r.date} ${r.vehicle} ${merchantName(r.merchantId)} ${demo.points.find((p) => p.id === r.pointId)?.name ?? ""} ${demo.bins
          .filter((b) => b.pointId === r.pointId)
          .map((b) => b.rfid)
          .join(" ")}`;
        return (
          inRange &&
          matches &&
          (view.value!=="商户报表" || !!demo.merchants.find(m=>m.id===r.merchantId&&merchantMatchesFilters(m,{line:lineFilter.value,street:streetFilter.value,status:merchantStatus.value}))) &&
          (view.value === "车辆收运明细" ||
            view.value === "车辆收运汇总" || !keyword.value.trim() ||
            (view.value === "车辆收运汇总" ? `${r.date} ${r.vehicle}` : text).includes(keyword.value.trim()))
        );
      }),
);
const exceptions = computed(() =>
  demo.weighExceptions.filter(
    (r) =>
      !rangeError.value &&
      r.date >= range.value[0] &&
      r.date <= range.value[1] &&
      (view.value === "商户报表" || vehicle.value === "全部车辆" || r.vehicle === vehicle.value) &&
      (view.value === "车辆收运汇总" || view.value === "车辆收运明细" || merchant.value === "全部商户" || r.merchantId === merchant.value) &&
      (view.value === "商户报表" || view.value === "车辆收运汇总" || point.value === "全部收集点" || r.pointId === point.value),
  ),
);
const grouped = computed(() =>
  sanitationReport(
    demo,
    filtered.value,
    view.value,
    new Set(
      demo.points
        .filter(
          (p) =>
            (view.value === "车辆收运汇总" || merchant.value === "全部商户" ||
              p.merchantId === merchant.value) &&
            (view.value === "车辆收运汇总" || point.value === "全部收集点" || p.id === point.value),
        )
        .map((p) => p.id),
    ),
  ).filter(r => view.value !== "车辆收运汇总" || vehicleRouteFilter.value === "全部线路" || (vehicleRouteFilter.value === "未匹配" ? r.routeUnmatched : r.routeIds.includes(vehicleRouteFilter.value))).map(r => ({...r, comparison: compareWeighbridge(demo.weighbridge ?? [], r.date, r.vehicle, r.kg)})),
);
const rawEvents = computed(() => [
  ...weighingRows(demo, filtered.value, false),
  ...exceptions.value,
].map(row => resolveWeighingPoint(demo,row)));
function merchantLineId(merchantId: string) {
  return demo.merchants.find(m => m.id === merchantId)?.lineId ?? '';
}
function merchantLineLabel(merchantId: string) {
  return collectionLines.find(line => line.id === merchantLineId(merchantId))?.name ?? '该商户设置线路';
}
const events = computed(() =>
  rawEvents.value.filter(r => (merchant.value === '全部商户' || r.merchantId === merchant.value) && r.rfid.toLowerCase().includes(keyword.value.trim().toLowerCase()) &&
    (detailLineFilter.value === '全部线路' || merchantLineId(r.merchantId) === detailLineFilter.value)),
);
const pointEditor = ref(false);
const editingPoint = ref<Point>();
const pointEvent = ref<Weighing>();
function editCollectionPoint(row: Weighing) {
  pointEvent.value = row;
  editingPoint.value = demo.points.find(point => point.id === row.pointId);
  pointEditor.value = true;
}
const detailListColumns = [
  { title: "日期", dataIndex: "date", width: 120 },
  { title: "车牌号", dataIndex: "vehicle", width: 140 },
  { title: "商户", width: 230, render: ({record}: {record: Weighing}) => merchantName(record.merchantId) },
  { title: newTitle("线路"), width: 160, render: ({record}: {record: Weighing}) => h('span', {class:'report-upgrade', style:{whiteSpace:'nowrap'}}, merchantLineLabel(record.merchantId)) },
  { title: "重量（kg）", width: 120, render: ({record}: {record: Weighing}) => record.kg.toFixed(2) },
  { title: "RFID", width: 260, render: ({record}: {record: Weighing}) => h("span", {class: "rfid-value"}, record.rfid) },
  { title: "所属收集点", width: 230, render: ({record}: {record: Weighing}) => demo.points.find(p => p.id === record.pointId)?.name ?? '未绑定' },
  { title: "所属机构", slotName: "organization", width: 380 },
  { title: "收集时间", dataIndex: "collectedAt", width: 180 },
  { title: "操作", width: 180, fixed: "right" as const, render: ({record}: {record: Weighing}) => h('button', {class:'text-button', onClick:()=>editCollectionPoint(record)}, demo.points.some(p=>p.id===record.pointId) ? '编辑收集点' : '添加收集点') },
];
const visibleRecords = computed(() =>
  view.value === "车辆收运明细"
    ? events.value.filter((e) => e.status === "有效")
    : grouped.value.flatMap((g) => g.items),
);
const totalKg = computed(
  () =>
    Math.round(visibleRecords.value.reduce((s, r) => s + r.kg, 0) * 100) / 100,
);
const bucketCount = computed(() =>
  view.value === "车辆收运明细"
    ? events.value.filter((e) => e.status === "有效").length
    : grouped.value.reduce((s, r) => s + r.buckets, 0),
);
const summaryCount = computed(() => new Set(visibleRecords.value.map(r => view.value === '商户报表' ? r.merchantId : r.vehicle)).size);
const columns = computed(() => view.value === "商户报表" ? [
  {title:"日期",dataIndex:"date",width:120},
  {title:newTitle("线路"),slotName:"line",width:110},
  {title:"商户名称",dataIndex:"name",width:240,ellipsis:true,tooltip:true},
  {title:"收运重量（kg）",slotName:"merchantWeight",width:140},
  {title:"收运桶数",slotName:"buckets",width:110},
  ...(manifestEnabled.value?[{title:newTitle("联单"),slotName:"dailyManifest",width:130}]:[]),
  {title:newTitle("状态"),dataIndex:"merchantStatus",width:100},
  {title:newTitle("街道"),dataIndex:"street",width:110},
  {title:newTitle("日均（kg）"),slotName:"dailyAverage",width:140},
  {title:"所属机构",slotName:"organization",width:380},
  {title:"操作",slotName:"action",width:90,fixed:"right" as const},
] : [
  { title: "日期", dataIndex: "date", width: 120 },
  {
    title:
      view.value === "商户报表"
        ? "商户名称"
        : view.value === "收集点报表"
          ? "收集点"
          : "车牌号",
    dataIndex: "name",
    width: 170,
    ellipsis: true,
    tooltip: true,
  },
  ...(view.value === "商户报表"
    ? [{ title: "客户联系电话（模拟）", dataIndex: "phone", width: 165 }]
    : view.value === "收集点报表"
      ? [
          { title: "车牌号", dataIndex: "vehicle", width: 140 },
          {
            title: "所属商户",
            slotName: "merchant",
            width: 200,
            ellipsis: true,
            tooltip: true,
          },
        ]
      : []),
  ...(view.value === "车辆收运汇总" ? [{ title: newTitle("线路"), dataIndex: "routeName", width: 100, ellipsis: true, tooltip: true, cellStyle: { color: "rgb(var(--danger-6))" } }] : []),
  { title: "收运重量（kg）", slotName: "weight", width: 140 },
  { title: "收运桶数", slotName: "buckets", width: 110 },
  ...(view.value === "车辆收运汇总"
    ? [
        ...(weighbridgeSettings.enabled ? [{ title: newTitle("地磅净重（kg）"), slotName: "weighbridge", width: 190 },
        { title: newTitle("准确率"), slotName: "accuracy", width: 120 },
        ] : []),
        { title: "所属机构", slotName: "organization", width: 380 },
        { title: "计划点位", slotName: "planned", width: 110 },
        { title: "计划内实收点位", dataIndex: "completed", width: 110 },
        { title: "计划外实收点位", dataIndex: "unplanned", width: 110 },
        { title: "漏收点位", dataIndex: "missing", width: 110 },
        { title: "完成率", slotName: "rate", width: 110 },
      ]
    : view.value === "收集点报表"
      ? [
        { title: "到达时间", slotName: "arrival", width: 160 },
        { title: "离开时间", slotName: "departure", width: 160 },
        { title: "停留时长", slotName: "duration", width: 130 },
      ]
      : [{ title: "预估垃圾量（kg）", dataIndex: "estimated", width: 150 }]),
  ...(view.value !== "车辆收运汇总" ? [{ title: "所属机构", slotName: "organization", width: 380 }] : []),
  ...(view.value === "商户报表" && manifestEnabled.value ? [{ title: newTitle("联单"), slotName: "dailyManifest", width: 130 }] : []),
  { title: "操作", slotName: "action", width: 100, fixed: "right" as const },
]);
const eventColumns = [
  { title: "收集时间", dataIndex: "collectedAt", width: 175 },
  { title: "车牌号", dataIndex: "vehicle", width: 135 },
  { title: "垃圾桶RFID编号", width: 260, render: ({record}: {record: Weighing}) => h("span", {class: "rfid-value"}, record.rfid) },
  { title: "净重（kg）", width: 110, render: ({record}: {record: Weighing}) => record.kg.toFixed(2) },
  {
    title: "收集点 / 商户",
    slotName: "point",
    width: 230,
    ellipsis: true,
    tooltip: true,
  },
  { title: "所属机构", slotName: "organization", width: 380 },
  { title: "记录状态", slotName: "validity", width: 110 },
  { title: "操作", slotName: "action", width: 90, fixed: "right" as const },
];
const selectedGroup = computed(() =>
  grouped.value.find((r) => r.id === selectedId.value),
);
const selectedWeighbridge = computed(() => grouped.value.find(r => r.id === selectedWeighbridgeId.value));
const detailEvents = computed(() =>
  selectedGroup.value
    ? weighingRows(demo, selectedGroup.value.items, false)
    : [],
);
const selectedEvent = computed(() =>
  !selectedEventId.value
    ? undefined
    : rawEvents.value.find((r) => r.id === selectedEventId.value) ||
      detailEvents.value.find((r) => r.id === selectedEventId.value),
);
watch(
  [
    view,
    period,
    date,
    customRange,
    vehicle,
    merchant,
    point,
    keyword,
    validity, detailLineFilter, vehicleRouteFilter, lineFilter,streetFilter,merchantStatus,
  ],
  () => {
    page.value = 1;
    selectedId.value = "";
    selectedEventId.value = "";
    selectedWeighbridgeId.value = "";
    detailPage.value = 1;
  },
  { deep: true },
);
watch(
  () => route.fullPath,
  () => {
    if (route.path !== ownPath) return;
    if (
      typeof route.query.merchant === "string" &&
      demo.merchants.some((m) => m.id === route.query.merchant)
    ) {
      merchant.value = route.query.merchant;
      customRange.value = [demo.date, demo.date];
    }
    if (
      typeof route.query.vehicle === "string" &&
      demo.fleet.some((v) => v.plate === route.query.vehicle)
    )
      vehicle.value = route.query.vehicle;
  },
  { immediate: true },
);
function exportData() {
  if (view.value === "车辆收运明细")
    downloadCsv(`温江-${reportTitle.value}-${range.value[0]}.csv`, [
      ["日期", "车牌号", "商户", "线路", "重量kg", "RFID", "所属收集点", "所属机构", "收集时间"],
      ...events.value.map(r => [r.date, r.vehicle, merchantName(r.merchantId),
        merchantLineLabel(r.merchantId), r.kg.toFixed(2), r.rfid,
        demo.points.find(p => p.id === r.pointId)?.name ?? '未绑定', currentOrganization.name, r.collectedAt]),
    ]);
  else if (view.value === "车辆收运汇总")
    downloadCsv(`温江-${reportTitle.value}-${range.value[0]}.csv`, [
      [
        "日期",
        "车牌号",
        "线路",
        "收运重量kg",
        "桶数",
        "所属机构",
        ...(weighbridgeSettings.enabled ? ["地磅净重kg", "准确率%"] : []),
        "计划点位",
        "计划内实收",
        "计划外实收",
        "未完成点位",
        "完成率%",
      ],
      ...grouped.value.map((r) => [
        r.date,
        r.vehicle,
        r.routeName,
        r.kg.toFixed(2),
        r.buckets,
        currentOrganization.name,
        ...(weighbridgeSettings.enabled ? [r.comparison.netKg?.toFixed(2) ?? "", r.comparison.accuracy?.toFixed(2) ?? ""] : []),
        r.planned ?? "",
        r.completed ?? "",
        r.unplanned ?? "",
        r.missing ?? "",
        r.rate ?? "",
      ]),
    ]);
  else if (view.value === "收集点报表")
    downloadCsv(`温江-${reportTitle.value}-${range.value[0]}.csv`, [
      ["日期", "收集点", "车牌号", "所属商户", "净重kg", "桶数", "所属机构", "到达时间", "离开时间", "停留时长"],
      ...grouped.value.map((r) => [
        r.date,
        r.name,
        r.vehicle,
        merchantName(r.merchantId),
        r.kg,
        r.buckets,
        currentOrganization.name, "待接入", "待接入", "待接入",
      ]),
    ]);
  else
    downloadCsv(`温江-${reportTitle.value}-${range.value[0]}.csv`, [
      ["日期","线路","商户名称","收运重量kg","收运桶数",...(manifestEnabled.value?["联单编号"]:[]),"状态","街道","最近30天日均kg","所属机构"],
      ...grouped.value.map(r=>[
        r.date,collectionLines.find(l=>l.id===r.lineId)?.name??'未分配',r.name,r.kg.toFixed(2),r.buckets,
        ...(manifestEnabled.value?[findDailyManifest(r.date,r.merchantId)?.number??'待生成']:[]),
        r.merchantStatus,r.street,r.dailyAverageKg===null?'':r.dailyAverageKg.toFixed(0),currentOrganization.name,
      ]),
    ]);
}
function reset() {
  if(hasDateShortcuts.value)selectDatePreset('昨日');
  if(view.value==='商户报表'||view.value==='车辆收运明细')advancedFilters.value=false;
  vehicleRouteFilter.value="全部线路";
  detailLineFilter.value="全部线路";
  lineFilter.value="全部线路";streetFilter.value="";merchantStatus.value="全部状态";
  vehicle.value = "全部车辆";
  merchant.value = "全部商户";
  point.value = "全部收集点";
  keyword.value = "";
  validity.value = "全部记录";
}
async function printReport() {
  printing.value = true;
  await nextTick();
  window.print();
  printing.value = false;
}
function beforePrint() {
  printing.value = true;
}
function afterPrint() {
  printing.value = false;
}
window.addEventListener("beforeprint", beforePrint);
window.addEventListener("afterprint", afterPrint);
onBeforeUnmount(() => {
  window.removeEventListener("beforeprint", beforePrint);
  window.removeEventListener("afterprint", afterPrint);
});
onDeactivated(() => {
  pointEditor.value = false;
  dailySelected.value = null;
  selectedWeighbridgeId.value = "";
  selectedId.value = "";
  selectedEventId.value = "";
});
function pointLabel(r: Weighing) {
  return `${demo.points.find((p) => p.id === r.pointId)?.name ?? "未绑定收集点"} / ${r.merchantId ? merchantName(r.merchantId) : "未绑定商户"}`;
}
</script>
<template>
  <div class="gi_page page-content report-page" :class="{'merchant-daily':view==='商户报表'}">
    <PageHeader
      :title="reportTitle"
      description="融涞系统作业监管 · 保留原有报表信息作为演示背景，新增地磅比对内容标红。"
      module="作业监管"
      ><a-button v-if="view !== '商户报表'" :disabled="!!rangeError" @click="printReport"
        >打印报表</a-button
      ><a-button type="primary" :disabled="!!rangeError" @click="exportData"
        >导出当前报表</a-button
      ></PageHeader
    ><ProductRequirements />
    <div class="print-only">
      {{ reportTitle }} · {{ range[0] }} 至 {{ range[1] }} · 全部模拟数据
    </div>
    <section class="panel report-filters">
      <div class="filter-bar">
        <a-range-picker v-model="customRange" :allow-clear="false" aria-label="报表日期范围" style="width: 320px; max-width: 100%"
        /><a-button-group v-if="hasDateShortcuts" class="report-date-presets" aria-label="报表日期快捷选择"><a-button v-for="preset in merchantDatePresets" :key="preset" size="small" :type="activeDatePreset===preset?'primary':'secondary'" :aria-pressed="activeDatePreset===preset" @click="selectDatePreset(preset)">{{preset}}</a-button></a-button-group><a-select
          v-if="view!=='商户报表'"
          v-model="vehicle"
          :options="['全部车辆', ...demo.fleet.map((v) => v.plate)]"
          class="filter-select"
          aria-label="报表车辆"
          allow-search
          :filter-option="(search: string, option: {label?: unknown; value?: unknown}) => String(option.label ?? option.value).toLowerCase().includes(search.toLowerCase())"
        /><a-select v-if="view === '车辆收运汇总'" v-model="vehicleRouteFilter" class="filter-select report-upgrade" :options="[{label:'全部线路',value:'全部线路'},{label:'未匹配',value:'未匹配'},...collectionLines.map(r=>({label:r.name,value:r.id}))]" aria-label="车辆日报线路" allow-search/><a-select
          v-if="view !== '车辆收运汇总'"
          v-model="merchant"
          :options="[
            { label: '全部商户', value: '全部商户' },
            ...demo.merchants.map((m) => ({ label: m.name, value: m.id })),
          ]"
          class="filter-select"
          aria-label="报表商户"
          allow-search
          :filter-option="(search: string,option: {label?: unknown})=>String(option.label).toLowerCase().includes(search.toLowerCase())"
        /><a-select v-if="view === '车辆收运明细'" v-model="detailLineFilter" class="filter-select report-upgrade" :options="[{label:'全部线路',value:'全部线路'},{label:'未设置线路',value:''},...collectionLines.map(line=>({label:line.name,value:line.id}))]" aria-label="收运明细线路" allow-search/><a-input
          v-if="view!=='商户报表' && view!=='车辆收运汇总' && (view!=='车辆收运明细' || advancedFilters)"
          v-model="keyword"
          :placeholder="
            view === '车辆收运明细'
              ? 'RFID模糊查询'
              : '筛选日期、名称或车牌'
          "
          aria-label="搜索报表"
          class="search-input"
          allow-clear
        /><template v-if="view==='商户报表'">
        <a-select v-model="lineFilter" class="filter-select report-upgrade" :options="[{label:'全部线路',value:'全部线路'},{label:'未分配',value:''},...collectionLines.map(l=>({label:l.name,value:l.id}))]" aria-label="日报线路"/>
        
        <template v-if="advancedFilters">
        <a-select v-model="merchantStatus" class="filter-select report-upgrade" :options="['全部状态','运营中','已停止']" aria-label="商户状态"/>
        <a-select v-model="streetFilter" class="filter-select report-upgrade" :options="[{label:'全部街道',value:''},...streetDictionary]" aria-label="日报街道" allow-search/>
        </template></template><a-button v-if="view==='商户报表' || view==='车辆收运明细'" type="text" :aria-expanded="advancedFilters" @click="advancedFilters=!advancedFilters">{{advancedFilters?'收起':'展开'}}{{advancedFilterCount?`（已选${advancedFilterCount}项）`:''}}</a-button><a-button @click="reset">重置</a-button>
      </div>
      <a-alert v-if="rangeError" type="warning">{{ rangeError }}</a-alert>
    </section>
    <div class="report-summary" aria-label="当前查询汇总">
      <span>{{view === '商户报表' ? '商户数量' : view === '车辆收运明细' ? '有效收运车辆数' : '收运车辆数'}}：<strong>{{summaryCount}}</strong></span>
      <span>{{view==='车辆收运明细'?'有效收运重量':'收运重量'}}：<strong>{{totalKg.toFixed(2)}}</strong> 千克</span>
      <span>{{view==='车辆收运明细'?'有效收运桶数':'收运桶数'}}：<strong>{{bucketCount}}</strong></span>
    </div>
    <section class="panel">
      <div class="panel-heading">
        <h2>{{ reportTitle }}</h2>
        <span class="muted small-text"
          >{{
            view === "车辆收运明细" ? events.length : grouped.length
          }}
          条结果</span
        >
      </div>
      <a-table
        v-if="view === '车辆收运明细'"
        :data="printing ? events : events.slice((page - 1) * 10, page * 10)"
        :columns="detailListColumns"
        :pagination="false"
        :scroll="{ x: 2100 }"
        row-key="id"
        ><template #dailyManifest="{record}"><a-tooltip content="查看联单"><a-button v-if="findDailyManifest(record.date,record.merchantId)" type="text" class="report-upgrade" :aria-label="`查看${record.date}${record.name??merchantName(record.merchantId)}联单`" @click="dailySelected=findDailyManifest(record.date,record.merchantId)!"><template #icon><IconFile /></template></a-button><span v-else class="report-upgrade">待生成</span></a-tooltip></template><template #organization><span class="organization-name">{{reportOrganization}}</span></template><template #point="{ record }">{{ pointLabel(record) }}</template
        ><template #validity="{ record }"
          ><StatusTag :value="record.status" /></template
        ><template #action="{ record }"
          ><a-button type="text" @click="selectedEventId = record.id"
            >详情</a-button
          ></template
        ></a-table
      ><a-table
        v-else
        :data="printing ? grouped : grouped.slice((page - 1) * 10, page * 10)"
        :columns="columns"
        :pagination="false"
        :scroll="{ x: columns.length * 140 }"
        row-key="id"
        ><template #line="{record}"><span class="report-upgrade">{{collectionLines.find(l=>l.id===record.lineId)?.name??'未分配'}}</span></template>
        <template #weight="{record}">{{Number(record.kg).toFixed(2)}}</template>
        <template #merchantWeight="{record}">{{Number(record.kg).toFixed(2)}}</template>
        <template #dailyAverage="{record}"><a-tooltip content="行日期之前30个完整自然日有效重量÷30；历史不足30天不计算"><span class="report-upgrade">{{record.dailyAverageKg===null?'—':record.dailyAverageKg.toFixed(0)}}</span></a-tooltip></template>
        <template #dailyManifest="{record}"><a-tooltip content="查看联单"><a-button v-if="findDailyManifest(record.date,record.merchantId)" type="text" class="report-upgrade" :aria-label="`查看${record.date}${record.name??merchantName(record.merchantId)}联单`" @click="dailySelected=findDailyManifest(record.date,record.merchantId)!"><template #icon><IconFile /></template></a-button><span v-else class="report-upgrade">待生成</span></a-tooltip></template><template #organization><span class="organization-name">{{reportOrganization}}</span></template>
        <template #arrival>—（待接入）</template><template #departure>—（待接入）</template><template #duration>—（待接入）</template>
        <template #weighbridge="{ record }">
          <a-button v-if="record.comparison.items.length" type="text" class="report-upgrade" :aria-label="`查看${record.date} ${record.vehicle}地磅记录`" @click="selectedWeighbridgeId = record.id">{{ record.comparison.netKg === null ? '数据异常' : record.comparison.netKg.toFixed(2) }}</a-button><span v-else class="report-upgrade">未同步</span>
        </template><template #accuracy="{ record }"><span class="report-upgrade">{{ record.comparison.accuracy === null ? '—' : record.comparison.accuracy.toFixed(2) + '%' }}</span></template>
        <template #difference="{ record }"><span class="report-upgrade">{{ record.comparison.differenceKg ?? '—' }}</span></template>
        <template #comparisonStatus="{ record }"><span class="report-upgrade">{{ record.comparison.status }}{{ record.date === demo.date ? ' · 当日暂计' : '' }}</span></template>
        <template #merchant="{ record }">{{
          merchantName(record.merchantId)
        }}</template
        ><template #buckets="{ record }"
          ><a-button
            type="text"
            @click="
              selectedId = record.id;
              detailPage = 1;
            "
            >{{ record.buckets }}</a-button
          ></template
        ><template #planned="{ record }">{{
          record.planned === null ? "—" : record.planned
        }}</template
        ><template #rate="{ record }">{{
          record.rate === null
            ? record.planned === null
              ? "无计划快照"
              : "未排班"
            : record.rate + "%"
        }}</template
        ><template #action="{ record }"
          ><a-button
            type="text"
            @click="
              selectedId = record.id;
              detailPage = 1;
            "
             :class="{'report-upgrade':view==='商户报表'}">{{view==='商户报表'?'明细':'收运明细'}}</a-button
          ></template
        ></a-table
      >
      <div class="table-pagination">
        <span
          >{{ view === '车辆收运汇总' ? '历史无计划快照时留空；当日未完成不直接判定漏收。' : view === '收集点报表' ? '到达、离开及停留时长保留原有字段，模拟数据未接入，不按称重时间反推。' : '全部模拟数据；按当前查询范围显示与导出。' }}</span
        ><a-pagination
          v-model:current="page"
          :page-size="10"
          :total="view === '车辆收运明细' ? events.length : grouped.length"
          show-total
        />
      </div>
    </section>
    <a-drawer :visible="!!dailySelected" title="商户五联单" :width="'min(720px,96vw)'" :footer="false" @cancel="dailySelected=null">
      <template v-if="dailySelected"><a-button type="primary" :loading="downloading" @click="downloadDaily">下载PDF</a-button>
      <section class="manifest-copy"><ManifestSheet v-if="exampleSelected" :document="exampleSelected"/></section></template>
    </a-drawer>
    <a-drawer :visible="!!selectedWeighbridgeId" title="地磅完整信息（模拟）" :width="'min(820px,96vw)'" :footer="false" @cancel="selectedWeighbridgeId = ''">
      <template #title><span class="report-upgrade">地磅完整信息 · 新增</span></template>
      <template v-if="selectedWeighbridge">
        <a-tag color="red">新增：地磅原始记录与比对结果</a-tag>
        <div class="detail-hero">{{ selectedWeighbridge.date }} · {{ selectedWeighbridge.vehicle }} · {{ selectedWeighbridge.comparison.items.length }}次过磅</div>
        <a-descriptions :column="2" bordered>
          <a-descriptions-item label="收运重量">{{ selectedWeighbridge.kg.toFixed(2) }} kg</a-descriptions-item>
          <a-descriptions-item label="地磅净重合计">{{ selectedWeighbridge.comparison.netKg?.toFixed(2) ?? '异常' }} kg</a-descriptions-item>
          <a-descriptions-item label="准确率">{{ selectedWeighbridge.comparison.accuracy === null ? '—' : selectedWeighbridge.comparison.accuracy.toFixed(2) + '%' }}</a-descriptions-item>
          <a-descriptions-item label="差值">{{ selectedWeighbridge.comparison.differenceKg?.toFixed(2) ?? '—' }} kg</a-descriptions-item>
        </a-descriptions>
        <a-alert class="detail-action">同车同日多次过磅合并比对，以下为每条独立原始记录。净重为0不计算准确率；原始数据只读，不随模拟收运编辑改变。</a-alert>
        <section v-for="item in selectedWeighbridge.comparison.items" :key="item.id" class="detail-action">
          <a-descriptions :title="`称重流水：${item.weighingNo ?? '未提供'}`" :column="2" bordered>
            <a-descriptions-item><template #label><span class="report-upgrade">称重流水 · 新增</span></template><span class="report-upgrade">{{ item.weighingNo ?? '—（待接入）' }}</span></a-descriptions-item>
            <a-descriptions-item label="日期">{{ item.date }}</a-descriptions-item>
            <a-descriptions-item label="车牌号">{{ item.vehicle }}</a-descriptions-item>
            <a-descriptions-item label="皮重">{{ item.tareKg.toFixed(2) }} kg</a-descriptions-item>
            <a-descriptions-item label="毛重">{{ item.grossKg.toFixed(2) }} kg</a-descriptions-item>
            <a-descriptions-item label="净重（垃圾量）">{{ item.netKg.toFixed(2) }} kg</a-descriptions-item>
            <a-descriptions-item label="重量校验">皮重＋净重＝毛重</a-descriptions-item>
            <a-descriptions-item><template #label><span class="report-upgrade">皮重时间 · 新增</span></template><span class="report-upgrade">{{ item.tareAt ?? '—（待接入）' }}</span></a-descriptions-item>
            <a-descriptions-item><template #label><span class="report-upgrade">毛重时间 · 新增</span></template><span class="report-upgrade">{{ item.grossAt ?? '—（待接入）' }}</span></a-descriptions-item>
            <a-descriptions-item label="同步时间">{{ item.syncedAt }}</a-descriptions-item>
            <a-descriptions-item label="来源主机">{{ item.device }}</a-descriptions-item>
            <a-descriptions-item label="来源记录ID">{{ item.sourceId }}</a-descriptions-item>
            <a-descriptions-item label="平台记录ID">{{ item.id }}</a-descriptions-item>
          </a-descriptions>
        </section>
      </template>
    </a-drawer>
    <a-drawer
      :visible="!!selectedId"
      :title="`${selectedGroup?.name ?? ''} · ${view==='商户报表'?'日报明细':'逐桶明细'}`"
      :width="'min(1000px,96vw)'"
      :footer="false"
      @cancel="selectedId = ''"
      ><template v-if="selectedGroup"
        ><div class="detail-hero">
          {{ selectedGroup.date }} · {{ selectedGroup.kg.toFixed(2) }}kg /
          {{ selectedGroup.buckets }}桶
        </div>
        <a-descriptions v-if="view==='商户报表'" :column="2" bordered class="daily-detail-info">
          <a-descriptions-item><template #label><span class="report-upgrade">联系电话（移入详情）</span></template><span class="report-upgrade">{{selectedGroup.phone}}</span></a-descriptions-item>
          <a-descriptions-item><template #label><span class="report-upgrade">最近30天日均量</span></template><span class="report-upgrade">{{selectedGroup.dailyAverageKg===null?'历史不足30天':selectedGroup.dailyAverageKg.toFixed(0)+' kg'}}</span></a-descriptions-item>
          <a-descriptions-item label="收运车辆">{{[...new Set(selectedGroup.items.map(r=>r.vehicle))].join('、')}}</a-descriptions-item>
          <a-descriptions-item label="所属机构">{{currentOrganization.name}}</a-descriptions-item>
          <a-descriptions-item label="联系人">{{demo.merchants.find(m=>m.id===selectedGroup?.merchantId)?.contact}}</a-descriptions-item>
          <a-descriptions-item label="商户地址">{{demo.merchants.find(m=>m.id===selectedGroup?.merchantId)?.address}}</a-descriptions-item>
        </a-descriptions>
        <a-table
          :data="detailEvents.slice((detailPage - 1) * 10, detailPage * 10)"
          :columns="eventColumns"
          :pagination="false"
          :scroll="{ x: 1520 }"
          row-key="id"
          ><template #dailyManifest="{record}"><a-tooltip content="查看联单"><a-button v-if="findDailyManifest(record.date,record.merchantId)" type="text" class="report-upgrade" :aria-label="`查看${record.date}${record.name??merchantName(record.merchantId)}联单`" @click="dailySelected=findDailyManifest(record.date,record.merchantId)!"><template #icon><IconFile /></template></a-button><span v-else class="report-upgrade">待生成</span></a-tooltip></template><template #organization><span class="organization-name">{{reportOrganization}}</span></template><template #point="{ record }">{{ pointLabel(record) }}</template
          ><template #validity="{ record }"
            ><StatusTag :value="record.status" /></template
          ><template #action="{ record }"
            ><a-button type="text" @click="selectedEventId = record.id"
              >详情</a-button
            ></template
          ></a-table
        ><a-pagination
          v-model:current="detailPage"
          :total="detailEvents.length"
          :page-size="10"
          class="detail-action" /></template></a-drawer
    ><CollectionPointEditor v-model:visible="pointEditor" :point="editingPoint" :merchant-id="pointEvent?.merchantId" @saved="pointEvent && ((demo.collectionPointBindings ??= {})[pointEvent.id] = $event.id)"/><a-modal
      :visible="!!selectedEventId"
      title="采集事件详情（模拟）"
      :footer="false"
      :width="'min(580px,94vw)'"
      @cancel="selectedEventId = ''"
      ><template v-if="selectedEvent"
        ><a-descriptions :column="1" bordered
          ><a-descriptions-item label="事件编号">{{
            selectedEvent.id
          }}</a-descriptions-item
          ><a-descriptions-item label="收集时间">{{
            selectedEvent.collectedAt
          }}</a-descriptions-item
          ><a-descriptions-item label="车牌号">{{
            selectedEvent.vehicle
          }}</a-descriptions-item
          ><a-descriptions-item label="RFID编号">{{
            selectedEvent.rfid
          }}</a-descriptions-item
          ><a-descriptions-item label="收集点 / 商户">{{
            pointLabel(selectedEvent)
          }}</a-descriptions-item
          ><a-descriptions-item label="原始净重"
            >{{ selectedEvent.kg.toFixed(2) }} kg</a-descriptions-item
          ><a-descriptions-item label="统计状态">{{
            selectedEvent.status
          }}</a-descriptions-item
          ><a-descriptions-item label="核验说明">{{
            selectedEvent.reason || "演示有效事件"
          }}</a-descriptions-item></a-descriptions
        ><a-alert class="detail-action">{{
          selectedEvent.status === "待核验"
            ? "仅保留原始异常，不提供修改净重或自动认领商户，等待人工核验流程确认。"
            : "逐桶数据由模拟记录按分值拆分，重量合计严格一致；不是线上设备数据。"
        }}</a-alert></template
      ></a-modal
    >
  </div>
</template>

<style>
.report-upgrade { color: rgb(var(--danger-6)); font-weight: 600; }
</style>

<style scoped>.manifest-copy{background:white;color:#111;padding:10px;margin-top:12px;border:1px solid #ddd}.manifest-copy h2{text-align:center}</style>

<style scoped>.merchant-daily :deep(.module-header h2){color:rgb(var(--danger-6))}.daily-detail-info{margin-bottom:16px}</style>

<style scoped>
.report-summary { display:flex; flex-wrap:wrap; align-items:center; gap:8px 32px; padding:10px 16px; background:var(--color-bg-2); border-radius:4px; font-size:14px; }
.report-summary strong { margin:0 3px; font-size:16px; color:var(--color-text-1); }
</style>

<style scoped>.organization-name{white-space:nowrap}</style>

<style scoped>
.report-date-presets{white-space:nowrap}
</style>
