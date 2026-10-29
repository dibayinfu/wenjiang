<script setup lang="ts">
defineOptions({ name: "WenjiangOverview" });
import { computed } from "vue";
import { useRouter } from "vue-router";
import AppIcon from "../components/AppIcon.vue";
import PageHeader from "../components/PageHeader.vue";
import MetricGrid from "../components/MetricGrid.vue";
import StatusTag from "../components/StatusTag.vue";
import { demo, summary, merchantName } from "../mock/store";
import { streets } from "../mock/model";

const router = useRouter();
const metrics = computed(() => [
  {
    label: "今日收运量",
    value: (summary.value.totalKg / 1000).toFixed(2),
    unit: "吨",
    note: "已完成任务的实际称重合计",
    icon: "weight",
  },
  {
    label: "已服务商户",
    value: summary.value.servicedMerchants,
    unit: `/ ${summary.value.activeMerchants} 家`,
    note: "今日已完成收运的签约商户",
    icon: "shop",
    tone: "green",
  },
  {
    label: "任务完成率",
    value: summary.value.completionRate,
    unit: "%",
    note: `${summary.value.completed} 条已完成 / 共 ${summary.value.total} 条任务`,
    icon: "check",
    tone: "purple",
  },
  {
    label: "待收运任务",
    value: summary.value.pending,
    unit: "条",
    note: `另有 ${summary.value.running} 条任务正在收运`,
    icon: "clock",
    tone: "orange",
  },
]);
const distribution = computed(() =>
  streets.map((street) => {
    const merchantIds = demo.merchants
      .filter((m) => m.street === street)
      .map((m) => m.id);
    const tasks = demo.tasks.filter((t) => merchantIds.includes(t.merchantId));
    return {
      street,
      total: tasks.length,
      completed: tasks.filter((t) => t.status === "已完成").length,
      kg: tasks.reduce((sum, t) => sum + (t.actualKg ?? 0), 0),
    };
  }),
);
const trend = computed(() => {
  const baseDate = new Date(`${demo.date}T12:00:00+08:00`);
  return [
    ...[1.65, 1.92, 1.78, 2.14, 1.89, 2.3],
    summary.value.totalKg / 1000,
  ].map((value, i) => {
    const date = new Date(baseDate.getTime() - (6 - i) * 86400000);
    return {
      value,
      label: `${date.getUTCMonth() + 1}/${String(date.getUTCDate()).padStart(2, "0")}`,
      today: i === 6,
    };
  });
});
const chartMax = computed(() =>
  Math.max(3, Math.ceil(summary.value.totalKg / 1000)),
);
const pendingTasks = computed(() =>
  demo.tasks.filter((t) => t.status !== "已完成").slice(0, 4),
);
function openTasks(street?: string) {
  router.push({ path: "/tasks", query: street ? { street } : {} });
}
</script>

