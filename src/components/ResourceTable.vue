<script setup lang="ts">
import { computed, h, onDeactivated, reactive, ref, watch } from "vue";
import { Drawer, Modal, Message } from "@arco-design/web-vue";
import { downloadCsv } from "../utils/csv";
export interface Field {
  key: string;
  label: string;
  upgrade?: boolean;
  clearOnChange?: string;
  type?: "number" | "boolean" | "select" | "multiple" | "date" | "textarea";
  options?: (string | number | { label: string; value: string | number })[];
  required?: boolean;
  min?: number;
  max?: number;
  readonly?: boolean;
  hidden?: boolean;
  formHidden?: boolean;
  width?: number;
  default?: unknown;
  when?: { key: string; value: string | string[] };
}
const props = defineProps<{
  title: string;
  rows: any[];
  fields: Field[];
  add?: boolean;
  editLabel?: string;
  editorDrawer?: boolean;
  secondaryFilter?: {
    key: string;
    label: string;
    options: { label: string; value: string }[];
  };
  validate?: (row: any) => string | undefined;
}>();
const emit = defineEmits<{ save: [row: any] }>();
const keyword = ref("");
const filter = ref("全部");
const secondary = ref("__all__");
const page = ref(1);
const visible = ref(false);
const detail = ref<any>(null);
const draft = reactive<any>({});
const filterField = computed(() =>
  props.fields.find(
    (f) => f.type === "select" && f.key !== props.secondaryFilter?.key,
  ),
);
const filtered = computed(() =>
  props.rows.filter(
    (r) =>
      (!keyword.value.trim() ||
        props.fields.some((f) =>
          String(r[f.key] ?? "")
            .toLowerCase()
            .includes(keyword.value.trim().toLowerCase()),
        )) &&
      (filter.value === "全部" ||
        !filterField.value ||
        r[filterField.value.key] === filter.value) &&
      (!props.secondaryFilter ||
        secondary.value === "__all__" ||
        (r[props.secondaryFilter.key] ?? "") === secondary.value),
  ),
);
const columns = computed(() => [
  ...props.fields
    .filter((f) => !f.hidden)
    .map((f) => ({
      title: f.upgrade ? () => h("span", { class: "upgrade-mark" }, `${f.label} · 新增`) : f.label,
      dataIndex: f.key,
      slotName: f.key,
      width: f.width ?? (f.type === "multiple" ? 180 : 150),
      ellipsis: true,
      tooltip: true,
    })),
  { title: "操作", slotName: "action", width: props.editLabel ? 180 : 130, fixed: "right" as const },
]);
watch([keyword, filter, secondary], () => (page.value = 1));
watch(
  () => filtered.value.length,
  (n) => (page.value = Math.min(page.value, Math.max(1, Math.ceil(n / 8)))),
);
function show(row?: any) {
  Object.keys(draft).forEach((k) => delete draft[k]);
  Object.assign(
    draft,
    row
      ? JSON.parse(JSON.stringify(row))
      : Object.fromEntries(
          props.fields.map((f) => [
            f.key,
            f.default ??
              (f.type === "boolean"
                ? true
                : f.type === "number"
                  ? 1
                  : f.type === "multiple"
                    ? []
                    : ""),
          ]),
        ),
  );
  if (!row)
    draft.id = `D${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
  visible.value = true;
}
const formFields = computed(() =>
  props.fields.filter((f) => {
    if (f.formHidden) return false;
    if (!f.when) return true;
    return Array.isArray(f.when.value)
      ? f.when.value.includes(draft[f.when.key])
      : draft[f.when.key] === f.when.value;
  }),
);
function save() {
  for (const f of formFields.value) {
    const v = draft[f.key];
    if (
      f.required &&
      (v === undefined ||
        v === null ||
        v === "" ||
        (typeof v === "string" && !v.trim()) ||
        (Array.isArray(v) && !v.length))
    )
      return Message.warning(`请填写${f.label}`);
    if (
      f.type === "number" &&
      (!Number.isFinite(v) || v < (f.min ?? 0) || v > (f.max ?? 1000000))
    )
      return Message.warning(`${f.label}超出有效范围`);
    if (f.type === "date" && v && !/^\d{4}-\d{2}-\d{2}$/.test(v))
      return Message.warning("日期格式应为 YYYY-MM-DD");
  }
  const error = props.validate?.(draft);
  if (error) return Message.warning(error);
  emit("save", JSON.parse(JSON.stringify(draft)));
  visible.value = false;
  Message.success("已保存模拟数据");
}
function display(row: any, f: Field) {
  const v = row[f.key];
  if (f.type === "boolean") return v ? "是" : "否";
  const label = (value: unknown) =>
    f.options?.find((o) => typeof o === "object" && o.value === value);
  const item = label(v);
  return Array.isArray(v)
    ? v
        .map((x) => {
          const o = label(x);
          return o && typeof o === "object" ? o.label : x;
        })
        .join("、") || "—"
    : item && typeof item === "object"
      ? item.label
      : (v ?? "—");
}
function exportRows() {
  downloadCsv(`${props.title}.csv`, [
    props.fields.map((f) => f.label),
    ...filtered.value.map((r) =>
      props.fields.map((f) => String(display(r, f))),
    ),
  ]);
}
onDeactivated(() => {
  visible.value = false;
  detail.value = null;
});
</script>
<template>
  <section class="panel resource-filters" aria-label="查询条件">
    <div class="filter-bar">
      <a-select
        v-if="secondaryFilter"
        v-model="secondary"
        :aria-label="secondaryFilter.label"
        :options="[
          { label: secondaryFilter.label, value: '__all__' },
          ...secondaryFilter.options,
        ]"
        class="filter-select"
        :class="{ 'upgrade-control': fields.some(f => f.key === secondaryFilter?.key && f.upgrade) }"
      />
      <a-input
        v-model="keyword"
        :aria-label="`搜索${title}`"
        :placeholder="`搜索${title}`"
        allow-clear
        class="search-input"
      /><a-select
        v-if="filterField"
        v-model="filter"
        :aria-label="`${title}分类筛选`"
        :options="[{label:`全部${filterField.label}`,value:'全部'}, ...(filterField.options ?? [])]"
        class="filter-select"
      /><a-button
        @click="
          keyword = '';
          filter = '全部';
          secondary = '__all__';
        "
        >重置</a-button
      >
    </div>
  </section>
  <section class="panel table-panel">
    <div class="panel-heading">
      <div>
        <h2>{{ title }}</h2>
        <p>共 {{ filtered.length }} 条 · 修改仅在当前浏览器生效</p>
      </div>
      <a-space
        ><a-button @click="exportRows">导出</a-button
        ><a-button v-if="add" type="primary" @click="show()"
          >新增</a-button
        ></a-space
      >
    </div>
    <a-table
      :data="filtered.slice((page - 1) * 8, page * 8)"
      :columns="columns"
      :pagination="false"
      :scroll="{ x: columns.reduce((sum, column) => sum + column.width, 0) }"
      row-key="id"
      stripe
    >
      <template
        v-for="f in fields.filter((f) => !f.hidden)"
        :key="f.key"
        #[f.key]="{ record }"
        ><span :class="{ 'upgrade-mark': f.upgrade }">{{
          f.type === "multiple"
            ? `${(record[f.key] ?? []).length} 项 · 查看详情`
            : display(record, f)
        }}</span></template
      >
      <template #action="{ record }"
        ><a-space
          ><a-button type="text" size="small" @click="detail = record"
            >查看</a-button
          ><a-button type="text" size="small" @click="show(record)"
            >{{ editLabel || "编辑" }}</a-button
          ></a-space
        ></template
      >
    </a-table>
    <div class="table-pagination">
      <span>每页 8 条</span
      ><a-pagination
        v-model:current="page"
        :total="filtered.length"
        :page-size="8"
        show-total
      />
    </div>
  </section>
  <a-drawer
    :visible="!!detail"
    :title="`${title}详情`"
    :width="'min(560px,96vw)'"
    :footer="false"
    @cancel="detail = null"
    ><a-descriptions v-if="detail" :column="1" bordered
      ><a-descriptions-item
        v-for="f in fields.filter(
          (f) =>
            !f.when ||
            (Array.isArray(f.when.value)
              ? f.when.value.includes(detail[f.when.key])
              : detail[f.when.key] === f.when.value),
        )"
        :key="f.key"
        :label="f.label"
        ><template #label><span :class="{ 'upgrade-mark': f.upgrade }">{{ f.label }}{{ f.upgrade ? ' · 新增' : '' }}</span></template><span :class="{ 'upgrade-mark': f.upgrade }">{{ display(detail, f) }}</span></a-descriptions-item
      ></a-descriptions
    ><slot v-if="detail" name="detail" :record="detail" /><a-button
      v-if="detail"
      class="detail-action"
      type="primary"
      @click="
        show(detail);
        detail = null;
      "
      >编辑信息</a-button
    ></a-drawer
  >
  <component
    :is="editorDrawer ? Drawer : Modal"
    v-model:visible="visible"
    :title="`${title} · 编辑信息`"
    :footer="false"
    :width="editorDrawer ? 'min(780px,96vw)' : 'min(620px,94vw)'"
    @cancel="visible = false"
  >
    <a-form layout="vertical" @submit="save"
      ><div class="form-grid">
        <a-form-item
          v-for="f in formFields"
          :key="f.key"
          :label="f.label"
          :required="f.required"
          :class="{ 'upgrade-control': f.upgrade }"
        >
          <template #label><span :class="{ 'upgrade-mark': f.upgrade }">{{ f.label }}{{ f.upgrade ? ' · 新增' : '' }}</span></template>
          <a-switch
            v-if="f.type === 'boolean'"
            v-model="draft[f.key]"
            :aria-label="f.label"
            :disabled="f.readonly"
          />
          <a-select
            v-else-if="f.type === 'select' || f.type === 'multiple'"
            v-model="draft[f.key]"
            :aria-label="f.label"
            :multiple="f.type === 'multiple'"
            @change="(value: unknown) => { if (f.clearOnChange && value) draft[f.clearOnChange] = ''; }"
            :options="f.options"
            :disabled="f.readonly"
            allow-search
          />
          <a-input-number
            v-else-if="f.type === 'number'"
            v-model="draft[f.key]"
            :aria-label="f.label"
            :min="f.min ?? 0"
            :max="f.max ?? 1000000"
            :precision="0"
            :disabled="f.readonly"
          />
          <a-date-picker
            v-else-if="f.type === 'date'"
            v-model="draft[f.key]"
            :aria-label="f.label"
            :disabled="f.readonly"
            style="width: 100%"
          />
          <a-textarea
            v-else-if="f.type === 'textarea'"
            v-model="draft[f.key]"
            :aria-label="f.label"
            :max-length="500"
            :disabled="f.readonly"
          />
          <a-input
            v-else
            v-model="draft[f.key]"
            :aria-label="f.label"
            :max-length="150"
            :disabled="f.readonly"
          />
        </a-form-item>
      </div>
      <slot name="form-extra" :draft="draft" />
      <a-alert>模拟编辑：保存后关联页面同步更新，取消不会修改数据。</a-alert>
      <div class="modal-actions">
        <a-button @click="visible = false">取消</a-button
        ><a-button type="primary" html-type="submit">保存</a-button>
      </div></a-form
    >
  </component>
</template>

<style>
.upgrade-mark { color: rgb(var(--danger-6)); font-weight: 600; }
.upgrade-control.arco-select-view,
.upgrade-control .arco-select-view { border: 1px solid rgb(var(--danger-6)); }
.upgrade-control.arco-select-view .arco-select-view-value,
.upgrade-control.arco-select-view .arco-select-view-placeholder,
.upgrade-control .arco-select-view .arco-select-view-value,
.upgrade-control .arco-select-view .arco-select-view-placeholder { color: rgb(var(--danger-6)); }
</style>

<style scoped>
.resource-filters .filter-bar {padding-bottom:0;}
</style>