<template>
  <div class="gi_page page-content">
    <PageHeader
      title="运营总览"
      description="从商户到收运，让每一份餐厨垃圾去向清晰。"
      module="运营管理"
    >
      <a-button type="primary" @click="openTasks()"
        >查看收运作业<template #icon
          ><AppIcon name="truck" :size="17" /></template
      ></a-button>
    </PageHeader>
    <MetricGrid :items="metrics" />
    <div class="overview-grid">
      <section class="panel trend-panel">
        <div class="panel-heading">
          <div>
            <h2>收运量趋势</h2>
            <p>最近 7 日 · 单位：吨</p>
          </div>
          <span class="legend"><i class="blue-dot" />餐厨垃圾收运量</span>
        </div>
        <div
          class="bar-chart"
          role="img"
          :aria-label="`最近七日模拟收运量，今日 ${(summary.totalKg / 1000).toFixed(2)} 吨`"
        >
          <div class="chart-axis">
            <span>{{ chartMax.toFixed(1) }}</span
            ><span>{{ ((chartMax / 3) * 2).toFixed(1) }}</span
            ><span>{{ (chartMax / 3).toFixed(1) }}</span
            ><span>0</span>
          </div>
          <div class="chart-grid">
            <div class="chart-lines"><i /><i /><i /><i /></div>
            <div class="chart-bars">
              <div
                v-for="point in trend"
                :key="point.label"
                class="chart-column"
              >
                <div class="chart-bar-track">
                  <div
                    class="chart-bar"
                    :class="{ today: point.today }"
                    :style="{ height: `${(point.value / chartMax) * 100}%` }"
                  >
                    <span>{{ point.value.toFixed(2) }}</span>
                  </div>
                </div>
                <span
                  class="chart-label"
                  :class="{ 'today-label': point.today }"
                  >{{ point.today ? "今日" : point.label }}</span
                >
              </div>
            </div>
          </div>
        </div>
        <div class="panel-footnote">
          前 6 日为固定演示值，今日收运量随任务完成自动更新。
        </div>
      </section>
      <section class="panel status-panel">
        <div class="panel-heading">
          <div>
            <h2>作业进度</h2>
            <p>今日收运任务分布</p>
          </div>
          <AppIcon name="clock" :size="18" />
        </div>
        <div
          class="progress-ring"
          :style="{
            background: `conic-gradient(rgb(var(--primary-6)) 0 ${summary.completionRate}%, var(--color-fill-2) ${summary.completionRate}% 100%)`,
          }"
        >
          <div>
            <strong>{{ summary.completionRate }}<small>%</small></strong
            ><span>任务完成率</span>
          </div>
        </div>
        <div class="status-summary">
          <button @click="router.push('/tasks?status=已完成')">
            <i class="green-dot" /><span>已完成</span
            ><strong>{{ summary.completed }}</strong></button
          ><button @click="router.push('/tasks?status=收运中')">
            <i class="blue-dot" /><span>收运中</span
            ><strong>{{ summary.running }}</strong></button
          ><button @click="router.push('/tasks?status=待收运')">
            <i class="orange-dot" /><span>待收运</span
            ><strong>{{ summary.pending }}</strong>
          </button>
        </div>
      </section>
    </div>
    <div class="overview-grid lower-grid">
      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>区域收运概况</h2>
            <p>4 个街道 · 按实际完成任务汇总</p>
          </div>
          <span class="muted small-text">收运分布示意</span>
        </div>
        <div class="area-layout">
          <div class="schematic-map">
            <svg
              viewBox="0 0 420 270"
              role="img"
              aria-label="温江区域示意图，非真实地理地图"
            >
              <rect width="420" height="270" fill="#f3f6f8" />
              <path
                d="M-10 40 70 22 118 64 176 41 231 67 281 23 355 46 440 12V130l-50 22-62-19-43 35-57-13-63 32-79-20-57 30-39-15Z"
                fill="#e8f0e8"
              />
              <path
                d="m73-20 34 61-7 52 37 46-17 59 38 86M244-12l-28 64 34 57-17 48 31 48-9 83M-20 84l116 12 83-6 77 23 84-22 102 12M-10 211l92-32 68 16 96-13 82 24 116-21"
                fill="none"
                stroke="white"
                stroke-width="12"
              />
              <path
                d="M350-10c-72 57-21 106-61 146s-94 47-81 148"
                stroke="#cee4f5"
                stroke-width="19"
                fill="none"
              />
              <path
                d="m41 92 65 41 74-38 68 53 76 43"
                stroke="#83a9ff"
                stroke-width="3"
                stroke-dasharray="5 6"
                fill="none"
              />
              <text x="16" y="25" fill="#86909c" font-size="11">
                温江区 · 业务示意
              </text>
              <text x="263" y="250" fill="#86909c" font-size="10">
                非真实地理位置
              </text>
            </svg>
            <button
              v-for="(item, i) in distribution"
              :key="item.street"
              class="map-point"
              :style="{
                left: `${[19, 64, 38, 76][i]}%`,
                top: `${[39, 40, 72, 73][i]}%`,
              }"
              @click="openTasks(item.street)"
            >
              <AppIcon name="pin" :size="18" />{{ item.street }}
            </button>
          </div>
          <div class="area-stats">
            <button
              v-for="area in distribution"
              :key="area.street"
              class="area-row"
              @click="openTasks(area.street)"
            >
              <div>
                <strong>{{ area.street }}</strong
                ><span>{{ (area.kg / 1000).toFixed(2) }} 吨</span>
              </div>
              <a-progress
                :percent="area.total ? area.completed / area.total : 0"
                :show-text="false"
                :stroke-width="5"
              />
              <p>
                {{ area.completed }} / {{ area.total }} 条已完成<AppIcon
                  name="arrow"
                  :size="13"
                />
              </p>
            </button>
          </div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>待跟进收运</h2>
            <p>关注尚未完成的任务</p>
          </div>
          <button class="text-button" @click="openTasks()">
            全部<AppIcon name="arrow" :size="15" />
          </button>
        </div>
        <div v-if="pendingTasks.length" class="followup-list">
          <button
            v-for="task in pendingTasks"
            :key="task.id"
            class="followup-item"
            @click="
              router.push({ path: '/tasks', query: { keyword: task.id } })
            "
          >
            <div class="followup-icon"><AppIcon name="truck" :size="18" /></div>
            <div>
              <strong>{{ merchantName(task.merchantId) }}</strong>
              <p>{{ task.vehicle }} · {{ task.timeWindow }}</p>
            </div>
            <StatusTag :value="task.status" />
          </button>
        </div>
        <a-empty v-else description="今日收运已全部完成" />
        <div class="attention-note">
          <AppIcon
            name="info"
            :size="15"
          />此处展示未完成任务，不代表超时或异常。
        </div>
      </section>
    </div>
  </div>
</template>
